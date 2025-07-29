import { type RecordItem } from "~/common/fs/types";

export async function getItem(host_id: string, item_id: string): Promise<RecordItem[]> {
    console.log(`Fetching item #${item_id} from host #${host_id}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return [];
}