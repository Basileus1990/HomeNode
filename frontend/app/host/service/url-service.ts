import type { HomeNodeFrontendConfig } from "~/config";

export function getResourceShareURL(hostId: string, resourceId: string) {
    return `${window.location.origin}/client/${hostId}/${resourceId}`;
}

export function getHostConnectionURL(config: HomeNodeFrontendConfig, hostId?: string, hostKey?: string) {
    if (hostId && hostKey) {
        console.log(`Using stored credentials #ID{${hostId}} & #Key{${hostKey}}`);
        return getHostReconnectURL(config, hostId, hostKey)
    }
    else {
        console.log("Asking for new credentials");
        return getHostCleanConntectionURL(config);
    }
}

export function getHostCleanConntectionURL(config: HomeNodeFrontendConfig) {
    return config.host_connect_ws_url;
}

export function getHostReconnectURL(config: HomeNodeFrontendConfig, hostId: string, hostKey: string) {
    //return `ws://localhost:3000/api/v1/host/reconnect/${hostId}?hostKey=${hostKey}`
    return config.host_reconnect_ws_url_template.replace("@hostId", hostId).replace("@hostKey", hostKey);
}