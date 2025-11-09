import { useContext, useState } from "react";
import { Flex, Stack, Button } from "@chakra-ui/react";
import { toaster, Toaster } from "~/common/ui/chakra/components/toaster";

import { getResourceShareURL } from "~/common/service/common-url-service";
import { HostWebSocketClient } from "~/client/service/server-com/ws/implemenation.js";
import { type Item, type SubItem } from "~/common/fs/types.js";
import { HostIdContext } from "~/common/ui/contexts/host-id-context";
import SubItemsList from "~/common/ui/components/sub-items-list";
import GoBackButton from "~/common/ui/components/go-back";
import ItemMenu from "~/common/ui/components/item-menu";
import Path from "~/common/ui/components/path";
import DirAddForm from "./dir-add-form";


export default function MainItem({item}: {item: Item}) {
    const hostId = useContext(HostIdContext);
    const [isDownloading, setDownloadStatus] = useState<boolean>(false);
    const itemURL = getResourceShareURL(hostId, item.path);

    const handleDownload = async () => {
        setDownloadStatus(true);
        
        const downloadPromise = HostWebSocketClient.downloadRecord(hostId, item.name, item.path, {})
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

    const getDirActions = () => {
        if (!item.perms || (!item.perms.AllowAddDir && !item.perms.AllowAddFile)) {
            return [];
        } else {
            return [
                {
                    value: "add-file-or-dir",
                    children: <DirAddForm item={item} />
                }
            ]
        }
    }

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
                    items={item.kind === "file" ? fileActions : getDirActions()}
                />
            </Flex>
            
            {item.kind === "directory" ? 
                <SubItemsList
                    perms={item.perms}
                    items={item.contents ?? []}
                    deleteItem={(item: SubItem) => HostWebSocketClient.deleteResource(hostId, item.path)}
                    downloadItem={(item: SubItem) => HostWebSocketClient.downloadRecord(hostId, item.name, item.path, {})}
                    useCache={true}
                /> : null
            }
        </Stack>
    )
}