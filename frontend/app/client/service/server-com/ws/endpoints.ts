import { ServerEndpointService } from "../api";
import type { HomeNodeFrontendConfig } from "../../../../common/config";


export class WebSocketServerEndpointService extends ServerEndpointService {
    public static getMetadataEndpointURL(hostId: string, path: string, config: HomeNodeFrontendConfig) {
        return config.client_metadata_ws_url_template
            .replace("@hostId", hostId)
            .replace("@path", path);
    }

    public static getDownloadEndpointURL(hostId: string, path: string, config: HomeNodeFrontendConfig) {
        return config.client_download_ws_url_template
            .replace("@hostId", hostId)
            .replace("@path", path);
    }

    public static getCreateFileEndpointURL(hostId: string, path: string, fileSize: number, config: HomeNodeFrontendConfig) {
        return config.client_create_file_ws_url_template
            .replace("@hostId", hostId)
            .replace("@path", path)
            .replace("@fileSize", fileSize.toString());
    }

    public static getCreateDirectoryEndpointURL(hostId: string, path: string, config: HomeNodeFrontendConfig) {
        return config.client_create_dir_ws_url_template
            .replace("@hostId", hostId)
            .replace("@path", path);
    }

    public static getDeleteResourceEndpointURL(hostId: string, path: string, config: HomeNodeFrontendConfig) {
        return config.client_delete_resource_ws_url_template
            .replace("@hostId", hostId)
            .replace("@path", path);
    }
}