import { Link as RouterLink } from "react-router";
import { Link, Text, Flex, Icon, IconButton, Box, HStack, Card, Clipboard } from "@chakra-ui/react";
import { FiFile, FiFolder, FiTrash, FiDownload, FiShare } from "react-icons/fi"
import { Tooltip } from "~/components/ui/tooltip";

import type { SubItem } from "~/common/fs/types";
import type { DirPermissions } from "~/common/perm/permissions";


export type SubItemComponentPrompts = {
    item: SubItem,
    perms?: DirPermissions,
    canDownload: boolean,
    handleDownload: (item: SubItem) => Promise<void>,
    handleDelete: (item: SubItem) => Promise<void>,
    handleShare?: (item: SubItem) => string
}

export default function SubItemComponent(prompts: SubItemComponentPrompts) {
    const { item, perms, canDownload, handleDownload, handleDelete, handleShare } = prompts;
    const shareLink = handleShare ? handleShare(item) : "";
    const iconProps = { rounded: "full", size: "sm" as const };

    const buildActions = (item: SubItem) => (
        <HStack>
            {handleShare ? shareButton() : ""}
            {item.kind === "file" ? getFileActions(item) : getDirActions(item)}
        </HStack>
    )
    
    const getDirActions = (item: SubItem) => (
        <>
            {perms?.AllowDeleteDir ? deleteButton(item) : ""}
        </>
    )

    const getFileActions = (item: SubItem) => (
        <>
            {downloadButton(item)}
            {perms?.AllowDeleteFile ? deleteButton(item) : ""}
        </>   
    )

    const deleteButton = (item: SubItem) => (
        <IconButton onClick={() => handleDelete(item)} {...iconProps} >
            <Tooltip content="Delete">
                <FiTrash />
            </Tooltip>
        </IconButton>
    )

    const shareButton = () => (
        <Clipboard.Root value={shareLink}>
            <Clipboard.Trigger asChild>
                <IconButton variant="surface" {...iconProps}>
                    <Clipboard.Indicator />
                </IconButton>
            </Clipboard.Trigger>
        </Clipboard.Root>
    )

    const downloadButton = (item: SubItem) => (
        <IconButton 
            onClick={() => handleDownload(item)}
            disabled={!canDownload}
            {...iconProps}
        >
            <Tooltip content="Download">
                <FiDownload />
            </Tooltip>
        </IconButton>
    )

    return (
        <Card.Root flexDirection="row" overflow="hidden">
            <Card.Body>
                <Flex
                    key={item.path}
                    flexDirection="row"
                    justifyContent="space-between"
                    alignItems="center"
                >
                <HStack>
                    <Icon size="md">
                        {item.kind === "file" ? <FiFile /> : <FiFolder />}
                    </Icon>

                    <Link asChild>
                        <RouterLink to={`/host/shared/${item.path}`}>
                            <Text fontWeight="bold">
                                {item.name}
                            </Text>
                        </RouterLink>
                    </Link>
                </HStack>

                {buildActions(item)}
                </Flex>
            </Card.Body>
        </Card.Root>
    )
}