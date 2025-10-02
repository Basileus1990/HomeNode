import log from "loglevel";

import type { Metadata } from "./types";
import { getParentPath, getLeaf } from "./path";
import { createHandle, findHandle } from "./opfs"
import { getEntry, setEntry, removeEntry } from "./cache";


async function create(
    path: string, 
    directory: boolean,
    metadata: Metadata,
    createIntermediate: boolean = true
): Promise<FileSystemHandle | null> 
{
    let handle;

    const entry = await getEntry(getParentPath(path));
    const leafName = getLeaf(path);
    if (entry && leafName) {
        try {
            if (directory)
                handle = await (entry.handle as FileSystemDirectoryHandle).getDirectoryHandle(leafName, { create: true });
            else
                handle = await (entry.handle as FileSystemDirectoryHandle).getFileHandle(leafName, { create: true });
        } catch {
            console.debug("Tried to create using handle from cache but failed. Falling back on OPFS");
        }
    }
    else
        handle = await createHandle(path, directory, createIntermediate);

    if (handle) {
        await setEntry({path, isDirectory: directory, handle, metadata });
        return handle
    } else {
        return null;
    }
}

async function createFileAsync(
    path: string, 
    file: File, 
    metadata: Metadata) {
    const fileHandle = await create(path, false, metadata) as FileSystemFileHandle | null;

    if (!fileHandle || fileHandle.kind !== 'file') {
      throw new Error('Failed to get file handle');
    }

    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
}

async function createFileSync(
    path: string, 
    file: File, 
    metadata: Metadata) {
    const fileHandle = await create(path, false, metadata) as FileSystemFileHandle | null;

    if (!fileHandle || fileHandle.kind !== 'file') {
      throw new Error('Failed to get file handle');
    }

    const accessHandle = await fileHandle.createSyncAccessHandle();
    const arrayBuffer = await file.arrayBuffer();
    accessHandle.write(arrayBuffer);
    accessHandle.flush();
    accessHandle.close();
}



async function createDirectoryDirectly(parent: FileSystemDirectoryHandle, path: string, metadata: Metadata) {
    const dirname = getLeaf(path);
    if (!dirname) {
        return null;
    }

    try {
        const handle = await parent.getDirectoryHandle(dirname, { create: true });
        await setEntry({path, isDirectory: true, handle, metadata });
        return handle;
    } catch {
        return null;
    }
}

async function createFileSyncDirectly(parent: FileSystemDirectoryHandle, path: string, file: File, metadata: Metadata) {
    const filename = getLeaf(path);
    if (!filename) {
        return null;
    }

    try {
        const handle = await parent.getFileHandle(filename, { create: true });
        const writable = await handle.createWritable();
        await writable.write(file);
        await writable.close();
        await setEntry({path, isDirectory: true, handle, metadata });
        return handle;
    } catch {
        return null;
    }
}

async function createFileAsyncDirectly(parent: FileSystemDirectoryHandle, path: string, file: File, metadata: Metadata) {
    const filename = getLeaf(path);
    if (!filename) {
        return null;
    }

    try {
        const handle = await parent.getFileHandle(filename, { create: true });
        const accessHandle = await handle.createSyncAccessHandle();
        const arrayBuffer = await file.arrayBuffer();
        accessHandle.write(arrayBuffer);
        accessHandle.flush();
        accessHandle.close();
        await setEntry({path, isDirectory: true, handle, metadata });
        return handle;
    } catch {
        return null;
    }
}



async function find(
    path: string, 
    directory: boolean,
): Promise<FileSystemHandle | null> 
{
    // try in indexdb cache
    const entry = await getEntry(path);
    if (entry)
        return entry.handle;

    // if not found resolve using just OPFS
    return findHandle(path, directory);
}

async function read(handle: FileSystemHandle) {
    
}

async function removeObject(path: string) {
    const parentPath = getParentPath(path);
    const parentHandle = await find(parentPath, true) as (FileSystemDirectoryHandle | null);
    const leafToRemove = getLeaf(path);

    if (!parentHandle || parentHandle.kind !== "directory") {
        throw new Error("Parent not found");
    }

    if (!leafToRemove) {
        throw new Error("Nothing to remove");
    }

    try {
        return parentHandle.removeEntry(leafToRemove, { recursive: true }).then(() => removeEntry(path));;
    } catch {
        return null;
    }  
} 


export {
    create, 
    createDirectoryDirectly,
    createFileAsync,
    createFileAsyncDirectly,
    createFileSync,
    createFileSyncDirectly,
    find, read,
    removeObject
}