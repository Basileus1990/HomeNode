import { get, set, clear, del, keys, delMany } from "idb-keyval";

import type { Metadata } from "./types";


export interface Entry {
    path: string;
    isDirectory: boolean;
    handle: FileSystemHandle;
    metadata: Metadata
}

export async function getEntry(path: string): Promise<Entry | undefined> {
    return get(path);
}

export async function setEntry(entry: Entry) {
    return set(entry.path, entry);
}

export async function removeEntry(path: string) {
    const entry: Entry | undefined = await get(path);
    
    if (!entry)
        throw new Error("Entry not found");

    if (entry.isDirectory) {
        const dbKeys = await keys();
        const dirContents = dbKeys.filter((p: IDBValidKey) => (p as string).includes(path));
        return delMany([path, ...dirContents]);
    } else { 
        return del(path);
    }
}

export async function clearAllEntries() {
    return clear();
}