import { useContext, useState } from "react";
import { useRevalidator } from "react-router";
import { Box, Button, VStack, Input, Center, Tabs, useFileUploadContext } from "@chakra-ui/react";
import { DialogRoot, DialogContent, DialogTrigger, DialogCloseTrigger } from "~/common/ui/chakra/components/dialog";
import { toaster, Toaster } from "~/common/ui/chakra/components/toaster";
import { FiFile, FiFolder, FiUpload } from "react-icons/fi";
import { FileUploadRoot, FileUploadList, FileUploadTrigger } from "~/common/ui/chakra/components/file-upload";

import { HostWebSocketClient } from "~/client/service/server-com/ws/implemenation";
import { createCacheKey, deleteFromCache } from "~/common/service/cache-service.js";
import type { Item } from "~/common/fs/types";
import { HostIdContext } from "~/common/ui/contexts/host-id-context";


function UploadFileButton({hostId, dirPath}: {hostId: string, dirPath: string}) {
    const revalidator = useRevalidator();
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const fileUpload = useFileUploadContext();

    const handleUpload = async (e: any) => {
        e.stopPropagation();
        setIsUploading(true);

        const file = fileUpload.acceptedFiles[0];
        const uploadPath = dirPath + "/" + file.name;
        const uploadPromise = HostWebSocketClient.uploadFile(hostId, uploadPath, file, {})
            .then(() => {
                const key = createCacheKey();
                deleteFromCache(key);
                fileUpload.clearFiles();
                revalidator.revalidate();
            })
            .finally(() => setIsUploading(false));
        
        toaster.promise(uploadPromise, {
            success: {
                title: "Successfully uploaded!",
                description: "Looks great",
            },
            error: {
                title: "Upload failed",
                description: "Something wrong with the upload",
            },
            loading: { title: "Uploading...", description: "Please wait" },
        });
    }

    return (
        <Button 
            onClick={handleUpload}
            disabled={isUploading}
            loading={isUploading}
        >
            Upload
        </Button>
    );
}

function CreateDirButton ({hostId, dirPath, dirname}: {hostId: string, dirPath: string, dirname: string}) {
    const revalidator = useRevalidator();

    const handleCreate = async (e: any) => {
        e.stopPropagation();

        const path = dirPath + "/" + dirname;

        const creationPromise = HostWebSocketClient.createDirectory(hostId, path)
            .then(() => {
                const key = createCacheKey();
                deleteFromCache(key);
                revalidator.revalidate();
            });
        
        toaster.promise(creationPromise, {
            success: {
                title: "Successfully created!",
                description: "Looks great",
            },
            error: {
                title: "Failed to add directory",
                description: "Something wrong",
            },
            loading: { title: "Creating...", description: "Please wait" },
        });
    }

    return (
        <Button onClick={handleCreate}>
            Create
        </Button>
    );
}

export default function DirAddForm({item}: {item: Item}) {
    const hostId = useContext(HostIdContext);
    const initialTab = item.perms?.AllowAddFile ? "file" : "dir";
    const [dirname, setDirname] = useState("");

    const addForm = () => (
        <Box p="6">
            <Center>
                <Tabs.Root defaultValue={initialTab}>
                    <Tabs.List>
                        <Tabs.Trigger value="file" onClick={e => e.stopPropagation()} disabled={!item.perms?.AllowAddFile}>
                            <FiFile />
                            Add file
                        </Tabs.Trigger>
                        <Tabs.Trigger value="dir" onClick={e => e.stopPropagation()} disabled={!item.perms?.AllowAddDir}>
                            <FiFolder />
                            Add directory
                        </Tabs.Trigger>
                    </Tabs.List>

                    <Tabs.Content value="file">
                        <Center>
                            <Center>
                                <FileUploadRoot maxFiles={1}>
                                    <VStack gap="4" w="max">
                                        <FileUploadTrigger onClick={e => e.stopPropagation()} asChild>
                                            <Button variant="outline">
                                                <FiUpload /> Upload file
                                            </Button>
                                        </FileUploadTrigger>

                                        <FileUploadList showSize clearable />
                                            
                                        <UploadFileButton hostId={hostId} dirPath={item.path} />
                                    </VStack>
                                </FileUploadRoot>
                            </Center>
                        </Center>
                    </Tabs.Content>

                    <Tabs.Content value="dir">
                        <VStack>
                            <Input
                                placeholder="Directory name..."
                                value={dirname}
                                onChange={(e) => setDirname(e.target.value)}
                                onClick={e => e.stopPropagation()}
                            />
                            <CreateDirButton hostId={hostId} dirPath={item.path} dirname={dirname}/>
                        </VStack>
                    </Tabs.Content>
                </Tabs.Root>
            </Center>
        </Box>
    )


    return (
        <VStack>
            <Toaster />
            <DialogRoot >
                <DialogTrigger asChild onClick={e => e.stopPropagation()}>
                    <Button variant="plain" size="sm">
                        Add
                    </Button>
                </DialogTrigger>

                <DialogContent>
                    <DialogCloseTrigger />

                    {addForm()}
                </DialogContent>
            </DialogRoot>
        </VStack>
    );
}