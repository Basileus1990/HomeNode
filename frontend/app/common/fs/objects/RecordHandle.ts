import { type RecordMetadata, Errors, RecordKind } from "../types";
import { META_FILE } from "./config";
import { checkKind } from "../service";


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
            .then(parsed => this._metadata = parsed as RecordMetadata);
    }

    public getName(): string {
        return this._recordHandle.name;
    }

    public getUnderlayingHandle(): FileSystemDirectoryHandle {
        return this._recordHandle;
    }

    public getKind(): RecordKind {
        const kind = checkKind(this._recordHandle.name);
        if (kind)
            return kind;

        else
            throw new Errors.InvalidRecordError({
                name: "INVALID_RECORD_ERROR",
                message: "Cannot identify record type from handle.name",
            });
    }

    public async getMetadata(): Promise<RecordMetadata> {
        if (!this._metadata) {
            await this.readMetadata();
        }
        return this._metadata as RecordMetadata;
    }

    public async getSize(): Promise<number> {
        return 0;
    };

    protected static async createMetadataAsync(dir: FileSystemDirectoryHandle, metadata: RecordMetadata) {
        const metadataHandle = await dir.getFileHandle(META_FILE, { create: true });
        const writableMetadata = await metadataHandle.createWritable();
        await writableMetadata.write(JSON.stringify(metadata));
        await writableMetadata.close();
    }
}
