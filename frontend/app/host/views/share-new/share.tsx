import type { Route } from ".react-router/types/app/host/views/share-new/+types/share";
import log from "loglevel";

import Uploader from "./components/uploader";
import { getStorageRoot, findHandle } from "~/common/fs/api";


export async function clientLoader({ params }: Route.LoaderArgs) {
    const { "*": resourcePath} = params;

    let handle: FileSystemHandle | null = null;
    let error: string = "";
    if (resourcePath) {
        try {
            handle = await findHandle(resourcePath);
        } catch (e) {
            error = "Invalid path";
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