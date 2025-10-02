import { type ClientToServerCommunication } from "../api";
import type { Item } from "~/common/fs/types";


export class HostWebSocketclient implements ClientToServerCommunication {
    public static async getRecordItem(hostId: string, itemId: string): Promise<Item[]> {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve([
                    {
                        name: "LoremIpsum.exe",
                        path: "lorem/ipsum",
                        kind: "file",
                        size: 999,
                    },
                    {
                        name: "Dolor",
                        path: "a/b/c/",
                        kind: "directory",
                        size: 0,
                    },
                ]);
            }, 2000);
        });
    }
}