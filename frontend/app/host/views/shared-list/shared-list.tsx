import type { Route } from ".react-router/types/app/host/views/shared-list/+types/shared-list";
import { useRevalidator } from "react-router";
import { Box, Text, Button, Stack } from "@chakra-ui/react";
import log from "loglevel";

import { findHandle, getStorageRoot, purgeStorage, readHandleWithPermissions } from "~/common/fs/api";
import { setDirPermissions } from "~/common/perm/permissions";
import MainItem from "./components/main-item";
import SubItemsList from "./components/sub-items-list";


export async function clientLoader({ params }: Route.LoaderArgs) {
    const { "*": resourcePath} = params;

    let handle: FileSystemHandle | null;
    if (resourcePath) {
        try {
            handle = await findHandle(resourcePath);
        } catch (e) {
            handle = null;
        }
    }
    else
        handle = await getStorageRoot();
    
    if (!handle) {
        log.debug(`No handle found for path: ${resourcePath}`)
        return null;
    }

    return readHandleWithPermissions(handle, resourcePath);
}

export async function clientAction({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const resourcePath = formData.get("itemPath") as string;

    const perms = {
        AllowAddDir: formData.get("allowAddDir") === "on",
        AllowAddFile: formData.get("allowAddFile") === "on",
        AllowDeleteDir: formData.get("allowDeleteDir") === "on",
        AllowDeleteFile: formData.get("allowDeleteFile") === "on",
    };

    await setDirPermissions(resourcePath, perms);
    return { ok: true, message: "Permissions updated successfully!" };
}

export default function SharedFilesList({loaderData}: Route.ComponentProps) {
    const item = loaderData;
    const revalidator = useRevalidator();

    const handleClear = async () => {
        await purgeStorage();
        revalidator.revalidate();
    };

    const buildContents = () => {
        if (!item) {
            throw new Error("Resource not found");
        } else if (!item.path || item.path === "/") {
            return (
                <>
                    <Text 
                        textStyle="xl" 
                        fontWeight="bold" 
                        textAlign="center"
                        color="teal"
                    >
                        Here are your shared files!
                    </Text>
                    <Button onClick={handleClear}>Clear all shared</Button>
                    <SubItemsList items={item.contents ?? []} />
                </>
            )   
        } else {
            return <MainItem item={item} />
        }
    }
    
    return (
        <Stack w={{ base: "sm", md: "lg", lg: "50vw" }}>
            {buildContents()}
        </Stack>
    );
}