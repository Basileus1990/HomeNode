/**
 * get root of OPFS
 */
export async function getStorageRoot(): Promise<FileSystemDirectoryHandle> {
    return await navigator.storage.getDirectory();
}

/**
 * clear entire OPFS
 */
export async function purgeStorage() {
    const root = await navigator.storage.getDirectory();
        for await (const key of root.keys()) {
        await root.removeEntry(key, { recursive: true });
    }
}