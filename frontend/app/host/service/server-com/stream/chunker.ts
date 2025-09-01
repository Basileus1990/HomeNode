import { FileRecordHandle, RecordHandle } from "~/common/fs/records-filesystem";

const chunkSize = parseInt(import.meta.env.VITE_CHUNK_SIZE);

/**
 * abstracts generating chunks from files / folders
 * only files supported for now
 */
export class RecordChunker {
    private chunker: FileRecordChunker;

    private constructor(chunker: FileRecordChunker) {
        this.chunker = chunker;
    }

    // factory method dance, because we can't have async constructor, but don't want uninitialized objects laying around
    public static async createChunker(record: RecordHandle) {
        if (record.getKind() === "file") {
            const fileRecord = await RecordHandle.readFromHandleAsync(record.getUnderlayingHandle()) as FileRecordHandle;
            const fileHandle = await fileRecord.getHandle();
            const file = await fileHandle.getFile();
            return new RecordChunker(new FileRecordChunker(file));
        } else {
            throw new Error("Not implemented");
        }
    }

    /**
     * @returns up to VITE_CHUNK_SIZE-bytes long ArrayBuffer or null if EOF reached
     */
    public async next(): Promise<ArrayBuffer | null> {
        return this.chunker.next();
    }
}

class FileRecordChunker {
    private file: File;
    private offset: number = 0;

    constructor(file: File) {
        this.file = file;
    }

    public async next(): Promise<ArrayBuffer | null> {
        if (this.offset > this.file.size) {
            return null;
        }

        const slice = this.file.slice(this.offset, this.offset + chunkSize);
        this.offset += chunkSize;
        return slice.arrayBuffer();
    }
}