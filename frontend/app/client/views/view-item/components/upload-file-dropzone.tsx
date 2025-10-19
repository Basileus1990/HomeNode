import { useState, useRef } from "react";
import { useDropzone, type FileWithPath } from 'react-dropzone';
import { useRevalidator } from "react-router";

import { HostWebSocketclient } from "~/client/service/server-com/ws/implemenation";
import { createCacheKey, deleteFromCache } from "~/client/service/cache-service";


export default function UploadFileDropzone({hostId, path}: {hostId: string, path: string}) {
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const selectedFiles = useRef<FileWithPath[]>([]);
    const revalidator = useRevalidator();
    const { getRootProps, getInputProps, open } = useDropzone({
        onDropAccepted: (files) => {
            selectedFiles.current = files;
        },
        multiple: false
    });

    const handleUpload = () => {
        if (selectedFiles.current.length !== 1) {
            window.alert("Select single file");
            return;
        }
        setIsUploading(true);

        const file = selectedFiles.current[0];
        const uploadPath = path + file.path?.replace("./", "/");

        HostWebSocketclient.uploadFile(hostId, uploadPath, file, {})
            .then(() => {
                window.alert(`Upload complete`);
                const key = createCacheKey();
                deleteFromCache(key);
                revalidator.revalidate();
            })
            .catch((e) => window.alert(e))
            .finally(() => {
                selectedFiles.current = [];
                setIsUploading(false);
            })
    }

    return (
        <>
            <button
                type="button"
                onClick={() => open()}
            >
                Select file
            </button>
            <div 
                {...getRootProps()}
            >
                <input {...getInputProps()} />
                <p>Drop files here</p>
            </div>
            <br/>
            <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
            >
                Upload
            </button>
        </>
    )
}