import { FlagService, decodePerJson } from "../../../../../common/server-com/binary";
import type { HomeNodeFrontendConfig } from "../../../../../common/config";


export enum SocketToClientMessageTypes {
    ServerError = 0,
    ServerACK = 1,
    MetadataResponse = 4,
    DownloadInitResponse = 6,
    ChunkResponse = 8,
    EOFResponse = 9,
}

export class HMClientReader {
    public read(data: ArrayBuffer, config: HomeNodeFrontendConfig): { typeNo: number, flags: number, payload: any } | null {
        const { typeNo, flags, payload } = this.disassemble(data, config.use_little_endian);
        const interpretedPayload = this.dispatch(typeNo, payload, config.use_little_endian);
        return { typeNo, flags, payload: interpretedPayload };
    }

    private disassemble(data: ArrayBuffer, useLittleEndian: boolean = false): { typeNo: number, flags: number, payload: ArrayBuffer } {
        const view = new DataView(data);
        const typeNo = view.getUint16(0, useLittleEndian);
        // const flags = view.getUint8(2);
        const payload = data.slice(2);
        return { typeNo, flags: 0, payload };
    }

    protected dispatch(typeNo: number, payload: ArrayBuffer, useLittleEndian: boolean = false): any {
        try {
            switch (typeNo) {
                case SocketToClientMessageTypes.ServerError:
                    return this.readServerError(payload, useLittleEndian);
                case SocketToClientMessageTypes.ServerACK:
                    return this.readServerAck();
                case SocketToClientMessageTypes.MetadataResponse:
                    return this.readMetadataResponse(payload);
                case SocketToClientMessageTypes.DownloadInitResponse:
                    return this.readStreamStartResponse(payload, useLittleEndian);
                case SocketToClientMessageTypes.ChunkResponse:
                    return this.readChunkResponse(payload);
                case SocketToClientMessageTypes.EOFResponse:
                    return this.readChunkEof();
                default:
                    return null;
            }
        } catch (e) {
            console.error("ClientReader error:", e);
            return null;
        }
    }

    // 1.
    private readServerError(data: ArrayBuffer, useLittleEndian: boolean = false) {
        const view = new DataView(data);
        const errorType = view.getUint16(0, useLittleEndian);
        if (data.byteLength > 2) {
            try {
                const errorInfo = decodePerJson(data.slice(2));
                return { errorType, errorInfo };
            } catch {
                return { errorType, errorInfo: undefined };
            }
        }
        return { errorType, errorInfo: undefined };
    }

    // 2.
    private readServerAck() {
        return true;
    }

    // 5.
    private readMetadataResponse(data: ArrayBuffer) {
        const view = new DataView(data);
        const flags = view.getUint8(0);
        const json = data.slice(1);
        return decodePerJson(json);
    }

    // 6.
    private readStreamStartResponse(data: ArrayBuffer, useLittleEndian: boolean = false) {
        const view = new DataView(data);
        
        const chunkSize = view.getUint32(0, useLittleEndian);
        const sizeInChunks = view.getUint32(4, useLittleEndian);
        const flags = view.getUint8(8);
        // const result: any = { sizeInChunks };

        // if (data.byteLength == 36) {
        //     result.salt = new Uint8Array(data.slice(4, 20));
        //     result.initVector = new Uint8Array(data.slice(20));
        // }

        return { chunkSize, sizeInChunks };
    }

    // 7.
    private readChunkResponse(data: ArrayBuffer) {
        return new Uint8Array(data);
    }

    // 8.
    private readChunkEof() {
        return null;
    }
}