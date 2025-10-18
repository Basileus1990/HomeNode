import log from "loglevel";

import { ServerToHostMessage } from "../message/readers";
import { createStreamWorker as createStreamWorker } from "./handle-stream-worker";
import type { WorkerRegistry } from "./stream-worker-registry";
import { HMHostWriter, HostToServerMessage } from "../message/writers";
import type { HomeNodeFrontendConfig } from "../../../common/config";
import { createHandle, findHandle, readHandle, removeHandle } from "../../../common/fs/api";
import { ErrorCodes } from "../../../common/error-codes";
import { HostExceptions } from "../../../common/exceptions";
import { createFileReceiverWorker } from "../stream/receive/create-file-receiver";


export class HostController {
    private _socket: WebSocket;
    private _config: HomeNodeFrontendConfig;
    private _streamWorkers: WorkerRegistry;
    private _postMessage: (message: any) => void;
    private _streamCounter = 0;
    private _connectionStatus: "connected" | "disconncted" = "disconncted";

    constructor(
        socket: WebSocket,
        config: HomeNodeFrontendConfig,
        streamWorkers: WorkerRegistry,
        postMessage: (message: any) => void
    ) {
        this._socket = socket;
        this._config = config;
        this._streamWorkers = streamWorkers;
        this._postMessage = postMessage;
    }

    public getCurrentStreamId(): number {
        return this._streamCounter;
    }

    public async dispatch(respondentId: number, typeNo: number, payload: ServerToHostMessage.Contents) {
        switch (typeNo) {
            case ServerToHostMessage.Types.ServerError:
                this.handleServerError(payload as ServerToHostMessage.ServerError);
                break;
            case ServerToHostMessage.Types.ServerACK:
                log.debug("Host received ACK from server");
                break;
            case ServerToHostMessage.Types.InitWithUuidQuery:
                await this.handleInitWithUuidQuery(payload as ServerToHostMessage.NewHostIdGrant, respondentId);
                break;
            case ServerToHostMessage.Types.MetadataQuery:
                await this.handleMetadataQuery(payload as ServerToHostMessage.ReadMetadata, respondentId);
                break;
            case ServerToHostMessage.Types.DownloadInitRequest:
                await this.handleDownloadInitRequest(payload as ServerToHostMessage.StartStream, respondentId);
                break;
            case ServerToHostMessage.Types.ChunkRequest:
                this.handleChunkRequest(payload as ServerToHostMessage.ChunkRequest, respondentId);
                break;
            case ServerToHostMessage.Types.DownloadCompletionRequest:
                await this.handleDownloadCompletionRequest(payload as ServerToHostMessage.DownloadCompletion, respondentId);
                break;
            case ServerToHostMessage.Types.InitWithExistingHost:
                this.handleInitWithExistingHost(respondentId);
                break;
            case ServerToHostMessage.Types.CreateDirectoryRequest:
                await this.handleCreateDirectoryRequest(payload as ServerToHostMessage.CreateDirectory, respondentId);
                break;
            case ServerToHostMessage.Types.DeleteResourceRequest:
                await this.handleDeleteResourceRequest(payload as ServerToHostMessage.RemoveResource, respondentId);
                break;
            case ServerToHostMessage.Types.CreateFileInitRequest:
                await this.handleCreateFileInitRequest(payload as ServerToHostMessage.CreateFile, respondentId);
                break;
            case ServerToHostMessage.Types.CreateFileHostChunkRequest:
                this.handleCreateFileHostChunkRequest(payload as ServerToHostMessage.CreateFileHostChunk, respondentId);
                break;
            case ServerToHostMessage.Types.UploadChunkResponse:
                this.handleUploadChunk(payload as ServerToHostMessage.UploadChunk, respondentId);
                break;
            default:
                log.trace("Host received unknown message type:", typeNo, "with payload:", payload);
                log.warn("Host received message of unknown type");
        }
    }


    /**
     * Handlers
     */

    private async handleServerError(payload: ServerToHostMessage.ServerError) {
        const errorType = payload.errorType;
        log.warn("Host received error of type:", errorType, "from server");
    }

