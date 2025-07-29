import { Errors, type RecordMetadata, RecordKind, type Items } from "~/common/fs/types";
import { RecordHandle, FileRecordHandle, DirectoryRecordHandle, FILE_RECORD_PREFIX, DIR_RECORD_PREFIX } from "~/common/fs/records-filesystem";

export namespace FSService {
    export async function getRootRecord() {
        const root = await navigator.storage.getDirectory();
        return await createDirectoryRecord("root", root, {
            contentName: "root",
            dateShared: Date.now(),
            kind: RecordKind.directory,
        });
    }

    export async function getStorageRoot(): Promise<FileSystemDirectoryHandle> {
        return await navigator.storage.getDirectory();
    }

    export async function purgeStorage() {
        const root = await navigator.storage.getDirectory();
            for await (const key of root.keys()) {
            await root.removeEntry(key, { recursive: true });
        }
    }

    /***********************
    * Create record region *
    ***********************/

    export async function createFileRecord(
        name: string,
        dir: FileSystemDirectoryHandle,
        file: File,
        metadata: RecordMetadata
    ): Promise<FileRecordHandle> {
        return FileRecordHandle.createFileRecordAsync(name, dir, file, metadata);
    }

    export async function createFileRecordWithSyncWrite(
        name: string,
        dir: FileSystemDirectoryHandle,
        file: File,
        metadata: RecordMetadata
    ): Promise<FileRecordHandle> {
        return FileRecordHandle.createFileRecordAsync(name, dir, file, metadata, true);
    }

    export async function createDirectoryRecord(
        name: string,
        dir: FileSystemDirectoryHandle,
        metadata: RecordMetadata
    ): Promise<DirectoryRecordHandle> {
        return DirectoryRecordHandle.createDirectoryRecordAsync(name, dir, metadata);
    }

    export async function createRecordInRoot(
        name: string,
        metadata: RecordMetadata,
        kind: RecordKind,
        file?: File
    ) {
        const root = (await getRootRecord()).getUnderlayingHandle();
        if (kind === RecordKind.file) {
            if (!file) {
                throw new Error("File is required for file record creation");
            }
            return FileRecordHandle.createFileRecordAsync(name, root, file, metadata);
        } else if (kind === RecordKind.directory) {
            return DirectoryRecordHandle.createDirectoryRecordAsync(name, root, metadata);
        } else {
            throw new Errors.InvalidRecordError({
                name: "INVALID_RECORD_ERROR",
                message: `Unsupported record kind: ${kind}`,
            });
        }
    }

    export async function createRecord(
        name: string,
        metadata: RecordMetadata,
        kind: RecordKind,
        file?: File,
        dir?: FileSystemDirectoryHandle
    ) {
        const root = dir || (await getRootRecord()).getUnderlayingHandle();
        if (kind === RecordKind.file) {
            if (!file) {
                throw new Error("File is required for file record creation");
            }
            return FileRecordHandle.createFileRecordAsync(name, root, file, metadata);
        } else if (kind === RecordKind.directory) {
            return DirectoryRecordHandle.createDirectoryRecordAsync(name, root, metadata);
        } else {
            throw new Errors.InvalidRecordError({
                name: "INVALID_RECORD_ERROR",
                message: `Unsupported record kind: ${kind}`,
            });
        }
    }

    /***********************
    * Delete record region *
    ***********************/

    export async function deleteRecord(recordName: string, dir?: FileSystemDirectoryHandle): Promise<boolean> {
        const root = dir || (await getRootRecord()).getUnderlayingHandle();
        
        const findItemToDelete = async (name: string, dir: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle | null> => {
            for await (const [key, value] of dir.entries()) {
                if (key.includes(name)) {
                    return dir;
                } else if (value.kind === "directory") {
                    const res = await findItemToDelete(name, value as FileSystemDirectoryHandle);
                    if (res) {
                        return res;
                    }
                }
            }
            return null;
        };

        const dirWithRecordToDelete = await findItemToDelete(recordName, root);
        if (dirWithRecordToDelete) {
            await dirWithRecordToDelete.removeEntry(recordName, { recursive: true });
            return true;
        }
        return false;
    }

    export async function prepareData(record: RecordHandle | null): Promise<Items.RecordItem[]> {
        async function readFileRecord(handle: FileRecordHandle): Promise<Items.FileRecordItem> {
            const file = await handle.getHandle().then((h) => h.getFile());
            const metadata = await handle.getMetadata();
            return {
                recordName: handle.getName().replace(FILE_RECORD_PREFIX, ""),
                contentName: metadata.contentName,
                kind: RecordKind.file,
                lastModified: file.lastModified,
                size: file.size,
                dateShared: metadata.dateShared,
            } as Items.FileRecordItem;
        }

        async function readDirectoryRecord(handle: DirectoryRecordHandle): Promise<Items.DirectoryRecordItem> {
            const metadata = await handle.getMetadata();
            return {
                    recordName: handle.getName().replace(DIR_RECORD_PREFIX, ""),
                    contentName: metadata.contentName,
                    dateShared: metadata.dateShared,
                    kind: RecordKind.directory,
                    entriesNo: 0, //TODO: Placeholder for entries count
            } as Items.DirectoryRecordItem;
        }


        if (!record) {
            console.log("No record found for the given ID.");
            return [];
        }

        const recordInfos: Items.RecordItem[] = [];
        if (record.getKind() === RecordKind.directory) {
            const dir = record as DirectoryRecordHandle;
            for await (const [key, handle] of dir.entries()) {
                const rec = await handle as RecordHandle;
                const kind = rec.getKind();
                if (kind === RecordKind.file) {
                    recordInfos.push(await readFileRecord(rec as FileRecordHandle));
                } else if (kind === RecordKind.directory) {
                    recordInfos.push(await readDirectoryRecord(rec as DirectoryRecordHandle));
                }
            }
        } else if (record.getKind() === RecordKind.file) {
            console.log("Got file record:", record);
            recordInfos.push(await readFileRecord(record as FileRecordHandle));
        }
        
        console.log("Prepared record infos:", recordInfos);
        return recordInfos;
    }
}


