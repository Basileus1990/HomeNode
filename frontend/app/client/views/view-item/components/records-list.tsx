import { Link, useLocation, useRevalidator } from "react-router";
import { useState } from "react";

import FileRecordListItem from "~/common/components/file-record-listitem.js";
import DirectoryRecordListItem from "~/common/components/directory-record-listitem.js";
import { HostWebSocketclient } from "~/client/service/server-com/ws/implemenation.js"
import type { Item } from "~/common/fs/types";

export default function RecordsList({records, hostId}: 
    {records: Item[], hostId: string}) {
    const [ isDownloading, setIsDownloading ] = useState<boolean>(false);
    const location = useLocation();
    const revalidator = useRevalidator();

    const handleDownload = (record: Item) => {
        if (!isDownloading) {
            console.log(`Downloading ${record.name}`);
            setIsDownloading(true);
            HostWebSocketclient.downloadRecord(
                hostId, 
                record.name,
                record.path
            )
                .then(() => console.log('resolved'))
                .catch((e) => console.log('caught: ', e))
                .finally(() => setIsDownloading(false));    // TODO: fix this
        } else {
            console.log('wait for other download to finish');
        }
    }

    const handleDelete = (record: Item) => {
        HostWebSocketclient.deleteResource(hostId, record.path)
            .then(() => {
                console.log('delete successful');
                revalidator.revalidate();
            })
            .catch((e) => window.alert(e))
    }

    const handleCreateDir = (record: Item) => {
        const folderName = window.prompt("Enter the name of folder to create");
        const path = `${record.path}/${folderName}`;
        console.log('creating folder: ', path);
        HostWebSocketclient.createDirectory(hostId, path)
            .then(() => {
                window.alert('create successful');
            })
            .catch((e) => window.alert(e))
    }

    const buildListItem = (record: Item) => {
        if (record.kind === "file") {
            return FileRecordListItem({rec: record as Item, children:
                <>
                    <button onClick={() => handleDownload(record)} disabled={isDownloading}>Download</button>
                    <br/>
                    <button onClick={() => handleDelete(record)}>Delete</button>
                </>
            });
        } else if (record.kind === "directory") {
            return DirectoryRecordListItem({rec: record as Item, children:
                <>
                    <Link to={`${location.pathname}/${record.name}`}>View</Link>
                    <br/>
                    <button onClick={() => handleDelete(record)}>Delete</button>
                    <br/>
                    <button onClick={() => handleCreateDir(record)}>Add directory</button>
                </>
            });
        }
    };

    return (
        <div>
            <h3>Records List</h3>
            <ul>
                {records.length === 0 && <p>No records found.</p>}
                {records.map(buildListItem)}
            </ul>
        </div>
    );
}