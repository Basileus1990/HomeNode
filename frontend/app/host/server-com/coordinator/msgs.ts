import type { HomeNodeFrontendConfig } from "~/common/config";

export interface HostIdReceived {
  type: "hostId";
  hostId: string;
  hostKey: string;
}

export interface Revalidate {
  type: "revalidate"
}

export type CoorindatorToUI =
  | HostIdReceived
  | Revalidate;


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