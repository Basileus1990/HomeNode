import log from "loglevel";

import { HMHostWriter, HostToServerMessage } from "../message/writers";
import type { ChunkReadyMessage, EofReachedMessage, StreamerReadyMessage, StreamWorkerToCoordinator, StreamWorkerErrorMessage } from "../types";
import type { HomeNodeFrontendConfig } from "../../../common/config";


export function createStreamWorker(
    socket: WebSocket,
    config: HomeNodeFrontendConfig,
    onStreamerActivated: (streamId: number) => void
) {
    const streamerWorker = new Worker(new URL("../stream/stream.worker.ts", import.meta.url),
        { type: "module" });

    streamerWorker.onmessage = async (event: MessageEvent<StreamWorkerToCoordinator>) => {
        const msg = event.data;

        onStreamerActivated(msg.streamId);

        switch (msg.type) {
            case "ready":
                await handleStreamReady(socket, msg, config);
                break;
            case "chunk":
                await handleChunk(socket, msg, config);
                break;
            case "eof":
                await handleEof(socket, msg, config);
                break;
            case "error":
                await handleError(socket, msg as StreamWorkerErrorMessage, config);
                break;
            default:
                log.trace("Host received unknown message from StreamWorker:", msg);
                log.warn("Host received message from StreamWorker it couldn't handle");
        }
    };

    streamerWorker.onerror = (err) => {
        log.error("StreamWorker emitted error:", err.message, err);
    };

    return streamerWorker;
}

async function handleStreamReady(socket: WebSocket, msg: StreamerReadyMessage, config: HomeNodeFrontendConfig) {
    log.debug(`StreamWorker #${msg.streamId} is ready`);
    const response = await HMHostWriter.write(
        msg.respondentId,
        HostToServerMessage.Types.DownloadFileInitStreamResponse,
        config,
        {
            streamId: msg.streamId,
            chunkSize: msg.chunkSize,
            sizeInChunks: msg.sizeInChunks,
            encryption: msg.encryption
        }
    );
    socket.send(response);
}

async function handleEof(socket: WebSocket, msg: EofReachedMessage, config: HomeNodeFrontendConfig) {
    log.debug(`StreamWorker #${msg.streamId} emitted EOF`);
    const response = await HMHostWriter.write(
        msg.respondentId,
        HostToServerMessage.Types.DownloadFileEofResponse,
        config
    );
    socket.send(response);
}

async function handleChunk(socket: WebSocket, msg: ChunkReadyMessage, config: HomeNodeFrontendConfig) {
    log.debug(`StreamWorker #${msg.streamId} emitted chunk`);
    const response = await HMHostWriter.write(
        msg.respondentId,
        HostToServerMessage.Types.DownloadFileChunkResponse,
        config,
        {
            chunk: msg.chunk,
            encryption: msg.encryption
        }
    );
    socket.send(response);
}

async function handleError(socket: WebSocket, msg: StreamWorkerErrorMessage, config: HomeNodeFrontendConfig) {
    log.error(`StreamWorker #${msg.streamId} emitted error: ${msg.message}`);
    const response = await HMHostWriter.write(
        msg.streamId,
        HostToServerMessage.Types.Error,
        config,
        {
            errorType: msg.errorType,
            errorInfo: { message: msg.message }
        }
    );
    socket.send(response);
}