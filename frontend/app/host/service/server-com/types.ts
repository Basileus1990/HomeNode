import type { RecordHandle } from "~/common/fs/records-filesystem";
import type { EncryptionData } from "~/common/crypto";

export interface PrepareStreamMessage {
  type: 'prepare';
  respondentId: number;
  downloadId: number;
  resourceId: string;
  chunkSize: number;
}

export interface RequestChunkMessage {
  type: 'next';
  respondentId: number;
}

export type CoordinatorToStreamer =
  | PrepareStreamMessage
  | RequestChunkMessage;


export interface StreamerReadyMessage {
  type: 'ready';
  respondentId: number;
  downloadId: number;
  chunkSize: number;
  sizeInChunks: number;
  encryption?: EncryptionData;
}

export interface ChunkReadyMessage {
  type: 'chunk';
  respondentId: number;
  downloadId: number;
  chunk: ArrayBuffer;
  encryption?: EncryptionData;
}

export interface EofReachedMessage {
  type: 'eof';
  respondentId: number;
  downloadId: number;
}

export type StreamerToCoordinator =
  | ChunkReadyMessage
  | EofReachedMessage
  | StreamerReadyMessage;


export interface HostIdReceived {
  type: 'hostId';
  hostId: string;
}

export type CoorindatorToUI =
  | HostIdReceived;

// export type UIToCoordinator
