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
            setIsDownloading(true);
            HostWebSocketclient.downloadRecord(hostId, record.name, record.path, {})
                .then(() => window.alert("Download complete"))
                .catch((e) => window.alert(e))
                .finally(() => setIsDownloading(false));    // TODO: fix this
        } else {
            window.alert("A file is already being downloaded. Wait for it to finish");
        }
    }

    const handleDelete = (record: Item) => {
        HostWebSocketclient.deleteResource(hostId, record.path)
            .then(() => {
                window.alert(`Resource ${record.name} deleted`);
                revalidator.revalidate()
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