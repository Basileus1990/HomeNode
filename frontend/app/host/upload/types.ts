import type { EncryptionData } from "../../common/crypto";


export type FileUploaderWorkerFilePayload = {
    file: File;
    path?: string;
    relativePath?: string;
}

export interface StartUploadMessage {
    type: "start";
    files: FileUploaderWorkerFilePayload[]
    encryption?: EncryptionData;
    root?: FileSystemDirectoryHandle;
}

export type UIToUploaderMessages =
    | StartUploadMessage;

export interface UploadCompletedMessage {
    type: "complete";
    msg: string;
}

export interface UploadFailedMessage {
    type: "fail";
    msg: string;
}

export type UploaderToUIMessages = 
    | UploadCompletedMessage
     | UploadFailedMessage;
