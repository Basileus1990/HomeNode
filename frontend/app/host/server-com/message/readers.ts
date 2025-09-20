import { decodePerJson, decodeUUID } from "../../../common/server-com/binary";
import type { HomeNodeFrontendConfig } from "../../../config";


export namespace ServerToHostMessage {
    export enum Types {
        ServerError = 0,
        ServerACK = 1,
        InitWithUuidQuery = 2,
        MetadataQuery = 3,
        DownloadInitRequest = 5,
        ChunkRequest = 7,
        DownloadCompletionRequest = 10,
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
        resourcePath: string;
    }
    export type StartStream = {
        resourcePath: string;
        chunkSize: number;
    }
    export type ChunkRequest = {
        streamId: number;
        offset: BigInt;
    }
    export type EndStream = {
        streamId: number;
    }
    export type DownloadCompletion = {
        streamId: number;
    }

    export type Contents =
      | ServerError
      | ServerACK
      | NewHostIdGrant
      | ReadMetadata
      | StartStream
      | ChunkRequest
      | EndStream
      | DownloadCompletion
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
    public static read(data: ArrayBuffer, config: HomeNodeFrontendConfig, parms?: any): HMHostReaderOut | null {
        const { respondentId, typeNo, payload } = this.disassemble(data, config.use_little_endian);
        const interpretedData = this.dispatch(typeNo, payload, parms, config.use_little_endian);
        return { respondentId, typeNo, payload: interpretedData };
    }

    // breaks downt the binary message into common parts
    // respondentId, typeNo, flags, payload
    private static disassemble(data: ArrayBuffer, useLittleEndian: boolean = false): 
        { respondentId: number, typeNo: number, payload: ArrayBuffer } {
        const view = new DataView(data);
        const respondentId = view.getUint32(0, useLittleEndian);
        const typeNo = view.getUint16(4, useLittleEndian);
        const payload = data.slice(6);
        return { respondentId, typeNo, payload };
    };


    // here goes logic for reading each type of message
    // nothing is type safe, we're no longer in strictly-typed land
    // use parms object to pass additional information
    private static dispatch(
        typeNo: number, 
        data: ArrayBuffer, 
        parms?: any, 
        useLittleEndian: boolean = false
    ): ServerToHostMessage.Contents | null 
    {
        try {
            switch (typeNo) {
                case ServerToHostMessage.Types.ServerError: 
                    return this.readServerError(data, useLittleEndian);
                case ServerToHostMessage.Types.ServerACK: 
                    return this.readServerACK();
                case ServerToHostMessage.Types.InitWithUuidQuery:
                    return this.readNewHostIDGrant(data);
                case ServerToHostMessage.Types.MetadataQuery:
                    return this.readMetadataRequest(data);
                case ServerToHostMessage.Types.DownloadInitRequest:
                    return this.readStreamStartRequest(data, useLittleEndian);
                case ServerToHostMessage.Types.ChunkRequest:
                    return this.readChunkRequest(data, useLittleEndian);
                case ServerToHostMessage.Types.DownloadCompletionRequest:
                    return this.readEndStreamRequest(data, useLittleEndian);
                default:
                    return null;
            }
        } catch (error) {
            return null;
        }
    }

    private static readServerError(data: ArrayBuffer, useLittleEndian: boolean = false): ServerToHostMessage.ServerError {
        const view = new DataView(data);
        const errorType = view.getUint16(0, useLittleEndian);
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

    // ACK has no payload, so data here is empty
    private static readServerACK(): ServerToHostMessage.ServerACK {
        return { ack: true };
    }

    private static readNewHostIDGrant(data: ArrayBuffer): ServerToHostMessage.NewHostIdGrant {
        return { hostId: decodeUUID(data.slice(0, 16)) };
    }

    private static readMetadataRequest(data: ArrayBuffer): ServerToHostMessage.ReadMetadata {
        const uploadId = decodeUUID(data.slice(0, 16));
        const path = String.fromCharCode(...new Uint8Array(data.slice(16, -1)));
        return { resourcePath: uploadId + path };
    }

    private static readStreamStartRequest(data: ArrayBuffer, useLittleEndian: boolean = false): ServerToHostMessage.StartStream {
        const resourceId = decodeUUID(data.slice(0, 16));
        const view = new DataView(data);
        const chunkSize = view.getUint32(16, useLittleEndian);
        return { resourcePath: resourceId, chunkSize };
    }

    private static readChunkRequest(data: ArrayBuffer, useLittleEndian: boolean = false): ServerToHostMessage.ChunkRequest {
        const view = new DataView(data);
        const streamId = view.getUint32(0, useLittleEndian);
        const offset = view.getBigUint64(4, useLittleEndian);
        return { streamId, offset };
    }

    private static readEndStreamRequest(data: ArrayBuffer, useLittleEndian: boolean = false): ServerToHostMessage.EndStream {
        const view = new DataView(data);
        const streamId = view.getUint32(0, useLittleEndian);
        return { streamId };
    }
}