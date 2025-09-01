import type { FromCoordinator, ToCoordinator, PrepareStreamMessage, RequestChunkMessage } from './types';
import { FromSocketMessageTypes, type HReaderOut, HMReader } from '../message/readers';
import { ToSocketMessageTypes, type HWriterIn, HMWriter } from '../message/writers';
import { FSService } from '~/common/fs/fs-service';


const inactivityTimeout = parseInt(import.meta.env.VITE_STREAMER_INACTIVITY_TIMEOUT);
const cleanupInterval = parseInt(import.meta.env.VITE_STREAMER_CLEANUP_INTERVAL);

const socket = new WebSocket(import.meta.env.VITE_SERVER_WS_URL);
socket.binaryType = "arraybuffer";
const reader = new HMReader();
const writer = new HMWriter();
const streamWorkers = new Map<number, { worker: Worker, lastActive: number }>();


socket.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
    const msg = reader.read(event.data);
    if (!msg) {
        console.error("Unable to interpret data from socket");
        return;
    }

    const { respondentId, typeNo, flags, payload } = msg;
    switch (typeNo) {
        case (FromSocketMessageTypes.RecordInfoRequest): {
            const recordName = payload.recordName;
            const record = await FSService.findRecordByName(recordName);

            if (!record) {
                sendError(respondentId, 400, "resource not found");
                break;
            }

            const messageBuffer = writer.write({
                respondentId, 
                typeNo: ToSocketMessageTypes.RecordInfoResponse, 
                payload: record.getMetadata()});
            socket.send(messageBuffer);
            break;
        }
        case (FromSocketMessageTypes.ResourceDownloadRequest): {
            const recordName = payload.recordName;
            const record = await FSService.findRecordByName(recordName);

            if (!record) {
                sendError(respondentId, 400, "resource not found");
                break;
            }

            const worker = new Worker(new URL('./streamer.worker.ts', import.meta.url));
            streamWorkers.set(respondentId, { worker, lastActive: Date.now() });
            worker.onmessage = (ev: MessageEvent<ToCoordinator>) => {
                const msg = ev.data;
                const entry = streamWorkers.get(msg.respondentId);

                if (!entry) {                                           // that would be worker that's not in stremWorkers
                    console.log('unkown worker ' + msg.respondentId);   // but somehow still got request for chunk from coordinator
                    return;                                             // logicly it will never happen
                }

                if (msg.type === 'chunk') {
                    const resp = writer.write({
                        respondentId: msg.respondentId, 
                        typeNo: ToSocketMessageTypes.ChunkResponse,
                        payload: msg.chunk
                    });
                    socket.send(resp);

                    entry.lastActive = Date.now();
                } else if (msg.type === 'eof') {
                    const resp = writer.write({
                        respondentId: msg.respondentId, 
                        typeNo: ToSocketMessageTypes.EofChunkResponse,
                        payload: new ArrayBuffer(0)
                    });
                    socket.send(resp);

                    entry.worker.terminate();               // close streamer after transfer is finished
                    streamWorkers.delete(msg.respondentId); // no retries for now
                }
            };

            // TODO: fill out the response
            const resp = writer.write({
                respondentId,
                typeNo: ToSocketMessageTypes.RecordDownloadResponse,
                payload: {
                    batchesNo: 0,
                    totalBytes: 0,
                    downloadId: 0
                }
            })
            socket.send(resp);

            worker.postMessage({
                type: 'prepare',
                respondentId,
                record
            });
            break;
        }
        case (FromSocketMessageTypes.ChunkRequest): {
            const entry = streamWorkers.get(respondentId);

            if (!entry) {
                sendError(respondentId, 400, "unkown respondentId");
                break;
            }

            entry.worker.postMessage({
               type: 'next',
               respondentId
            });
            break;
        }
        default: {

        }
    }
};

// convenience function for sending error messages
function sendError(respondentId: number, errorCode: number, message?: string) {
    const errorMessage = writer.write({
        respondentId, 
        typeNo: ToSocketMessageTypes.Error,
        payload: {
            errorCode,
            message
        }
    });
    socket.send(errorMessage);
}

// kill inactive streamers every cleanupInterval
function cleanupZombieWorkers() {
  const now = Date.now();
  for (const [streamId, entry] of streamWorkers.entries()) {
    if (now - entry.lastActive > inactivityTimeout) {
      console.log(`[Coordinator] 🧹 Zombie stream detected: ${streamId}`);
      entry.worker.terminate();
      streamWorkers.delete(streamId);
    }
  }
}
setInterval(cleanupZombieWorkers, cleanupInterval);