import { FileRecordHandle } from "./FileRecordHandle";
import { RecordHandle } from "./RecordHandle";
import { RecordKind, type RecordMetadata } from "../types";
import { DIR_RECORD_PREFIX } from "./config"
import { checkKind, readFromHandleAsync } from "../service";


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
                yield [key, readFromHandleAsync(value as FileSystemDirectoryHandle)];
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
                        return (await readFromHandleAsync(handle as FileSystemDirectoryHandle)).init();
                    }
                    else if (recursive === true && checkKind(handle.name) === RecordKind.directory) {
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

    public async getSize(): Promise<number> {
        let size = 0;
        for await (const [_, record] of this.entries()) {
            const recordSize = (await record).getSize();
            size += await recordSize;
        }
        return size;
    };

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
