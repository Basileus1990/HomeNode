import { type DirPermissions, getDefaultPermissions, getDirPermissions, setDirPermissions, delDirPermissions } from "../perm/permissions";
import { getStorageRoot } from "./root";
import { HostExceptions } from "../exceptions";
import type { Item } from "./types";
import { getSize } from "./opfs";


export async function findHandleWithPermissions(path: string): Promise<[FileSystemHandle, DirPermissions]> {
    const root = await getStorageRoot();

    if (path === "/")
        return [root, getDefaultPermissions()];

    const parts = path.split("/").filter(Boolean);

    let current: FileSystemDirectoryHandle | FileSystemFileHandle = root;
    for (let i = 0; i < parts.length; i++) {
        const isLast = i === parts.length - 1;
        const part = parts[i];

        if (!(current instanceof FileSystemDirectoryHandle)) {
            // Can't traverse inside a file
            throw new DOMException("", HostExceptions.PathError);
        }

        if (isLast) {
            // Last segment: file or directory
            for await (const [key, entry] of current.entries()) {
                if (key === part) {
                    let perms = await getDirPermissions(path);

                    // Entry was somehow missing permissions
                    if (!perms) {
                        perms = getDefaultPermissions();
                        await setDirPermissions(path, perms);
                    }
                    return [entry, perms];
                }
            }
            throw new DOMException("", HostExceptions.DOMNotFoundError);
        } else {
            current = await current.getDirectoryHandle(part);
        }
    }
    throw new DOMException("", HostExceptions.DOMNotFoundError);
}

export async function createHandleIfAllowed(path: string, directory: boolean, createIntermediate: boolean = true): Promise<FileSystemHandle> {
    const root = await getStorageRoot();
    const parts = path.split("/").filter(Boolean);

    const parentPath = parts.slice(0, -1).join("/");
    const perms = await getDirPermissions(parentPath);
    console.log(parentPath, perms);
    if (!perms ||
        (directory && !perms.AllowAddDir) ||
        (!directory && !perms.AllowAddFile)) 
    {
        throw new Error(HostExceptions.ForbiddenError);
    }

    let current: FileSystemDirectoryHandle | FileSystemFileHandle = root;
    for (let i = 0; i < parts.length; i++) {
        const isLast = i === parts.length - 1;
        const part = parts[i];

        if (!(current instanceof FileSystemDirectoryHandle)) {
            // Can"t traverse inside a file
            throw new DOMException("", HostExceptions.PathError);
        }

        if (isLast) {
            // Last segment: file or directory
            if (directory) {
                current = await current.getDirectoryHandle(part, { create: true });
            } else {
                current = await current.getFileHandle(part, { create: true });
            }
            setDirPermissions(path, getDefaultPermissions());
            return current;
        } else {
            // Intermediate directories
            current = await current.getDirectoryHandle(part, { create: createIntermediate });
        }
    }

    throw new Error();
}

export async function readHandleWithPermissions(handle: FileSystemHandle, path?: string): Promise<Item> {
    const item = {
        path: path ? path : "",
        name: handle.name,
        kind: handle.kind,
        size: await getSize(handle),
    } as Item;

    if (handle.kind === "directory") {
        item.contents = [];
        item.perms = await getPerms();

        for await (const [name, entry] of (handle as FileSystemDirectoryHandle).entries()) {
            const entryPath = (path ? (path + "/") : "") + entry.name;
            item.contents.push({
                path: entryPath,
                name,
                kind: entry.kind,
            });
        }
    }

    return item;

    async function getPerms() {
        let perms: DirPermissions | undefined = undefined;
        if (path)
            perms = await getDirPermissions(path);
        if (path && !perms) {
            perms = getDefaultPermissions();
            setDirPermissions(path, perms);
        }
        if (!perms)
            perms = getDefaultPermissions();
        
        return perms;
    }
}

export async function removeHandleIfAllowed(path: string) {
    const root = await getStorageRoot();
    const parts = path.split("/").filter(Boolean);

    const parentPath = parts.slice(0, -1).join("/");
    const perms = await getDirPermissions(parentPath);
    console.log(parentPath, perms);

    let current: FileSystemDirectoryHandle | FileSystemFileHandle = root;
    for (let i = 0; i < parts.length; i++) {
        const isLast = i === parts.length - 1;
        const part = parts[i];

        if (!(current instanceof FileSystemDirectoryHandle)) {
            // Can't traverse inside a file
            throw new DOMException("", HostExceptions.PathError);
        }

        if (isLast) {
            // Last segment: file or directory

            // Check delete permissions
            for await (const [key, handle] of current.entries()) {
                if (handle.name === parts[parts.length - 1]) {
                    if (!perms ||
                        (handle.kind === "directory" && !perms.AllowDeleteDir) ||
                        (handle.kind === "file" && !perms.AllowDeleteFile)) {
                        throw new Error(HostExceptions.ForbiddenError);
                    }
                    if (handle.kind === "directory")
                        delDirPermissions(path);
                    break;
                }
            }

            current.removeEntry(parts[parts.length - 1], { recursive: true });
        } else {
            // Intermediate directories
            current = await current.getDirectoryHandle(part);
        }
    }
}