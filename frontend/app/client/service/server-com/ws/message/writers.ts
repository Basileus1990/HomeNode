import { encodeUUID, USE_LITTLE_ENDIAN, encodePerJson, FlagService } from "~/common/communication/binary";


export enum ClientToSocketMessageTypes {
    ClientError = 0,
    ClientACK = 1,
    MetadataRequest = 3,
    DownloadInitRequest = 5,
    ChunkRequest = 7,
    DownloadCompletionRequest = 10
}

export class HMClientWriter {
    public write(typeNo: number, payload: any): ArrayBuffer {
        const { flags, payload: payloadBytes } = this.dispatch(typeNo, payload);
        return this.assemble(typeNo, flags, payloadBytes);
    }

    private assemble(typeNo: number, flags: number, payloadBuffer: ArrayBuffer): ArrayBuffer {
        const payloadView = new Uint8Array(payloadBuffer);
        const buffer = new ArrayBuffer(3 + payloadView.length);
        const view = new DataView(buffer);
        const byteView = new Uint8Array(buffer);

        view.setUint16(0, typeNo, USE_LITTLE_ENDIAN);
        view.setUint8(2, flags);
        byteView.set(payloadView, 3);

        return buffer;
    }

    protected dispatch(typeNo: number, data: any): { flags: number; payload: ArrayBuffer } {
        switch (typeNo) {
            case ClientToSocketMessageTypes.ClientError:
                return this.writeClientError(data);
            case ClientToSocketMessageTypes.ClientACK:
                return this.writeClientACK();
            case ClientToSocketMessageTypes.MetadataRequest:
                return this.writeMetadataRequest(data);
            case ClientToSocketMessageTypes.DownloadInitRequest:
                return this.writeStreamStartRequest(data);
            case ClientToSocketMessageTypes.ChunkRequest:
                return this.writeChunkRequest(data);
            case ClientToSocketMessageTypes.DownloadCompletionRequest:
                return this.writeEndStreamRequest(data);
            default:
                throw new Error(`Unknown client message type: ${typeNo}`);
        }
    }

    private writeClientError(data: { errorType: number, errorInfo?: object }) {
        let buffer;
        if (data.errorInfo) {
            const encoded = encodePerJson(data.errorInfo);
            buffer = new ArrayBuffer(2 + encoded.length);
            new Uint8Array(buffer).set(encoded, 2);
        } else {
            buffer = new ArrayBuffer(2);
        }
        new DataView(buffer).setUint16(0, data.errorType, USE_LITTLE_ENDIAN);
        return { flags: 0, payload: buffer };
    }

    private writeClientACK() {
        return { flags: 0, payload: new ArrayBuffer() };
    }

    private writeMetadataRequest(data: { hostID: string, resourceID: string }) {
        const bytes = this.writeHostResourceIDs(data);
        return { flags: 0, payload: bytes.buffer };
    }

    private writeStreamStartRequest(data: { hostID: string, resourceID: string }) {
        const bytes = this.writeHostResourceIDs(data);
        return { flags: 0, payload: bytes.buffer };
    }

    private writeChunkRequest(data: { offset: bigint }) {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setBigUint64(0, data.offset, USE_LITTLE_ENDIAN);
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
