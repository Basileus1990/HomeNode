import { downloadFileHandle, findHandle } from "~/common/fs/opfs.js";

export default function DownloadFileButton({filename, path}: {filename: string, path: string}) {
    
    const handleDownload = async () => {
        try {
            // optional: show UI feedback, disable button, etc.
            const handle = await findHandle(path);
            await downloadFileHandle(handle as FileSystemFileHandle, filename, (transferred, total) => {
                // you can hook this into a progress UI
                console.debug(`Downloading ${path}: ${transferred}/${total}`);
            })
        } catch (err) {
            console.error("Download failed", err);
            alert(`Download failed: ${(err as Error).message}`);
        }
    }

    return (
        <button onClick={handleDownload}>
            Download
        </button>
    );
}