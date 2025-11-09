import { useState } from "react";
import { useRevalidator } from "react-router";
import { For, VStack, Stack } from "@chakra-ui/react";
import { toaster, Toaster } from "~/common/ui/chakra/components/toaster";
import { FiBox } from "react-icons/fi";

import { createCacheKey, deleteFromCache } from "~/common/service/cache-service";
import { type DirPermissions } from "~/common/perm/permissions";
import { type SubItem } from "~/common/fs/types.js";
import SubItemComponent from "~/common/ui/components/sub-item";


export type SubItemsListProps = {
    perms?: DirPermissions,
    items: SubItem[],
    deleteItem: (item: SubItem) => Promise<unknown>
    downloadItem: (item: SubItem) => Promise<unknown>
    useCache?: boolean
}

export default function SubItemsList(props : SubItemsListProps) {
    const { perms, items, deleteItem, downloadItem, useCache } = props;
    const [isDownloading, setDownloadStatus] = useState<boolean>(false);
    const revalidator = useRevalidator();

    const handleDelete = async (subitem: SubItem) => {
        const deletePromise = deleteItem(subitem)
            .then(() => {
                if (useCache) {
                    const key = createCacheKey();
                    deleteFromCache(key);
                }
                revalidator.revalidate();
            });

        toaster.promise(deletePromise, {
            success: {
                title: "Successfully deleted!",
            },
            error: {
                title: "Delete failed",
            },
            loading: { title: "Deleting...", description: "Please wait" },
        });
    };

    const handleDownload = async (subitem: SubItem) => {
        setDownloadStatus(true);
        
        const downloadPromise = downloadItem(subitem)
            .finally(() => setDownloadStatus(false));

        toaster.promise(downloadPromise, {
            success: {
                title: "Successfully downloaded!",
                description: "Looks great",
            },
            error: {
                title: "Download failed",
                description: "Something wrong with the download",
            },
            loading: { title: "Downloading...", description: "Please wait" },
        });
    }

    return (
        <Stack>
            <Toaster />
            <For
                each={items}
                fallback={
                    <VStack textAlign="center" fontWeight="medium">
                        <FiBox />
                        Directory is empty
                    </VStack>
                }
            >
                {(item, index) => (
                    <SubItemComponent
                        key={index}
                        item={item}
                        perms={perms}
                        canDownload={!isDownloading}
                        handleDownload={handleDownload}
                        handleDelete={handleDelete}
                    />
                )}
            </For>
        </Stack>
    )
}