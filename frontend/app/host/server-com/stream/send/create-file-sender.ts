import log from "loglevel";

import { HMHostWriter, HostToServerMessage } from "../../message/writers";
import type { ChunkReady, EofReached, WorkerReady, Error, FromFileSenderMsg } from "./msgs";
import type { HomeNodeFrontendConfig } from "../../../../common/config";


export function createFileSenderWorker(
    socket: WebSocket,
    config: HomeNodeFrontendConfig,
    onStreamerActivated: (streamId: number) => void
) {
    const streamerWorker = new Worker(new URL("../stream/stream.worker.ts", import.meta.url),
        { type: "module" });

    streamerWorker.onmessage = async (event: MessageEvent<FromFileSenderMsg>) => {
        const msg = event.data;

        onStreamerActivated(msg.streamId);

        switch (msg.type) {
            case "ready":
                await handleWorkerReady(socket, msg as WorkerReady, config);
                break;
            case "chunk":
                await handleChunkReady(socket, msg as ChunkReady, config);
                break;
            case "eof":
                await handleEofReached(socket, msg as EofReached, config);
                break;
            case "error":
                await handleError(socket, msg as Error, config);
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

async function handleWorkerReady(socket: WebSocket, msg: WorkerReady, config: HomeNodeFrontendConfig) {
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

async function handleEofReached(socket: WebSocket, msg: EofReached, config: HomeNodeFrontendConfig) {
    log.debug(`StreamWorker #${msg.streamId} emitted EOF`);
    const response = await HMHostWriter.write(
        msg.respondentId,
        HostToServerMessage.Types.DownloadFileEofResponse,
        config
    );
    socket.send(response);
}

async function handleChunkReady(socket: WebSocket, msg: ChunkReady, config: HomeNodeFrontendConfig) {
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

async function handleError(socket: WebSocket, msg: Error, config: HomeNodeFrontendConfig) {
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