import type { RecordMetadata } from "./types";
import { Errors, RecordKind } from "./types";

export const META_FILE = "meta.json"
export const FILE_RECORD_PREFIX = "file_"
export const DIR_RECORD_PREFIX = "dir_"

export class RecordHandle {
    protected _recordHandle: FileSystemDirectoryHandle; // handle to folder
    private _metadata?: RecordMetadata = undefined;

    /**
     * DO NOT USE - use factory method
     */
    constructor(handle: FileSystemDirectoryHandle) {
        this._recordHandle = handle;
    }

    /**
     * MUST be called before using the object, can't be in contructor as it's async
     */
    public async init(): Promise<RecordHandle> {
        await this.readMetadata();
        return this;
    }

    /**
     * loads metadata from json file into oject
     */
    private async readMetadata() {
        const metadataFile = await this._recordHandle.getFileHandle(META_FILE);
        if (!metadataFile) {
            throw new Errors.InvalidRecordError({
                name: "INVALID_RECORD_ERROR",
                message: "Metadata file not found",
            });
        }
        await metadataFile.getFile()
                .then(file => file.text())
                .then(text => JSON.parse(text))
                .then(parsed => this._metadata = parsed as RecordMetadata)
    }

    public getName(): string {
        return this._recordHandle.name;
    }

    public getUnderlayingHandle(): FileSystemDirectoryHandle {
        return this._recordHandle;
    }

    public static checkKind(name: string): RecordKind | undefined {
        if (name.includes(FILE_RECORD_PREFIX))
            return RecordKind.file
        else if (name.includes(DIR_RECORD_PREFIX))
            return RecordKind.directory
        else
            return undefined
    }

    public getKind(): RecordKind {
        const kind = RecordHandle.checkKind(this._recordHandle.name);
        if (kind)
            return kind
        else
            throw new Errors.InvalidRecordError({
                name: "INVALID_RECORD_ERROR",
                message: "Cannot identify record type from handle.name",
            });
    }

    public async getMetadata(): Promise<RecordMetadata> {
        if (!this._metadata) {
            await this.readMetadata()
        }
        return this._metadata as RecordMetadata;
    }

    // Factory methods to create records

    /**
     * tries to read FileRecord or DirectoryRecord based on given FileSystemDirectoryHandle
     * throws InvalidRecordError
     */
    public static async readFromHandleAsync(handle: FileSystemDirectoryHandle): Promise<RecordHandle> {
        const recordKind = RecordHandle.checkKind(handle.name);
        if (recordKind === RecordKind.directory) {
            return new DirectoryRecordHandle(handle).init();
        } else if (recordKind === RecordKind.file) {
            return new FileRecordHandle(handle).init();
        } else {
            throw new Errors.InvalidRecordError({
                name: "INVALID_RECORD_ERROR",
                message: "Cannot identify record type from handle.name",
            });
        }
    }

    protected static async createMetadataAsync(dir: FileSystemDirectoryHandle, metadata: RecordMetadata) {
        const metadataHandle = await dir.getFileHandle("meta.json", { create: true });
        const writableMetadata = await metadataHandle.createWritable();
        await writableMetadata.write(JSON.stringify(metadata));
        await writableMetadata.close();
    }
}

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
            await writable.write({data: file, type: "write"});
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

export class DirectoryRecordHandle extends RecordHandle {
    /** 
     * DO NOT USE - use factory method
     */
    constructor(handle: FileSystemDirectoryHandle) {
        super(handle);
    }

    public async init(): Promise<DirectoryRecordHandle> {
        await super.init();
        return this;
    }

    /**
     * [name, RecordHandle] generator iterating over records in this directory
     */
    public async *entries(): AsyncGenerator<[string, Promise<RecordHandle>]> {
        for await (const [key, value] of this._recordHandle.entries()) {
            if (value.kind === "directory") {
                yield [key, RecordHandle.readFromHandleAsync(value as FileSystemDirectoryHandle)];
            } 
        }
    }

    /**
     * null if not found
     *  */ 
    public async findByName(recordName: string, recursive: boolean = false) {
        async function _find(recordName: string, dir: FileSystemDirectoryHandle, recursive: boolean = false): Promise<RecordHandle | null> {
            for await (const handle of dir.values()) {
                if (handle.kind === "directory") {
                    if (handle.name.includes(recordName)) {
                        return (await RecordHandle.readFromHandleAsync(handle as FileSystemDirectoryHandle)).init();
                    }
                    else if (recursive === true && RecordHandle.checkKind(handle.name) === RecordKind.directory) {
                        const res = await _find(recordName, handle as FileSystemDirectoryHandle, recursive);
                        if (res) {
                            return res;
                        }
                    }
                }
            }
            return null;
        }

        return _find(recordName, this._recordHandle, recursive);
    }

    /** 
     * create INSIDE this directory
     */
    public async createFileRecord(name: string, file: File, metadata: RecordMetadata, useSyncWrite: boolean = false) {
        return FileRecordHandle.createFileRecordAsync(name, this._recordHandle, file, metadata, useSyncWrite);
    }

    /**
     * create INSIDE this directory
     */
    public async createDirectoryRecord(name: string, metadata: RecordMetadata) {
        return DirectoryRecordHandle.createDirectoryRecordAsync(name, this._recordHandle, metadata);
    }

    public async removeRecord(recordName: string) {
        return this._recordHandle.removeEntry(recordName, { recursive: true });
    }

    // Factory methods to create directory records

    public static async createDirectoryRecordAsync(
        name: string,
        dir: FileSystemDirectoryHandle,
        metadata: RecordMetadata
    ): Promise<DirectoryRecordHandle> {
        const recordName = DIR_RECORD_PREFIX + name;
        const newDirectoryHandle = await dir.getDirectoryHandle(recordName, { create: true });

        await RecordHandle.createMetadataAsync(newDirectoryHandle, metadata);

        return new DirectoryRecordHandle(newDirectoryHandle).init();
    }
}