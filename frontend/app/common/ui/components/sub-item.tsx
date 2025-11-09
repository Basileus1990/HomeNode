import { useContext } from "react";
import { Link as RouterLink } from "react-router";
import { Link, Text, Flex, Icon, IconButton, HStack, Card, Clipboard } from "@chakra-ui/react";
import { FiFile, FiFolder, FiTrash, FiDownload } from "react-icons/fi"
import { Tooltip } from "~/common/ui/chakra/components/tooltip";

import type { SubItem } from "~/common/fs/types";
import type { DirPermissions } from "~/common/perm/permissions";
import { HostIdContext } from "~/common/ui/contexts/host-id-context";
import { getResourceShareURL, getSubItemURL } from "~/common/service/common-url-service";


export type SubItemComponentPrompts = {
    item: SubItem,
    perms?: DirPermissions,
    canDownload: boolean,
    handleDownload: (item: SubItem) => Promise<void>,
    handleDelete: (item: SubItem) => Promise<void>,
}

export default function SubItemComponent(prompts: SubItemComponentPrompts) {
    const { item, perms, canDownload, handleDownload, handleDelete } = prompts;
    const hostId = useContext(HostIdContext);
    const shareLink = getResourceShareURL(hostId, item.path);
    const iconProps = { rounded: "full" as const, size: "sm" as const };
    console.log(perms);

    const buildActions = (item: SubItem) => (
        <HStack>
            <ShareButton shareLink={shareLink} iconProps={iconProps} />
            {item.kind === "file" ? getFileActions(item) : getDirActions(item)}
        </HStack>
    )
    
    const getDirActions = (item: SubItem) => (
        <>
            {perms?.AllowDeleteDir ? 
                <DeleteButton 
                    item={item} 
                    onDelete={handleDelete} 
                    iconProps={iconProps} 
                /> : null}
        </>
    )

    const getFileActions = (item: SubItem) => (
        <>
            <DownloadButton 
                item={item} 
                onDownload={handleDownload}
                canDownload={canDownload}
                iconProps={iconProps}
            />
            {perms?.AllowDeleteFile ? 
                <DeleteButton 
                    item={item} 
                    onDelete={handleDelete} 
                    iconProps={iconProps} 
                /> : null}
        </>   
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
                        <RouterLink to={getSubItemURL(item.name)}>
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



type DownloadButtonProps = {
    item: SubItem;
    onDownload: (item: SubItem) => Promise<void>;
    canDownload: boolean;
    iconProps: { rounded: "full"; size: "sm"; };
}

function DownloadButton({ item, onDownload, canDownload, iconProps }: DownloadButtonProps) {
    return (
        <IconButton 
            variant="surface" 
            onClick={() => onDownload(item)}
            disabled={!canDownload}
            {...iconProps}
        >
            <Tooltip content="Download">
                <FiDownload />
            </Tooltip>
        </IconButton>
    );
}

type ShareButtonProps = {
    shareLink: string;
    iconProps: { rounded: "full"; size: "sm"; };
}


function ShareButton({ shareLink, iconProps }: ShareButtonProps) {
    return (
        <Clipboard.Root value={shareLink}>
            <Clipboard.Trigger asChild>
                <IconButton variant="surface" {...iconProps}>
                    <Clipboard.Indicator />
                </IconButton>
            </Clipboard.Trigger>
        </Clipboard.Root>
    );
}


type DeleteButtonProps = {
    item: SubItem;
    onDelete: (item: SubItem) => Promise<void>;
    iconProps: { rounded: "full"; size: "sm"; };
}

function DeleteButton({ item, onDelete, iconProps }: DeleteButtonProps) {
    return (
        <IconButton 
            variant="outline"
            color="colorPalette.warning"
            onClick={() => onDelete(item)} 
            {...iconProps}
        >
            <Tooltip content="Delete">
                <FiTrash />
            </Tooltip>
        </IconButton>
    );
}