
export async function getStorageRoot() {
    return await navigator.storage.getDirectory();
}

export async function purgeStorage() {
    const root = await navigator.storage.getDirectory();
        for await (const key of root.keys()) {
        await root.removeEntry(key, { recursive: true });
    }
}
