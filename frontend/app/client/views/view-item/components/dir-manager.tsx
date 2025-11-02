import { useContext } from "react";
import { useRevalidator } from "react-router";

import { HostIdContext } from "../../host-id-context";
import type { Item } from "~/common/fs/types";
import SubItemsList from "./sub-items-list";
import { HostWebSocketClient } from "~/client/service/server-com/ws/implemenation";
import { getDefaultPermissions } from "~/common/perm/permissions";
import UploadFileDropzone from "./upload-file-dropzone";
import { createCacheKey, deleteFromCache } from "~/client/service/cache-service.js";


export default function SharedDirectoryManger({item}: {item: Item}) {
    const hostId = useContext(HostIdContext);
    const revalidator = useRevalidator();
    
    const handleCreateDir = () => {
        const folderName = window.prompt("Enter the name of folder to create");
        const path = `${item.path}/${folderName}`;
        console.log("create dir:", path);

        HostWebSocketClient.createDirectory(hostId, path)
            .then(() => {
                window.alert(`Folder ${folderName} created`);
                const key = createCacheKey();
                deleteFromCache(key);
                revalidator.revalidate();
            })
            .catch((e) => window.alert(e))
    }

    const buildContents = () => {
        if (item.contents && item.contents.length > 0) {
            return <SubItemsList items={item.contents} perms={item.perms ?? getDefaultPermissions()} />;
        } else {
            return <p>Empty directory</p>;
        }
    }

    return (
        <div>
            { item.perms?.AllowAddFile ? <UploadFileDropzone hostId={hostId} path={item.path}/> : "" }
            <br/>
            { item.perms?.AllowAddDir ? <button onClick={handleCreateDir}>Add directory</button> : "" }
            <br/>
            {buildContents()}
        </div>
    )
}