    private async handleDownloadInitRequest(payload: ServerToHostMessage.StartStream, respondentId: number) {
        const resourcePath = payload.path;

        try {
            log.debug("Host received download request for resource:", resourcePath);
            await findHandle(resourcePath);

            const streamId = this._streamCounter++;
            const newWorker = createStreamWorker(this._socket, this._config, (id) => this.setWorkerLastActiveNow(id));
            this._streamWorkers.set(streamId, { worker: newWorker, lastActive: Date.now() });
            newWorker.postMessage({
                type: "prepare",
                resourcePath,
                chunkSize: this._config.batch_size,
                streamId,
                respondentId
            });
            log.debug("Host started preparing for streaming resource:", resourcePath);
            log.info("created worker");
        } catch (e) {
            const handled = await this.handleCommonErrors(e, respondentId);
            if (!handled) {
                await this.sendError(respondentId, ErrorCodes.UnknownError);
            }
        }
    }

    private handleChunkRequest(payload: ServerToHostMessage.ChunkRequest, respondentId: number) {
        const streamId = payload.streamId;
        const offset = payload.offset;
        const entry = this._streamWorkers.get(streamId);
        log.info("queried for chunk from ", streamId, entry);

        if (!entry) {
            this.sendError(respondentId, 400, "unknown respondentId");
            return;
        }

        entry.worker.postMessage({
            type: "next",
            respondentId,
            offset
        });
        log.info("requested chunk from streamer");
    }

    private async handleDownloadCompletionRequest(payload: ServerToHostMessage.DownloadCompletion, respondentId: number) {
        const streamId = payload.streamId;
        const entry = this._streamWorkers.get(streamId);
        log.info("queried for chunk from ", streamId, entry);

        if (!entry) {
            this.sendError(respondentId, 400, "unknown respondentId");
            return;
        }

        log.info("stream finished for streamer", streamId, "terminating");
        entry.worker.terminate();
        this._streamWorkers.delete(streamId);

        await this.sendHostAck(respondentId);
    }

    private async handleInitWithUuidQuery(payload: ServerToHostMessage.NewHostIdGrant, respondentId: number) {
        if (this._connectionStatus === "connected") {
            log.warn("Host already connected, ignoring another new HostId grant");
            return;
        }

        const hostId = payload.hostId;
        const hostKey = payload.hostKey;


        this._postMessage({
            type: "hostId",
            hostId,
            hostKey
        });

        await this.sendHostAck(respondentId);
        this._connectionStatus = "connected";
    }

    private async handleMetadataQuery(payload: ServerToHostMessage.ReadMetadata,respondentId: number) {
        try {
            const resourcePath = payload.path;
            const handle = await findHandle(resourcePath);

            const metadata = await readHandle(handle, resourcePath);
            await this.sendMetadataResponse(respondentId, metadata);
            log.debug(`Metadata for ${resourcePath} sent`);
        } catch (e) {
            const handled = await this.handleCommonErrors(e, respondentId);
            if (!handled) {
                await this.sendError(respondentId, ErrorCodes.UnknownError);
            }
        }
    }

    private async handleInitWithExistingHost(respondentId: number) {
        if (this._connectionStatus === "connected") {
            log.warn("Host already connected, ignoring another reconnect message");
            return;
        }

        log.debug("Host reconnected");
        await this.sendHostAck(respondentId);
        this._connectionStatus = "connected";
    }

    private async handleCreateDirectoryRequest(payload: ServerToHostMessage.CreateDirectory, respondentId: number) {
        const path = payload.path;
        log.debug("Host received create folder request for path:", path);
        console.log("Host received create folder request for path:", path);
        try {
            await createHandle(path, true, true);
            await this.sendHostAck(respondentId);
        } catch (e) {
            console.log(e);
            const handled = await this.handleCommonErrors(e, respondentId);
            if (!handled) {
                await this.sendError(respondentId, ErrorCodes.UnknownError);
            }
        }
    }

