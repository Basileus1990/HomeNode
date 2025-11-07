import { Link as RouterLink, useNavigate } from "react-router";
import { useState } from "react";
import { FiPlus, FiArrowLeft, FiDownload } from "react-icons/fi";
import { Box, Text, Flex, IconButton, Stack, Separator, Wrap } from "@chakra-ui/react";
import { Tooltip } from "~/components/ui/tooltip";
import { toaster, Toaster } from "~/components/ui/toaster";

import type { Item } from "~/common/fs/types.js";
import SubItemsList from "./sub-items-list";
import { downloadFileLocally } from "~/host/service/file-service";
import Path from "./path";
import { DirPermissionsForm } from "./dir-perms";


export default function MainItem({item}: {item: Item}) {
    const navigate = useNavigate();
    const [isDownloading, setDownloadStatus] = useState<boolean>(false);

    function formatBytes(bytes: number, decimals = 2): string {
        if (bytes === 0) return "0 Bytes";

        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        const value = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));
        return `${value} ${sizes[i]}`;
    }

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

    const buildActionButton = () => {
        if (item.kind === "file") {
            return (
                 <IconButton 
                    onClick={() => handleDownload()}
                    disabled={isDownloading}
                >
                    <Tooltip content="Download">
                        <FiDownload />
                    </Tooltip>
                </IconButton>
            )
        } else {
            return (
                <IconButton>
                    <Tooltip content="Add something">
                        <RouterLink to={`/host/share/${item.path}`}>
                            <FiPlus />
                        </RouterLink>
                    </Tooltip>
                </IconButton>
            );
        }
    }

    const buildContents = () => {
        if (item.kind === "directory") {
            return (
                <>
                    <DirPermissionsForm item={item} />
                    <Separator />
                    <SubItemsList items={item.contents ?? []} />
                </>
            );
        }
    }

    return (
        <Stack>
            <Toaster />
            <Flex
                w="100%"
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
            >
                
                    <IconButton onClick={() => navigate(-1)}>
                        <Tooltip content="Go back">
                            <FiArrowLeft />
                        </Tooltip>
                    </IconButton>

                    {/* <Text fontWeight="bolder">{item.name}</Text> */}
                    <Path path={item.path} kind={item.kind} />

                    {buildActionButton()}
                
            </Flex>
            {buildContents()}
        </Stack>
    )
}