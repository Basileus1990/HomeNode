import { useContext, useState } from "react";

import type { Item } from "~/common/fs/types.js";
import SharedDirectoryManger from "./dir-manager";
import DownloadFileButton from "./download-file-button";
import { HostIdContext } from "../../host-id-context";

export default function MainItem({item}: {item: Item}) {
    const hostId = useContext(HostIdContext);
    const [isDownloading, setDownloadStatus] = useState<boolean>(false);

    const buildActions = () => {
        if (item.kind === "directory") {
            return <SharedDirectoryManger item={item} />
        } else {
            return <DownloadFileButton 
                        setDownloadStatus={setDownloadStatus} 
                        hostId={hostId} 
                        filename={item.name} 
                        path={item.path} 
                        isDownloading={isDownloading} 
                    />
        }
    }

    return (
        <div
            style={{ display: 'flex', flexDirection: 'column' }}
        >
            <h2>{item.name}</h2>
            <h4>Path: {item.path}</h4>
            <p>Kind: {item.kind}</p>
            <p>Total size: {item.size} b</p>
            {buildActions()}
        </div>
    )
}