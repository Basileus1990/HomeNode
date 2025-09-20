import { Link, useFetcher } from "react-router";
import { useContext } from "react";

//import { RecordKind, type Items } from "../../../../common/fs/types";
import FileRecordListItem from "../../../../common/components/file-record-listitem.js";
import DirectoryRecordListItem from "../../../../common/components/directory-record-listitem.js";
import { HostIdContext } from "../../host-id-context";
import { getResourceShareURL } from "../../../service/url-service";
import type { Item } from "~/common/newer-fs/types.js";

export default function RecordsList({records}: {records: Item[]}) {
    const fetcher = useFetcher();
    const sortedRecords = records;
    const hostId = useContext(HostIdContext);

    const deleteItemFetcher = (item: Item) => (
        <fetcher.Form method="post">
            <input type="hidden" name="itemName" value={item.path} />
            <button type="submit">Delete</button>
        </fetcher.Form>
    )

    const shareLinkButton = (item: Item) => (
        <button
            onClick={async () => {
                const link = getResourceShareURL(hostId, item.path); 
                await navigator.clipboard.writeText(link);
            }}
        >
            Share
            </button>
    )

    const buildListItem = (record: Item) => {
        if (record.kind === "file") {
            return FileRecordListItem({rec: record as Item, children: 
                <>
                    {deleteItemFetcher(record)}
                    <br/>
                    {shareLinkButton(record)}
                </>
            });
        } else if (record.kind === "directory") {
            return DirectoryRecordListItem({rec: record as Item, children:
                <>
                    {deleteItemFetcher(record)}
                    <Link to={`/host/shared/${(record as Item).path}`}>View</Link>
                    <br/>
                    {shareLinkButton(record)}
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