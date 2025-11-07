import { useContext, useState } from "react";
import { Link as RouterLink, useFetcher, useRevalidator } from "react-router";
import { FiBox, FiPlus } from "react-icons/fi";
import { toaster, Toaster } from "~/components/ui/toaster";
import { Box, Text, For, Flex, VStack, IconButton, Stack } from "@chakra-ui/react";

import type { Item, SubItem } from "~/common/fs/types.js";
import { HostIdContext } from "../../../../client/views/host-id-context";
import SubItemComponent from "./sub-item";
import { getAllAllowedPermissions } from "~/common/perm/permissions";
import { deleteResource, downloadFileLocally } from "~/host/service/file-service";
import { createCacheKey, deleteFromCache } from "~/client/service/cache-service";
import { getResourceShareURL } from "~/host/service/url-service";


export default function SubItemsList({items}: {items: SubItem[]}) {
    const hostId = useContext(HostIdContext);
    const [isDownloading, setDownloadStatus] = useState<boolean>(false);
    const revalidator = useRevalidator();
    const perms = getAllAllowedPermissions();

    const handleDelete = async (subitem: SubItem) => {
        const deletePromise = deleteResource(subitem.path)
            .then(() => {
                const key = createCacheKey();
                deleteFromCache(key);
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
        
        const downloadPromise = downloadFileLocally(subitem.name, subitem.path)
            .finally(() => setDownloadStatus(false));

        toaster.promise(downloadPromise, {
            success: {
                title: "Successfully downloaded!",
                description: "Looks great",
            },
            error: {
                title: "Dowdnload failed",
                description: "Something wrong with the download",
            },
            loading: { title: "Downloading...", description: "Please wait" },
        });
    }

    const handleShare = (subitem: SubItem) => {
        return getResourceShareURL(hostId, subitem.path); 
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
                        handleShare={handleShare}
                    />
                )}
            </For>
        </Stack>
    )
}