import { USE_LITTLE_ENDIAN, FlagService, decodePerJson, decodeUUID } from "~/common/communication/binary"
import { decryptBuffer } from "~/common/crypto";


/**
 * ! numbers / names are placeholders
 * types of messages from server to host
 */
export enum SocketToHostMessageTypes {
    ServerError = 0,
    ServerACK = 1,
    NewHostIDGrant = 2,
    // 4.
    MetadataRequest = 3,
    StreamStartRequest = 6,
    ChunkRequest = 7,
    // 8.
    EndStreamRequest = 9,
}

/**
 * takes binary message from server and translates it into format suitable for later usage
 * reads message payload based on it's type
 * errors are either fault of messed up message or wrong typeNo - impossible to tell which one - and largely left to caller
 */
export class HMHostReader {
    public read(data: ArrayBuffer, parms?: any): 
        { respondentId: number, typeNo: number, payload: any } | null {
        const { respondentId, typeNo, payload } = this.disassemble(data);
        const interpretedData = this.dispatch(typeNo, payload, parms);
        return { respondentId, typeNo, payload: interpretedData };
    }

    // breaks downt the binary message into common parts
    // respondentId, typeNo, flags, payload
    private disassemble(data: ArrayBuffer): 
        { respondentId: number, typeNo: number, payload: ArrayBuffer } {
        const view = new DataView(data);
        const respondentId = view.getUint32(0, USE_LITTLE_ENDIAN);
        const typeNo = view.getUint16(4, USE_LITTLE_ENDIAN);
        const payload = data.slice(6);
        return { respondentId, typeNo, payload };
    };


    // here goes logic for reading each type of message
    // nothing is type safe, we're no longer in strictly-typed land
    // use parms object to pass additional information
    private dispatch(typeNo: number, data: ArrayBuffer, parms?: any): any {
        try {
            switch (typeNo) {
                case SocketToHostMessageTypes.ServerError: 
                    return this.readServerError(data);
                case SocketToHostMessageTypes.ServerACK: 
                    return this.readServerACK(data);
                case SocketToHostMessageTypes.NewHostIDGrant:
                    return this.readNewHostIDGrant(data);
                case SocketToHostMessageTypes.MetadataRequest:
                    return this.readMetadataRequest(data);
                case SocketToHostMessageTypes.StreamStartRequest:
                    return this.readStreamStartRequest(data);
                case SocketToHostMessageTypes.ChunkRequest:
                    return this.readChunkRequest(data);
                case SocketToHostMessageTypes.EndStreamRequest:
                    return this.readEndStreamRequest(data);
                default:
                    return null;
            }
        } catch (error) {
            console.error('error while trying to read message from server:', error);
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
            } catch (error) {
                console.error('error while parsing server error message json data');
                return  { errorType, errorInfo: undefined };
            }
        } else
            return  { errorType, errorInfo: undefined };
    }

    // 2.
    // ACK has no payload, so data here is empty
    private readServerACK(data: ArrayBuffer) {
        return true;
    }

    // 3.
    private readNewHostIDGrant(data: ArrayBuffer) {
        return decodeUUID(data.slice(0, 16));
    }

    // 4.

    // 5.
    private readMetadataRequest(data: ArrayBuffer) {
        return decodeUUID(data.slice(0, 16));
    }

    // 6.
    private readStreamStartRequest(data: ArrayBuffer) {
        const resourceID = decodeUUID(data.slice(0, 16));
        const view = new DataView(data);
        const chunkSize = view.getUint32(16, USE_LITTLE_ENDIAN);
        return { resourceID, chunkSize};
    }

    // 7.
    private readChunkRequest(data: ArrayBuffer) {
        const downloadID = decodeUUID(data.slice(0, 16));
        const view = new DataView(data);
        const offset = view.getBigUint64(16, USE_LITTLE_ENDIAN);
        return { downloadID, offset };
    }

    // 8.

    // 9.
    private readEndStreamRequest(data: ArrayBuffer) {
        const downloadID = decodeUUID(data.slice(0, 16));
        return downloadID;
    }
}