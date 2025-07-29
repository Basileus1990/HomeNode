import type { Route } from ".react-router/types/app/host/pages/shared-list/+types/shared-list";

import { FSService } from "~/host/service/fs-service";
import { RecordHandle } from "~/common/fs/records-filesystem";
import type { Items } from "~/common/fs/types";
import RecordsList from "./components/records-list";

export async function clientLoader({ params }: Route.LoaderArgs) {
    const rootRecord = await FSService.getRootRecord();
    const recordNameToFind = params.item_id;
    let res: RecordHandle | null = rootRecord;

    if (recordNameToFind) {
        const recordToFind = await rootRecord.find(recordNameToFind, true);
        res = recordToFind;
    }

    return FSService.prepareData(res);
}

export default function SharedFilesList({loaderData}: Route.ComponentProps) {
    const items: Items.RecordItem[] = loaderData;
    
    return (
        <div>
            <h2>Shared Files</h2>
            <button onClick={()=> FSService.purgeStorage()}>Clear OPFS</button>
            <RecordsList records={items} />
        </div>
    );
}