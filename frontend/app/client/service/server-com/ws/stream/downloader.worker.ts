import { HMClientReader, SocketToClientMessageTypes } from "../message/readers";
import { ClientToSocketMessageTypes, HMClientWriter } from "../message/writers";
import type { ToDownloader } from "./types";
import { FlagService } from "../../../../../common/communication/binary";


const _reader = new HMClientReader();
const _writer = new HMClientWriter();

let _stream: WritableStream;
let _fileWriter: WritableStreamDefaultWriter;
let _socket: WebSocket;
let _url: string;

let _chunksReceived = 0;
let _chunksAwaited = 0;
let _chunkSize = 0;
let _offset: bigint = 0n;


self.onmessage = (e: MessageEvent<ToDownloader>) => {
    const msg = e.data;

    switch (msg.type) {
        case 'start': {
            _stream = msg.stream;
            _fileWriter = _stream.getWriter();
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

        if (!msg) {
            console.error("Unable to interpret data from socket");
            return;
        }

        switch (msg.typeNo) {
            case SocketToClientMessageTypes.DownloadInitResponse: {
                console.log('received start stream response', msg.payload);
                _chunksAwaited = msg.payload.sizeInChunks;
                _chunkSize = msg.payload.chunkSize;

                self.postMessage({
                    type: 'started',
                    sizeInChunks: msg.payload.sizeInChunks,
                });

                if (_chunksReceived < _chunksAwaited) {
                    console.log('querying for offset:', _offset);
                    const query = _writer.write(
                        ClientToSocketMessageTypes.ChunkRequest,
                        { offset: _offset }
                    );
                    socket.send(query);
                } else {
                    console.log('dont wanna more chunks, requesting end of stream');
                    _fileWriter.close();

                    console.log('disconneting');
                    const query = _writer.write(
                        ClientToSocketMessageTypes.DownloadCompletionRequest,
                        {}
                    );
                    socket.send(query);
                    socket.close();

                    close();
                }

                break;
            }
            case SocketToClientMessageTypes.ChunkResponse: {
                console.log('received chunk', msg.payload.byteLength);
                _chunksReceived++;
                _offset += BigInt(_chunkSize);
                console.log('at ', _chunksReceived, ' of ', _chunksAwaited);

                _fileWriter.write(msg.payload);
                console.log('received', msg.payload.byteLength, msg.payload);
                self.postMessage({
                    type: 'chunk',
                    chunkNo: _chunksReceived,
                });

                if (_chunksReceived < _chunksAwaited) {
                    console.log('querying for offset:', _offset);
                    const query = _writer.write(
                        ClientToSocketMessageTypes.ChunkRequest,
                        { offset: _offset }
                    );
                    socket.send(query);
                } else {
                    console.log('dont wanna more chunks, requesting end of stream');
                    _fileWriter.close();

                    console.log('disconneting');
                    const query = _writer.write(
                        ClientToSocketMessageTypes.DownloadCompletionRequest,
                        {}
                    );
                    socket.send(query);
                    socket.close();

                    close();
                }

                break;
            }
            case SocketToClientMessageTypes.EOFResponse: {
                console.log('received eof');
                console.log('at ', _chunksReceived, ' of ', _chunksAwaited)

                if (_chunksReceived < _chunksAwaited) {
                    console.log('querying for offset:', _offset);
                    const query = _writer.write(
                        ClientToSocketMessageTypes.ChunkRequest,
                        { offset: _offset }
                    );
                    socket.send(query);
                } else {
                    console.log('dont wanna more chunks, requesting end of stream');
                    _fileWriter.close();

                    console.log('disconneting');
                    const query = _writer.write(
                        ClientToSocketMessageTypes.DownloadCompletionRequest,
                        {}
                    );
                    socket.send(query);
                    socket.close();

                    close();
                }
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
        close();
    };

    return socket;
}
