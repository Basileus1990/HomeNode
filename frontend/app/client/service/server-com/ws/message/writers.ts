import { encodeUUID, encodePerJson, FlagService } from "../../../../../common/server-com/binary";
import type { HomeNodeFrontendConfig } from "../../../../../config";


export enum ClientToSocketMessageTypes {
    ClientError = 0,
    ClientACK = 1,
    ChunkRequest = 7,
    DownloadCompletionRequest = 10
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
        const buffer = new ArrayBuffer(3 + payloadView.length);
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
            case ClientToSocketMessageTypes.ClientError:
                return this.writeClientError(data, useLittleEndian);
            case ClientToSocketMessageTypes.ClientACK:
                return this.writeClientACK();
            case ClientToSocketMessageTypes.ChunkRequest:
                return this.writeChunkRequest(data, useLittleEndian);
            case ClientToSocketMessageTypes.DownloadCompletionRequest:
                return this.writeEndStreamRequest(data);
            default:
                throw new Error(`Unknown client message type: ${typeNo}`);
        }
    }

    private writeClientError(
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

    private writeClientACK() {
        return { flags: 0, payload: new ArrayBuffer() };
    }

    private writeChunkRequest(
        data: { offset: bigint }, 
        useLittleEndian: boolean = false
    ) {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setBigUint64(0, data.offset, useLittleEndian);
        return { flags: 0, payload: buffer };
    }

    private writeHostResourceIDs(data: { hostID: string; resourceID: string; }) {
        const encodedHostID = encodeUUID(data.hostID);
        const encodedResourceID = encodeUUID(data.resourceID);
        const bytes = new Uint8Array(new ArrayBuffer(16 + 16));
        bytes.set(encodedHostID, 0);
        bytes.set(encodedResourceID, 16);
        return bytes;
    }

    private writeEndStreamRequest(data: any) {
        return { flags: 0, payload: new ArrayBuffer() };
    }
}
