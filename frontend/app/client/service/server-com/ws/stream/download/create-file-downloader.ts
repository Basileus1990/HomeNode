import type { FromDownloader } from "./msgs";
import type { TransferProgressCallbacks } from "../../../../../../common/server-com/stream/types";


export function createDownloadWorker(
    resolve: (value: unknown) => void,
    reject: (reason?: any) => void,
    { onStart, onProgress, onEof, onError }: TransferProgressCallbacks) 
{
    const worker = new Worker(new URL("./downloader.worker.ts", import.meta.url), {
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
                if (onProgress) {
                    onProgress(msg.chunkNo);
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