import { Link } from "react-router";

import type { FileRecordInfo, DirectoryRecordInfo, RecordInfo } from "~/host/fs/types";
import { RecordKind } from "~/host/fs/types";
import FileRecordListItem from "../../../../common/components/file-record-listitem";
import DirectoryRecordListItem from "../../../../common/components/directory-record-listitem";

export default function RecordsList({records}: {records: RecordInfo[]}) {
    const buildListItem = (record: RecordInfo) => {
        if (record.kind === RecordKind.file) {
            return FileRecordListItem({rec: record as FileRecordInfo});
        } else if (record.kind === RecordKind.directory) {
            return DirectoryRecordListItem({rec: record as DirectoryRecordInfo, children:
                <Link to={`/host/shared/${(record as DirectoryRecordInfo).recordName}`}>View</Link>
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