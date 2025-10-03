import { Link, useLocation } from "react-router";
import { useState } from "react";

import FileRecordListItem from "~/common/components/file-record-listitem.js";
import DirectoryRecordListItem from "~/common/components/directory-record-listitem.js";
import { HostWebSocketclient } from "~/client/service/server-com/ws/implemenation.js"
import type { Item } from "~/common/fs/types";

export default function RecordsList({records, hostId}: 
    {records: Item[], hostId: string}) {
    const [ isDownloading, setIsDownloading ] = useState(false);
    const location = useLocation();

    const downloadButton = (record: Item) => (
        <button 
            onClick={() => {
                if (!isDownloading) {
                    console.log(`Downloading ${record.name}`);
                    setIsDownloading(true);
                    HostWebSocketclient.downloadRecord(
                        hostId, 
                        record.name,
                        record.path
                    )
                    .then((value) => console.log('resolved'))
                    .catch((e) => console.log('caught: ', e))
                    .finally(setIsDownloading(false));
                } else {
                    console.log('wait for other download to finish');
                }
            }}
            disabled={isDownloading}
        >
            Download
        </button>
    )

    const buildListItem = (record: Item) => {
        if (record.kind === "file") {
            return FileRecordListItem({rec: record as Item, children:
                <>
                    {downloadButton(record)}
                </>
            });
        } else if (record.kind === "directory") {
            return DirectoryRecordListItem({rec: record as Item, children:
                <>
                    <Link to={`${location.pathname}/${record.name}`}>View</Link>
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