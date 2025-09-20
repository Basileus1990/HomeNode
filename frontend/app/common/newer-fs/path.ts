/**
 * Records the path from root to given handle
 */
export async function getPath(target: FileSystemHandle) {
    const root = await navigator.storage.getDirectory();
    
    const recursiveBuildPath = async (dir: FileSystemDirectoryHandle): Promise<string | undefined> => {
        for await (const [, handle] of dir.entries()) {
            const isTarget = await target.isSameEntry(handle);
            if (isTarget)
                return handle.name;
            if (handle.kind === "directory") {
                const child = await recursiveBuildPath(handle as FileSystemDirectoryHandle);
                if (child)
                    return handle.name + "/" + child
                else
                    return child;
            }
        }
        return undefined;
    }

    return await recursiveBuildPath(root);
}

export function splitPath(path: string) {
    return path.split("/");
}

export function getParentPath(path: string) {
    const parts = path.split("/").filter(Boolean);
    if (parts.length <= 1) 
        return "/";
    parts.pop();
    return parts.join("/") + "/";
}

export function getLeaf(path: string) {
    return path.split("/").at(-1);
}

export function isDirectoryPath(path: string) {
    const parts = path.split("/");
    return !parts.at(-1)?.includes(".")
}