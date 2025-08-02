import { Link, useFetcher } from "react-router";

import { RecordKind, type Items } from "~/common/fs/types";
import FileRecordListItem from "~/common/components/file-record-listitem.js";
import DirectoryRecordListItem from "~/common/components/directory-record-listitem.js";

export default function RecordsList({records}: {records: Items.RecordItem[]}) {
    const fetcher = useFetcher();
    const sortedRecords = records.sort((a, b) => a.contentName.localeCompare(b.contentName));

    const deleteItemFetcher = (item: Items.RecordItem) => (
        <fetcher.Form method="post">
            <input type="hidden" name="itemName" value={item.recordName} />
            <button type="submit">Delete</button>
        </fetcher.Form>
    )

    const buildListItem = (record: Items.RecordItem) => {
        if (record.kind === RecordKind.file) {
            return FileRecordListItem({rec: record as Items.FileRecordItem, children: deleteItemFetcher(record)});
        } else if (record.kind === RecordKind.directory) {
            return DirectoryRecordListItem({rec: record as Items.DirectoryRecordItem, children:
                <>
                    {deleteItemFetcher(record)}
                    <Link to={`/host/shared/${(record as Items.DirectoryRecordItem).recordName}`}>View</Link>
                </>
            });
        }
    };


    return (
        <div>
            <h3>Records List</h3>
            <ul>
                {sortedRecords.length === 0 && <p>No records found.</p>}
                {sortedRecords.map(buildListItem)}
            </ul>
        </div>
    );
}