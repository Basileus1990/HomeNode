import { ServerEndpointService } from "../api";

const RECORD_INFO_ENDPOINT = import.meta.env.VITE_RECORD_INFO_WS_URL as string;
const RECORD_DOWNLOAD_ENDPOINT = import.meta.env.VITE_RECORD_DOWNLOAD_WS_URL as string;


export class WebSocketServerEndpointService extends ServerEndpointService {
    public static getMetadataEndpointURL(hostId: string, itemId: string) {
        return RECORD_INFO_ENDPOINT.replace("@hostId", hostId).replace("@itemId", itemId);
    }

    public static getDownloadEndpointURL(hostId: string, itemId: string) {
        return RECORD_DOWNLOAD_ENDPOINT.replace("@hostId", hostId).replace("@itemId", itemId);
    }
}