import { showSaveFilePicker } from "native-file-system-adapter";
import log from "loglevel";
//import streamSaver from "streamsaver";

import type{ ClientToServerCommunication } from "../api";
import type{ FromDownloader } from "./stream/types";
import type { Item } from "~/common/newer-fs/types";
import { SocketToClientMessageTypes, HMClientReader } from "./message/readers";
import { WebSocketServerEndpointService } from "./endpoints";
import { getConfig } from "../../../../config";


// WIP
// if ("serviceWorker" in navigator) {
//     navigator.serviceWorker.register("/sw.js");
//     //streamSaver.mitm = "/mitm.html";
// }

export class HostWebSocketclient implements ClientToServerCommunication {
    public static async getRecordItem(hostId: string, path: string): Promise<Item[]> {
        const config = await getConfig();
        const url = WebSocketServerEndpointService.getMetadataEndpointURL(hostId, path, config);
        console.log(url, url.at(-1));
        return new Promise((resolve, reject) => {            
            const socket = new WebSocket(url);
            socket.binaryType = "arraybuffer";

            socket.onmessage = (event: MessageEvent<ArrayBuffer>) => {
                const reader = new HMClientReader();

                if (typeof event.data === "string") {
                    reject(new Error("Received string data, expected binary data"));
                    return;
                }

                try {
                    const msg = reader.read(event.data, config);
                    if (!msg) {
                        reject(new Error("Unable to interpret data from socket"));
                        return;
                    }

                    if (msg.typeNo != SocketToClientMessageTypes.MetadataResponse) {
                        reject(new Error("Socket did not return metadata"));
                        return;
                    }

                    console.log(msg.payload);
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
    /**
     * 
     * @param hostId host identifier
     * @param resourcePath resource identifier
     * @param filename name the downloaded file will be
     * @param onStart will be called with the size of download in chunks once the stream is ready
     * @param onChunk will be called on each chunk
     * @param onEof will be called once the download finished
     * @param onError will be called in case of error
     * @returns 
     */
    public static async downloadRecord(
        hostId: string, 
        filename: string,
        resourcePath: string, 
        onStart?: (sizeInChunks?: number) => void,
        onChunk?: (chunkNo?: number) => void,
        onEof?: () => void,
        onError?: () => void) 
    {
        const config = await getConfig();
        const url = WebSocketServerEndpointService.getDownloadEndpointURL(hostId, resourcePath, config);
        return new Promise(async (resolve, reject) => {
            try {
                const transferableStream = await getFileStream();
                const worker = createDownloadWorker(resolve, reject);
                worker.postMessage({
                    type: "start",
                    stream: transferableStream,
                    url: url,
                    config
                }, [transferableStream]);
            } catch (e) {
                log.error(e);
                reject(e);
            }
        });


        async function getFileStream() {
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
            return transferableStream;
        }

        function createDownloadWorker(resolve: (value: unknown) => void, reject: (reason?: any) => void) {
            const worker = new Worker(new URL("./stream/downloader.worker.ts", import.meta.url), {
                type: "module",
            });

            worker.onmessage = (e: MessageEvent<FromDownloader>) => {
                const msg = e.data;

                switch (msg.type) {
                    case "started":
                        if (onStart){
                            onStart(msg.sizeInChunks);
                        }
                        break;
                    case "chunk": {
                        if (onChunk) {
                            onChunk(msg.chunkNo);
                        }
                        break;
                    }
                    case "aborted":
                        if (onError) {
                            onError();
                        }
                        reject("abort");
                        break;
                    case "eof":
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