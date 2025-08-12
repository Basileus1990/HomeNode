import type { RecordHandle } from "~/common/fs/records-filesystem";

export interface PrepareStreamMessage {
  type: 'prepare';
  respondentId: number;
  recordHandle: RecordHandle;
}

export interface ChunkMessage {
  type: 'chunk';
  respondentId: number;
  chunk: ArrayBuffer;
}

export interface RequestChunkMessage {
  type: 'next';
  respondentId: number;
}

export interface EofMessage {
  type: 'eof';
  respondentId: number;
}

export type ToCoordinator =
  | ChunkMessage
  | EofMessage;

export type FromCoordinator =
  | PrepareStreamMessage
  | RequestChunkMessage;
