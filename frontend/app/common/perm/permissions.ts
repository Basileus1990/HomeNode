import { get, set, del } from 'idb-keyval';

export interface DirPermissions {
    AllowAddDir: boolean,
    AllowAddFile: boolean,
    AllowDeleteDir: boolean,
    AllowDeleteFile: boolean
}

export function getDefaultPermissions(): DirPermissions {
    return {
        AllowAddDir: false,
        AllowAddFile: false,
        AllowDeleteDir: false,
        AllowDeleteFile: false
    };
}

export async function getDirPermissions(path: string): Promise<DirPermissions | undefined> {
    return get(path);
}

export async function setDirPermissions(path: string, perms: DirPermissions) {
    return set(path, perms);
}

export async function delDirPermissions(path: string) {
    return del(path);
}