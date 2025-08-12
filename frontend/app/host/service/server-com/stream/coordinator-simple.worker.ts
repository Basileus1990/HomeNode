import { FromSocketMessageTypes, type HReaderOut, HMReader } from '../message/readers';
import { ToSocketMessageTypes, type HWriterIn, HMWriter } from '../message/writers';
import { FSService } from '~/common/fs/fs-service';
import { RecordChunker } from './chunker';

const socket = new WebSocket(import.meta.env.VITE_SERVER_WS_URL);
socket.binaryType = "arraybuffer";
const reader = new HMReader();
const writer = new HMWriter();
const chunkers = new Map<number, { chunker: RecordChunker, lastActive: number }>();


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

            const chunker = await RecordChunker.createChunker(record);
            chunkers.set(respondentId, { chunker, lastActive: Date.now() });

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
            break;
        }
        case (FromSocketMessageTypes.ChunkRequest): {
            const entry = chunkers.get(respondentId);

            if (!entry) {
                sendError(respondentId, 400, "unkown respondentId");
                break;
            }

            const chunk = await entry.chunker.next();
            if (!chunk) {
                const resp = writer.write({
                    respondentId: msg.respondentId, 
                    typeNo: ToSocketMessageTypes.EofChunkResponse,
                    payload: new ArrayBuffer(0)
                });
                socket.send(resp);
                chunkers.delete(respondentId);
            } else {
                const resp = writer.write({
                    respondentId: respondentId, 
                    typeNo: ToSocketMessageTypes.ChunkResponse,
                    payload: chunk
                });
                socket.send(resp);
                entry.lastActive = Date.now();
            }
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