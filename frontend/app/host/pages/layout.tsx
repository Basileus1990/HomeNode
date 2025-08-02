import { Outlet, Link } from "react-router";
import useServerCommunicatorWorker from "../worker/server-com-worker/use-server-com-worker";

export default function Host() {
    //useServerCommunicatorWorker();

    return (
        <div>
            <h1>Host</h1>
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
        </div>
    );
}   