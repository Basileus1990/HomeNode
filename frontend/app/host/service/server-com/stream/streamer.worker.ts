import { RecordHandle } from '../../../../common/fs/records-filesystem';
import type { CoordinatorToStreamer, RequestChunkMessage } from '../types';
import { RecordChunker } from './chunker';

let downloadId: number;
let record: RecordHandle;
let chunker: RecordChunker;
let chunkSize: number;

self.onmessage = async (e: MessageEvent<CoordinatorToStreamer>) => {
    const msg = e.data;

    // prepare for streaming
    if (msg.type === 'prepare') {
        downloadId = msg.downloadId;
        record = msg.recordHandle;
        chunkSize = msg.chunkSize;
        chunker = await RecordChunker.createChunker(record, chunkSize);
    }

    // send next chunk
    if (msg.type === 'next') {
        const chunk = await chunker.next();

        if (!chunk) {       // EOF reached, no chunks to send
            self.postMessage({
                type: 'eof',
                respondentId: msg.respondentId 
            })
            return;
        }

        self.postMessage({  // send the chunk to coordinator who owns the socket
            type: 'chunk',
            respondentId: msg.respondentId,
            chunk
        });
    }
};
