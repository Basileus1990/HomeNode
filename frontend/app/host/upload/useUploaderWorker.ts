import { useState, useRef, useEffect } from "react";
import type { FileWithPath } from "react-dropzone";
import log from "loglevel";

import type { UIToUploaderMessages, UploaderToUIMessages } from "./types";


export default function useFileUploaderWorker({ onUpload, onError }: { onUpload: () => void, onError?: (error: string) => void }) {
    const workerRef = useRef<Worker | null>(null);
    const [isUploading, setUploading] = useState(false);

    const createUploadMessage = (files: FileWithPath[], root?: FileSystemDirectoryHandle): UIToUploaderMessages => {
        return {
            type: "start",
            files: files.map(file => ({
                file: file,   
                path: file.path,
                relativePath: file.relativePath
            })),
            root
        };  
    };

    const uploadFiles = (files: FileWithPath[], root?: FileSystemDirectoryHandle) => {
        if (!workerRef.current) {
            log.error("Upload worker not initialized");
            onError?.("Uploader not initialized");
            return;
        }

        setUploading(true);
        workerRef.current.postMessage(createUploadMessage(files, root));
    };

    useEffect(() => {
        workerRef.current = new Worker(new URL("./file-uploader-worker.ts", import.meta.url), {
            type: "module",
        });

        workerRef.current.onmessage = (event: MessageEvent<UploaderToUIMessages>) => {
            const { type, msg } = event.data;
            if (type === "complete") {
                log.debug(`Upload completed: ${msg}!`)
                setUploading(false);
                onUpload(); 
            } else if (type === "fail") {
                log.warn(`Upload failed: ${msg}!`)
                setUploading(false);
                onError?.(msg);
            }
        };

        return () => {
            if (workerRef.current) {
                log.debug("Shutting down upload worker");
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, []);

    return { uploadFiles, isUploading };
}