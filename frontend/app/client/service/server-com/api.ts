import { type Items } from "~/common/fs/types";

export abstract class ClientToServerCommunication {
    public static async getRecordItem(hostId: string, itemId: string): Promise<Items.RecordItem[]> {
        throw new Error("Method not implemented.");
    };
}

export abstract class ServerEndpointService {
    public static getMetadataEndpointURL(hostId: string, itemId: string): string {
        throw new Error("Method not implemented.");
    }
}