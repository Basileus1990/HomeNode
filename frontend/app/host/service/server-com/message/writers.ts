import { assemble, useLittleEndian, FlagService } from './binary'
import { encryptBuffer } from "../../crypto";

/**
 * type for input to the writer
 */
export type HWriterIn = {
    respondentId: number, 
    typeNo: number,
    payload: any
}

/**
 * ! numbers / names are placeholders
 * types of messages from host to server
 */
export enum ToSocketMessageTypes {
    Error = 0,
    RecordInfoResponse= 1,
    RecordDownloadResponse= 2,
    ChunkResponse= 3,
    EofChunkResponse = 4,
}

/**
 * takes data needed to build a message and writes a binary buffer for sending to the server
 * builds messages based on given type number
 */
export class HMWriter {
    public write(data: HWriterIn): ArrayBuffer {
        const [flags, payloadBytes] = this.dispatch(data.typeNo, data.payload);
        return assemble(data.respondentId, data.typeNo, flags, payloadBytes)
    }

    // here goes logic for writing each type of message
    // nothing is type safe, we're no longer in strictly-typed land
    private dispatch(typeNo: number, data: any): [number, ArrayBuffer] {
        switch (typeNo) {
            case ToSocketMessageTypes.Error:
                return this.buildError(data);
            case ToSocketMessageTypes.RecordInfoResponse:
                return this.buildRecordInfoResponse(data);
            case ToSocketMessageTypes.RecordDownloadResponse:
                return this.buildRecordDownloadPreflightResponse(data);
            default:
                throw new Error(`Unknown message type: ${typeNo}`);
        }
    }

    private buildError(data: any): [number, ArrayBuffer] {
        const encoded = encodePerJson(data);
        return [0, encoded.buffer as ArrayBuffer];
    }

    private buildRecordInfoResponse(data: any): [number, ArrayBuffer] {
        const payloadBytes = encodePerJson(data);
        return [0, payloadBytes.buffer as ArrayBuffer];
    }

    private buildRecordDownloadPreflightResponse(data: any): [number, ArrayBuffer] {
        const buffer = new ArrayBuffer(4 + 8 + 4);
        const view = new DataView(buffer);

        view.setUint32(0, data.batchesNo, useLittleEndian);
        view.setBigUint64(4, data.totalBytes, useLittleEndian);
        view.setUint32(12, data.downloadId);
        return [0, buffer];
    }

}

function encodePerJson(payload: object): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(payload));
}