import type { HomeNodeFrontendConfig } from "../../../../../config";

export interface StartStreamMessage {
  type: 'start';
  stream: WritableStream;
  url: string;
  config: HomeNodeFrontendConfig;
}

export interface StreamStartedMessage {
  type: 'started';
  sizeInChunks: number;
}

export interface ChunkMessage {
  type: 'chunk';
  chunkNo: number;
}

export interface EofMessage {
  type: 'eof';
}

export interface DownloadAbortedMessage {
    type: 'aborted'
}

export type FromDownloader =
  | StreamStartedMessage
  | ChunkMessage
  | EofMessage
  | DownloadAbortedMessage

export type ToDownloader =
  | StartStreamMessage
