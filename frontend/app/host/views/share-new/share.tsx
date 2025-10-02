import type { Route } from ".react-router/types/app/host/views/share-new/+types/share";
import log from "loglevel";

import Uploader from "./components/uploader";
import { getStorageRoot, findHandle } from "~/common/fs/api";


export async function clientLoader({ params }: Route.LoaderArgs) {
    const { "*": resourcePath} = params;

    let handle: FileSystemHandle | null;
    let error: string = "";
    if (resourcePath) {
        handle = await findHandle(resourcePath);
        if (!handle) {
            error = "Path not found";
            handle = await getStorageRoot();
        } else if (handle.kind !== "directory") {
            error = "Not a directory";
        }
    }
    else
        handle = await getStorageRoot();

    return { handle, error };
}

export default function Share({loaderData}: Route.ComponentProps) {
    const { handle, error } = loaderData;

    if (error) {
        return (
            <p>Error: {error}!</p>
        );
    }

    return (
        <article>
            <Uploader root={handle as FileSystemDirectoryHandle} />
        </article>
    );
}