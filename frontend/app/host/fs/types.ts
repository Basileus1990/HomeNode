export enum RecordKind {
    file = "file",
    directory = "directory"
}

export interface RecordMetadata {
    contentName: string;
    dateShared: number;
    kind: RecordKind;
}


export interface RecordInfo {
    recordName: string;
    contentName: string;
    kind: RecordKind;
    dateShared: number;
}

export interface FileRecordInfo extends RecordInfo {
    kind: RecordKind.file;
    lastModified: number;
    size: number;
}

export interface DirectoryRecordInfo extends RecordInfo {
    kind: RecordKind.directory;
    entriesNo: number;
}



export class ErrorBase<T extends string> extends Error {
    name: T;
    message: string;
    cause: any;

    constructor({
        name,
        message,
        cause,
    }: {
        name: T;
        message: string;
        cause?: any;
    }) {
        super(message);
        this.name = name;
        this.message = message;
        this.cause = cause;
    }
}

type ErrorName = 
    | "NOT_FILE_RECORD_ERROR"
    | "NOT_DIRECTORY_RECORD_ERROR"
    | "INVALID_RECORD_ERROR";

export class NotFileRecordError extends ErrorBase<ErrorName> { }
;
export class InvalidRecordError extends ErrorBase<ErrorName> { }
;
export class NotDirectoryRecordError extends ErrorBase<ErrorName> { }
;
