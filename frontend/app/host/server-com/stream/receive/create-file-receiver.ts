import log from "loglevel";

import { HMHostWriter, HostToServerMessage } from "../../message/writers";
import type { HostChunkRequest, UploadEnd, ReceiverReady, Error, FromFileReceiverMsg, UploadAck } from "./msgs";
import type { HomeNodeFrontendConfig } from "../../../../common/config";


export function createFileReceiverWorker(
    socket: WebSocket,
    config: HomeNodeFrontendConfig,
    onStreamerActivated: (streamId: number) => void
) {
    const streamerWorker = new Worker(new URL("./file-receiver.worker.ts", import.meta.url),
        { type: "module" });

    streamerWorker.onmessage = async (event: MessageEvent<FromFileReceiverMsg>) => {
        const msg = event.data;

        onStreamerActivated(msg.streamId);

        switch (msg.type) {
            case "ready":
                await handleWorkerReady(socket, msg as ReceiverReady, config);
                break;
            case "chunk":
                await handleHostChunkRequest(socket, msg as HostChunkRequest, config);
                break;
            case "ack":
                await handleUploadAck(socket, msg as UploadAck, config);
                break;
            case "eof":
                await handleUploadEnd(socket, msg as UploadEnd, config);
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
        log.error("Receiver emitted error:", err.message, err);
    };

    return streamerWorker;
}

async function handleWorkerReady(socket: WebSocket, msg: ReceiverReady, config: HomeNodeFrontendConfig) {
    log.debug(`Receiver #${msg.streamId} is ready`);
    const response = await HMHostWriter.write(
        msg.respondentId,
        HostToServerMessage.Types.UploadFileInitStreamResponse,
        config,
        {
            streamId: msg.streamId,
        }
    );
    socket.send(response);
}

async function handleUploadAck(socket: WebSocket, msg: UploadAck, config: HomeNodeFrontendConfig) {
    log.debug(`Receiver #${msg.streamId} saved chunk`);
    const response = await HMHostWriter.write(
        msg.respondentId,
        HostToServerMessage.Types.Ack,
        config
    );
    socket.send(response);
}

async function handleUploadEnd(socket: WebSocket, msg: UploadEnd, config: HomeNodeFrontendConfig) {
    log.debug(`Receiver #${msg.streamId} saved entire file`);
    const response = await HMHostWriter.write(
        msg.respondentId,
        HostToServerMessage.Types.UploadFileEndStreamRequest,
        config
    );
    socket.send(response);
}

async function handleHostChunkRequest(socket: WebSocket, msg: HostChunkRequest, config: HomeNodeFrontendConfig) {
    log.debug(`Receiver #${msg.streamId} requests chunk from offset ${msg.offset}`);
    const response = await HMHostWriter.write(
        msg.respondentId,
        HostToServerMessage.Types.UploadFileChunkRequest,
        config,
        {
            offset: msg.offset
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