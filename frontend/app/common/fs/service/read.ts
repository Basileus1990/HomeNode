import type { RecordHandle, FileRecordHandle, DirectoryRecordHandle } from "../fs";
import { type Items, RecordKind } from "../types";
import { FILE_RECORD_PREFIX, DIR_RECORD_PREFIX } from "../objects/config";

    /**
     * read record into object inteded for displaying in frontend
     */
    export async function readRecordIntoItem(record: RecordHandle | null): Promise<Items.RecordItem[]> {
        async function readFileRecord(handle: FileRecordHandle): Promise<Items.FileRecordItem> {
            const file = await handle.getHandle().then((h) => h.getFile());
            const metadata = await handle.getMetadata();
            return {
                recordName: handle.getName().replace(FILE_RECORD_PREFIX, ""),
                contentName: metadata.contentName,
                kind: RecordKind.file,
                lastModified: file.lastModified,
                size: file.size,
                dateShared: metadata.dateShared,
            } as Items.FileRecordItem;
        }

        async function readDirectoryRecord(handle: DirectoryRecordHandle): Promise<Items.DirectoryRecordItem> {
            const metadata = await handle.getMetadata();
            return {
                    recordName: handle.getName().replace(DIR_RECORD_PREFIX, ""),
                    contentName: metadata.contentName,
                    dateShared: metadata.dateShared,
                    kind: RecordKind.directory,
                    entriesNo: 0, //TODO: Placeholder for entries count
            } as Items.DirectoryRecordItem;
        }


        if (!record) {
            console.log("No record found for the given ID.");
            return [];
        }

        const items: Items.RecordItem[] = [];
        if (record.getKind() === RecordKind.directory) {
            const dir = record as DirectoryRecordHandle;
            console.log(dir);
            for await (const [key, handle] of dir.entries()) {
                const rec = await handle;
                const kind = rec.getKind();
                if (kind === RecordKind.file) {
                    items.push(await readFileRecord(rec as FileRecordHandle));
                } else if (kind === RecordKind.directory) {
                    items.push(await readDirectoryRecord(rec as DirectoryRecordHandle));
                }
            }
        } else if (record.getKind() === RecordKind.file) {
            items.push(await readFileRecord(record as FileRecordHandle));
        }
        
        console.log(items);
        return items;
    }