import { RecordHandle } from "../fs";
import { RecordKind } from "../types";
import { getRootRecord } from "./root";
import { checkKind } from "./kind";
import { readFromHandleAsync } from "./factory";


export async function findRecordByName(recordName: string, dir?: FileSystemDirectoryHandle, recursive: boolean = false): Promise<RecordHandle | null> {
    const root = dir || (await getRootRecord()).getUnderlayingHandle();
    
    const _findRecord = async (dir: FileSystemDirectoryHandle): Promise<RecordHandle | null> => {
        for await (const [key, handle] of dir.entries()) {
            if (handle.name.includes(recordName)) {
                return readFromHandleAsync(handle as FileSystemDirectoryHandle);
            } else if (handle.kind === "directory" && recursive) {
                const res = await _findRecord(handle as FileSystemDirectoryHandle);
                if (res) {
                    return res;
                }
            }
        }
        return null;
    };

    return await _findRecord(root);
}

export async function findAnyRecord(
    validatorFunc: (record: RecordHandle) => boolean, 
    dir?: FileSystemDirectoryHandle,
    recursive: boolean = false): Promise<RecordHandle | null> {
    const root = dir || (await getRootRecord()).getUnderlayingHandle();
    
    const _findRecord = async (dir: FileSystemDirectoryHandle): Promise<RecordHandle | null> => {
        for await (const [key, handle] of dir.entries()) {
            if (handle.kind === "directory") {
                const record = new RecordHandle(handle as FileSystemDirectoryHandle);
                if (validatorFunc(record)) {
                    return (await readFromHandleAsync(handle as FileSystemDirectoryHandle)).init();
                } else if (recursive === true && checkKind(handle.name) === RecordKind.directory) {
                    const res = await _findRecord(handle as FileSystemDirectoryHandle);
                    if (res) {
                        return res;
                    }
                }
            }
        }
        return null;
    };

    return await _findRecord(root);
}