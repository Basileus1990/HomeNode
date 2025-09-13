import type { Items } from "~/common/fs/types";
import type { HomeNodeFrontendConfig } from "~/config";

export abstract class ClientToServerCommunication {
    public static async getRecordItem(hostId: string, itemId: string, config: HomeNodeFrontendConfig): Promise<Items.RecordItem[]> {
        throw new Error("Method not implemented.");
    };
}

export abstract class ServerEndpointService {
    public static getMetadataEndpointURL(hostId: string, itemId: string, config: HomeNodeFrontendConfig): string {
        throw new Error("Method not implemented.");
    }
}