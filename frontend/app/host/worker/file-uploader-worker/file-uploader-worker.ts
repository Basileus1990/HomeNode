import type { FileWithPath } from "react-dropzone";

import { FSService } from "../../service/fs-service";
import { prepareFilesForUpload, type RecordTreeNode } from "~/host/service/prepare-files";
import { RecordKind } from "~/common/fs/types";
import type { DirectoryRecordHandle } from "~/common/fs/records-filesystem";
import type { FileUploaderWorkerFilePayload } from "./file-uploader-worker-types";


self.onmessage = async (event) => {
    const { type, payload, msg } = event.data;

    if (type === "upload") {
        const files = rebuildPayload(payload);
        const tree = await prepareFilesForUpload(files);
        const rootRecord = await FSService.getRootRecord();
        try {
            await createRecordsFromTree(tree, rootRecord as DirectoryRecordHandle);
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

async function createRecordsFromTree(tree: RecordTreeNode, dir: DirectoryRecordHandle): Promise<void> {
    for (const child of tree.children!) {
        if (child.metadata.kind === RecordKind.file) {
            await dir.createFileRecord(child.recordName, child.file!, child.metadata, true);    // Using FileSystemSyncAccessHandle to write file for compatility with Safari
        } else if (child.metadata.kind === RecordKind.directory) {
            const newDir = await dir.createDirectoryRecord(child.recordName, child.metadata);
            await createRecordsFromTree(child, newDir);
        }
    }
}