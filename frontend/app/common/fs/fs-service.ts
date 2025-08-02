import { Errors, type RecordMetadata, RecordKind, type Items } from "./types";
import { RecordHandle, FileRecordHandle, DirectoryRecordHandle, FILE_RECORD_PREFIX, DIR_RECORD_PREFIX } from "./records-filesystem";

export namespace FSService {
    export async function getRootRecord(): Promise<DirectoryRecordHandle> {
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

    /***********************
    * Read record region *
    ***********************/

    export async function readRecordIntoItem(record: RecordHandle | null): Promise<Items.RecordItem[]> {
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

        const items: Items.RecordItem[] = [];
        if (record.getKind() === RecordKind.directory) {
            const dir = record as DirectoryRecordHandle;
            console.log(dir);
            for await (const [key, handle] of dir.entries()) {
                const rec = await handle;
                const kind = rec.getKind();
                if (kind === RecordKind.file) {
                    items.push(await readFileRecord(rec as FileRecordHandle));
                } else if (kind === RecordKind.directory) {
                    items.push(await readDirectoryRecord(rec as DirectoryRecordHandle));
                }
            }
        } else if (record.getKind() === RecordKind.file) {
            items.push(await readFileRecord(record as FileRecordHandle));
        }
        
        console.log(items);
        return items;
    }

    /***********************
    * Find record region *
    ***********************/

    export async function findRecordByName(recordName: string, dir?: FileSystemDirectoryHandle, recursive: boolean = false): Promise<RecordHandle | null> {
        const root = dir || (await getRootRecord()).getUnderlayingHandle();
        
        const _findRecord = async (dir: FileSystemDirectoryHandle): Promise<RecordHandle | null> => {
            for await (const [key, handle] of dir.entries()) {
                if (handle.name.includes(recordName)) {
                    return RecordHandle.readFromHandleAsync(handle as FileSystemDirectoryHandle);
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
                        return (await RecordHandle.readFromHandleAsync(handle as FileSystemDirectoryHandle)).init();
                    } else if (recursive === true && RecordHandle.checkKind(handle.name) === RecordKind.directory) {
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
}


