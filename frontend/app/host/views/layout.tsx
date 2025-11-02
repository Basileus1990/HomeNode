import type { Route } from ".react-router/types/app/host/views/+types/layout";
import { Outlet, Link } from "react-router";

import useCoordinatorWorker from "../server-com/coordinator/use-coordinator";
import { getHostId } from "../service/id";
import { HostIdContext } from "../../client/views/host-id-context";
import { getConfig } from "../../common/config";


export async function clientLoader() {
    return getConfig();
}

export default function Host({loaderData}: Route.ComponentProps) {
    useCoordinatorWorker(loaderData);
    const hostId = getHostId() ?? "";

    return (
        <div>
            <HostIdContext value={hostId}>
                <h1>Host</h1>
                <h2>{ hostId ? hostId : 'No hostID found'}</h2>
                <p>
                    This is the host route. You can share files or view shared files here.
                </p>
                <p>
                    <Link to="/host/share">Share new file</Link>
                </p>
                <p>
                    <Link to="/host/shared">Your shared files</Link>
                </p>
                <Outlet/>
            </HostIdContext>
        </div>
    );
}   