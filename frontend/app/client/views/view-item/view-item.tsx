import type { Route } from "./+types/view-item.js";
import { useRouteError, isRouteErrorResponse } from "react-router";

import { HostWebSocketClient } from "~/client/service/server-com/ws/implemenation"
import { createCacheKey, checkKeyInCache, getFromCache, setToCache } from "~/common/service/cache-service.js";
import MainItem from "./components/main-item";
import { HostIdContext } from "../../../common/ui/contexts/host-id-context.js";


export async function clientLoader({ params }: Route.LoaderArgs) {
    const { host_id, "*": path} = params;

    if (!params.host_id) {
        throw new Error("Missing host_id in route parameters");
    }

    const cacheKey = createCacheKey();
    if (checkKeyInCache(cacheKey)) {
        return getFromCache(cacheKey);
    }

    const result = await HostWebSocketClient.getRecordItem(host_id, path);
    setToCache(cacheKey, result);
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
    const item = loaderData;
    const hostId = params.host_id;

    const buildContents = () => {
        if (!item) {
            return  <p>No item found</p>;
        } else {
            return <MainItem item={item} />
        }
    }

    return (
        <>
            <HostIdContext value={hostId}>
                {buildContents()}
            </HostIdContext>
        </>
    );
}
