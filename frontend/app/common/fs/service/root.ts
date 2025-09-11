import { DirectoryRecordHandle } from "../fs";
import { RecordKind } from "../types";
import { readFromHandleAsync, createDirectoryRecord } from "./factory";
    
/**
 * get root DirectoryRecord at the root of this origin OPFS
 * create if not present
 */
export async function getRootRecord(): Promise<DirectoryRecordHandle> {
    const root = await navigator.storage.getDirectory();

    try {
        const rootRecordHandle = await root.getDirectoryHandle("root");
        return readFromHandleAsync(rootRecordHandle) as Promise<DirectoryRecordHandle>;
    } catch (error) {
        if (error instanceof DOMException && error.name === "NotFoundError") {
            return await createDirectoryRecord("root", root, {
                contentName: "root",
                dateShared: Date.now(),
                kind: RecordKind.directory,
            });
        } else {
            throw error;
        }
    }
}