import { Link, useLocation } from "react-router";
import { useContext } from "react";


import type { SubItem } from "~/common/fs/types";
import DownloadFileButton from "./download-file-button";
import DeleteButton from "./delete-button";
import { HostIdContext } from "../../host-id-context";


export default function SubItemComponent(
    {item, canDeleteDir, canDeleteFile, setDownloadStatus, isDownloading}: 
    {item: SubItem, canDeleteDir: boolean, canDeleteFile: boolean, setDownloadStatus: (value: React.SetStateAction<boolean>) => void, isDownloading: boolean}) {

    const location = useLocation();
    const hostId = useContext(HostIdContext);

    const buildActions = (item: SubItem) => (
        <div style={{ width: 'fitContent' }}>
            <Link to={`${location.pathname}/${item.name}`}>View</Link>

            {item.kind === "file" ? getFileActions(item) : getDirActions(item)}
        </div>
    )
    
    const getDirActions = (item: SubItem) => (
        <>
            {canDeleteDir ? <DeleteButton hostId={hostId} name={item.name} path={item.path} /> : ""}
        </>
    )

    const getFileActions = (item: SubItem) => (
        <>
            <DownloadFileButton setDownloadStatus={setDownloadStatus} hostId={hostId} filename={item.name} path={item.path} isDownloading={isDownloading}/>
            <br/>
            {canDeleteFile ? <DeleteButton hostId={hostId} name={item.name} path={item.path} /> : ""}
        </>
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