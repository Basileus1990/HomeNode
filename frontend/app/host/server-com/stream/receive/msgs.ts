import type { EncryptionData } from "../../../../common/crypto";


export interface PrepareReceiver {
  type: "prepare";
  respondentId: number;
  streamId: number;
  resourcePath: string;
  chunkSize: number;
  fileSize: number;
}

export interface Prompt {
  type: "next";
  respondentId: number;
}

export interface UploadChunk {
  type: "data";
  respondentId: number;
  chunk: ArrayBuffer;
}

export type ToFileReceiverMsg =
  | PrepareReceiver
  | Prompt
  | UploadChunk;


export interface ReceiverReady {
  type: "ready";
  respondentId: number;
  streamId: number;
}

export interface HostChunkRequest {
  type: "chunk";
  respondentId: number;
  streamId: number;
  offset: bigint;
}

export interface UploadAck {
  type: "ack";
  respondentId: number;
  streamId: number;
}

export interface UploadEnd {
  type: "eof";
  respondentId: number;
  streamId: number;
}

export interface Error {
  type: "error";
  streamId: number;
  errorType: number;
  message?: string;
}

export type FromFileReceiverMsg =
  | ReceiverReady
  | HostChunkRequest
  | UploadAck
  | UploadEnd
  | Error;
