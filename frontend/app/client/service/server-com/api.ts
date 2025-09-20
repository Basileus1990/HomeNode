import type { Item } from "~/common/newer-fs/types";
import type { HomeNodeFrontendConfig } from "../../../config";

export abstract class ClientToServerCommunication {
    public static async getRecordItem(hostId: string, itemId: string, config: HomeNodeFrontendConfig): Promise<Item[]> {
        throw new Error("Method not implemented.");
    };
}

export abstract class ServerEndpointService {
    public static getMetadataEndpointURL(hostId: string, itemId: string, config: HomeNodeFrontendConfig): string {
        throw new Error("Method not implemented.");
    }
}