    private async handleDeleteResourceRequest(payload: ServerToHostMessage.RemoveResource, respondentId: number) {
        const path = payload.path;
        log.debug("Host received delete file request for path:", path);
        try {
            await removeHandle(path);
            await this.sendHostAck(respondentId);
        } catch (e) {
            const handled = await this.handleCommonErrors(e, respondentId);
            if (!handled) {
                await this.sendError(respondentId, ErrorCodes.UnknownError);
            }
        }
    }

    private async handleCreateFileInitRequest(payload: ServerToHostMessage.CreateFile,respondentId: number) {
        const filePath = payload.path;
        const fileSize = payload.fileSize;

        try {
            log.debug("Host received upload request for file:", filePath);
            await createHandle(filePath, false, true);

            const streamId = this._streamCounter++;
            const worker = createFileReceiverWorker(this._socket, this._config, (id) => this.setWorkerLastActiveNow(id));
            this._streamWorkers.set(streamId, { worker, lastActive: Date.now() });
            worker.postMessage({
                type: "prepare",
                resourcePath: filePath,
                fileSize,
                chunkSize: this._config.batch_size,
                streamId,
                respondentId
            });
            log.debug("Host started preparing for receiving file:", filePath);
            log.info("created worker");
        } catch (e) {
            const handled = await this.handleCommonErrors(e, respondentId);
            if (!handled) {
                await this.sendError(respondentId, ErrorCodes.UnknownError);
            }
        }
    }

    private handleCreateFileHostChunkRequest(payload: ServerToHostMessage.CreateFileHostChunk, respondentId: number) {
        const streamId = payload.streamId;
        const entry = this._streamWorkers.get(streamId);
        log.info("Prompting receiver: ", streamId, entry);

        if (!entry) {
            this.sendError(respondentId, 400, "unknown respondentId");
            return;
        }

        entry.worker.postMessage({
            type: "next",
            respondentId
        });
        log.info("Prompted receiver for chunk request");
    }

    private handleUploadChunk(payload: ServerToHostMessage.UploadChunk, respondentId: number) {
        const streamId = payload.streamId;
        const entry = this._streamWorkers.get(streamId);
        log.info("Transfering chunk to receiver: ", streamId, entry);

        if (!entry) {
            this.sendError(respondentId, 400, "unknown respondentId");
            return;
        }

        entry.worker.postMessage({
            type: "data",
            respondentId,
            chunk: payload.chunk
        });
        log.info("Transferred chunk to receiver");
    }


    /**
     * Senders
     */

    private async sendHostAck(respondentId: number) {
        const response = await HMHostWriter.write(
            respondentId,
            HostToServerMessage.Types.HostACK,
            this._config
        );
        this._socket.send(response);
    }

    private async sendMetadataResponse(respondentId: number, metadata: any) {
        const response = await HMHostWriter.write(
            respondentId,
            HostToServerMessage.Types.MetadataResponse,
            this._config,
            { item: metadata }
        );
        this._socket.send(response);
    }

    private async sendError(respondentId: number, errorType: number, message?: string) {
        const response = await HMHostWriter.write(
            respondentId,
            HostToServerMessage.Types.HostError,
            this._config,
            {
                errorType,
                errorInfo: { message }
            }
        );
        this._socket.send(response);
    }


    /**
     * Helpers
     */

    private setWorkerLastActiveNow(streamId: number) {
        const entry = this._streamWorkers.get(streamId);
        if (entry) {
            entry.lastActive = Date.now();
        }
    }

    private async handleCommonErrors(e: unknown, respondentId: number) {
        if (e instanceof TypeError) {
            await this.sendError(respondentId, ErrorCodes.InvalidPath);
            return true;
        } else if (e instanceof DOMException) {
            if (e.name === HostExceptions.DOMNotAllowedError) {
                await this.sendError(respondentId, ErrorCodes.OperationNotAllowed);
                return true;
            } else if (e.name === HostExceptions.DOMNotFoundError) {
                await this.sendError(respondentId, ErrorCodes.ResourceNotFound);
                return true;
            }
        }
        return false;
    }
}