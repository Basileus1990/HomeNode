import log from "loglevel";
log.setLevel("DEBUG");

import { HMHostReader } from '../message/readers';
import { HostController } from './controller';
import { WorkerRegistry } from "./stream-worker-registry";
import type { UIToCoordinator } from "../types";
import type { HomeNodeFrontendConfig } from "../../../common/config";
import { getHostConnectionURL } from "../../service/url-service";

let _config: HomeNodeFrontendConfig;
let _socket: WebSocket;
const streamWorkers = new WorkerRegistry();
let _controller: HostController;


self.onmessage = (event: MessageEvent<UIToCoordinator>) => {
    switch (event.data.type) {
        case "start": {
            _config = event.data.config;
            const url = getHostConnectionURL(_config, event.data.hostId, event.data.hostKey);
            _socket = openSocket(url);
            _controller = new HostController(_socket, _config, streamWorkers, (message: any) => self.postMessage(message));
            setInterval(cleanInactiveWorkers, _config.streamer_cleanup_interval);
            log.log("Coordinator initialized");
            break;
        }
        case "stop": {
            log.log("Coordinator worker closing");
            _socket.close();
            log.debug("Host closed socket");
            self.close();
            break;
        }
    }
}


function openSocket(url: string) {
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    log.debug("Host opened socket");

    socket.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
        const msg = HMHostReader.read(event.data, _config);
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

        await _controller.dispatch(respondentId, typeNo, payload);
    };

    return socket;
}

// kill inactive workers every cleanupInterval
function cleanInactiveWorkers() {
  const now = Date.now();
  for (const [streamId, entry] of streamWorkers.entries()) {
    if (now - entry.lastActive > _config.streamer_inactivity_timeout) {
      log.debug(`Coordinator cleaned inactive worker: ${streamId}`);
      entry.worker.terminate();
      streamWorkers.delete(streamId);
    }
  }
}