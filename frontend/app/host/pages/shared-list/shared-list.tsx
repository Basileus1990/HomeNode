import type { Route } from ".react-router/types/app/host/pages/shared-list/+types/shared-list";

import { FSService } from "~/host/service/fs-service";
import { FileRecordHandle, DirectoryRecordHandle, RecordHandle } from "~/host/fs/records-filesystem";
import type { RecordMetadata, FileRecordInfo, DirectoryRecordInfo, RecordInfo } from "~/host/fs/types";
import { RecordKind } from "~/host/fs/types";
import RecordsList from "./components/records-list";

export async function clientLoader({ params }: Route.LoaderArgs) {
    
    const rootRecord = await FSService.getRootRecord();
    const recordNameToFind = params.id;
    let res: RecordHandle | null = rootRecord;

    if (recordNameToFind) {
        const recordToFind = await rootRecord.find(recordNameToFind, true);
        res = recordToFind;
    }
    console.log("ClientLoader firing for: ", params, "Found record:", res);
    return prepareData(res);
}

async function prepareData(record: RecordHandle | null): Promise<RecordInfo[]> {
    async function readFileRecord(handle: FileRecordHandle): Promise<FileRecordInfo> {
        const file = await handle.getHandle().then((h) => h.getFile());
        const metadata = await handle.getMetadata();
        return {
            recordName: handle.getName(),
            contentName: metadata.contentName,
            kind: RecordKind.file,
            lastModified: file.lastModified,
            size: file.size,
            dateShared: metadata.dateShared,
        } as FileRecordInfo;
    }

    async function readDirectoryRecord(handle: DirectoryRecordHandle): Promise<DirectoryRecordInfo> {
        const metadata = await handle.getMetadata();
        return {
                recordName: handle.getName(),
                contentName: metadata.contentName,
                dateShared: metadata.dateShared,
                kind: RecordKind.directory,
                entriesNo: 0, //TODO: Placeholder for entries count
        } as DirectoryRecordInfo;
    }


    if (!record) {
        console.log("No record found for the given ID.");
        return [];
    }

    const recordInfos: RecordInfo[] = [];
    if (record.getKind() === RecordKind.directory) {
        const dir = record as DirectoryRecordHandle;
        for await (const [key, handle] of dir.entries()) {
            const rec = await handle as RecordHandle;
            const kind = rec.getKind();
            if (kind === RecordKind.file) {
                recordInfos.push(await readFileRecord(rec as FileRecordHandle));
            } else if (kind === RecordKind.directory) {
                recordInfos.push(await readDirectoryRecord(rec as DirectoryRecordHandle));
            }
        }
    } else if (record.getKind() === RecordKind.file) {
        console.log("Got file record:", record);
        recordInfos.push(await readFileRecord(record as FileRecordHandle));
    }
    
    console.log("Prepared record infos:", recordInfos);
    return recordInfos;
}

export default function SharedFilesList({loaderData}: Route.ComponentProps) {
    const fileInfo: RecordInfo[] = loaderData;
    
    return (
        <div>
            <h2>Shared Files</h2>
            <button onClick={()=> FSService.purgeStorage()}>Clear OPFS</button>
            <RecordsList records={fileInfo} />
        </div>
    );
}