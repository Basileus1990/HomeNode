import { encodeUUID, encodePerJson, FlagService } from "../../../../../common/server-com/binary";
import type { HomeNodeFrontendConfig } from "../../../../../common/config";


export enum ClientToSocketMessageTypes {
    Error = 0,
    Ack = 1,

    DownloadFileChunkRequest = 7,
    DownloadFileEndStreamRequest = 10,

    UploadFileChunkResponse = 19
}

export class HMClientWriter {
    public write(typeNo: number, payload: any, config: HomeNodeFrontendConfig): ArrayBuffer {
        const { flags, payload: payloadBytes } = this.dispatch(typeNo, payload, config.use_little_endian);
        return this.assemble(typeNo, flags, payloadBytes, config.use_little_endian);
    }

    private assemble(
        typeNo: number, 
        flags: number, 
        payloadBuffer: ArrayBuffer, 
        useLittleEndian: boolean = false
    ): ArrayBuffer {
        const payloadView = new Uint8Array(payloadBuffer);
        const buffer = new ArrayBuffer(2 + payloadView.length);
        const view = new DataView(buffer);
        const byteView = new Uint8Array(buffer);

        view.setUint16(0, typeNo, useLittleEndian);
        byteView.set(payloadView, 2);

        return buffer;
    }

    protected dispatch(
        typeNo: number, 
        data: any, 
        useLittleEndian: boolean = false
    ): { flags: number; payload: ArrayBuffer } {
        switch (typeNo) {
            case ClientToSocketMessageTypes.Error:
                return this.writeError(data, useLittleEndian);
            case ClientToSocketMessageTypes.Ack:
                return this.writeAck();
            case ClientToSocketMessageTypes.DownloadFileChunkRequest:
                return this.writeDownloadFileChunkRequest(data, useLittleEndian);
            case ClientToSocketMessageTypes.DownloadFileEndStreamRequest:
                return this.writeDownloadFileEndStreamRequest(data);
            case ClientToSocketMessageTypes.UploadFileChunkResponse:
                return this.writeUploadFileChunkResponse(data, useLittleEndian);
            default:
                throw new Error(`Unknown client message type: ${typeNo}`);
        }
    }

    private writeError(
        data: { errorType: number, errorInfo?: object }, 
        useLittleEndian: boolean = false
    ) {
        let buffer;
        if (data.errorInfo) {
            const encoded = encodePerJson(data.errorInfo);
            buffer = new ArrayBuffer(2 + encoded.length);
            new Uint8Array(buffer).set(encoded, 2);
        } else {
            buffer = new ArrayBuffer(2);
        }
        new DataView(buffer).setUint16(0, data.errorType, useLittleEndian);
        return { flags: 0, payload: buffer };
    }

    private writeAck() {
        return { flags: 0, payload: new ArrayBuffer() };
    }

    private writeDownloadFileChunkRequest(
        data: { offset: bigint }, 
        useLittleEndian: boolean = false
    ) {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setBigUint64(0, data.offset, useLittleEndian);
        return { flags: 0, payload: buffer };
    }

    private writeDownloadFileEndStreamRequest(data: any) {
        return { flags: 0, payload: new ArrayBuffer() };
    }

    private writeUploadFileChunkResponse(
        data: { streamId: number, chunk: ArrayBuffer },
        useLittleEndian: boolean = false
    ) {
        const buffer = new ArrayBuffer(data.chunk.byteLength + 4);
        const view = new DataView(buffer);
        view.setUint32(0, data.streamId, useLittleEndian);
        const bytes = new Uint8Array(buffer);
        bytes.set(new Uint8Array(data.chunk), 4);
        return { flags: 0, payload: buffer };
    }
}
