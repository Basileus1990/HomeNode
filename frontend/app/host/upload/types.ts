import type { EncryptionData } from "~/common/crypto";

export type FileUploaderWorkerFilePayload = {
    file: File;
    path?: string;
    relativePath?: string;
}

export type FileUploaderWorkerMessageType =
    | "upload"
    | "uploadComplete"
    | "uploadError";
    
export type FileUploaderWorkerMessage = {
    type: FileUploaderWorkerMessageType;
    payload?: FileUploaderWorkerFilePayload[];
    msg?: string;
    encryption?: EncryptionData;
}

