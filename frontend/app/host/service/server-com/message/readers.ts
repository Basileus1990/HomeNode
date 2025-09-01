import { disassemble, useLittleEndian, FlagService } from './binary'
import { decryptBuffer } from "../../crypto";

/**
 * type for output from reader
 */
export type HReaderOut = {
    respondentId: number, 
    typeNo: FromSocketMessageTypes,
    flags: number, 
    payload: any
}

/**
 * ! numbers / names are placeholders
 * types of messages from server to host
 */
export enum FromSocketMessageTypes {
    Error = 0,
    RecordInfoRequest = 1,
    ResourceDownloadRequest = 2,
    ChunkRequest = 3,
}

/**
 * takes binary message from server and translates it into format suitable for later usage
 * reads message payload based on it's type
 * errors are either fault of messed up message or wrong typeNo - impossible to tell which one - and largely left to caller
 */
export class HMReader {
    public read(data: ArrayBuffer, parms?: any): HReaderOut | null {
        const { respondentId, typeNo, flags, payload } = disassemble(data);
        const interpretedData = this.interpreter(typeNo, payload, parms);
        return { respondentId, typeNo, flags, payload: interpretedData };
    }

    // here goes logic for reading each type of message
    // nothing is type safe, we're no longer in strictly-typed land
    // use parms object to pass additional information
    private interpreter(typeNo: number, data: ArrayBuffer, parms?: any): any {
        switch (typeNo) {
            case FromSocketMessageTypes.RecordInfoRequest: {
                const recordIdBytes = data.slice(0, 16);
                const recordId = new TextDecoder().decode(recordIdBytes);
                return recordId;
            }
            case FromSocketMessageTypes.ChunkRequest: {
                const view = new DataView(data);
                const downloadId = view.getUint32(0, useLittleEndian);
                const batchNo = view.getUint32(4, useLittleEndian);
                return { downloadId, batchNo };
            }
            default:
                return null;
        }
    }
}

function decodePerJson(data: ArrayBuffer): object {
    return JSON.parse(new TextDecoder().decode(data));
}