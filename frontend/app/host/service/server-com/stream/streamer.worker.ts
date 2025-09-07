import type { EncryptionData } from '../../../../common/crypto';
import { RecordHandle } from '../../../../common/fs/records-filesystem';
import type { CoordinatorToStreamer, RequestChunkMessage } from '../types';
import { RecordChunker } from './chunker';
import { FSService } from '~/common/fs/fs-service';

let downloadId: number;     // id of this specific download stream
let record: RecordHandle | null;   
let chunker: RecordChunker;
let chunkSize: number;
let encryption: EncryptionData | undefined;
let size: number;

console.log('STREAMER');

self.onmessage = async (e: MessageEvent<CoordinatorToStreamer>) => {
    const msg = e.data;
    console.log('streamer got msg');

    // prepare for streaming
    if (msg.type === 'prepare') {
        console.log('streamer got prepare', msg);
        downloadId = msg.downloadId;

        record = await FSService.findRecordByName(msg.resourceId, undefined, true);
        if (!record)
            return;
        
        chunkSize = msg.chunkSize;
        const recordMetadata = await record.getMetadata();
        encryption = recordMetadata.encryptionData;
        chunker = await RecordChunker.createChunker(record, chunkSize);
        console.log('streamer ready', downloadId, record, chunkSize, encryption, chunker);

        size = await record.getSize();

        self.postMessage({
            type: 'ready',
            downloadId: msg.downloadId,
            respondentId: msg.respondentId,
            chunkSize: msg.chunkSize,
            encryption,
            sizeInChunks: Math.ceil(size / chunkSize)
        });
    }

    // send next chunk
    if (msg.type === 'next') {
        console.log(downloadId, 'received request for chunk');

        const chunk = await chunker.next();
        console.log(downloadId, 'got chunk');

        if (!chunk) {       // EOF reached, no chunks to send
            console.log(downloadId, 'reached eof');
            self.postMessage({
                type: 'eof',
                respondentId: msg.respondentId,
                downloadId
            })
            return;
        }

        console.log(downloadId, 'sending chunk');
        self.postMessage({  // send the chunk to coordinator who owns the socket
            type: 'chunk',
            respondentId: msg.respondentId,
            chunk,
            encryption,
            downloadId
        });
    }
};
