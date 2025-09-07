import { RecordHandle } from "../fs";
import { getRootRecord } from "./root";

    export async function deleteRecordByName(recordName: string, dir?: FileSystemDirectoryHandle, recursive: boolean = false): Promise<boolean> {
        const root = dir || (await getRootRecord()).getUnderlayingHandle();
        
        const _findItemToDelete = async (dir: FileSystemDirectoryHandle): Promise<[FileSystemHandle, FileSystemDirectoryHandle] | null> => {
            for await (const [key, handle] of dir.entries()) {
                if (key.includes(recordName)) {
                    return [handle, dir];
                } else if (handle.kind === "directory" && recursive) {
                    const res = await _findItemToDelete(handle as FileSystemDirectoryHandle);
                    if (res) {
                        return res;
                    }
                }
            }
            return null;
        };

        const res = await _findItemToDelete(root);
        if (res) {
            const [itemToDelete, dirWithItemToDelete] = res;
            await dirWithItemToDelete.removeEntry(itemToDelete.name, { recursive: true });
            return true;
        }
        return false;
    }

    export async function deleteAnyRecord(
        validatorFunc: (record: RecordHandle) => boolean, 
        dir?: FileSystemDirectoryHandle,
        recursive: boolean = false): Promise<boolean> {
        const root = dir || (await getRootRecord()).getUnderlayingHandle();
        
        const findItemToDelete = async (dir: FileSystemDirectoryHandle): Promise<[FileSystemHandle, FileSystemDirectoryHandle] | null> => {
            for await (const [key, handle] of dir.entries()) {
                const record = new RecordHandle(handle as FileSystemDirectoryHandle);
                if (validatorFunc(record)) {
                    return [handle, dir];
                } else if (handle.kind === "directory" && recursive) {
                    const res = await findItemToDelete(handle as FileSystemDirectoryHandle);
                    if (res) {
                        return res;
                    }
                }
            }
            return null;
        };

        const res = await findItemToDelete(root);
        if (res) {
            const [itemToDelete, dirWithItemToDelete] = res;
            await dirWithItemToDelete.removeEntry(itemToDelete.name, { recursive: true });
            return true;
        }
        return false;
    }