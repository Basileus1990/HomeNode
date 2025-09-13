import { ServerEndpointService } from "../api";
import type { HomeNodeFrontendConfig } from "../../../../config";


export class WebSocketServerEndpointService extends ServerEndpointService {
    public static getMetadataEndpointURL(hostId: string, itemId: string, config: HomeNodeFrontendConfig) {
        console.log(config);
        return config.record_info_ws_url.replace("@hostId", hostId).replace("@itemId", itemId);
    }

    public static getDownloadEndpointURL(hostId: string, itemId: string, config: HomeNodeFrontendConfig) {
        return config.record_download_ws_url.replace("@hostId", hostId).replace("@itemId", itemId);
    }
}