import { useState, useContext } from "react";
import { Link as RouterLink } from "react-router";
import { Flex, Stack, Button } from "@chakra-ui/react";
import { toaster, Toaster } from "~/common/ui/chakra/components/toaster";

import { getResourceShareURL } from "~/common/service/common-url-service";
import { getAllAllowedPermissions } from "~/common/perm/permissions";
import { deleteResource, downloadFileLocally } from "~/host/service/file-service";
import { type Item, type SubItem } from "~/common/fs/types.js";
import { HostIdContext } from "~/common/ui/contexts/host-id-context";
import SubItemsList from "~/common/ui/components/sub-items-list";
import GoBackButton from "~/common/ui/components/go-back";
import ItemMenu from "~/common/ui/components/item-menu";
import Path from "~/common/ui/components/path";
import DirPermissionsForm from "./dir-perms";


export default function MainItem({item}: {item: Item}) {
    const [isDownloading, setDownloadStatus] = useState<boolean>(false);
    const hostId = useContext(HostIdContext);
    const itemURL = getResourceShareURL(hostId, item.path);

    const handleDownload = async () => {
        setDownloadStatus(true);
        
        const downloadPromise = downloadFileLocally(item.name, item.path)
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

    const dirActions = [
        {
            value: "add-file-or-dir",
            children: 
                <Button variant="plain" size="sm" asChild>
                    <RouterLink to={`/host/share/${item.path}`}>
                        Add
                    </RouterLink>
                </Button>
        },
        {
            value: "manage-dir-permissions",
            children: <DirPermissionsForm item={item} />
        }
    ]

    const fileActions = [
        {
            value: "download",
            children: 
                <Button 
                    variant="plain" 
                    size="sm"
                    onClick={e => {
                        e.stopPropagation();
                        handleDownload();
                    }}
                    disabled={isDownloading}
                    loading={isDownloading}
                >
                    Download
                </Button>
        }
    ]

    return (
        <Stack>
            <Toaster />
            <Flex
                w="100%"
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
            >
                <GoBackButton />

                <Path path={item.path} kind={item.kind} />

                <ItemMenu 
                    shareLink={itemURL}
                    items={item.kind === "file" ? fileActions : dirActions}
                />
            </Flex>

            {item.kind === "directory" ? 
                <SubItemsList 
                    perms={getAllAllowedPermissions()}
                    items={item.contents ?? []} 
                    deleteItem={(item: SubItem) => deleteResource(item.path)}
                    downloadItem={(item: SubItem) => downloadFileLocally(item.name, item.path)}
                    useCache={false}
                /> : null
            }
        </Stack>
    )
}