import type { Route } from ".react-router/types/app/host/views/+types/layout";
import { Outlet } from "react-router";

import useCoordinatorWorker from "../server-com/coordinator/use-coordinator";
import { getHostId } from "../service/id";
import { HostIdContext } from "~/common/ui/contexts/host-id-context";
import { getConfig } from "~/common/config";


export async function clientLoader() {
    return getConfig();
}

export default function Host({loaderData}: Route.ComponentProps) {
    useCoordinatorWorker(loaderData);
    const hostId = getHostId() ?? "";

    return (
        <HostIdContext value={hostId}>
            <Outlet/>
        </HostIdContext>
    );
}   