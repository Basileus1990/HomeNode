import log from "loglevel";

import { createFileTree, mapPathsBackToFiles, rebuildFileTree } from "./prepare-files";
import type { UIToUploaderMessages } from "./types";
import { getStorageRoot } from "../../common/fs/api";


self.onmessage = async (event: MessageEvent<UIToUploaderMessages>) => {
    const { type, files, encryption } = event.data;

    if (type === "start") {
        const filesWithPaths = mapPathsBackToFiles(files);
        const tree = await rebuildFileTree(filesWithPaths, encryption);

        try {
            let root = event.data.root;
            const opfsRoot = await getStorageRoot();
            if (!root || (await opfsRoot.isSameEntry(root))) {
                root = await opfsRoot.getDirectoryHandle(tree.name, { create: true });
            }

            await createFileTree(tree, root);
            log.debug("Saved record tree:", tree);
            self.postMessage({ type: "complete" , msg: "All files uploaded successfully" });
        } catch (error) {
            log.warn("Error creating records:", error);
            self.postMessage({ type: "fail", msg: error });
        }
    }
}