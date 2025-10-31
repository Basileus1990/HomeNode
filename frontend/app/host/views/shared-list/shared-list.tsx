import type { Route } from ".react-router/types/app/host/views/shared-list/+types/shared-list";
import { useRevalidator } from "react-router";
import log from "loglevel";

import RecordsList from "./components/records-list";
import { findHandle, getStorageRoot, removeHandle, purgeStorage, readHandle } from "~/common/fs/api";
import { setDirPermissions } from "~/common/perm/permissions";


export async function clientLoader({ params }: Route.LoaderArgs) {
    const { "*": resourcePath} = params;

    let handle: FileSystemHandle | null;
    if (resourcePath) {
        try {
            handle = await findHandle(resourcePath);
        } catch (e) {
            handle = null;
        }
    }
    else
        handle = await getStorageRoot();
    
    if (!handle) {
        log.debug(`No handle found for path: ${resourcePath}`)
        return [];
    }

    return readHandle(handle, resourcePath);
}

export async function clientAction({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const resourcePath = formData.get("resourcePath") as string;

    // if (resourcePath) {
    //     try {
    //         await removeHandle(resourcePath);
    //         log.debug(`Successfully removed resource: ${resourcePath}`);
    //     } catch (ex) {
    //         log.warn(`Could not resource: ${resourcePath} due to ${ex}`);
    //     }
    // }

    const perms = {
        AllowAddDir: formData.get("allowAddDir") === "on",
        AllowAddFile: formData.get("allowAddFile") === "on",
        AllowDeleteDir: formData.get("allowDeleteDir") === "on",
        AllowDeleteFile: formData.get("llowDeleteFile") === "on",
    };
    console.log(resourcePath, perms);
    return setDirPermissions(resourcePath, perms);
}

export default function SharedFilesList({loaderData}: Route.ComponentProps) {
    const items = loaderData;
    const revalidator = useRevalidator();

    const handleClear = async () => {
        await purgeStorage();
        revalidator.revalidate();
    };
    
    return (
        <div>
            <h2>Shared Files</h2>
            <button onClick={handleClear}>Clear OPFS</button>
            <RecordsList records={items}/>
        </div>
    );
}