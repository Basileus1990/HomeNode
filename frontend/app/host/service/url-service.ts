import log from "loglevel";

import type { HomeNodeFrontendConfig } from "~/common/config";

export function getResourceShareURL(hostId: string, resourceId: string) {
    return `${window.location.origin}/client/${hostId}/${resourceId}`;
}

export function getHostAddItemURL(path: string) {
    return `${window.location.origin}/host/share/${path}`;
}

export function getHostConnectionURL(config: HomeNodeFrontendConfig, hostId?: string, hostKey?: string) {
    if (hostId && hostKey) {
        log.trace(`Using stored credentials #ID{${hostId}} & #Key{${hostKey}}`);
        return getHostReconnectURL(config, hostId, hostKey)
    }
    else {
        log.trace("Asking for new credentials");
        return getHostCleanConntectionURL(config);
    }
}

export function getHostCleanConntectionURL(config: HomeNodeFrontendConfig) {
    return config.host_connect_ws_url;
}

export function getHostReconnectURL(config: HomeNodeFrontendConfig, hostId: string, hostKey: string) {
    return config.host_reconnect_ws_url_template.replace("@hostId", hostId).replace("@hostKey", hostKey);
}