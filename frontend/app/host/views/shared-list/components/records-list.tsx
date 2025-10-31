import { Link, useFetcher } from "react-router";
import { useContext } from "react";
import log from "loglevel";

import FileRecordListItem from "../../../../common/components/file-record-listitem.js";
import DirectoryRecordListItem from "../../../../common/components/directory-record-listitem.js";
import { HostIdContext } from "../../host-id-context";
import { getResourceShareURL, getHostAddItemURL } from "../../../service/url-service";
import type { Item } from "~/common/fs/types.js";
import { downloadFileHandle, findHandle } from "~/common/fs/opfs.js";
import { setDirPermissions } from "~/common/perm/permissions.js";
import { removeHandle } from "~/common/fs/opfs.js";


export default function RecordsList({records}: {records: Item[]}) {
    const fetcher = useFetcher();
    const sortedRecords = records;
    const hostId = useContext(HostIdContext);

    // const deleteItemFetcher = (resource: Item) => (
    //     <fetcher.Form method="post">
    //         <input type="hidden" name="resourcePath" value={resource.path} />
    //         <button type="submit">Delete</button>
    //     </fetcher.Form>
    // )

    const shareLinkButton = (resource: Item) => (
        <button
            onClick={async () => {
                const link = getResourceShareURL(hostId, resource.path); 
                await navigator.clipboard.writeText(link);
            }}
        >
            Share
            </button>
    )

    const handleDownload = async (resource: Item) => {
        try {
            // optional: show UI feedback, disable button, etc.
            const handle = await findHandle(resource.path);
            await downloadFileHandle(handle as FileSystemFileHandle, resource.name, (transferred, total) => {
                // you can hook this into a progress UI
                console.debug(`Downloading ${resource.path}: ${transferred}/${total}`);
            })
        } catch (err) {
            console.error("Download failed", err);
            alert(`Download failed: ${(err as Error).message}`);
        }
    }

    const handleDelete = async (resource: Item) => {
        try {
            await removeHandle(resource.path);
            log.debug(`Successfully removed resource: ${resource.path}`);
        } catch (ex) {
            log.warn(`Could not resource: ${resource.path} due to ${ex}`);
        }
    }

    const updatePermissionsFetcher = (resource: Item) => (
        <fetcher.Form method="post">
            <label htmlFor="allowAddDir">Allow adding directories</label>
            <input type="checkbox" name="allowAddDir" checked={resource.perms?.AllowAddDir} />

            <label htmlFor="allowAddFile">Allow adding files</label>
            <input type="checkbox" name="allowAddFile" checked={resource.perms?.AllowAddFile} />

            <label htmlFor="allowDeleteDir">Allow deleting directories</label>
            <input type="checkbox" name="allowDeleteDir" checked={resource.perms?.AllowDeleteDir} />

            <label htmlFor="allowDeleteFile">Allow deleting files</label>
            <input type="checkbox" name="allowDeleteFile" checked={resource.perms?.AllowDeleteFile} />

            <input type="hidden" name="resourcePath" value={resource.path} />
            <button type="submit">Update permissions</button>
        </fetcher.Form>
    )

    const buildListItem = (resource: Item) => {
        if (resource.kind === "file") {
            return FileRecordListItem({rec: resource, children: 
                <>
                    <br/>
                    <button onClick={() => handleDelete(resource)}>Delete</button>
                    <br/>
                    <button onClick={() => handleDownload(resource)}>Download</button>
                    <br/>
                    {shareLinkButton(resource)}
                </>
            });
        } else if (resource.kind === "directory") {
            return DirectoryRecordListItem({rec: resource, children:
                <>
                    <br/>
                    {updatePermissionsFetcher(resource)}
                    <br/>
                    <button onClick={() => handleDelete(resource)}>Delete</button>
                    <br/>
                    <Link to={`/host/shared/${resource.path}`}>View</Link>
                    <br/>
                    <Link to={`/host/share/${resource.path}`}>Add</Link>
                    <br/>
                    {shareLinkButton(resource)}
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