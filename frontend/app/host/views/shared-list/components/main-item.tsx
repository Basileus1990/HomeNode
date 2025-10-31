import { useContext } from "react";

import type { Item } from "~/common/fs/types.js";
import SharedDirectoryManger from "./dir-manager";
import { HostIdContext } from "../../host-id-context";
import ShareLinkButton from "./share-link-button";
import DownloadFileButton from "./download-file-button";

export default function MainItem({item}: {item: Item}) {
    const hostId = useContext(HostIdContext);

    const buildActions = () => {
        if (item.kind === "directory") {
            return <SharedDirectoryManger item={item} />
        } else {
            return <DownloadFileButton filename={item.name} path={item.path} />
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
            <ShareLinkButton hostId={hostId} path={item.path} />
            {buildActions()}
        </div>
    )
}