import { Outlet, Link } from "react-router";

import useCoordinatorWorker from "../service/server-com/coordinator/use-coordinator";
import { getHostId } from "../service/id";
import { HostIdContext } from "./host-id-context";


export default function Host() {
    useCoordinatorWorker();
    let hostId = "";
    if (typeof window !== 'undefined') {
        hostId = getHostId() ?? "";
    }

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