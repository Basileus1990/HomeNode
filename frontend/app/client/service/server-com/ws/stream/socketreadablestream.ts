import { HMClientReader, SocketToClientMessageTypes } from "../message/readers";
import type { ToDownloader } from "./types";
import { FlagService } from "~/common/server-com/binary";


function createSocketReadableStream(url: string, reader: HMClientReader) {
  return new ReadableStream({
    start(controller) {
      const socket = new WebSocket(url);
      socket.binaryType = "arraybuffer";

      socket.onmessage = (event) => {
        const msg = reader.read(event.data);

        if (!msg) {
          console.error("Unable to interpret data from socket");
          return;
        }

        switch (msg.typeNo) {
          case SocketToClientMessageTypes.DownloadInitResponse:
            self.postMessage({
              type: 'started',
              sizeInChunks: msg.payload.sizeInChunks,
            });

            // You can emit a control message into the stream too if needed
            break;

          case SocketToClientMessageTypes.ChunkResponse:
            controller.enqueue(msg.payload); // write to stream
            self.postMessage({
              type: 'chunk',
              // chunkNo: ++_chunkCounter,
            });
            break;

          case SocketToClientMessageTypes.EOFResponse:
            controller.close(); // signal end of stream
            self.postMessage({ type: 'eof' });
            break;

          default:
            // Optional: emit control messages if needed
            break;
        }
      };

      socket.onerror = () => {
        self.postMessage({ type: 'aborted' });
        controller.error(new Error("WebSocket error"));
        socket.close();
      };
    }
  });
}
