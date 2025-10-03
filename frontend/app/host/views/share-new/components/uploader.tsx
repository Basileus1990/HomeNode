import { useState } from "react";
import { useNavigate } from "react-router";
import type { FileWithPath } from "react-dropzone";

import Dropzone from "./dropzone";
import SelectedFilesList from "./selected-files-list";
import useUploaderWorker from "~/host/upload/useUploaderWorker";

export default function Uploader({ root }: { root?: FileSystemDirectoryHandle }) {
    const [selectedFiles, setSelectedFiles] = useState<FileWithPath[]>([]);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const { uploadFiles, isUploading } = useUploaderWorker({ onUpload: async () => {
        navigate("/host/shared");
    }, onError: (error: string) => {
        setError(error);
    } });

    const handleUpload = async () => {
        uploadFiles(selectedFiles, root);
    }

    return (
        <div>
            <Dropzone setSelectedFiles={setSelectedFiles} />
            <SelectedFilesList selectedFiles={selectedFiles} setSelectedFiles={setSelectedFiles} />
            {error && <p style={{ color: "red" }}>{error}</p>}
            <button
                onClick={handleUpload}
                disabled={selectedFiles.length === 0 || isUploading}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
                {isUploading ? "Uploading..." : "Upload"}
            </button>
        </div>
    );
}