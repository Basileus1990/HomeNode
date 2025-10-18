import type { EncryptionData } from "../../../../common/crypto";


export interface PrepareWorker {
  type: "prepare";
  respondentId: number;
  streamId: number;
  resourcePath: string;
  chunkSize: number;
}

export interface GetChunk {
  type: "next";
  respondentId: number;
  offset?: number;
}

export type ToFileSenderMsg =
  | PrepareWorker
  | GetChunk;


export interface WorkerReady {
  type: "ready";
  respondentId: number;
  streamId: number;
  chunkSize: number;
  sizeInChunks: number;
  encryption?: EncryptionData;
}

export interface ChunkReady {
  type: "chunk";
  respondentId: number;
  streamId: number;
  chunk: ArrayBuffer;
  encryption?: EncryptionData;
}

export interface EofReached {
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

export type FromFileSenderMsg =
  | ChunkReady
  | EofReached
  | WorkerReady
  | Error;
