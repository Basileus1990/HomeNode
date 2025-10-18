import type { Route } from "./+types/view-item.js";
import { useRouteError, isRouteErrorResponse, useRevalidator } from "react-router";

import RecordsList from "./components/records-list";
import { HostWebSocketclient } from "~/client/service/server-com/ws/implemenation"
import UploadFileDropzone from "./components/upload-file-dropzone";


const metadataCache = new Map<string, any>();


export async function clientLoader({ params }: Route.LoaderArgs) {
    const { host_id, "*": path} = params;

    if (!params.host_id) {
        throw new Error("Missing host_id in route parameters");
    }

    const cacheKey = `${host_id}/${path ?? ""}`;
    if (metadataCache.has(cacheKey)) {
        console.log(`retrieved ${cacheKey} from cache`);
        return metadataCache.get(cacheKey);
    }

    console.log(`querying server for ${cacheKey}`);
    const result = await HostWebSocketclient.getRecordItem(host_id, path);
    metadataCache.set(cacheKey, result);
    return result;
}

export function ErrorBoundary() {
    const error = useRouteError();

    if (isRouteErrorResponse(error)) {
        return (
            <div style={{ color: "red" }}>
                <h2>Failed to load item</h2>
                <p>{error.status} {error.statusText}</p>
                <pre>{error.data?.message || "Unknown error"}</pre>
            </div>
        );
    }

    return (
        <div style={{ color: "red" }}>
            <h2>Failed to load item</h2>
            <pre>{error instanceof Error ? error.message : String(error)}</pre>
        </div>
    );
}

export default function ViewItem({ loaderData, params }: Route.ComponentProps) {
    const revalidator = useRevalidator();

    const handleCreateDir = (hostId: string, basePath: string) => {
        const folderName = window.prompt("Enter the name of folder to create");
        const path = `${basePath}/${folderName}`;

        HostWebSocketclient.createDirectory(hostId, path)
            .then(() => {
                window.alert(`Folder ${folderName} created`);
                revalidator.revalidate();
            })
            .catch((e) => window.alert(e))
    }

    return (
        <div>
            <h1>Viewing item #{params["*"]} from host#{params.host_id}</h1>
            <UploadFileDropzone hostId={params.host_id} path={params["*"]}/>
            <br/>
            <button onClick={() => handleCreateDir(params.host_id, params["*"])}>Add directory</button>
            <br/>
            <RecordsList records={loaderData} hostId={params.host_id} />
        </div>
    );
}
