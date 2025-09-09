import type { Route } from ".react-router/types/app/host/views/shared-list/+types/shared-list";
import { useRevalidator } from "react-router";

import { FSService } from "~/common/fs/fs-service";
import { RecordHandle } from "~/common/fs/fs";
import type { Items } from "~/common/fs/types";
import RecordsList from "./components/records-list";

export async function clientLoader({ params }: Route.LoaderArgs) {
    const rootRecord = await FSService.getRootRecord();
    const recordNameToFind = params.item_id;
    let res: RecordHandle | null = rootRecord;

    if (recordNameToFind) {
        const recordToFind = await FSService.findRecordByName(recordNameToFind, rootRecord.getUnderlayingHandle(), true);
        res = recordToFind;
    }
    return FSService.readRecordIntoItem(res);
}

export async function clientAction({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const itemName = formData.get("itemName") as string;

    if (itemName) {
        try {
            // Attempt to delete the record
            const res = await FSService.deleteRecordByName(itemName, undefined, true);
            console.log("Delete result:", res);
        } catch (error) {
            console.error("Error deleting record:", error);
        }
        
    }

    console.log("Deleting item:", itemName);
}

export default function SharedFilesList({loaderData}: Route.ComponentProps) {
    const items: Items.RecordItem[] = loaderData;
    const revalidator = useRevalidator();

    const handleClear = async () => {
        await FSService.purgeStorage();
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