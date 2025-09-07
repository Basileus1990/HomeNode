import { USE_LITTLE_ENDIAN, FlagService, encodePerJson, encodeUUID } from "~/common/communication/binary"
import { encryptBuffer, type EncryptionData } from "~/common/crypto";
import { type Items } from "~/common/fs/types";


export namespace HostToServerMessage {
    export enum Types {
        HostError = 0,
        HostACK = 1,
        CurrentHostIDDeclaration = -1,
        MetadataResponse = 4,
        DownloadInitResponse = 6,
        ChunkResponse = 8,
        EOFResponse = 9
    }
    export type HostError = {
        errorType: number;
        errorInfo?: object;  // deserialized from JSON, contains additional information
    }
    export type CurrentHostIdDeclaration = {
        hostId: string;
    }
    export type Metadata = {
        record: Items.RecordItem[];
        encryption?: EncryptionData;
    }
    export type StartStream = {
        downloadId: number;
        sizeInChunks: number;
        chunkSize: number;
        encryption?: EncryptionData;
    }
    export type Chunk = {
        chunk: ArrayBuffer;
        encryption?: EncryptionData;
    }

    export type Params =
      | HostError
      | CurrentHostIdDeclaration
      | Metadata
      | StartStream
      | Chunk
}

/**
 * takes data needed to build a message and writes a binary buffer for sending to the server
 * builds messages based on given type number
 */
export class HMHostWriter {
    public async write(respondentId: number, typeNo: number, payload?: HostToServerMessage.Params): Promise<ArrayBuffer> {
        const payloadBytes  = await this.dispatch(typeNo, payload);
        console.log(payloadBytes.byteLength);
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
    protected async dispatch(typeNo: number, data?: HostToServerMessage.Params): Promise<ArrayBuffer> {
        switch (typeNo) {
            case HostToServerMessage.Types.HostError:
                return this.writeHostError(data as HostToServerMessage.HostError);
            case HostToServerMessage.Types.HostACK:
                return this.writeHostACK();
            case HostToServerMessage.Types.CurrentHostIDDeclaration:
                return this.writeCurrentHostIDDeclaration(data as HostToServerMessage.CurrentHostIdDeclaration);
            case HostToServerMessage.Types.MetadataResponse:
                return this.writeMetadataResponse(data as HostToServerMessage.Metadata);
            case HostToServerMessage.Types.DownloadInitResponse:
                return this.writeStreamStartResponse(data as HostToServerMessage.StartStream);
            case HostToServerMessage.Types.ChunkResponse:
                return this.writeChunkResponse(data as HostToServerMessage.Chunk);
            case HostToServerMessage.Types.EOFResponse:
                return this.writeEOFResponse();
            default:
                throw new Error(`Unknown message type: ${typeNo}`);
        }
    }

    // 0.
    private writeHostError(data: HostToServerMessage.HostError) {
        let buffer = new ArrayBuffer(2);
        // if (data.errorInfo) {
        //     const encodedErrorInfo = encodePerJson(data.errorInfo);
        //     buffer = new ArrayBuffer(2 + encodePerJson.length);
        //     const bytes = new Uint8Array(buffer);
        //     bytes.set(encodedErrorInfo, 2);
        // } else {
        //     buffer = new ArrayBuffer(2);
        // }
        const view = new DataView(buffer);
        view.setUint16(data.errorType, 0, USE_LITTLE_ENDIAN);
        
        return buffer;
    }

    // 1.
    // ACK has no body, so we return empty, 0-size ArrayBuffer
    private writeHostACK() {
        return new ArrayBuffer();
    }

    // 2.
    private writeCurrentHostIDDeclaration(data: HostToServerMessage.CurrentHostIdDeclaration) {
        const encodedId = encodeUUID(data.hostId);
        return encodedId.buffer as ArrayBuffer;
    }

    // 3.
    private async writeMetadataResponse(data: HostToServerMessage.Metadata) {
        let encodedMetadata = encodePerJson(data.record);
        let buffer;
        let metadataIndex = 1;
        let flags = 0;

        if (data.encryption) {
            flags = FlagService.setEncrypted(flags);
            buffer = new ArrayBuffer(1 + 16 + 12 + encodedMetadata.length);
            writeEncryptionData(buffer, 1, 17, data.encryption);
            const { salt, iv, ciphertext } = await encryptBuffer(data.encryption.password, encodedMetadata.buffer as ArrayBuffer, data.encryption.salt, data.encryption.iv);
            encodedMetadata = new Uint8Array(ciphertext);
            metadataIndex = 29;
        } else {
            buffer = new ArrayBuffer(1 + encodedMetadata.length);
        }
        const view = new DataView(buffer);
        const bytes = new Uint8Array(buffer);
        view.setUint8(0, flags);
        bytes.set(encodedMetadata, metadataIndex);

        return buffer;
    }

    // 4.
    private writeStreamStartResponse(data: HostToServerMessage.StartStream) {
        let payload;
        let flags = 0;

        if (data.encryption) {
            flags = FlagService.setEncrypted(flags);
            payload = new ArrayBuffer(4 + 1 + 4 + 4 + 16 + 12);
            writeEncryptionData(payload, 13, 29, data.encryption);
        } else {
            payload = new ArrayBuffer(4 + 1 + 4 + 4);
        }

        const view = new DataView(payload);
        view.setUint32(0, data.downloadId, USE_LITTLE_ENDIAN);
        view.setUint32(4, data.sizeInChunks, USE_LITTLE_ENDIAN);
        view.setUint8(8, flags);
        
        //view.setUint32(9, data.chunkSize, USE_LITTLE_ENDIAN);

        console.log(new Uint8Array(payload));
        return payload;
    }

    // 7.
    private async writeChunkResponse(data: HostToServerMessage.Chunk) {
        // if (data.encryption) {
        //     const { salt, iv, ciphertext } = await encryptBuffer(data.encryption.password, data.chunk, data.encryption.salt, data.encryption.iv);
        //     return ciphertext;
        // }
        console.log('sent', data.chunk.byteLength, data.chunk);
        return data.chunk;
    }

    // 8.
    // EOF signalled by empty chunk
    private writeEOFResponse() {
        return new ArrayBuffer();
    }
}

function writeEncryptionData(buffer: ArrayBuffer, saltOffset: number, ivOffset: number, encryptionData: EncryptionData) {
    const bytes = new Uint8Array(buffer);
    bytes.set(encryptionData.salt, saltOffset);
    bytes.set(encryptionData.iv, ivOffset);
}