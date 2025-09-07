import { Errors, type RecordMetadata, RecordKind } from "../types";
import { FileRecordHandle, DirectoryRecordHandle, RecordHandle } from "../fs";
import { getRootRecord } from "./root";
import { checkKind } from "./kind";

    /**
     * usable outsiede and inside WebWorker, but not usable in Safari
     */
    export async function createFileRecord(
        name: string,
        dir: FileSystemDirectoryHandle,
        file: File,
        metadata: RecordMetadata
    ): Promise<FileRecordHandle> {
        return FileRecordHandle.createFileRecordAsync(name, dir, file, metadata);
    }

    /**
     * uses sync write - only usable inside WebWorker, but usable on Safari
     */
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

/**
 * tries to read FileRecord or DirectoryRecord based on given FileSystemDirectoryHandle
 * throws InvalidRecordError
 */
export async function readFromHandleAsync(handle: FileSystemDirectoryHandle): Promise<RecordHandle> {
    const recordKind = checkKind(handle.name);
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