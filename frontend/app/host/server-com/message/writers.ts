import { FlagService, encodePerJson, encodeUUID } from "../../../common/server-com/binary";
import { type EncryptionData, encryptBuffer } from "../../../common/crypto";
import { type HomeNodeFrontendConfig } from "../../../config";
import type { Item } from "~/common/fs/types";
import Host from "~/host/views/layout";


export namespace HostToServerMessage {
    export enum Types {
        HostError = 0,
        HostACK = 1,
        CurrentHostIDDeclaration = -1,
        MetadataResponse = 4,
        DownloadInitResponse = 6,
        ChunkResponse = 8,
        EOFResponse = 9,

        RequestChunk = 22,
        UploadEOF = 23
    }
    export type HostError = {
        errorType: number;
        errorInfo?: object;  // deserialized from JSON, contains additional information
    }
    export type CurrentHostIdDeclaration = {
        hostId: string;
    }
    export type Metadata = {
        // record: Items.RecordItem[];
        item: Item
        encryption?: EncryptionData;
    }
    export type StartStream = {
        streamId: number;
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
    public static async write(
        respondentId: number, 
        typeNo: number, 
        config: HomeNodeFrontendConfig, 
        payload?: HostToServerMessage.Params
    ): Promise<ArrayBuffer> {
        const payloadBytes  = await this.dispatch(typeNo, config, payload);
        return this.assemble(respondentId, typeNo, payloadBytes, config.use_little_endian)
    }

    /**
     * creates binary message for the server from respondentId, message type, flags byte and binary payload buffer
     */
    private static assemble(
        respondentId: number, 
        typeNo: number, 
        payloadBuffer: ArrayBuffer,
        useLittleEndian: boolean = false
    ): ArrayBuffer {
        const payloadView = new Uint8Array(payloadBuffer);
        const buffer = new ArrayBuffer(6 + payloadView.length);
        const view = new DataView(buffer);
        const byteView = new Uint8Array(buffer);

        view.setUint32(0, respondentId, useLittleEndian);
        view.setUint16(4, typeNo, useLittleEndian);
        byteView.set(payloadView, 6);
        return buffer;
    };

    // here goes logic for writing each type of message
    // nothing is type safe, we're no longer in strictly-typed land
    protected static async dispatch(
        typeNo: number, 
        config: HomeNodeFrontendConfig,
        data?: HostToServerMessage.Params 
    ): Promise<ArrayBuffer> {
        switch (typeNo) {
            case HostToServerMessage.Types.HostError:
                return this.writeHostError(data as HostToServerMessage.HostError, config.use_little_endian);
            case HostToServerMessage.Types.HostACK:
                return this.writeHostACK();
            case HostToServerMessage.Types.CurrentHostIDDeclaration:
                return this.writeCurrentHostIDDeclaration(data as HostToServerMessage.CurrentHostIdDeclaration);
            case HostToServerMessage.Types.MetadataResponse:
                return this.writeMetadataResponse(data as HostToServerMessage.Metadata, config);
            case HostToServerMessage.Types.DownloadInitResponse:
                return this.writeStreamStartResponse(data as HostToServerMessage.StartStream, config.use_little_endian);
            case HostToServerMessage.Types.ChunkResponse:
                return this.writeChunkResponse(data as HostToServerMessage.Chunk, config);
            case HostToServerMessage.Types.EOFResponse:
                return this.writeEOFResponse();
            case HostToServerMessage.Types.RequestChunk:
            default:
                throw new Error(`Unknown message type: ${typeNo}`);
        }
    }

    private static writeHostError(data: HostToServerMessage.HostError, useLittleEndian: boolean = false) {
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
        view.setUint16(data.errorType, 0, useLittleEndian);
        return buffer;
    }

    // ACK has no body, so we return empty, 0-size ArrayBuffer
    private static writeHostACK() {
        return new ArrayBuffer();
    }

    private static writeCurrentHostIDDeclaration(data: HostToServerMessage.CurrentHostIdDeclaration) {
        const encodedId = encodeUUID(data.hostId);
        return encodedId.buffer as ArrayBuffer;
    }

    private static async writeMetadataResponse(data: HostToServerMessage.Metadata, config: HomeNodeFrontendConfig) {
        let encodedMetadata = encodePerJson(data.item);
        let buffer;
        let metadataIndex = 1;
        let flags = 0;

        if (data.encryption) {
            flags = FlagService.setEncrypted(flags);
            buffer = new ArrayBuffer(1 + 16 + 12 + encodedMetadata.length);     // flags, salt, iv, metadata
            writeEncryptionData(buffer, 1, 17, data.encryption);
            const { salt, iv, ciphertext } = await encryptBuffer(
                data.encryption.password, 
                encodedMetadata.buffer as ArrayBuffer, 
                config,
                data.encryption.salt, 
                data.encryption.iv);
            encodedMetadata = new Uint8Array(ciphertext);
            metadataIndex = 29;
        } else {
            buffer = new ArrayBuffer(1 + encodedMetadata.length);               // flags, metadata
        }
        const view = new DataView(buffer);
        const bytes = new Uint8Array(buffer);
        view.setUint8(0, flags);
        bytes.set(encodedMetadata, metadataIndex);
        return buffer;
    }

    private static writeStreamStartResponse(data: HostToServerMessage.StartStream, useLittleEndian: boolean = false) {
        let buffer;
        let flags = 0;

        if (data.encryption) {
            flags = FlagService.setEncrypted(flags);
            buffer = new ArrayBuffer(4 + 4 + 1 + 16 + 12);         // streamId, sizeInChunks, flags, salt, iv
            writeEncryptionData(buffer, 9, 25, data.encryption);
        } else {
            buffer = new ArrayBuffer(4 + 4 + 1);                   // streamId, sizeInChunks, flags
        }

        const view = new DataView(buffer);
        view.setUint32(0, data.streamId, useLittleEndian);
        view.setUint32(4, data.sizeInChunks, useLittleEndian);
        view.setUint8(8, flags);
        return buffer;
    }

    private static async writeChunkResponse(data: HostToServerMessage.Chunk, config: HomeNodeFrontendConfig) {
        if (data.encryption) {
            const { salt, iv, ciphertext } = await encryptBuffer(
                data.encryption.password, 
                data.chunk, 
                config,
                data.encryption.salt, 
                data.encryption.iv);
            return ciphertext;
        }
        return data.chunk;
    }

    // EOF needs no body
    private static writeEOFResponse() {
        return new ArrayBuffer();
    }
}

function writeEncryptionData(buffer: ArrayBuffer, saltOffset: number, ivOffset: number, encryptionData: EncryptionData) {
    const bytes = new Uint8Array(buffer);
    bytes.set(encryptionData.salt, saltOffset);
    bytes.set(encryptionData.iv, ivOffset);
}