import type { Route } from ".react-router/types/app/host/views/shared-list/+types/shared-list";
import { useRevalidator } from "react-router";

// import { FSService } from "../../../common/fs/fs-service";
// import { RecordHandle } from "../../../common/fs/fs";
// import type { Items } from "../../../common/fs/types";
import RecordsList from "./components/records-list";
import { findHandle, isDirectoryPath, getSize, getStorageRoot, getLeaf, removeHandle, purgeStorage, getPath } from "~/common/newer-fs/api";

export async function clientLoader({ params, request }: Route.LoaderArgs) {
    //const rootRecord = await FSService.getRootRecord();
    const { '*': recordNameToFind} = params;
    // let res: RecordHandle | null = rootRecord;

    // if (recordNameToFind) {
    //     const recordToFind = await FSService.findRecordByName(recordNameToFind, rootRecord.getUnderlayingHandle(), true);
    //     res = recordToFind;
    // }
    // return FSService.readRecordIntoItem(res);
    console.log('host looking for', recordNameToFind);

    let handle: FileSystemHandle | null = await getStorageRoot();
    if (recordNameToFind)
        handle = await findHandle(recordNameToFind, isDirectoryPath(recordNameToFind));

    if (!handle) {
        console.log("empty handle");
        return [];
    }

    const res = [];
    if (handle.kind === "directory") {
        for await (const [name, entry] of (handle as FileSystemDirectoryHandle).entries()) {
            res.push({
                path: (recordNameToFind ? recordNameToFind + "/" : "") + entry.name,
                name,
                kind: entry.kind,
                size: await getSize(entry),
            })
        }
    } else {
        res.push({
            path: recordNameToFind,
            name: getLeaf(recordNameToFind ?? "") ?? "unkown",
            kind: "file",
            size: await getSize(handle),
        })
    }

    return res;
}

export async function clientAction({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const itemName = formData.get("itemName") as string;

    if (itemName) {
        try {
            // Attempt to delete the record
            //const res = await FSService.deleteRecordByName(itemName, undefined, true);
            const res = await removeHandle(itemName);
            console.log("Delete result:", res);
        } catch (error) {
            console.error("Error deleting record:", error);
        }
        
    }

    console.log("Deleting item:", itemName);
}

export default function SharedFilesList({loaderData}: Route.ComponentProps) {
    const items = loaderData;
    const revalidator = useRevalidator();

    const handleClear = async () => {
        await purgeStorage();
        revalidator.revalidate();
    };
    
    return (
        <div>
            <h2>Shared Files</h2>
            <button onClick={handleClear}>Clear OPFS</button>
            <RecordsList records={items}/>
        </div>
    );
}