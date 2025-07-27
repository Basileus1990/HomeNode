import { useState, useRef, useEffect } from "react";
import type { FileWithPath } from "react-dropzone";

import type {  FileUploaderWorkerMessage } from "~/host/worker/file-uploader-worker/file-uploader-worker-types";

export default function useFileUploaderWorker({ onUpload, onError }: { onUpload: () => void, onError?: (error: string) => void }) {
    const workerRef = useRef<Worker | null>(null);
    const [uploading, setUploading] = useState(false);

    const createUploadMessage = (files: FileWithPath[]): FileUploaderWorkerMessage => {
        return {
            type: "upload",
            payload: files.map(file => ({
                file: file,   
                path: file.path,
                relativePath: file.relativePath
            })),
        };  
    };

    const uploadFiles = (files: FileWithPath[]) => {
        if (!workerRef.current) {
            console.error("Worker not initialized");
            onError?.("Worker not initialized");
            return;
        }

        setUploading(true);
        workerRef.current.postMessage(createUploadMessage(files));
    };

    useEffect(() => {
        workerRef.current = new Worker(new URL("./file-uploader-worker.ts", import.meta.url), {
            type: "module",
        });

        workerRef.current.onmessage = (event) => {
            const { type, payload, msg } = event.data;
            if (type === "uploadComplete") {
                console.log("File uploaded successfully");
                setUploading(false);
                onUpload(); 
            } else if (type === "uploadError") {  // TODO: handle errors
                console.log("Error uploading file");
                setUploading(false);
                onError?.(msg);
            }
        };

        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, []);

    return { uploadFiles: uploadFiles, isUploading: uploading };
}