import { Link } from "react-router";
import { useState } from "react";

import { RecordKind, type Items } from "~/common/fs/types";
import FileRecordListItem from "~/common/components/file-record-listitem.js";
import DirectoryRecordListItem from "~/common/components/directory-record-listitem.js";
import { HostWebSocketclient } from "~/client/service/server-com/ws/implemenation.js"

export default function RecordsList({records, hostId}: 
    {records: Items.RecordItem[], hostId: string}) {
    const [ isDownloading, setIsDownloading ] = useState(false);

    const downloadButton = (record: Items.RecordItem) => (
        <button 
            onClick={() => {
                if (!isDownloading) {
                    console.log(`Downloading ${record.recordName}`);
                    setIsDownloading(true);
                    HostWebSocketclient.downloadRecord(
                        hostId, 
                        record.recordName,
                        record.contentName
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

    const buildListItem = (record: Items.RecordItem) => {
        if (record.kind === RecordKind.file) {
            return FileRecordListItem({rec: record as Items.FileRecordItem, children:
                <>
                    {downloadButton(record)}
                </>
            });
        } else if (record.kind === RecordKind.directory) {
            return DirectoryRecordListItem({rec: record as Items.DirectoryRecordItem, children:
                <>
                    <Link to={`/client/${hostId}/${record.recordName}`}>View</Link>
                </>
            });
        }
    };

    return (
        <div>
            <h3>Records List</h3>
            <ul>
                {records.length === 0 && <p>No records found.</p>}
                {records.sort((a, b) => { return a.contentName.localeCompare(b.contentName) }).map(buildListItem)}
            </ul>
        </div>
    );
}