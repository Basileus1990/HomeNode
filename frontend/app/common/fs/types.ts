import type { DirPermissions } from "../perm/permissions";

export interface Metadata {
    [key: string]: any;
}

export interface Item {
    path: string;
    name: string;
    kind: "directory" | "file";
    size: number;
    perms?: DirPermissions
}