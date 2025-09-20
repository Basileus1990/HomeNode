import type { FileWithPath } from "react-dropzone";

import { prepareFilesForUpload, type TreeNode } from "./prepare-files";
import type { FileUploaderWorkerFilePayload } from "./types";


self.onmessage = async (event) => {
    const { type, payload, msg, encryption } = event.data;

    if (type === "upload") {
        const files = rebuildPayload(payload);
        const tree = await prepareFilesForUpload(files, encryption);
        const root = await navigator.storage.getDirectory();
        try {
            const treeRoot = await root.getDirectoryHandle(tree.name, { create: true });
            await createRecordsFromTree(tree, treeRoot);
            console.log("Saved record tree:", tree);
            self.postMessage({ type: "uploadComplete" });
        } catch (error) {
            console.error("Error creating records:", error);
            self.postMessage({ type: "uploadError", error: error });
        }
    }
}

function rebuildPayload(payload: FileUploaderWorkerFilePayload[]): FileWithPath[] {
    return payload.map(item => {
        return Object.assign(item.file, { path: item.path, relativePath: item.relativePath }) as FileWithPath;
    });
}

async function createRecordsFromTree(tree: TreeNode, dir: FileSystemDirectoryHandle): Promise<void> {
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
            await createRecordsFromTree(child, dirHandle);
        }
    }
}