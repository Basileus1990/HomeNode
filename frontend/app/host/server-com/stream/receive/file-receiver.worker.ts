import log from "loglevel";

import type { HostChunkRequest, ReceiverReady, ToFileReceiverMsg, UploadAck, UploadEnd } from "./msgs";
import { findHandle } from "../../../../common/fs/api";


let streamId: number;     // id of this specific download stream
let chunkSize: number;
let handle: FileSystemHandle;
let writeable: FileSystemWritableFileStream ;
let fileSize: number;
let offset: number = 0;


self.onmessage = async (e: MessageEvent<ToFileReceiverMsg>) => {
    const msg = e.data;
    const respondentId = msg.respondentId;

    // prepare for streaming
    switch (msg.type) {
        case "prepare": {
            streamId = msg.streamId;
            fileSize = msg.fileSize;
            chunkSize = msg.chunkSize;

            // coordinator is responsible for creating the handle before initiating the worker
            // so if we're here  it means it's safe to access
            handle = await findHandle(msg.resourcePath);
            const fileHandle = handle as FileSystemFileHandle;
            writeable = await fileHandle.createWritable();

            self.postMessage(buildWorkerReadyMsg(respondentId));
            log.debug(`Receiver #${streamId} is ready`);
            break;
        }
        case "next": {
            if (offset < fileSize) {
                self.postMessage(buildHostChunkRequestMsg(respondentId));
            log.debug(`Receiver #${streamId} requsts next chunk from offset ${offset}`);
            } else {
                writeable.close();
                self.postMessage(buildUploadEndMsg(respondentId));
                log.debug(`Receiver #${streamId} received entire file and ends stream`);
                close();
            }
            
            break;
        }
        case "data": {
            if (offset < fileSize) {
                await writeable.write(msg.chunk);
                offset += chunkSize;
                self.postMessage(buildChunkAckMsg(respondentId));
                log.debug(`Receiver #${streamId} at [${offset}:${fileSize}]`);
            } else {
                writeable.close();
                self.postMessage(buildUploadEndMsg(respondentId));
                log.debug(`Receiver #${streamId} received entire file and ends stream`);
                close();
            }
            break;
        }
        default: {
            log.trace("Host received unknown message it couldn't handle:", msg);
            log.warn("Host received message it couldn't handle");
        }
    }
};


function buildWorkerReadyMsg(respondentId: number): ReceiverReady {
    return {
        type: "ready",
        streamId,
        respondentId
    };
}

function buildHostChunkRequestMsg(respondentId: number): HostChunkRequest {
    return {
        type: "chunk",
        respondentId,
        offset: BigInt(offset),
        streamId
    };
}

function buildChunkAckMsg(respondentId: number): UploadAck {
    return {
        type: "ack",
        respondentId,
        streamId,
    };
}

function buildUploadEndMsg(respondentId: number): UploadEnd {
    return {
        type: "eof",
        respondentId,
        streamId,
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
