import { useState } from "react";

import type { SubItem } from "~/common/fs/types";
import SubItemComponent from "./sub-item";
import type { DirPermissions } from "~/common/perm/permissions";

export default function SubItemsList({items, perms}: {items: SubItem[], perms: DirPermissions}) {
    const [isDownloading, setDownloadStatus] = useState<boolean>(false);
    items.sort((a: SubItem, b: SubItem) => {
        return ('' + a.name).localeCompare(b.name);
    });

    const buildListItem = (item: SubItem) => (
        <li key={item.path}>
            <SubItemComponent 
                item={item} 
                canDeleteDir={perms.AllowDeleteDir} 
                canDeleteFile={perms.AllowDeleteFile} 
                setDownloadStatus={setDownloadStatus} 
                isDownloading={isDownloading}
            />
        </li>
    )

    return (
        <>
            <h3>Directory contents:</h3>
            <ul>
                {items.length === 0 && <p>No items</p>}
                {items.map((item) => buildListItem(item))}
            </ul>
        </>
    )
}