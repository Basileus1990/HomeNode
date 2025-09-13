import log from "loglevel";

import { HMHostWriter, HostToServerMessage } from "../message/writers";
import type { ChunkReadyMessage, EofReachedMessage, StreamerReadyMessage, StreamWorkerToCoordinator, StreamWorkerErrorMessage } from "../types";
import type { HomeNodeFrontendConfig } from "../../../config";


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
        }
    };

    return streamerWorker;
}

async function handleStreamReady(socket: WebSocket, msg: StreamerReadyMessage, config: HomeNodeFrontendConfig) {
    log.debug(`StreamWorker #${msg.streamId} is ready`);
    const response = await HMHostWriter.write(
        msg.respondentId,
        HostToServerMessage.Types.DownloadInitResponse,
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
        HostToServerMessage.Types.EOFResponse,
        config
    );
    socket.send(response);
}

async function handleChunk(socket: WebSocket, msg: ChunkReadyMessage, config: HomeNodeFrontendConfig) {
    log.debug(`StreamWorker #${msg.streamId} emitted chunk`);
    const response = await HMHostWriter.write(
        msg.respondentId,
        HostToServerMessage.Types.ChunkResponse,
        config,
        {
            chunk: msg.chunk,
            encryption: msg.encryption
        }
    );
    socket.send(response);
}