import type { FileWithPath } from "react-dropzone";

import { getNewUUID } from "../service/id";
import type { EncryptionData } from "../../common/crypto";
import type { FileUploaderWorkerFilePayload } from "./types";


interface TreeNode {
    name: string;
    // metadata: RecordMetadata;
    children?: TreeNode[];
    file?: FileWithPath;
    kind: "directory" | "file";
}

export async function rebuildFileTree(files: FileWithPath[], encryption?: EncryptionData): Promise<TreeNode> {
    const dateNow = Date.now();
    const uploadId = getNewUUID();
    const root: TreeNode = { 
        name: uploadId, 
        children: [], 
        kind: "directory"
    };

    for (const file of files) {
        // Use relativePath or path, fallback to file.name
        let relPath = file.relativePath || file.path || file.name;
        const parts = relPath ? relPath.split("/") : [file.name];

        let current = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            if (part === "." || part === "")
                continue;

            if (isFile) {
                // Add file node
                current.children!.push({
                    name: file.name,
                    file: file,
                    kind: "file"
                });
            } else {
                // Find or create directory node
                let dir = current.children!.find(
                    (child) => child.kind === "directory" && child.name === part
                );
                if (!dir) {
                    dir = {
                        name: part,
                        children: [],
                        kind: "directory"
                    };
                    current.children!.push(dir);
                }
                current = dir;
            }
        }
    }

    return root;
}

export function mapPathsBackToFiles(payload: FileUploaderWorkerFilePayload[]): FileWithPath[] {
    return payload.map(item => {
        return Object.assign(item.file, { path: item.path, relativePath: item.relativePath }) as FileWithPath;
    });
}

export async function createFileTree(tree: TreeNode, dir: FileSystemDirectoryHandle): Promise<void> {
    for (const child of tree.children!) {
        if (child.kind === "file") {
            const fileHandle = await dir.getFileHandle(child.name, { create: true });
            const accessHandle = await fileHandle.createSyncAccessHandle(); // Using FileSystemSyncAccessHandle to write file for compatility with Safari
            const arrayBuffer = await child.file!.arrayBuffer();
            accessHandle.write(arrayBuffer);
            accessHandle.flush();
            accessHandle.close();
        } else if (child.kind === "directory") {
            const dirHandle = await dir.getDirectoryHandle(child.name, { create: true });
            await createFileTree(child, dirHandle);
        }
    }
}
