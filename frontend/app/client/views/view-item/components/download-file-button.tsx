import { HostWebSocketClient } from "~/client/service/server-com/ws/implemenation.js"


export default function DownloadFileButton(
    {hostId, filename, path, setDownloadStatus, isDownloading}: 
    {hostId: string, filename: string, path: string, setDownloadStatus: (value: React.SetStateAction<boolean>) => void, isDownloading: boolean}) {

    const handleDownload = async () => {
        setDownloadStatus(true);
        HostWebSocketClient.downloadRecord(hostId, filename, path, {})
            .then(() => window.alert("Download complete"))
            .catch((e) => window.alert(e))
            .finally(() => setDownloadStatus(false));
    }

    return (
        <button onClick={handleDownload} disabled={isDownloading} >
            Download
        </button>
    );
}