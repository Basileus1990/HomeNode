import { RecordHandle, FileRecordHandle } from "../../../common/fs/fs";
import { readFromHandleAsync } from "../../../common/fs/service";

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
    public static async createChunker(handle: FileSystemHandle, chunkSize: number) {
        if (handle.kind === "file") {
            const file = await (handle as FileSystemFileHandle).getFile();
            return new RecordChunker(new FileRecordChunker(file, chunkSize));
        } else {
            throw new Error("Not implemented");
        }
    }

    public async next(offset?: bigint): Promise<ArrayBuffer | null> {
        return this.chunker.next(offset);
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

    public async next(offset?: bigint): Promise<ArrayBuffer | null> {
        const offsetToRead = Number(offset) ?? this.offset;

        if (offsetToRead > this.file.size) {
            return null;
        }

        const slice = this.file.slice(offsetToRead, this.offset + this.chunkSize);
        this.offset += this.chunkSize;
        return slice.arrayBuffer();
    }
}