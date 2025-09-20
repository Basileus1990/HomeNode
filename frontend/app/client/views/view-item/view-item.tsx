import type { Route } from "./+types/view-item.js";

import RecordsList from "./components/records-list.js";
import { HostWebSocketclient } from "~/client/service/server-com/ws/implemenation.js"


export async function clientLoader({ params }: Route.LoaderArgs) {
    const { host_id, "*": path} = params;

    if (!params.host_id) {
        throw new Error("Missing host_id in route parameters");
    }

    return HostWebSocketclient.getRecordItem(host_id, path);
}

export default function ViewItem({ loaderData, params }: Route.ComponentProps) {
    return (
        <div>
            <h1>Viewing item #{params.item_id} from host#{params.host_id}</h1>
            <RecordsList records={loaderData} hostId={params.host_id} />
        </div>
    );
}
