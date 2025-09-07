import { showSaveFilePicker } from 'native-file-system-adapter';
//import streamSaver from 'streamsaver';

import { type ClientToServerCommunication } from "../api";
import { type Items } from "~/common/fs/types";
import { type FromDownloader } from "./stream/types";
import { ClientToSocketMessageTypes, HMClientWriter } from "./message/writers";
import { SocketToClientMessageTypes, HMClientReader } from "./message/readers";
import { WebSocketServerEndpointService } from "./endpoints";


// WIP
// if ('serviceWorker' in navigator) {
//     navigator.serviceWorker.register('/sw.js');
//     //streamSaver.mitm = '/mitm.html';
// }

export class HostWebSocketclient implements ClientToServerCommunication {
    public static async getRecordItem(hostId: string, itemId: string): Promise<Items.RecordItem[]> {
        return new Promise((resolve, reject) => {
            const url = WebSocketServerEndpointService.getMetadataEndpointURL(hostId, itemId);
            const socket = new WebSocket(url);
            socket.binaryType = "arraybuffer";

            socket.onmessage = (event: MessageEvent<ArrayBuffer>) => {
                const reader = new HMClientReader();

                if (typeof event.data === "string") {
                    reject(new Error("Received string data, expected binary data"));
                    return;
                }

                try {
                    const msg = reader.read(event.data);
                    if (!msg) {
                        reject(new Error("Unable to interpret data from socket"));
                        return;
                    }

                    if (msg.typeNo != SocketToClientMessageTypes.MetadataResponse) {
                        reject(new Error("Socket did not return metadata"));
                        return;
                    }

                    resolve(msg.payload);
                } catch (error) {
                    reject(new Error(`Error reading message: ${error}`));
                } finally {
                    socket.close();
                }
            };

            socket.onerror = (error) => {
                reject(error);
            };
        });
    }

    // WIP
    public static async downloadRecord(
        hostId: string, 
        itemId: string, 
        filename: string,
        onStart?: (sizeInChunks?: number) => void,
        onChunk?: (chunkNo?: number) => void,
        onEof?: () => void,
        onError?: () => void

    ) {
        return new Promise(async (resolve, reject) => {
            try {
                const fileHandle = await showSaveFilePicker({
                    _preferPolyfill: false,
                    suggestedName: filename,
                    excludeAcceptAllOption: false // default
                });
                const writeable = await fileHandle.createWritable();
                const writerStream = writeable.getWriter();
                const transferableStream = new WritableStream({
                    write(chunk) {
                        return writerStream.write(chunk);
                    },
                    close() {
                        return writerStream.close();
                    },
                    abort(err) {
                        return writerStream.abort(err);
                    },
                });
                console.log('created writeable', writeable);
                const url = WebSocketServerEndpointService.getDownloadEndpointURL(hostId, itemId);
                console.log('querying', url);

                const worker = createWorker(resolve, reject);
                worker.postMessage({
                    type: 'start',
                    stream: transferableStream,
                    url: url,
                }, [transferableStream]);
                console.log('sent start order to downloader');
            } catch (e) {
                console.error(e);
                reject(e);
            }
        });


        function createWorker(resolve: (value: unknown) => void, reject: (reason?: any) => void) {
            const worker = new Worker(new URL('./stream/downloader.worker.ts', import.meta.url), {
                type: 'module',
            });

            worker.onmessage = (e: MessageEvent<FromDownloader>) => {
                const msg = e.data;

                switch (msg.type) {
                    case 'started':
                        console.log('started downloading: ', msg.sizeInChunks, ' chunks');
                        if (onStart){
                            onStart(msg.sizeInChunks);
                        }
                        break;
                    case 'chunk': {
                        console.log('received chunk: ', msg.chunkNo);
                        if (onChunk) {
                            onChunk(msg.chunkNo);
                        }
                        break;
                    }
                    case 'aborted':
                        console.log('error');
                        if (onError) {
                            onError();
                        }
                        reject('abort');
                        break;
                    case 'eof':
                        console.log('eof');
                        if (onEof) {
                            onEof();
                        }
                        resolve(true);
                        break
                    default:
                        break;
                }
            };
            return worker;
        }
    }
}