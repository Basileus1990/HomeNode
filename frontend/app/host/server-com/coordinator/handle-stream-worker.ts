import log from "loglevel";

import { HMHostWriter, HostToServerMessage } from "../message/writers";
import type { ChunkReadyMessage, EofReachedMessage, StreamerReadyMessage, StreamWorkerToCoordinator, StreamWorkerErrorMessage } from "../types";


export function createStreamWorker(
    socket: WebSocket,
    onStreamerActivated: (streamId: number) => void
) {
    const streamerWorker = new Worker(new URL("../stream/stream.worker.ts", import.meta.url),
        { type: "module" });

    streamerWorker.onmessage = async (event: MessageEvent<StreamWorkerToCoordinator>) => {
        const msg = event.data;

        onStreamerActivated(msg.streamId);

        switch (msg.type) {
            case "ready":
                await handleStreamReady(socket, msg);
                break;
            case "chunk":
                await handleChunk(socket, msg);
                break;
            case "eof":
                await handleEof(socket, msg);
                break;
        }
    };

    return streamerWorker;
}

async function handleStreamReady(socket: WebSocket, msg: StreamerReadyMessage) {
    log.debug(`StreamWorker #${msg.streamId} is ready`);
    const response = await HMHostWriter.write(
        msg.respondentId,
        HostToServerMessage.Types.DownloadInitResponse,
        {
            streamId: msg.streamId,
            chunkSize: msg.chunkSize,
            sizeInChunks: msg.sizeInChunks,
            encryption: msg.encryption
        }
    );
    socket.send(response);
}

async function handleEof(socket: WebSocket, msg: EofReachedMessage) {
    log.debug(`StreamWorker #${msg.streamId} emitted EOF`);
    const response = await HMHostWriter.write(
        msg.respondentId,
        HostToServerMessage.Types.EOFResponse
    );
    socket.send(response);
}

async function handleChunk(socket: WebSocket, msg: ChunkReadyMessage) {
    log.debug(`StreamWorker #${msg.streamId} emitted chunk`);
    const response = await HMHostWriter.write(
        msg.respondentId,
        HostToServerMessage.Types.ChunkResponse,
        {
            chunk: msg.chunk,
            encryption: msg.encryption
        }
    );
    socket.send(response);
}

async function handleError(msg: StreamWorkerErrorMessage) {
    log.warn
}