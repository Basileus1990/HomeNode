import { useNavigate } from "react-router";
import type { FileWithPath } from "react-dropzone";

import useUploaderWorker from "~/host/worker/file-uploader-worker/useUploaderWorker";

export default function ShareButton({selectedFiles, setError}: 
    {selectedFiles: FileWithPath[], setError: React.Dispatch<React.SetStateAction<string | null>>}) {
    const navigate = useNavigate();
    const { uploadFiles, isUploading } = useUploaderWorker({ onUpload: async () => {
        console.log("Callback after upload");
        navigate("/host/shared");
    }, onError: (error: string) => {
        setError(error);
    } });

    const handleUpload = async () => {
        console.log("Selected files:", selectedFiles);
        uploadFiles(selectedFiles);
    }

    return (
        <button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
            {isUploading ? "Uploading..." : "Upload"}
        </button>
    );
}