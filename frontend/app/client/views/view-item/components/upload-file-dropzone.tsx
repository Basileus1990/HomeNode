import { useState, useRef, useEffect } from "react";
import { useDropzone, type FileWithPath } from 'react-dropzone';
import { useLocation } from "react-router";
import { HostWebSocketclient } from "~/client/service/server-com/ws/implemenation";

export default function UploadFileDropzone({hostId, path}: {hostId: string, path: string}) {
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const selectedFiles = useRef<FileWithPath[]>([]);
    const location = useLocation();
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
        console.log('uploding to:', uploadPath);

        HostWebSocketclient.uploadFile(
            hostId, 
            uploadPath, 
            file)
            .then(() => {
                console.log('upload successful');
                window.alert('upload successful');
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