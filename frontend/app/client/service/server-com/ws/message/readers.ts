import { USE_LITTLE_ENDIAN, FlagService, decodePerJson } from "~/common/communication/binary";


export enum SocketToClientMessageTypes {
    ServerError = 1,
    ServerACK = 2,
    MetadataResponse = 3,
    StreamStartResponse = 6,
    ChunkResponse = 7,
    EOFResponse = 8
}

export class HMClientReader {
    public read(data: ArrayBuffer): { typeNo: number, flags: number, payload: any } | null {
        const { typeNo, flags, payload } = this.disassemble(data);
        const interpretedPayload = this.dispatch(typeNo, payload);
        return { typeNo, flags, payload: interpretedPayload };
    }

    private disassemble(data: ArrayBuffer): { typeNo: number, flags: number, payload: ArrayBuffer } {
        const view = new DataView(data);
        const typeNo = view.getUint16(0, USE_LITTLE_ENDIAN);
        const flags = view.getUint8(2);
        const payload = data.slice(3);
        return { typeNo, flags, payload };
    }

    protected dispatch(typeNo: number, payload: ArrayBuffer): any {
        try {
            switch (typeNo) {
                case SocketToClientMessageTypes.ServerError:
                    return this.readServerError(payload);
                case SocketToClientMessageTypes.ServerACK:
                    return this.readServerAck();
                case SocketToClientMessageTypes.MetadataResponse:
                    return this.readMetadataResponse(payload);
                case SocketToClientMessageTypes.StreamStartResponse:
                    return this.readStreamStartResponse(payload);
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
    private readServerError(data: ArrayBuffer) {
        const view = new DataView(data);
        const errorType = view.getUint16(0, USE_LITTLE_ENDIAN);
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
        return decodePerJson(data);
    }

    // 6.
    private readStreamStartResponse(data: ArrayBuffer) {
        const view = new DataView(data);
        const sizeInChunks = view.getUint32(0, USE_LITTLE_ENDIAN);
        const result: any = { sizeInChunks };

        if (data.byteLength == 36) {
            result.salt = new Uint8Array(data.slice(4, 20));
            result.initVector = new Uint8Array(data.slice(20));
        }

        return result;
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