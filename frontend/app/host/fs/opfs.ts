import type { RecordMetadata } from "./types";
import { NotFileRecordError, InvalidRecordError } from "./types";
import { FileRecordHandle, RecordHandle } from "./records-filesystem";

export namespace OPFS {
    export async function writeFileRecord(
        recordName: string,
        file: File,
        metadata: RecordMetadata,
        dir?: FileSystemDirectoryHandle,
    ): Promise<FileRecordHandle> {
        const directoryHandle = dir || (await navigator.storage.getDirectory());
        const recordDirHandle = await directoryHandle.getDirectoryHandle(recordName, { create: true });

        const fileHandle = await recordDirHandle.getFileHandle(file.name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();

        await writeMetadata(recordDirHandle, metadata);

        const fileRecordHandle = new FileRecordHandle(recordDirHandle);
        await fileRecordHandle.init();
        return fileRecordHandle;
    }

    export async function getFileRecordHandle(
        recordName: string,
        root?: FileSystemDirectoryHandle
    ): Promise<FileRecordHandle> {
        const rootDirectoryHandle = root || (await navigator.storage.getDirectory());
        const recordDirHandle = await rootDirectoryHandle.getDirectoryHandle(recordName);
        const fileRecordHandle = new FileRecordHandle(recordDirHandle);
        await fileRecordHandle.init();
        return fileRecordHandle;
    }

    export async function removeRecord(
        recordName: string,
        root?: FileSystemDirectoryHandle
    ): Promise<void> {
        const rootDirectoryHandle = root || (await navigator.storage.getDirectory());
        await rootDirectoryHandle.removeEntry(recordName, { recursive: true });
    }

    export async function clearStorage(): Promise<void> {
        const rootDirectoryHandle = await navigator.storage.getDirectory();
        for await (const [name] of rootDirectoryHandle.entries()) {
            await rootDirectoryHandle.removeEntry(name, { recursive: true });
        }
    }

    export async function getAllRecords(
        root?: FileSystemDirectoryHandle
    ): Promise<{files: FileRecordHandle[]}> {
        const rootDirectoryHandle = root || (await navigator.storage.getDirectory());
        const records: FileRecordHandle[] = [];
        for await (const [name, handle] of rootDirectoryHandle.entries()) {
            if (handle.kind === "directory") {
                const recordHandle = new RecordHandle(handle as FileSystemDirectoryHandle)
                try {
                    await recordHandle.init();
                    const recordType = await recordHandle.getKind();
                    if (recordType === "file") {
                        const fileRecordHandle = new FileRecordHandle(handle as FileSystemDirectoryHandle);
                        await fileRecordHandle.init();
                        records.push(fileRecordHandle);
                    } else if (recordType === "directory") {
                        // Handle directory records if needed
                    }
                }
                catch (error) {
                    if (error instanceof NotFileRecordError) {
                        console.error(`Not a file record: ${name}`);
                    } else if (error instanceof InvalidRecordError) {
                        console.error(`Invalid record: ${name}`);
                    } else {
                        console.error(`Error initializing record handle for ${name}:`, error);
                    }
                }
            }
        }
        return { files: records };
    }

    async function writeMetadata(
        recordDirHandle: FileSystemDirectoryHandle,
        metadata: RecordMetadata
    ): Promise<void> {
        const metadataHandle = await recordDirHandle.getFileHandle("meta.json", { create: true });
        const writableMetadata = await metadataHandle.createWritable();
        await writableMetadata.write(JSON.stringify(metadata));
        await writableMetadata.close();
    }

    export namespace Worker {
        export async function writeFileRecord(
            recordName: string,
            file: File,
            metadata: RecordMetadata,
            dir?: FileSystemDirectoryHandle,
        ): Promise<FileRecordHandle> {
            const directoryHandle = dir || (await navigator.storage.getDirectory());
            const recordDirHandle = await directoryHandle.getDirectoryHandle(recordName, { create: true });

            const fileHandle = await recordDirHandle.getFileHandle(file.name, { create: true });
            const accessHandle = await fileHandle.createSyncAccessHandle();
            accessHandle.write(await file.arrayBuffer());
            accessHandle.flush();
            accessHandle.close();

            await writeMetadata(recordDirHandle, metadata);

            const fileRecordHandle = new FileRecordHandle(recordDirHandle);
            await fileRecordHandle.init();
            return fileRecordHandle;
        }
        
    }
}