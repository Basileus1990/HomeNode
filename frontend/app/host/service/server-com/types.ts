import type { RecordHandle } from "~/common/fs/records-filesystem";
import type { EncryptionData } from "~/common/crypto";

export interface PrepareStreamMessage {
  type: 'prepare';
  downloadId: number;
  recordHandle: RecordHandle;
  chunkSize: number;
}

export interface ChunkReadyMessage {
  type: 'chunk';
  respondentId: number;
  chunk: ArrayBuffer;
  encryption?: EncryptionData;
}

export interface RequestChunkMessage {
  type: 'next';
  respondentId: number;
}

export interface EofReachedMessage {
  type: 'eof';
  respondentId: number;
}

export type StreamerToCoordinator =
  | ChunkReadyMessage
  | EofReachedMessage;

export type CoordinatorToStreamer =
  | PrepareStreamMessage
  | RequestChunkMessage;

export interface HostIdReceived {
  type: 'hostId';
  hostId: string;
}

export type CoorindatorToUI =
  | HostIdReceived;

// export type UIToCoordinator
