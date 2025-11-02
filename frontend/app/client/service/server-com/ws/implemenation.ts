import { showSaveFilePicker } from "native-file-system-adapter";
import log from "loglevel";
//import streamSaver from "streamsaver";

import type { ClientToServerCommunication } from "../api";
import type { Item } from "~/common/fs/types";
import type { TransferProgressCallbacks } from "../../../../common/server-com/stream/types";
import { SocketToClientMessageTypes, HMClientReader } from "./message/readers";
import { ClientToSocketMessageTypes, HMClientWriter } from "./message/writers";
import { WebSocketServerEndpointService } from "./endpoints";
import { getConfig } from "../../../../common/config";
import { getErrorMessage } from "../../error/translate-error-codes";
import { createDownloadWorker } from "./stream/download/create-file-downloader";


// WIP
// if ("serviceWorker" in navigator) {
//     navigator.serviceWorker.register("/sw.js");
//     //streamSaver.mitm = "/mitm.html";
// }

export class HostWebSocketClient implements ClientToServerCommunication {
    public static async getRecordItem(hostId: string, path: string): Promise<Item> {
        const config = await getConfig();
        const url = WebSocketServerEndpointService.getMetadataEndpointURL(hostId, path, config);
        
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

                    switch (msg.typeNo) {
                        case SocketToClientMessageTypes.MetadataResponse: {
                            resolve(msg.payload);
                            break;
                        }
                        case SocketToClientMessageTypes.Error: {
                            reject(new Error(getErrorMessage((msg.payload.errorType))));
                            break;
                        }
                        default: {
                            reject(new Error("Unexpected server response"));
                            break;
                        }
                    }                    
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
        callbacks: TransferProgressCallbacks) 
    {
        const config = await getConfig();
        const url = WebSocketServerEndpointService.getDownloadEndpointURL(hostId, resourcePath, config);
        return new Promise(async (resolve, reject) => {
            try {
                const transferableStream = await getFileStream(filename);
                const worker = createDownloadWorker(resolve, reject, callbacks);
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

        async function getFileStream(suggestedName: string) {
            const fileHandle = await showSaveFilePicker({
                _preferPolyfill: false,
                suggestedName,
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

        
    }

    public static async uploadFile(
        hostId: string,
        path: string,
        file: File,
        { onStart, onProgress, onEof, onError }: TransferProgressCallbacks) 
    {
        const config = await getConfig();
        const url = WebSocketServerEndpointService.getCreateFileEndpointURL(hostId, path, file.size,config);
        console.log("Upload URL:", url);
        return new Promise(async (resolve, reject) => {
            try {
                const reader = new HMClientReader();
                const writer = new HMClientWriter();
                const socket = new WebSocket(url);
                socket.binaryType = "arraybuffer";

                socket.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
                    console.log("socket got msg");
                    try {
                        const msg = reader.read(event.data, config);
                        if (!msg) {
                            reject(new Error("Unable to interpret data from socket"));
                            return;
                        }

                        switch (msg.typeNo) {
                            case SocketToClientMessageTypes.UploadFileInitStreamResponse: {
                                if (onStart) {
                                    onStart();
                                }
                                log.debug("Host reports being reaady to start transfer");
                                break;
                            }
                            case SocketToClientMessageTypes.UploadFileChunkRequest: {
                                if (onProgress) {
                                    onProgress(msg.payload.chunkNo);
                                }
                                const offset = Number(msg.payload.offset);
                                const chunk = file.slice(offset, offset + config.chunk_size!);
                                const bytes = await chunk.arrayBuffer();
                                const resp = writer.write(
                                    ClientToSocketMessageTypes.UploadFileChunkResponse,
                                    { 
                                        streamId: msg.payload.streamdId,
                                        chunk: bytes
                                    },
                                    config
                                );
                                socket.send(resp);
                                log.debug(`Uploaded chunk [${offset}-${offset+config.chunk_size!}:${file.size}]`)
                                break;
                            }
                            case SocketToClientMessageTypes.UploadFileEndStreamRequest: {
                                if (onEof) {
                                    onEof();
                                }
                                console.log("closing socket");
                                socket.close();
                                log.debug("Host signals upload end");
                                resolve(true);
                            }
                            case SocketToClientMessageTypes.Error: {
                                if (onError) {
                                    onError();
                                }
                                console.log("closing socket");
                                socket.close();
                                reject(new Error(getErrorMessage((msg.payload.errorType))));
                                break;
                            }
                            default: {
                                console.log("closing socket");
                                socket.close();
                                reject(new Error("Unexpected server response"));
                                break;
                            }
                        }   

                    } catch (error) {
                        console.log("closing socket");
                        socket.close();
                        reject(new Error(`Error reading message: ${error}`));
                    }
                }
                
            } catch (e) {
                log.error(e);
                reject(e);
            }
        });
    }

    public static async createDirectory(hostId: string, path: string) {
        const config = await getConfig();
        const url = WebSocketServerEndpointService.getCreateDirectoryEndpointURL(hostId, path, config);
        
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

                    switch (msg.typeNo) {
                        case SocketToClientMessageTypes.Ack: {
                            resolve(true);
                            break;
                        }
                        case SocketToClientMessageTypes.Error: {
                            reject(new Error(getErrorMessage((msg.payload.errorType))));
                            break;
                        }
                        default: {
                            reject(new Error("Unexpected server response"));
                            break;
                        }
                    } 
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

    public static async deleteResource(hostId: string, path: string) {
        const config = await getConfig();
        const url = WebSocketServerEndpointService.getDeleteResourceEndpointURL(hostId, path, config);
        
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

                    switch (msg.typeNo) {
                        case SocketToClientMessageTypes.Ack: {
                            resolve(true);
                            break;
                        }
                        case SocketToClientMessageTypes.Error: {
                            reject(new Error(getErrorMessage((msg.payload.errorType))));
                            break;
                        }
                        default: {
                            reject(new Error("Unexpected server response"));
                            break;
                        }
                    }
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
}