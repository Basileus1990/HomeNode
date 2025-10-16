import log from "loglevel";

import type { EncryptionData } from "../../../common/crypto";
import type { CoordinatorToStreamWorker } from "../types";
import { RecordChunker } from "./chunker";
import { findHandle, getSize } from "../../../common/fs/api";


let streamId: number;     // id of this specific download stream
let chunker: RecordChunker;
let chunkSize: number;
let encryption: EncryptionData | undefined;
let handle: FileSystemHandle | null;


self.onmessage = async (e: MessageEvent<CoordinatorToStreamWorker>) => {
    const msg = e.data;
    console.log("streamer got msg");

    // prepare for streaming
    if (msg.type === "prepare") {
        streamId = msg.streamId;

        // coordinator is responsible for checking whether the handle exists before initiating the worker
        // so if we're here  it means it's safe to access
        handle = await findHandle(msg.resourcePath);
            
        chunkSize = msg.chunkSize;
        chunker = await RecordChunker.createChunker(handle, chunkSize);
        const size = await getSize(handle);
        // const recordMetadata = await record.getMetadata();
        // encryption = recordMetadata.encryptionData;

        self.postMessage({
            type: "ready",
            streamId: msg.streamId,
            respondentId: msg.respondentId,
            chunkSize: msg.chunkSize,
            encryption,
            sizeInChunks: Math.ceil(size / chunkSize)
        });
        log.debug(`StreamWorker #${streamId} is ready`);
    }

    // send next chunk
    if (msg.type === "next") {
        log.debug(`StreamWorker #${streamId} received request for next chunk`);
        const chunk = await chunker.next(msg.offset);

        if (!chunk) {       // EOF reached, no chunks to send
            self.postMessage({
                type: "eof",
                respondentId: msg.respondentId,
                streamId,
            })
        } else {
            self.postMessage({
                type: "chunk",
                respondentId: msg.respondentId,
                chunk,
                encryption,
                streamId
            });
        }
    }
};