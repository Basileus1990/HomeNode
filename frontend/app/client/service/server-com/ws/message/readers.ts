import { FlagService, decodePerJson } from "../../../../../common/server-com/binary";
import type { HomeNodeFrontendConfig } from "../../../../../common/config";


export enum SocketToClientMessageTypes {
    Error = 0,
    Ack = 1,

    MetadataResponse = 4,

    DownloadFileInitStreamResponse = 6,
    DownloadFileChunkResponse = 8,
    DownloadFileEofResponse = 9,

    UploadFileInitStreamResponse = 15,
    UploadFileChunkRequest = 18,
    UploadFileEndStreamRequest = 16,
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
        const payload = data.slice(2);
        return { typeNo, flags: 0, payload };
    }

    protected dispatch(typeNo: number, payload: ArrayBuffer, useLittleEndian: boolean = false): any {
        try {
            switch (typeNo) {
                case SocketToClientMessageTypes.Error:
                    return this.readError(payload, useLittleEndian);
                case SocketToClientMessageTypes.Ack:
                    return this.readAck();
                case SocketToClientMessageTypes.MetadataResponse:
                    return this.readMetadataResponse(payload);
                case SocketToClientMessageTypes.DownloadFileInitStreamResponse:
                    return this.readDownloadFileInitResponse(payload, useLittleEndian);
                case SocketToClientMessageTypes.DownloadFileChunkResponse:
                    return this.readDownloadFileChunkResponse(payload);
                case SocketToClientMessageTypes.DownloadFileEofResponse:
                    return this.readDownloadFileEofResponse();
                case SocketToClientMessageTypes.UploadFileInitStreamResponse:
                    return this.readUploadFileInitResponse(payload, useLittleEndian);
                case SocketToClientMessageTypes.UploadFileChunkRequest:
                    return this.readUploadFileChunkRequest(payload, useLittleEndian);
                case SocketToClientMessageTypes.UploadFileEndStreamRequest:
                    return this.readUploadFileEndRequest();
                default:
                    return null;
            }
        } catch (e) {
            console.error("ClientReader error:", e);
            return null;
        }
    }

    // 1.
    private readError(data: ArrayBuffer, useLittleEndian: boolean = false) {
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
    private readAck() {
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
    private readDownloadFileInitResponse(data: ArrayBuffer, useLittleEndian: boolean = false) {
        const view = new DataView(data);
        
        // const chunkSize = view.getUint32(0, useLittleEndian);
        const sizeInChunks = view.getUint32(0, useLittleEndian);
        // const flags = view.getUint8(8);
        // const result: any = { sizeInChunks };

        // if (data.byteLength == 36) {
        //     result.salt = new Uint8Array(data.slice(4, 20));
        //     result.initVector = new Uint8Array(data.slice(20));
        // }

        return { sizeInChunks };
    }

    // 7.
    private readDownloadFileChunkResponse(data: ArrayBuffer) {
        return new Uint8Array(data);
    }

    // 8.
    private readDownloadFileEofResponse() {
        return null;
    }

    private readUploadFileInitResponse(data: ArrayBuffer, useLittleEndian: boolean = false) {
        const view = new DataView(data);
        const streamId = view.getUint32(0, useLittleEndian);
        return { streamId };
    }

    private readUploadFileChunkRequest(data: ArrayBuffer, useLittleEndian: boolean = false) {
        const view = new DataView(data);
        const offset = view.getBigUint64(0, useLittleEndian);
        return { offset };
    }

    private readUploadFileEndRequest() {
        return true;
    }
}