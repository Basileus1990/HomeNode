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
            case ServerToHostMessage.Types.Error:
                this.handleServerError(payload as ServerToHostMessage.Error);
                break;
            case ServerToHostMessage.Types.Ack:
                log.debug("Host received ACK from server");
                break;
            case ServerToHostMessage.Types.InitWithUuidQuery:
                await this.handleInitWithUuidQuery(payload as ServerToHostMessage.NewHostIdGrant, respondentId);
                break;
            case ServerToHostMessage.Types.MetadataRequest:
                await this.handleMetadataRequest(payload as ServerToHostMessage.Metadata, respondentId);
                break;
            case ServerToHostMessage.Types.DownloadFileInitStreamRequest:
                await this.handleDownloadFileInitStreamRequest(payload as ServerToHostMessage.DownloadFileInitStream, respondentId);
                break;
            case ServerToHostMessage.Types.DownloadFileChunkRequest:
                this.handleDownloadFileChunkRequest(payload as ServerToHostMessage.DownloadFileChunkRequest, respondentId);
                break;
            case ServerToHostMessage.Types.DownloadFileEndStreamRequest:
                await this.handleDownloadFileEndStreamRequest(payload as ServerToHostMessage.DownloadFileEndStream, respondentId);
                break;
            case ServerToHostMessage.Types.InitWithExistingHost:
                this.handleInitWithExistingHost(respondentId);
                break;
            case ServerToHostMessage.Types.CreateDirectoryRequest:
                await this.handleCreateDirectoryRequest(payload as ServerToHostMessage.CreateDirectory, respondentId);
                break;
            case ServerToHostMessage.Types.DeleteResourceRequest:
                await this.handleDeleteResourceRequest(payload as ServerToHostMessage.Delete, respondentId);
                break;
            case ServerToHostMessage.Types.UploadFileInitStreamRequest:
                await this.handleUploadFileInitStreamRequest(payload as ServerToHostMessage.UploadFileInitStream, respondentId);
                break;
            case ServerToHostMessage.Types.UploadFileChunkPrompt:
                this.handleUploadFileChunkPrompt(payload as ServerToHostMessage.UploadFileChunkPrompt, respondentId);
                break;
            case ServerToHostMessage.Types.UploadFileChunkResponse:
                this.handleUploadFileChunkResponse(payload as ServerToHostMessage.UploadFileChunk, respondentId);
                break;
            default:
                log.trace("Host received unknown message type:", typeNo, "with payload:", payload);
                log.warn("Host received message of unknown type");
        }
    }


    /**
     * Handlers
     */

    private async handleServerError(payload: ServerToHostMessage.Error) {
        const errorType = payload.errorType;
        log.warn("Host received error of type:", errorType, "from server");
    }

    private async handleDownloadFileInitStreamRequest(payload: ServerToHostMessage.DownloadFileInitStream, respondentId: number) {
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
                chunkSize: this._config.chunk_size,
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

    private handleDownloadFileChunkRequest(payload: ServerToHostMessage.DownloadFileChunkRequest, respondentId: number) {
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

    private async handleDownloadFileEndStreamRequest(payload: ServerToHostMessage.DownloadFileEndStream, respondentId: number) {
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

    private async handleMetadataRequest(payload: ServerToHostMessage.Metadata,respondentId: number) {
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

    private async handleDeleteResourceRequest(payload: ServerToHostMessage.Delete, respondentId: number) {
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

    private async handleUploadFileInitStreamRequest(payload: ServerToHostMessage.UploadFileInitStream,respondentId: number) {
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
                chunkSize: this._config.chunk_size,
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

    private handleUploadFileChunkPrompt(payload: ServerToHostMessage.UploadFileChunkPrompt, respondentId: number) {
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

    private handleUploadFileChunkResponse(payload: ServerToHostMessage.UploadFileChunk, respondentId: number) {
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
            HostToServerMessage.Types.Ack,
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
            HostToServerMessage.Types.Error,
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