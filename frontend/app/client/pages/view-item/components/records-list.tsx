import { Link } from "react-router";

import { RecordKind, type Items } from "~/common/fs/types";
import FileRecordListItem from "~/common/components/file-record-listitem.js";
import DirectoryRecordListItem from "~/common/components/directory-record-listitem.js";

export default function RecordsList({records, hostId}: 
    {records: Items.RecordItem[], hostId: string}) {
    const downloadButton = (record: Items.RecordItem) => (
        <button onClick={() => {
            console.log(`Downloading ${record.recordName}`);
        }}>
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
                    <br />
                    {downloadButton(record)}
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