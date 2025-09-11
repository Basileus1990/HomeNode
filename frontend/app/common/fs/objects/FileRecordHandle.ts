import { RecordHandle } from "./RecordHandle";
import { Errors, type RecordMetadata } from "../types";


const FILE_RECORD_PREFIX = "file_"


export class FileRecordHandle extends RecordHandle {
    fileHandle?: FileSystemFileHandle;

    /**
     * DO NOT USE - use factory method
     * can't be made private because of no friend level protection in ts
     */
    constructor(handle: FileSystemDirectoryHandle) {
        super(handle);
    }

    public async init(): Promise<FileRecordHandle> {
        super.init();
        // Find the file handle in the record directory
        for await (const [name, handle] of this._recordHandle.entries()) {
            if (handle.kind === "file" && name !== "meta.json") {
                this.fileHandle = handle as FileSystemFileHandle;
                return this;
            }
        }
        throw new Errors.NotFileRecordError({
            name: "NOT_FILE_RECORD_ERROR",
            message: "No file handle found",
        });
    }

    /**
     * get handle of the stored file
     */
    public async getHandle(): Promise<FileSystemFileHandle> {
        if (!this.fileHandle) {
            await this.init();
        }
        return this.fileHandle as FileSystemFileHandle;
    }

    public async getSize(): Promise<number> {
        if (!this.fileHandle) {
            await this.init();
        }
        const file = await this.fileHandle!.getFile();
        return file.size;
    };

    // Factory methods to create file records
    public static async createFileRecordAsync(
        name: string,
        dir: FileSystemDirectoryHandle,
        file: File,
        metadata: RecordMetadata,
        useSyncWrite: boolean = false): Promise<FileRecordHandle> {
        const recordName = FILE_RECORD_PREFIX + name;
        const newDirectoryHandle = await dir.getDirectoryHandle(recordName, { create: true });

        const fileHandle = await newDirectoryHandle.getFileHandle(file.name, { create: true });
        if (!useSyncWrite) {
            const writable = await fileHandle.createWritable();
            await writable.write({ data: file, type: "write" });
            await writable.close();
        } else {
            const accessHandle = await fileHandle.createSyncAccessHandle();
            const arrayBuffer = await file.arrayBuffer();
            accessHandle.write(arrayBuffer);
            accessHandle.flush();
            accessHandle.close();
        }

        await RecordHandle.createMetadataAsync(newDirectoryHandle, metadata);

        return new FileRecordHandle(newDirectoryHandle).init();
    }
}
