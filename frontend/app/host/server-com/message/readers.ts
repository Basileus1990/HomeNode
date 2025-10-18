import { decodePerJson, decodeUUID } from "../../../common/server-com/binary";
import type { HomeNodeFrontendConfig } from "../../../common/config";


export namespace ServerToHostMessage {
    export enum Types {
        Error = 0,
        Ack = 1,

        InitWithUuidQuery = 2,
        InitWithExistingHost = 11,

        MetadataRequest = 3,

        DownloadFileInitStreamRequest = 5,
        DownloadFileChunkRequest = 7,
        DownloadFileEndStreamRequest = 10,

        UploadFileInitStreamRequest = 14,
        UploadFileChunkPrompt = 17,
        UploadFileChunkResponse = 19,

        CreateDirectoryRequest = 12,
        DeleteResourceRequest = 13,
    }

    export type Error = {
        errorType: number;
        errorInfo?: object;  // deserialized from JSON, contains additional information
    }
    export type Ack = {
        ack: boolean;
    }
    export type NewHostIdGrant = {
        hostId: string; // UUID really
        hostKey: string;
    }
    export type Metadata = {
        path: string;
    }
    export type DownloadFileInitStream = {
        path: string;
    }
    export type DownloadFileChunkRequest = {
        streamId: number;
        offset: BigInt;
    }
    export type DownloadFileEndStream = {
        streamId: number;
    }
    export type ExistingHostInit = {
    }
    export type CreateDirectory = {
        path: string;
    }
    export type Delete = {
        path: string;
    }
    export type UploadFileInitStream = {
        path: string;
        fileSize: number;
    }
    export type UploadFileChunkPrompt = {
        streamId: number;
    }
    export type UploadFileChunk = {
        streamId: number;
        chunk: ArrayBuffer;
    }

    export type Contents =
      | Error
      | Ack
      | NewHostIdGrant
      | Metadata
      | DownloadFileInitStream
      | DownloadFileChunkRequest
      | DownloadFileEndStream
      | ExistingHostInit
      | CreateDirectory
      | Delete
      | UploadFileInitStream
      | UploadFileChunk
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
                case ServerToHostMessage.Types.Error: 
                    return this.readError(data, useLittleEndian);
                case ServerToHostMessage.Types.Ack: 
                    return this.readAck();
                case ServerToHostMessage.Types.InitWithUuidQuery:
                    return this.readNewHostIDGrant(data);
                case ServerToHostMessage.Types.MetadataRequest:
                    return this.readMetadataRequest(data);
                case ServerToHostMessage.Types.DownloadFileInitStreamRequest:
                    return this.readDownloadFileInitStreamRequest(data);
                case ServerToHostMessage.Types.DownloadFileChunkRequest:
                    return this.readDownloadFileChunkRequest(data, useLittleEndian);
                case ServerToHostMessage.Types.DownloadFileEndStreamRequest:
                    return this.readDownloadFileEndStreamRequest(data, useLittleEndian);
                case ServerToHostMessage.Types.InitWithExistingHost:
                    return {};
                case ServerToHostMessage.Types.CreateDirectoryRequest:
                    return this.readCreateDirectoryRequest(data);
                case ServerToHostMessage.Types.DeleteResourceRequest:
                    return this.readDeleteResourceRequest(data);
                case ServerToHostMessage.Types.UploadFileInitStreamRequest: 
                    return this.readUploadFileInitStreamRequest(data, useLittleEndian);
                case ServerToHostMessage.Types.UploadFileChunkPrompt:
                    return this.readUploadFileChunkPrompt(data, useLittleEndian);
                case ServerToHostMessage.Types.UploadFileChunkResponse:
                    return this.readUploadFileChunkResponse(data, useLittleEndian);
                default:
                    return null;
            }
        } catch (error) {
            return null;
        }
    }

    private static readError(data: ArrayBuffer, useLittleEndian: boolean = false): ServerToHostMessage.Error {
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
    private static readAck(): ServerToHostMessage.Ack {
        return { ack: true };
    }

    private static readNewHostIDGrant(data: ArrayBuffer): ServerToHostMessage.NewHostIdGrant {
        const hostId = decodeUUID(data.slice(0, 16));
        const decoder = new TextDecoder();
        const hostKey = decoder.decode(data.slice(16, -1));
        return { hostId, hostKey };
    }

    private static readMetadataRequest(data: ArrayBuffer): ServerToHostMessage.Metadata {
        const uploadId = decodeUUID(data.slice(0, 16));
        const path = String.fromCharCode(...new Uint8Array(data.slice(16, -1)));
        return { path: uploadId + path };
    }

    private static readDownloadFileInitStreamRequest(data: ArrayBuffer): ServerToHostMessage.DownloadFileInitStream {
        const resourceId = decodeUUID(data.slice(0, 16));
        const path = String.fromCharCode(...new Uint8Array(data.slice(16, -1)));
        return { path: resourceId + path };
    }

    private static readDownloadFileChunkRequest(data: ArrayBuffer, useLittleEndian: boolean = false): ServerToHostMessage.DownloadFileChunkRequest {
        const view = new DataView(data);
        const streamId = view.getUint32(0, useLittleEndian);
        const offset = view.getBigUint64(4, useLittleEndian);
        return { streamId, offset };
    }

    private static readDownloadFileEndStreamRequest(data: ArrayBuffer, useLittleEndian: boolean = false): ServerToHostMessage.DownloadFileEndStream {
        const view = new DataView(data);
        const streamId = view.getUint32(0, useLittleEndian);
        return { streamId };
    }

    private static readCreateDirectoryRequest(data: ArrayBuffer): ServerToHostMessage.CreateDirectory {
        const uploadId = decodeUUID(data.slice(0, 16));
        const path = String.fromCharCode(...new Uint8Array(data.slice(16, -1)));
        return { path: uploadId + path };
    }

    private static readDeleteResourceRequest(data: ArrayBuffer): ServerToHostMessage.Delete {
        const uploadId = decodeUUID(data.slice(0, 16));
        const path = String.fromCharCode(...new Uint8Array(data.slice(16, -1)));
        return { path: uploadId + path };
    }

    private static readUploadFileInitStreamRequest(data: ArrayBuffer, useLittleEndian: boolean) {
        const resourceId = decodeUUID(data.slice(0, 16));
        const view = new DataView(data);
        const fileSize = view.getUint32(16, useLittleEndian);
        const path = String.fromCharCode(...new Uint8Array(data.slice(20, -1)));
        return { path: resourceId + path, fileSize };
    }

    private static readUploadFileChunkPrompt(data: ArrayBuffer, useLittleEndian: boolean): ServerToHostMessage.UploadFileChunkPrompt {
        const view = new DataView(data);
        const streamId = view.getUint32(0, useLittleEndian)
        return { streamId };
    }

    private static readUploadFileChunkResponse(data: ArrayBuffer, useLittleEndian: boolean): ServerToHostMessage.UploadFileChunk {
        const view = new DataView(data);
        const streamId = view.getUint32(0, useLittleEndian);
        const chunk = data.slice(4);
        return { streamId, chunk };
    }
}