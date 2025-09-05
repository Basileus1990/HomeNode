import type { CoordinatorToStreamer, StreamerToCoordinator, PrepareStreamMessage, RequestChunkMessage } from '../types';
import { SocketToHostMessageTypes, HMHostReader } from '../message/readers';
import { HostToSocketMessageTypes, HMHostWriter } from '../message/writers';
import { FSService } from '../../../../common/fs/fs-service';


const inactivityTimeout = parseInt(import.meta.env.VITE_STREAMER_INACTIVITY_TIMEOUT);
const cleanupInterval = parseInt(import.meta.env.VITE_STREAMER_CLEANUP_INTERVAL);
const hostConnectURL = 'ws://localhost:3000/api/v1/host/connect'

const socket = new WebSocket(hostConnectURL);
socket.binaryType = "arraybuffer";
console.log('connecting to:', hostConnectURL);
const reader = new HMHostReader();
const writer = new HMHostWriter();
const streamWorkers = new Map<number, { worker: Worker, lastActive: number }>();
let downloadIdCounter = 0;


socket.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
    const msg = reader.read(event.data);
    if (!msg) {
        console.error("Unable to interpret data from socket");
        return;
    }

    const { respondentId, typeNo, payload: payload } = msg;
    switch (typeNo) {
        case (SocketToHostMessageTypes.ServerError): {
            console.log('error', msg.payload.errorType);
            break;
        }
        case (SocketToHostMessageTypes.ServerACK): {
            console.log('server ACK');
            break;
        }
        case (SocketToHostMessageTypes.NewHostIDGrant): {
            const hostId = msg.payload;
            console.log('assigned new id:', hostId);

            self.postMessage({
                type: "hostId",
                hostId
            });

            const response = writer.write(
                respondentId,
                HostToSocketMessageTypes.HostACK,
                null
            );
            socket.send(response);
            break;
        }
        case (SocketToHostMessageTypes.MetadataRequest): {
            const recordName = payload;
            const record = await FSService.findRecordByName(recordName, undefined, true);

            if (!record) {
                sendError(respondentId, 400, "resource not found");
                break;
            }

            const metadata = await FSService.readRecordIntoItem(record);
            const messageBuffer = writer.write(
                respondentId, 
                HostToSocketMessageTypes.MetadataResponse, 
                {
                    record: metadata
                });
            socket.send(messageBuffer);
            break;
        }
        case (SocketToHostMessageTypes.StreamStartRequest): {
            const recordName = payload.recordID;
            const chunkSize = payload.chunkSize;
            const record = await FSService.findRecordByName(recordName);
            const downloadId = downloadIdCounter++;

            if (!record) {
                sendError(respondentId, 400, "resource not found");
                break;
            }

            const worker = createStreamerWorker();
            streamWorkers.set(downloadId, { worker, lastActive: Date.now() });

            // TODO: fill out the response
            // TODO: encryption
            const resp = writer.write(
                respondentId,
                HostToSocketMessageTypes.StartStreamResponse,
                {
                    downloadId,
                    chunkSize,
                    sizeInChunks: 0
                }
            );
            socket.send(resp);

            worker.postMessage({
                type: 'prepare',
                record,
                chunkSize,
                downloadId
            });
            break;
        }
        case (SocketToHostMessageTypes.ChunkRequest): {
            const downloadId = payload.downloadId;
            const entry = streamWorkers.get(downloadId);

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

self.onmessage = (event) => {
    const { type, payload } = event.data;

    if (type == "stop") {
        console.log("Worker stopped", 'disconnecting...');
        socket.close();
        console.log('disconnected');
        self.close();
    }
}

function createStreamerWorker() {
    const worker = new Worker(new URL('./streamer.worker.ts', import.meta.url));

    worker.onmessage = (ev: MessageEvent<StreamerToCoordinator>) => {
        const msg = ev.data;
        const entry = streamWorkers.get(msg.respondentId);

        if (!entry) { // that would be worker that's not in stremWorkers
            console.log('unkown worker ' + msg.respondentId); // but somehow still got request for chunk from coordinator
            return; // logicly it will never happen
        }

        if (msg.type === 'chunk') {
            const resp = writer.write(
                msg.respondentId,
                HostToSocketMessageTypes.ChunkResponse,
                msg.chunk
            );
            socket.send(resp);

            entry.lastActive = Date.now();
        } else if (msg.type === 'eof') {
            const resp = writer.write(
                msg.respondentId,
                HostToSocketMessageTypes.EOFResponse,
                null
            );
            socket.send(resp);

            entry.worker.terminate(); // close streamer after transfer is finished
            streamWorkers.delete(msg.respondentId); // no retries for now
        }
    };
    return worker;
}

// convenience function for sending error messages
function sendError(respondentId: number, errorCode: number, message?: string) {
    const errorMessage = writer.write(
        respondentId, 
        HostToSocketMessageTypes.HostError,
        {
            errorCode,
            message
        }
    );
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