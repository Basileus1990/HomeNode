import { RecordHandle } from '~/common/fs/records-filesystem';
import type { FromCoordinator, RequestChunkMessage } from './types';
import { RecordChunker } from './chunker';

let respondentId: number;
let record: RecordHandle;
let chunker: RecordChunker;

self.onmessage = async (e: MessageEvent<FromCoordinator>) => {
    const msg = e.data;

    // prepare for streaming
    if (msg.type === 'prepare') {
        respondentId = msg.respondentId;
        record = msg.recordHandle;
        chunker = await RecordChunker.createChunker(record);
    }

    // send next chunk
    if (msg.type === 'next') {
        const chunk = await chunker.next();

        if (!chunk) {       // EOF reached, no chunks to send
            self.postMessage({
                type: 'eof',
                respondentId 
            })
            return;
        }

        self.postMessage({  // send the chunk to coordinator who owns the socket
            type: 'chunk',
            respondentId,
            chunk
        });
    }
};
