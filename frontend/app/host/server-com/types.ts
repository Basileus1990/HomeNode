import type { EncryptionData } from "~/common/crypto";
import type { HomeNodeFrontendConfig } from "~/config";

export interface PrepareStreamMessage {
  type: "prepare";
  respondentId: number;
  streamId: number;
  resourcePath: string;
  chunkSize: number;
}

export interface RequestChunkMessage {
  type: "next";
  respondentId: number;
  offset?: number;
}

export type CoordinatorToStreamWorker =
  | PrepareStreamMessage
  | RequestChunkMessage;


export interface StreamerReadyMessage {
  type: "ready";
  respondentId: number;
  streamId: number;
  chunkSize: number;
  sizeInChunks: number;
  encryption?: EncryptionData;
}

export interface ChunkReadyMessage {
  type: "chunk";
  respondentId: number;
  streamId: number;
  chunk: ArrayBuffer;
  encryption?: EncryptionData;
}

export interface EofReachedMessage {
  type: "eof";
  respondentId: number;
  streamId: number;
}

export interface StreamWorkerErrorMessage {
  type: "error";
  streamId: number;
  message?: string;
}

export type StreamWorkerToCoordinator =
  | ChunkReadyMessage
  | EofReachedMessage
  | StreamerReadyMessage;


export interface HostIdReceived {
  type: "hostId";
  hostId: string;
  hostKey: string;
}

export type CoorindatorToUI =
  | HostIdReceived;


export interface StartCoordinatorMessage {
  type: "start";
  config: HomeNodeFrontendConfig;
  hostId?: string;
  hostKey?: string;
}

export interface StopCoordinatorMessage {
  type: "stop"
}

export type UIToCoordinator =
  | StartCoordinatorMessage
  | StopCoordinatorMessage;