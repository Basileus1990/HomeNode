export interface Metadata {
    [key: string]: any;
}

export interface Item {
    path: string;
    name: string;
    kind: "directory" | "file";
    size: number;
}