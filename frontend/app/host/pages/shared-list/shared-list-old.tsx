import type { Route } from ".react-router/types/app/host/pages/+types/shared-list";
import { useFetcher } from "react-router";

import type { FileRecordHandle } from "../fs/records-filesystem";
import { OPFS } from "../fs/opfs";

export async function clientLoader() {
    return prepareData(await OPFS.getAllRecords().then((data) => data.files));
}

export async function clientAction({ request }: { request: Request }) {
    const formData = await request.formData();
    const fileName = formData.get("fileName") as string;

    if (fileName) {
        await OPFS.removeRecord(fileName); // Delete the file from OPFS
    }

    return prepareData(await OPFS.getAllRecords().then((data) => data.files));
}


async function prepareData(records: FileRecordHandle[]) {
    const fileInfo: any[] = [];
    for (const record of records) {
        const file = await (await record.getHandle()).getFile();
        const metadata = await record.getMetadata();
        const fileData = {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            recordName: metadata.name,
            dateShared: metadata.dateShared,
        };
        fileInfo.push(fileData);
    }
    return fileInfo;
}

export default function SharedFilesList({loaderData}: Route.ComponentProps) {
    const files = loaderData
    const fetcher = useFetcher();
    
    // If fetcher is submitting, use its data; otherwise, use the loader data
    const displayedFiles = fetcher.data || files;
    return (
        <div>
            <button onClick={()=> OPFS.clearStorage()}>Clear OPFS</button>
            <h2>Shared Files</h2>
            <ul>
                {displayedFiles.length === 0 && <p>No files found.</p>}
                {displayedFiles.map((file: any) => (
                    <li key={file.recordName}>
                        <strong>{file.name}</strong> - {file.size} bytes
                        <br />
                        Type: {file.type}
                        <br />
                        Last Modified: {new Date(file.lastModified).toLocaleString()}
                        <br />
                        Record: {file.recordName}
                        <br />
                        Date Shared: {new Date(file.dateShared).toLocaleString()}
                        <br />
                        <fetcher.Form method="post">
                            <input type="hidden" name="fileName" value={file.recordName} />
                            <button type="submit">Delete</button>
                        </fetcher.Form>
                    </li>
                ))}
            </ul>
        </div>
    );
}