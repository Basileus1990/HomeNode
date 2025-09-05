import { HMClientReader, SocketToClientMessageTypes } from "../message/readers";
import type { ToDownloader } from "./types";
import { FlagService } from "~/common/communication/binary";

const _reader = new HMClientReader();

let _stream: WritableStream;
let _writer: WritableStreamDefaultWriter;
let _socket: WebSocket;
let _url: string;
let _chunkCounter = 0;


self.onmessage = (e: MessageEvent<ToDownloader>) => {
    const msg = e.data;

    switch (msg.type) {
        case 'start': {
            _stream = msg.stream;
            _writer = _stream.getWriter();
            _url = msg.url;

            _socket = getSocket(_url);
            break;
        }
    }
}


function getSocket(url: string) {
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";

    socket.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
        const msg = _reader.read(event.data);
        let salt: Uint8Array;
        let iv: Uint8Array;

        if (!msg) {
            console.error("Unable to interpret data from socket");
            return;
        }

        switch (msg.typeNo) {
            case SocketToClientMessageTypes.StreamStartResponse: {
                self.postMessage({
                    type: 'started',
                    sizeInChunks: msg.payload.sizeInChunks,
                });

                if (FlagService.isEncrypted(msg.flags)) {
                    salt = msg.payload.salt;
                    iv = msg.payload.iv;
                }
                break;
            }
            case SocketToClientMessageTypes.ChunkResponse: {
                _writer.write(msg.payload);
                self.postMessage({
                    type: 'chunk',
                    chunkNo: ++_chunkCounter,
                });
                break;
            }
            case SocketToClientMessageTypes.EOFResponse: {
                _writer.close();
                self.postMessage({
                    type: 'eof',
                });
                break;
            }
            default: {

            }
        }

    };

    socket.onerror = () => {
        self.postMessage({
            type: 'aborted',
        });
        socket.close();
        // close();
    };

    return socket;
}
