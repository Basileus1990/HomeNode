import type { RecordInfo, RecordMetadata, RecordKind } from "./types";

namespace OPFS {
    export async function writeFileRecord(
        recordName: string,
        file: File,
        metadata: RecordMetadata,
        dir?: FileSystemDirectoryHandle,
    ): Promise<FileSystemDirectoryHandle> {
        const directoryHandle = dir || (await navigator.storage.getDirectory());
        const recordDirHandle = await directoryHandle.getDirectoryHandle(recordName, { create: true });

        const fileHandle = await recordDirHandle.getFileHandle(recordName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();

        const metadataHandle = await recordDirHandle.getFileHandle("meta.json", { create: true });
        const writableMetadata = await metadataHandle.createWritable();
        await writableMetadata.write(JSON.stringify(metadata));
        await writableMetadata.close();

        return recordDirHandle;
    }


    export async function getFileFromFileRecord(
        recordName: string,
        root?: FileSystemDirectoryHandle
    ): Promise<File> {
        const rootDirectoryHandle = root || (await navigator.storage.getDirectory());
        const recordDirHandle = await rootDirectoryHandle.getDirectoryHandle(recordName);
        for await (const [name, handle] of recordDirHandle.entries()) {
            if (handle.kind === "file" && name !== "meta.json") {
                const fileHandle = handle as FileSystemFileHandle;
                return fileHandle.getFile();
            }
        }
        throw new Error(`No file found in record ${recordName}`);
    }

    export async function getMetadataFromRecord(
        recordName: string,
        root?: FileSystemDirectoryHandle
    ): Promise<RecordMetadata> {
        const rootDirectoryHandle = root || (await navigator.storage.getDirectory());
        const recordDirHandle = await rootDirectoryHandle.getDirectoryHandle(recordName);
        const metadataHandle = await recordDirHandle.getFileHandle("meta.json");
        const file = await metadataHandle.getFile();
        const text = await file.text();
        return JSON.parse(text);
    }

    async function removeRecord(
        recordName: string,
        root?: FileSystemDirectoryHandle
    ): Promise<void> {
        const rootDirectoryHandle = root || (await navigator.storage.getDirectory());
        await rootDirectoryHandle.removeEntry(recordName, { recursive: true });
    }

    export async function listRecords(
        root?: FileSystemDirectoryHandle
    ): Promise<RecordInfo[]> {
        const rootDirectoryHandle = root || (await navigator.storage.getDirectory());
        const records: RecordInfo[] = [];
        for await (const [name, handle] of rootDirectoryHandle.entries()) {
            if (handle.kind === "directory") {
                try {
                    const file = await getFileFromFileRecord(name, rootDirectoryHandle);
                    records.push({
                        name: file.name,
                        size: file.size,
                        kind: file.type,
                        lastModified: file.lastModified,
                    });
                } catch (error) {
                    console.error(`Error reading file from record ${name}:`, error);
                }
            }
        }
        return records;
    }

    export async function clear()
        : Promise<void> {
        const root = await navigator.storage.getDirectory();
        for await (const name of root.keys()) {
            await root.removeEntry(name, { recursive: true });
        }
    }
}

