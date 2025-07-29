import type { FileWithPath } from "react-dropzone";

import { getRecordId } from "./server-communication";
import { RecordKind, type RecordMetadata } from "~/common/fs/types";

export async function prepareFilesForUpload(files: FileWithPath[]) {
    const tree = rebuildTree(files);
    // place for any additional preparation logic if needed
    return tree;
}

export interface RecordTreeNode {
    recordName: string;
    metadata: RecordMetadata;
    children?: RecordTreeNode[];
    file?: FileWithPath;
}

export async function rebuildTree(files: FileWithPath[]): Promise<RecordTreeNode> {
    const dateNow = Date.now();
    const root: RecordTreeNode = { 
        recordName: "root", 
        children: [], 
        metadata: {
            contentName: "root",
            dateShared: dateNow,
            kind: RecordKind.directory,
        }};

    for (const file of files) {
        // Use relativePath or path, fallback to file.name
        let relPath = file.relativePath || file.path || file.name;
        const parts = relPath ? relPath.split("/") : [file.name];

        let current = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;

            if (isFile) {
                // Add file node
                current.children!.push({
                    recordName: await getRecordId(),
                    metadata: {
                        contentName: part,
                        dateShared: dateNow,
                        kind: RecordKind.file,
                    },
                    file: file,
                });
            } else {
                // Find or create directory node
                let dir = current.children!.find(
                    (child) => child.metadata.kind === "directory" && child.metadata.contentName === part
                );
                if (!dir) {
                    dir = {
                        recordName: await getRecordId(),
                        metadata: {
                            contentName: part,
                            dateShared: dateNow,
                            kind: RecordKind.directory,
                        },
                        children: [],
                    };
                    current.children!.push(dir);
                }
                current = dir;
            }
        }
    }

    return root;
}