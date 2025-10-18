import log from "loglevel";

import type { EncryptionData } from "../../../../common/crypto";
import type { ToFileSenderMsg } from "./msgs";
import { RecordChunker } from "../chunker";
import { findHandle, getSize } from "../../../../common/fs/api";
import { ErrorCodes } from "../../../../common/error-codes";


let streamId: number;     // id of this specific download stream
let chunker: RecordChunker;
let chunkSize: number;
let encryption: EncryptionData | undefined;
let handle: FileSystemHandle | null;


self.onmessage = async (e: MessageEvent<ToFileSenderMsg>) => {
    const msg = e.data;
    const respondentId = msg.respondentId;
    console.log("streamer got msg");

    // prepare for streaming
    switch (msg.type) {
        case "prepare": {
            streamId = msg.streamId;

            // coordinator is responsible for checking whether the handle exists before initiating the worker
            // so if we're here  it means it's safe to access
            handle = await findHandle(msg.resourcePath);

            chunkSize = msg.chunkSize;
            chunker = await RecordChunker.createChunker(handle, chunkSize);
            const size = await getSize(handle);
            // const recordMetadata = await record.getMetadata();
            // encryption = recordMetadata.encryptionData;

            self.postMessage(buildWorkerReadyMsg(respondentId, size));
            log.debug(`StreamWorker #${streamId} is ready`);
            break;
        }
        case "next": {
            log.debug(`StreamWorker #${streamId} received request for next chunk`);
            const chunk = await chunker.next(msg.offset);

            if (!chunk) {       // EOF reached, no chunks to send
                self.postMessage(buildEofReachedMsg(respondentId))
            } else {
                self.postMessage(buildChunkReadyMsg(respondentId, chunk));
            }
            break;
        }
        default: {
            log.trace("Host received unknown message it couldn't handle:", msg);
            log.warn("Host received message it couldn't handle");
        }
    }
};

function buildChunkReadyMsg(respondentId: number, chunk: ArrayBuffer | null): any {
    return {
        type: "chunk",
        respondentId,
        chunk,
        encryption,
        streamId
    };
}

function buildEofReachedMsg(respondentId: number): any {
    return {
        type: "eof",
        respondentId,
        streamId,
    };
}

function buildWorkerReadyMsg(respondentId: number, size: number): any {
    return {
        type: "ready",
        streamId: streamId,
        respondentId,
        chunkSize,
        encryption,
        sizeInChunks: Math.ceil(size / chunkSize)
    };
}

function buildErrorMsg(errorType: number, message?: string): any {
    return {
        type: "error",
        streamId,
        errorType,
        message
    };
}
