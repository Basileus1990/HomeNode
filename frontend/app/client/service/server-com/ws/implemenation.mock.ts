import { type ClientToServerCommunication } from "../api";
import { type Items, RecordKind } from "../../../../common/fs/types";


export class HostWebSocketclient implements ClientToServerCommunication {
    public static async getRecordItem(hostId: string, itemId: string): Promise<Items.RecordItem[]> {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve([
                    {
                        recordName: "Lorem",
                        contentName: "Ipsum",
                        kind: RecordKind.file,
                        dateShared: Date.now() + 1,
                        lastModified: Date.now() - 1,
                        size: 999,
                    } as Items.FileRecordItem,
                    {
                        recordName: "Dolor",
                        contentName: "...",
                        kind: RecordKind.directory,
                        entriesNo: 1
                    } as Items.DirectoryRecordItem,
                ]);
            }, 2000);
        });
    }
}