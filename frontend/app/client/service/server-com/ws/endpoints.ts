import { ServerEndpointService } from "../api";
import type { HomeNodeFrontendConfig } from "../../../../config";


export class WebSocketServerEndpointService extends ServerEndpointService {
    public static getMetadataEndpointURL(hostId: string, path: string, config: HomeNodeFrontendConfig) {
        console.log(config);
        return config.client_metadata_ws_url_template.replace("@hostId", hostId).replace("@path", path);
    }

    public static getDownloadEndpointURL(hostId: string, path: string, config: HomeNodeFrontendConfig) {
        return config.client_download_ws_url_template.replace("@hostId", hostId).replace("@path", path);
    }
}