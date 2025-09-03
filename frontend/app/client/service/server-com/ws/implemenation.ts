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
        try {
            const fileHandle = await showSaveFilePicker({
                _preferPolyfill: false,
                suggestedName: filename,
                excludeAcceptAllOption: false // default
            });
            const writeable = fileHandle.createWritable();
            const url = WebSocketServerEndpointService.getDownloadEndpointURL(hostId, itemId);

            const worker = createWorker();
            worker.postMessage({
                type: 'start',
                stream: writeable,
                url: url,
            }, [writeable]);
        } catch (e) {
            console.error(e);
        }


        function createWorker() {
            const worker = new Worker(new URL('./downloader.worker.ts', import.meta.url), {
                type: 'module',
            });

            worker.onmessage = (e: MessageEvent<FromDownloader>) => {
                const msg = e.data;

                switch (msg.type) {
                    case 'started':
                        break;
                    case 'chunk': {
                        if (onChunk) {
                            onChunk(msg.chunkNo);
                        }
                        break;
                    }
                    case 'aborted':
                        break;
                    case 'eof':
                        break
                    default:
                        break;
                }
            };
            return worker;
        }
    }
}