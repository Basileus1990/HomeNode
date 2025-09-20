import type { Route } from ".react-router/types/app/host/views/shared-list/+types/shared-list";
import { useRevalidator } from "react-router";
import log from "loglevel";

import RecordsList from "./components/records-list";
import { findHandle, getStorageRoot, removeHandle, purgeStorage, readHandle } from "~/common/newer-fs/api";


export async function clientLoader({ params }: Route.LoaderArgs) {
    const { "*": resourcePath} = params;

    let handle: FileSystemHandle | null;
    if (resourcePath)
        handle = await findHandle(resourcePath);
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

    if (resourcePath) {
        const removed = await removeHandle(resourcePath);
        if (removed) {
            log.debug(`Successfully removed resource: ${resourcePath}`)
        } else {
            log.warn(`Could not resource: ${resourcePath}`)
        }
    }
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