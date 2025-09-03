import type { StartStreamMessage } from "~/client/service/server-com/ws/stream/types";
import { USE_LITTLE_ENDIAN, FlagService, encodePerJson, encodeUUID } from "~/common/communication/binary"
import { encryptBuffer } from "~/common/crypto";
import { type Items } from "~/common/fs/types";

/**
 * ! numbers / names are placeholders
 * types of messages from host to server
 */
export enum HostToSocketMessageTypes {
    HostError = 0,
    HostACK = 1,

    CurrentHostIDDeclaration = 2,
    MetadataResponse = 3,
    StartStreamResponse = 6,
    ChunkResponse = 7,
    EOFResponse = 8
}

type MetadataParams = {
    encryption?: {
        salt: Uint8Array, 
        iv: Uint8Array
    },
    record: Items.RecordItem
}

type StreamStartParams = { 
    downloadId: number,
    sizeInChunks: number,
    chunkSize: number,
    encryption?: {
        salt: Uint8Array, 
        iv: Uint8Array
    }
};

/**
 * takes data needed to build a message and writes a binary buffer for sending to the server
 * builds messages based on given type number
 */
export class HMHostWriter {
    public write(respondentId: number, typeNo: number, payload: any): ArrayBuffer {
        const payloadBytes  = this.dispatch(typeNo, payload);
        return this.assemble(respondentId, typeNo, payloadBytes)
    }

    /**
     * creates binary message for the server from respondentId, message type, flags byte and binary payload buffer
     */
    private assemble(respondentId: number, typeNo: number, payloadBuffer: ArrayBuffer): ArrayBuffer {
        const payloadView = new Uint8Array(payloadBuffer);
        const buffer = new ArrayBuffer(6 + payloadView.length);
        const view = new DataView(buffer);
        const byteView = new Uint8Array(buffer);

        view.setUint32(0, respondentId, USE_LITTLE_ENDIAN);
        view.setUint16(4, typeNo, USE_LITTLE_ENDIAN);
        byteView.set(payloadView, 6);
        return buffer;
    };

    // here goes logic for writing each type of message
    // nothing is type safe, we're no longer in strictly-typed land
    protected dispatch(typeNo: number, data: any): ArrayBuffer {
        switch (typeNo) {
            case HostToSocketMessageTypes.HostError:
                return this.writeHostError(data);
            case HostToSocketMessageTypes.HostACK:
                return this.writeHostACK();
            case HostToSocketMessageTypes.CurrentHostIDDeclaration:
                return this.writeCurrentHostIDDeclaration(data);
            case HostToSocketMessageTypes.MetadataResponse:
                return this.writeMetadataResponse(data);
            case HostToSocketMessageTypes.StartStreamResponse:
                return this.writeStreamStartResponse(data);
            case HostToSocketMessageTypes.ChunkResponse:
                return this.writeChunkResponse(data);
            case HostToSocketMessageTypes.EOFResponse:
                return this.writeEOFResponse();
            default:
                throw new Error(`Unknown message type: ${typeNo}`);
        }
    }

    // 1.
    private writeHostError(data: { errorType: number, errorInfo: object | undefined }) {
        let buffer;
        if (data.errorInfo) {
            const encodedErrorInfo = encodePerJson(data.errorInfo);
            buffer = new ArrayBuffer(2 + encodePerJson.length);
            const bytes = new Uint8Array(buffer);
            bytes.set(encodedErrorInfo, 2);
        } else {
            buffer = new ArrayBuffer(2);
        }
        const view = new DataView(buffer);
        view.setUint16(data.errorType, 0, USE_LITTLE_ENDIAN);
        
        return buffer;
    }

    // 2.
    // ACK has no body, so we return empty, 0-size ArrayBuffer
    private writeHostACK() {
        return new ArrayBuffer();
    }

    // 3.
    // the request has no body, so we return empty, 0-size ArrayBuffer
    // private writeNewHostIDRequest() {
    //     return new ArrayBuffer();
    // }

    // 4.
    private writeCurrentHostIDDeclaration(data: { hostID: string }) {
        const encodedID = encodeUUID(data.hostID);
        return encodedID.buffer as ArrayBuffer;
    }

    // 5.
    private writeMetadataResponse(data: MetadataParams){
        const encryptedMetadata = encodePerJson(data.record);
        let payload;
        let bytes;
        let metadataIndex = 1;
        let flags = 0;

        if (data.encryption) {
            flags = FlagService.setEncrypted(flags);
            payload = new ArrayBuffer(1 + 16 + 12 + encryptedMetadata.length);
            bytes = new Uint8Array(payload);
            bytes.set(data.encryption.salt, 1);
            bytes.set(data.encryption.iv, 17);
            metadataIndex = 29;
        } else {
            payload = new ArrayBuffer(1 + encryptedMetadata.length);
            bytes = new Uint8Array(payload);
        }
        const view = new DataView(payload);
        view.setUint8(0, flags);
        bytes.set(encryptedMetadata, metadataIndex);

        return payload;
    }

    // 6.
    private writeStreamStartResponse(data: StreamStartParams) {
        let payload;

        let flags = 0;
        if (data.encryption) {
            flags = FlagService.setEncrypted(flags);
            payload = new ArrayBuffer(4 + 1 + 4 + 4 + 16 + 12);
            const bytes = new Uint8Array(payload);
            bytes.set(data.encryption.salt, 13);
            bytes.set(data.encryption.iv, 19);
        } else {
            payload = new ArrayBuffer(4 + 1 + 4 + 4);
        }

        const view = new DataView(payload);
        view.setUint32(0, data.downloadId, USE_LITTLE_ENDIAN);
        view.setUint8(4, flags);
        view.setUint32(5, data.sizeInChunks, USE_LITTLE_ENDIAN);
        view.setUint32(9, data.chunkSize, USE_LITTLE_ENDIAN);
        return payload;
    }

    // 7.
    private writeChunkResponse(data: ArrayBuffer) {
        return data;
    }

    // 8.
    // EOF signalled by empty chunk
    private writeEOFResponse() {
        return new ArrayBuffer();
    }
}