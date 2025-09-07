import { USE_LITTLE_ENDIAN, FlagService, decodePerJson, decodeUUID } from "~/common/communication/binary"
import { decryptBuffer } from "~/common/crypto";


export namespace ServerToHostMessage {
    export enum Types {
        ServerError = 0,
        ServerACK = 1,
        NewHostIDGrant = 2,
        MetadataRequest = 3,
        StreamStartRequest = 4,
        ChunkRequest = 5,
        EndStreamRequest = 6,
    }

    export type ServerError = {
        errorType: number;
        errorInfo?: object;  // deserialized from JSON, contains additional information
    }
    export type ServerACK = {
        ack: boolean;
    }
    export type NewHostIdGrant = {
        hostId: string;
    }
    export type ReadMetadata = {
        resourceId: string;
    }
    export type StartStream = {
        resourceId: string;
        chunkSize: number;
    }
    export type ChunkRequest = {
        downloadId: number;
        offset: BigInt;
    }
    export type EndStream = {
        downloadId: number;
    }

    export type Contents =
      | ServerError
      | ServerACK
      | NewHostIdGrant
      | ReadMetadata
      | StartStream
      | ChunkRequest
      | EndStream
}

export type HMHostReaderOut = { 
    respondentId: number, 
    typeNo: number, 
    payload: ServerToHostMessage.Contents | null 
}

/**
 * takes binary message from server and translates it into format suitable for later usage
 * reads message payload based on it's type
 * errors are either fault of messed up message or wrong typeNo - impossible to tell which one - and largely left to caller
 */
export class HMHostReader {
    public read(data: ArrayBuffer, parms?: any): HMHostReaderOut | null {
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
    private dispatch(typeNo: number, data: ArrayBuffer, parms?: any): ServerToHostMessage.Contents | null {
        try {
            switch (typeNo) {
                case ServerToHostMessage.Types.ServerError: 
                    return this.readServerError(data);
                case ServerToHostMessage.Types.ServerACK: 
                    return this.readServerACK(data);
                case ServerToHostMessage.Types.NewHostIDGrant:
                    return this.readNewHostIDGrant(data);
                case ServerToHostMessage.Types.MetadataRequest:
                    return this.readMetadataRequest(data);
                case ServerToHostMessage.Types.StreamStartRequest:
                    return this.readStreamStartRequest(data);
                case ServerToHostMessage.Types.ChunkRequest:
                    return this.readChunkRequest(data);
                case ServerToHostMessage.Types.EndStreamRequest:
                    return this.readEndStreamRequest(data);
                default:
                    return null;
            }
        } catch (error) {
            console.error('error while trying to read message from server:', error);
            return null;
        }
    }

    // 0.
    private readServerError(data: ArrayBuffer): ServerToHostMessage.ServerError {
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

    // 1.
    // ACK has no payload, so data here is empty
    private readServerACK(data: ArrayBuffer): ServerToHostMessage.ServerACK {
        return { ack: true };
    }

    // 2.
    private readNewHostIDGrant(data: ArrayBuffer): ServerToHostMessage.NewHostIdGrant {
        return { hostId: decodeUUID(data.slice(0, 16)) };
    }

    // 3.
    private readMetadataRequest(data: ArrayBuffer): ServerToHostMessage.ReadMetadata {
        return { resourceId: decodeUUID(data.slice(0, 16)) };
    }

    // 4.
    private readStreamStartRequest(data: ArrayBuffer): ServerToHostMessage.StartStream {
        const resourceId = decodeUUID(data.slice(0, 16));
        const view = new DataView(data);
        const chunkSize = view.getUint32(16, USE_LITTLE_ENDIAN);
        return { resourceId, chunkSize };
    }

    // 5.
    private readChunkRequest(data: ArrayBuffer): ServerToHostMessage.ChunkRequest {
        const view = new DataView(data);
        const downloadId = view.getUint32(0, USE_LITTLE_ENDIAN);
        const offset = view.getBigUint64(16, USE_LITTLE_ENDIAN);
        return { downloadId, offset };
    }

    // 6.
    private readEndStreamRequest(data: ArrayBuffer): ServerToHostMessage.EndStream {
        const view = new DataView(data);
        const downloadId = view.getUint32(0, USE_LITTLE_ENDIAN);
        return { downloadId };
    }
}