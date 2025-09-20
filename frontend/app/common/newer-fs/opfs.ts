import { getLeaf, getPath } from "./path";
import { getStorageRoot } from "./root";
import type { Item } from "./types";


export async function findHandle(path: string, directory: boolean): Promise<FileSystemHandle | null> {
    console.log("looking for ", path);
    
    const root = await getStorageRoot();

    if (path === "/")
        return root;

    // if (!path.startsWith("/")) {
    //   throw new Error("Path must be absolute and start with /");
    // }

    const parts = path.split("/").filter(Boolean);

    let current: FileSystemDirectoryHandle | FileSystemFileHandle = root;
    for (let i = 0; i < parts.length; i++) {
        const isLast = i === parts.length - 1;
        const part = parts[i];

        if (!(current instanceof FileSystemDirectoryHandle)) {
            // Can't traverse inside a file
            return null;
        }

        if (isLast) {
            // Last segment: file or directory
            try {
                if (directory) {
                    current = await current.getDirectoryHandle(part);
                } else {
                    current = await current.getFileHandle(part);
                }
            } catch {
                return null;
            }
        } else {
            // Intermediate directories
            try {
                current = await current.getDirectoryHandle(part);
            } catch {
                return null;
            }
        }
    }

    return current;
}

export async function createHandle(path: string, directory: boolean, createIntermediate: boolean = true): Promise<FileSystemHandle | null> {
    const root = await getStorageRoot();

    if (!path.startsWith("/")) {
      throw new Error("Path must be absolute and start with /");
    }

    const parts = path.split("/").filter(Boolean);

    let current: FileSystemDirectoryHandle | FileSystemFileHandle = root;
    for (let i = 0; i < parts.length; i++) {
        const isLast = i === parts.length - 1;
        const part = parts[i];

        if (!(current instanceof FileSystemDirectoryHandle)) {
            // Can"t traverse inside a file
            return null;
        }

        if (isLast) {
            // Last segment: file or directory
            try {
                if (directory) {
                    current = await current.getDirectoryHandle(part, { create: true });
                } else {
                    current = await current.getFileHandle(part, { create: true });
                }
            } catch {
                return null;
            }
        } else {
            // Intermediate directories
            try {
                current = await current.getDirectoryHandle(part, { create: createIntermediate });
            } catch {
                return null;
            }
        }
    }

    return current;
}

export async function createFileAsync(path: string, file: File) {
    const fileHandle = await createHandle(path, false) as FileSystemFileHandle | null;

    if (!fileHandle || fileHandle.kind !== 'file') {
      throw new Error('Failed to get file handle');
    }

    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
}

export async function createFileSync(path: string, file: File) {
    const fileHandle = await createHandle(path, false) as FileSystemFileHandle | null;

    if (!fileHandle || fileHandle.kind !== 'file') {
      throw new Error('Failed to get file handle');
    }

    const accessHandle = await fileHandle.createSyncAccessHandle();
    const arrayBuffer = await file.arrayBuffer();
    accessHandle.write(arrayBuffer);
    accessHandle.flush();
    accessHandle.close();
}

export async function writeFileSync(fileHandle: FileSystemFileHandle, file: File) {
    const accessHandle = await fileHandle.createSyncAccessHandle();
    const arrayBuffer = await file.arrayBuffer();
    accessHandle.write(arrayBuffer);
    accessHandle.flush();
    accessHandle.close();
}

export async function getSize(handle: FileSystemHandle) {
    if (handle.kind === "file") {
        const file = await (handle as FileSystemFileHandle).getFile();
        return file.size;
    } else {
        let size = 0;
        for await (const [, entry] of (handle as FileSystemDirectoryHandle).entries()) {
            size += await getSize(entry);
        }
        return size;
    }

}

export async function readItem(path: string, directory: boolean) {
    const handle = await findHandle(path, directory);

    if (!handle) {
        return null;
    }

    return {
        path,
        name: getLeaf(path),
        kind: handle.kind,
        size: await getSize(handle),
    } as Item;
}

export async function readHandle(handle: FileSystemHandle) {
    //const path = getPath(handle);
    const path = "x";
    const res = [];
    if (handle.kind === "directory") {
        for await (const [name, entry] of (handle as FileSystemDirectoryHandle).entries()) {
            res.push({
                path: path + "/" + entry.name,
                name,
                kind: entry.kind,
                size: await getSize(entry),
            })
        }
    } else {
        res.push({
            path: path,
            name: handle.name,
            kind: "file",
            size: await getSize(handle),
        })
    }
    return res;
}

export async function removeHandle(path: string) {
    const root = await getStorageRoot();

    if (!path.startsWith("/")) {
      throw new Error("Path must be absolute and start with /");
    }

    const parts = path.split("/").filter(Boolean);

    let current: FileSystemDirectoryHandle | FileSystemFileHandle = root;
    for (let i = 0; i < parts.length; i++) {
        const isLast = i === parts.length - 1;
        const part = parts[i];

        if (!(current instanceof FileSystemDirectoryHandle)) {
            // Can't traverse inside a file
            return false;
        }

        if (isLast) {
            // Last segment: file or directory
            try {
                current.removeEntry(getLeaf(path)!);
            } catch {
                return false;
            }
        } else {
            // Intermediate directories
            try {
                current = await current.getDirectoryHandle(part);
            } catch {
                return false;
            }
        }
    }

    return true;
}
