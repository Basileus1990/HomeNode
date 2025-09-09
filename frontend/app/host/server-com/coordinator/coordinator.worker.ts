import log from "loglevel";

import { HMHostReader } from '../message/readers';
import { HostController } from './controller';
import { StreamWorkerRegistry } from "./stream-worker-registry";
import { type UIToCoordinator } from "../types";

// env's will be reworked
const inactivityTimeout = parseInt(import.meta.env.VITE_STREAMER_INACTIVITY_TIMEOUT);
const cleanupInterval = parseInt(import.meta.env.VITE_STREAMER_CLEANUP_INTERVAL);


const _socket = openSocket('ws://localhost:3000/api/v1/host/connect');
const streamWorkers = new StreamWorkerRegistry();
const handler =  new HostController(_socket, streamWorkers, self.postMessage);


_socket.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
    const msg = HMHostReader.read(event.data);
    if (!msg) {
        log.trace("Host was unable to interpret data from socket");
        log.error("Host received unknown data from socket");
        return;
    }

    const { respondentId, typeNo, payload } = msg;

    if (!payload) {
        log.trace(`Host received message of type: ${typeNo} but was unable to read payload`);
        return;
    }

    await handler.dispatch(respondentId, typeNo, payload);
};

self.onmessage = (event: MessageEvent<UIToCoordinator>) => {
    switch (event.data.type) {
        case ("stop"): 
            log.log("Coordinator worker closing");
            _socket.close();
            log.debug("Host closed socket");
            self.close();
            break;
    }
}


function openSocket(url: string) {
  const socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";
  log.debug("Host opened socket");
  return socket;
}

// kill inactive workers every cleanupInterval
function cleanInactiveWorkers() {
  const now = Date.now();
  for (const [streamId, entry] of streamWorkers.entries()) {
    if (now - entry.lastActive > inactivityTimeout) {
      log.debug(`Coordinator cleaned inactive worker: ${streamId}`);
      entry.worker.terminate();
      streamWorkers.delete(streamId);
    }
  }
}
setInterval(cleanInactiveWorkers, cleanupInterval);