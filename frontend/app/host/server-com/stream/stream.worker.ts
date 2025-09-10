import log from "loglevel";

import type { EncryptionData } from '../../../common/crypto';
import { RecordHandle } from "../../../common/fs/fs";
import type { CoordinatorToStreamWorker } from '../types';
import { RecordChunker } from './chunker';
import { FSService } from '../../../common/fs/fs-service';

let streamId: number;     // id of this specific download stream
let record: RecordHandle | null;   
let chunker: RecordChunker;
let chunkSize: number;
let encryption: EncryptionData | undefined;


self.onmessage = async (e: MessageEvent<CoordinatorToStreamWorker>) => {
    const msg = e.data;
    console.log('streamer got msg');

    // prepare for streaming
    if (msg.type === 'prepare') {
        streamId = msg.streamId;

        record = await FSService.findRecordByName(msg.resourceId, undefined, true);
        if (!record) {
            log.error(`StreamWorker #${streamId} did not find resource: ${msg.resourceId}`);
            return;
        }
            
        chunkSize = msg.chunkSize;
        chunker = await RecordChunker.createChunker(record, chunkSize);
        const size = await record.getSize();
        const recordMetadata = await record.getMetadata();
        encryption = recordMetadata.encryptionData;

        self.postMessage({
            type: 'ready',
            streamId: msg.streamId,
            respondentId: msg.respondentId,
            chunkSize: msg.chunkSize,
            encryption,
            sizeInChunks: Math.ceil(size / chunkSize)
        });
        log.debug(`StreamWorker #${streamId} is ready`);
    }

    // send next chunk
    if (msg.type === 'next') {
        log.debug(`StreamWorker #${streamId} received request for next chunk`);
        const chunk = await chunker.next(msg.offset);

        if (!chunk) {       // EOF reached, no chunks to send
            self.postMessage({
                type: 'eof',
                respondentId: msg.respondentId,
                streamId,
            })
        } else {
            self.postMessage({
                type: 'chunk',
                respondentId: msg.respondentId,
                chunk,
                encryption,
                streamId
            });
        }
    }
};