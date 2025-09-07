import type { CoordinatorToStreamer, StreamerToCoordinator, PrepareStreamMessage, RequestChunkMessage } from '../types';
import { ServerToHostMessage, HMHostReader } from '../message/readers';
import { HostToServerMessage, HMHostWriter } from '../message/writers';
import { FSService } from '../../../../common/fs/fs-service';


const inactivityTimeout = parseInt(import.meta.env.VITE_STREAMER_INACTIVITY_TIMEOUT);
const cleanupInterval = parseInt(import.meta.env.VITE_STREAMER_CLEANUP_INTERVAL);
const hostConnectURL = 'ws://localhost:3000/api/v1/host/connect'

const socket = new WebSocket(hostConnectURL);
socket.binaryType = "arraybuffer";
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

    const { respondentId, typeNo, payload } = msg;
    switch (typeNo) {
        case (ServerToHostMessage.Types.ServerError): {
            console.log('error:', (payload as ServerToHostMessage.ServerError).errorType);
            break;
        }
        case (ServerToHostMessage.Types.ServerACK): {
            console.log('server ACK');
            break;
        }
        case (ServerToHostMessage.Types.InitWithUuidQuery): {
            const hostId = (payload as ServerToHostMessage.NewHostIdGrant).hostId;

            self.postMessage({
                type: "hostId",
                hostId
            });

            const response = await writer.write(
                respondentId,
                HostToServerMessage.Types.HostACK
            );
            socket.send(response);
            break;
        }
        case (ServerToHostMessage.Types.MetadataQuery): {
            const resourceId = (payload as ServerToHostMessage.ReadMetadata).resourceId;
            const record = await FSService.findRecordByName(resourceId, undefined, true);
            console.log('received metadata request for', resourceId);

            if (!record) {
                sendError(respondentId, 400, "resource not found");
                break;
            }

            const metadata = await FSService.readRecordIntoItem(record);
            const messageBuffer = await writer.write(
                respondentId, 
                HostToServerMessage.Types.MetadataResponse, 
                {
                    record: metadata
                });
            console.log('sent', metadata);
            socket.send(messageBuffer);
            break;
        }
        case (ServerToHostMessage.Types.DownloadInitRequest): {
            const resourceId = (payload as ServerToHostMessage.StartStream).resourceId;
            const chunkSize = (payload as ServerToHostMessage.StartStream).chunkSize;
            const record = await FSService.findRecordByName(resourceId, undefined, true);
            const downloadId = downloadIdCounter++;
            console.log('received download request', payload);

            if (!record) {
                console.log(resourceId, 'not found');
                sendError(respondentId, 400, "resource not found");
                break;
            }

            const newWorker = createStreamerWorker();
            streamWorkers.set(downloadId, { worker: newWorker, lastActive: Date.now() });
            newWorker.postMessage({
                type: 'prepare',
                resourceId,
                chunkSize,
                downloadId,
                respondentId
            });
            console.log('created worker');
            break;
        }
        case (ServerToHostMessage.Types.ChunkRequest): {
            const downloadId = (payload as ServerToHostMessage.ChunkRequest).downloadId;
            const entry = streamWorkers.get(downloadId);
            console.log('queried for chunk from ', downloadId, entry);

            if (!entry) {
                sendError(respondentId, 400, "unkown respondentId");
                break;
            }

            entry.worker.postMessage({
                type: 'next',
                respondentId
            });
            console.log('requested chunk from streamer');
            break;
        }
        case (ServerToHostMessage.Types.DownloadCompletionRequest): {
            const downloadId = (payload as ServerToHostMessage.DownloadCompletion).downloadId;
            const entry = streamWorkers.get(downloadId);
            console.log('queried for chunk from ', downloadId, entry);

            if (!entry) {
                sendError(respondentId, 400, "unkown respondentId");
                break;
            }

            console.log('stream finished for streamer', downloadId, 'terminating');
            entry.worker.terminate();
            streamWorkers.delete(downloadId);
            break;
        }
        default: {
            console.log('default');
        }
    }
};

self.onmessage = (event) => {
    const { type, payload } = event.data;

    if (type == "stop") {
        console.log("Worker stopped");
        socket.close();
        self.close();
    }
}

function createStreamerWorker() {
    const streamerWorker = new Worker(new URL('../stream/streamer.worker.ts', import.meta.url),
        { type: "module" });
    console.log(streamerWorker);

    streamerWorker.onmessage = async (ev: MessageEvent<StreamerToCoordinator>) => {
        const msg = ev.data;
        const entry = streamWorkers.get(msg.downloadId);
        console.log('stremer emitted msg');

        if (!entry) { // that would be worker that's not in stremWorkers
            console.log('unkown worker ' + msg.downloadId); // but somehow still got request for chunk from coordinator
            return; // logicly it will never happen
        }

        if (msg.type === 'chunk') {
            console.log('streamer emited chunk');
            const resp = await writer.write(
                msg.respondentId,
                HostToServerMessage.Types.ChunkResponse,
                { 
                    chunk: msg.chunk,
                    encryption: msg.encryption
                }
            );
            socket.send(resp);

            entry.lastActive = Date.now();
        } else if (msg.type === 'eof') {
            console.log('streamer emited eof');
            const resp = await writer.write(
                msg.respondentId,
                HostToServerMessage.Types.EOFResponse
            );
            socket.send(resp);

            entry.worker.terminate(); // close streamer after transfer is finished
            streamWorkers.delete(msg.respondentId); // no retries for now
        } else if (msg.type === 'ready') {
            console.log('streamer ready');
            const resp = await writer.write(
                msg.respondentId,
                HostToServerMessage.Types.DownloadInitResponse,
                {
                    downloadId: msg.downloadId,
                    chunkSize: msg.chunkSize,
                    sizeInChunks: msg.sizeInChunks,
                    encryption: msg.encryption
                }
            );
            socket.send(resp);
        }
    };
    return streamerWorker;
}

// convenience function for sending error messages
async function sendError(respondentId: number, errorType: number, message?: string) {
    console.log('send error', errorType, message);
    const errorMessage = await writer.write(
        respondentId, 
        HostToServerMessage.Types.HostError,
        {
            errorType,
            errorInfo: { message }
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