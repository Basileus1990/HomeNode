import { get } from "http";
import type { Route } from "./+types/view-item.js";

import RecordsList from "./components/records-list.js";
import { getItem } from "~/client/service/server-communication.js";

export async function clientLoader({ params }: Route.LoaderArgs) {
    if (!params.host_id || !params.item_id) {
        throw new Error("Missing host_id or item_id in route parameters");
    }
    return getItem(params.host_id, params.item_id);
}

export default function ViewItem({ loaderData, params }: Route.ComponentProps) {
    return (
        <div>
            <h1>Viewing item #{params.item_id} from host#{params.host_id}</h1>
            <RecordsList records={loaderData} />
        </div>
    );
}
