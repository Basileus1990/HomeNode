import log from "loglevel";

import { findRecordByName, readRecordIntoItem } from "../../../common/fs/service";
import { ServerToHostMessage } from '../message/readers';
import { createStreamWorker as createStreamWorker } from './handle-stream-worker';
import type { StreamWorkerRegistry } from "./stream-worker-registry";
import { HMHostWriter, HostToServerMessage } from "../message/writers";

export class HostController {
    private _socket: WebSocket;
    private _streamWorkers: StreamWorkerRegistry;
    private _postMessage: (message: any) => void;
    private _streamCounter = 0;

    constructor(
        socket: WebSocket,
        streamWorkers: StreamWorkerRegistry,
        postMessage: (message: any) => void
    ) {
        this._socket = socket;
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
                log.debug('Host received ACK from server');
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
                this.handleDownloadCompletionRequest(payload as ServerToHostMessage.DownloadCompletion, respondentId);
                break;
            default:
                log.trace('Host received unknown message type:', typeNo, 'with payload:', payload);
                log.warn('Host received message of unknown type');
        }
    }

    private async handleServerError(payload: ServerToHostMessage.ServerError) {
        const errorType = payload.errorType;
        log.warn('Host received error of type:', errorType, 'from server');
    }

    private async handleDownloadInitRequest(
        payload: ServerToHostMessage.StartStream,
        respondentId: number
    ) {
        const resourceId = payload.resourceId;
        const chunkSize = payload.chunkSize;
        const record = await findRecordByName(resourceId, undefined, true);
        log.debug('Host received download request for resource:', resourceId);

        if (!record) {
            log.debug('Host couldn\'t find resource:', resourceId);
            await this.sendError(respondentId, 400, "resource not found");
            return;
        }

        const newStreamId = this._streamCounter++;
        const newWorker = createStreamWorker(this._socket, (id) => this.setStreamerWorkerLastActiveNow(id));
        this._streamWorkers.set(newStreamId, { worker: newWorker, lastActive: Date.now() });
        newWorker.postMessage({
            type: 'prepare',
            resourceId,
            chunkSize,
            streamId: newStreamId,
            respondentId
        });
        log.debug('Host started preparing for streaming resource:', resourceId);
        log.info('created worker');
    }

    private handleChunkRequest(
        payload: ServerToHostMessage.ChunkRequest,
        respondentId: number
    ) {
        const streamId = payload.streamId;
        const entry = this._streamWorkers.get(streamId);
        log.info('queried for chunk from ', streamId, entry);

        if (!entry) {
            this.sendError(respondentId, 400, "unknown respondentId");
            return;
        }

        entry.worker.postMessage({
            type: 'next',
            respondentId
        });
        log.info('requested chunk from streamer');
    }

    private handleDownloadCompletionRequest(
        payload: ServerToHostMessage.DownloadCompletion,
        respondentId: number
    ) {
        const streamId = payload.streamId;
        const entry = this._streamWorkers.get(streamId);
        log.info('queried for chunk from ', streamId, entry);

        if (!entry) {
            this.sendError(respondentId, 400, "unknown respondentId");
            return;
        }

        log.info('stream finished for streamer', streamId, 'terminating');
        entry.worker.terminate();
        this._streamWorkers.delete(streamId);
    }

    private async handleInitWithUuidQuery(
        payload: ServerToHostMessage.NewHostIdGrant,
        respondentId: number
    ) {
        const hostId = payload.hostId;

        this._postMessage({
            type: "hostId",
            hostId
        });

        await this.sendHostAck(respondentId);
    }

    private async handleMetadataQuery(
        payload: ServerToHostMessage.ReadMetadata,
        respondentId: number
    ) {
        const resourceId = payload.resourceId;
        const record = await findRecordByName(resourceId, undefined, true);
        log.info('received metadata request for', resourceId);

        if (!record) {
            await this.sendError(respondentId, 400, "resource not found");
            return;
        }

        const metadata = await readRecordIntoItem(record);
        await this.sendMetadataResponse(respondentId, metadata);
        log.info('sent', metadata);
    }

    private async sendHostAck(respondentId: number) {
        const response = await HMHostWriter.write(
            respondentId,
            HostToServerMessage.Types.HostACK
        );
        this._socket.send(response);
    }

    private async sendMetadataResponse(respondentId: number, metadata: any) {
        const response = await HMHostWriter.write(
            respondentId,
            HostToServerMessage.Types.MetadataResponse,
            { record: metadata }
        );
        this._socket.send(response);
    }

    private async sendError(respondentId: number, errorType: number, message?: string) {
        const response = await HMHostWriter.write(
            respondentId,
            HostToServerMessage.Types.HostError,
            {
                errorType,
                errorInfo: { message }
            }
        );
        this._socket.send(response);
    }

    private setStreamerWorkerLastActiveNow(streamId: number) {
        const entry = this._streamWorkers.get(streamId);
        if (entry) {
            entry.lastActive = Date.now();
        }
    }
}