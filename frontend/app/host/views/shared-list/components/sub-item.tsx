import { Link } from "react-router";
import { useContext } from "react";


import type { SubItem } from "~/common/fs/types";
import { HostIdContext } from "../../../../client/views/host-id-context";
import ShareLinkButton from "./share-link-button";
import DownloadFileButton from "./download-file-button";
import DeleteButton from "./delete-button";


export default function SubItemComponent({item}: {item: SubItem}) {
    const hostId = useContext(HostIdContext);

    const buildActions = (item: SubItem) => (
        <div style={{ width: 'fitContent' }}>
            <Link to={`/host/shared/${item.path}`}>View</Link>
            <DeleteButton path={item.path} />
            <ShareLinkButton hostId={hostId} path={item.path} />

            {item.kind === "file" ? getFileActions(item) : getDirActions(item)}
        </div>
    )
    
    const getDirActions = (item: SubItem) => (<></>)

    const getFileActions = (item: SubItem) => (
        <DownloadFileButton filename={item.name} path={item.path} />
    )

    return (
        <div
            style={{ display: 'flex', flexDirection: 'column' }}
        >
            <h3>{item.name}</h3>
            <i>Path: {item.path}</i>
            <p>Kind: {item.kind}</p>

            {buildActions(item)}
        </div>
    )
}