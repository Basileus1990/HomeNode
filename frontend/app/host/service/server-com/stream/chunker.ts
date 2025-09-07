import { RecordHandle, FileRecordHandle } from "../../../../common/fs/fs";
import { FSService } from "~/common/fs/fs-service";

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
    public static async createChunker(record: RecordHandle, chunkSize: number) {
        if (record.getKind() === "file") {
            const fileRecord = await FSService.readFromHandleAsync(record.getUnderlayingHandle()) as FileRecordHandle;
            const fileHandle = await fileRecord.getHandle();
            const file = await fileHandle.getFile();
            return new RecordChunker(new FileRecordChunker(file, chunkSize));
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
    private chunkSize: number;

    constructor(file: File, chunkSize: number) {
        this.file = file;
        this.chunkSize = chunkSize;
    }

    public async next(): Promise<ArrayBuffer | null> {
        if (this.offset > this.file.size) {
            return null;
        }

        const slice = this.file.slice(this.offset, this.offset + this.chunkSize);
        this.offset += this.chunkSize;
        return slice.arrayBuffer();
    }
}