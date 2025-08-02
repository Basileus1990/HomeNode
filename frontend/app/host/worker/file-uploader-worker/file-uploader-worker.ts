import type { FileWithPath } from "react-dropzone";

import { FSService } from "../../service/fs-service";
import { prepareFilesForUpload, type RecordTreeNode } from "~/host/service/prepare-files";
import { RecordKind } from "~/host/fs/types";
import type { DirectoryRecordHandle } from "~/host/fs/records-filesystem";
import type { FileUploaderWorkerFilePayload } from "./file-uploader-worker-types";


self.onmessage = async (event) => {
    const { type, payload, msg } = event.data;

    if (type === "upload") {
        const files = rebuildPayload(payload);
        console.log("Received files for upload:", files);
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
        return {
            ...(item.file),
            relativePath: item.relativePath,
            path: item.path
        }}
    );
}

async function createRecordsFromTree(tree: RecordTreeNode, dir: DirectoryRecordHandle): Promise<void> {
    for (const child of tree.children!) {
        if (child.metadata.kind === RecordKind.file) {
            //await dir.createFileRecord(child.recordName, child.file!, child.metadata);
            const dir2 = await FSService.createDirectoryRecord(child.recordName, dir.getUnderlayingHandle(), child.metadata);
        } else if (child.metadata.kind === RecordKind.directory) {
            const newDir = await dir.createDirectoryRecord(child.recordName, child.metadata);
            await createRecordsFromTree(child, newDir);
        }
    }
}