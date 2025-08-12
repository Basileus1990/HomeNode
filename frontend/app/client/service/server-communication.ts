export async function getItem(host_id: string, item_id: string): Promise<[]> {
    console.log(`Fetching item #${item_id} from host #${host_id}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return [];
}