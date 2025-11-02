import type { Route } from ".react-router/types/app/host/views/shared-list/+types/shared-list";
import { useRevalidator, Link } from "react-router";
import log from "loglevel";

import { findHandle, getStorageRoot, purgeStorage, readHandle } from "~/common/fs/api";
import { setDirPermissions } from "~/common/perm/permissions";
import MainItem from "./components/main-item";
import SubItemsList from "./components/sub-items-list";


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
        return null;
    }

    return readHandle(handle, resourcePath);
}

export async function clientAction({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const resourcePath = formData.get("itemPath") as string;

    const perms = {
        AllowAddDir: formData.get("allowAddDir") === "on",
        AllowAddFile: formData.get("allowAddFile") === "on",
        AllowDeleteDir: formData.get("allowDeleteDir") === "on",
        AllowDeleteFile: formData.get("llowDeleteFile") === "on",
    };

    return setDirPermissions(resourcePath, perms).then(() => window.alert("Permissions updated"));
}

export default function SharedFilesList({loaderData}: Route.ComponentProps) {
    const item = loaderData;
    const revalidator = useRevalidator();

    const handleClear = async () => {
        await purgeStorage();
        revalidator.revalidate();
    };

    const buildContents = () => {
        if (!item) {
            return  <p>No item found</p>;
        } else if (!item.path || item.path === "/") {
            if (!item.contents || item.contents.length <= 0) {
                return (
                    <>
                        <p>Nothing shared yet!</p>
                        <br/>
                        <Link to="/host/share">Add something</Link>
                    </>
                )
            }

            return <SubItemsList items={item.contents} />
        } else {
            return <MainItem item={item} />
        }
    }

    
    return (
        <div>
            <h1>Shared Files</h1>
            <button onClick={handleClear}>Clear OPFS</button>
            {buildContents()}
        </div>
    );
}