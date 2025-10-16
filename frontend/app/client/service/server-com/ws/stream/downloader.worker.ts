import log from "loglevel";

import { HMClientReader, SocketToClientMessageTypes } from "../message/readers";
import { ClientToSocketMessageTypes, HMClientWriter } from "../message/writers";
import type { ToDownloader } from "./types";
import type { HomeNodeFrontendConfig } from "../../../../../common/config";



const _reader = new HMClientReader();
const _writer = new HMClientWriter();

let _fileWriter: WritableStreamDefaultWriter;
let _socket: WebSocket;
let _url: string;
let _config: HomeNodeFrontendConfig;

let _chunksReceived = 0;
let _chunksExpected = 0;
let _chunkSize = 0;
let _downloadSize = 0;
let _offset: bigint = 0n;


self.onmessage = (e: MessageEvent<ToDownloader>) => {
    const msg = e.data;

    switch (msg.type) {
        case "start": {
            _fileWriter = msg.stream.getWriter();
            _url = msg.url;
            _config = msg.config;
            _socket = getSocket(_url);
            break;
        }
    }
}


function getSocket(url: string) {
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";

    socket.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
        const msg = _reader.read(event.data, _config);

        if (!msg) {
            log.error("Client unable to interpret data from socket");
            return;
        }

        switch (msg.typeNo) {
            case SocketToClientMessageTypes.DownloadInitResponse: {
                log.debug("Client received confirmation the host is ready to stream");
                
                _chunksExpected = msg.payload.sizeInChunks;
                _chunkSize = msg.payload.chunkSize;
                _downloadSize = _chunksExpected * _chunkSize;

                self.postMessage({
                    type: "started",
                    sizeInChunks: msg.payload.sizeInChunks,
                    downloadSize: _downloadSize
                });
                
                if (_offset < _downloadSize) {  // should always be true, but to be sure let's check if we're not trying to download 0-byte file
                    queryNextChunk(_offset);
                } else {
                    finishDownload();
                }

                break;
            }
            case SocketToClientMessageTypes.ChunkResponse: {
                _chunksReceived++;
                _offset += BigInt(_chunkSize);

                _fileWriter.write(msg.payload);

                self.postMessage({
                    type: "chunk",
                    chunkNo: _chunksReceived,
                });

                if (_offset < _downloadSize) {
                    queryNextChunk(_offset);
                } else {
                    finishDownload();
                }

                break;
            }
            case SocketToClientMessageTypes.EOFResponse: {
                log.log("received eof");
                log.log("at ", _chunksReceived, " of ", _chunksExpected)

                if (_offset < _downloadSize) {
                    queryNextChunk(_offset);
                } else {
                    finishDownload();
                }
                break;
            }
            default: {

            }
        }

    };

    socket.onerror = (event) => {
        log.error(`Client socket suffered an error: ${event} while downloading file`);
        self.postMessage({
            type: "aborted",
        });
        socket.close();
        close();
    };

    return socket;
}

function finishDownload() {
    _fileWriter.close();

    const query = _writer.write(
        ClientToSocketMessageTypes.DownloadCompletionRequest,
        {},
        _config
    );
    _socket.send(query);
    _socket.close();

    log.debug("Client finished download and disconnected");
    close();
}

function queryNextChunk(offset: bigint) {
    log.debug(`Client querying for next chunk at offset: ${offset}`);
    log.log("Client querying for next chunk");

    const query = _writer.write(
        ClientToSocketMessageTypes.ChunkRequest,
        { offset },
        _config
    );
    _socket.send(query);
}