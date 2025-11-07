import type { Route } from ".react-router/types/app/host/views/+types/layout";
import { Outlet, Link } from "react-router";
import { Center } from "@chakra-ui/react";

import useCoordinatorWorker from "../server-com/coordinator/use-coordinator";
import { getHostId } from "../service/id";
import { HostIdContext } from "../../client/views/host-id-context";
import { getConfig } from "../../common/config";
import { ColorModeButton } from "~/components/ui/color-mode";


export async function clientLoader() {
    return getConfig();
}

export default function Host({loaderData}: Route.ComponentProps) {
    useCoordinatorWorker(loaderData);
    const hostId = getHostId() ?? "";

    return (
        <>
            <HostIdContext value={hostId}>
                <h1>Host</h1>
                <p>
                    <Link to="/host/share">Share new file</Link>
                </p>
                <p>
                    <Link to="/host/shared">Your shared files</Link>
                </p>
                <ColorModeButton />

                <Center>
                    <Outlet/>
                </Center>
            </HostIdContext>
        </>
    );
}   