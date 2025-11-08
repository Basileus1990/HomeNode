import { useState } from "react";
import { useNavigate } from "react-router";
import { Stack, Text, Button, Alert, Center } from "@chakra-ui/react";
import type { FileWithPath } from "react-dropzone";

import Dropzone from "./dropzone";
import SelectedFilesList from "./selected-files-list";
import useUploaderWorker from "~/host/upload/useUploaderWorker";

export default function Uploader({ root }: { root?: FileSystemDirectoryHandle }) {
    const [selectedFiles, setSelectedFiles] = useState<FileWithPath[]>([]);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const { uploadFiles, isUploading } = useUploaderWorker({ onUpload: async () => {
        navigate("/host/shared");
    }, onError: (error: string) => {
        setError(error);
    } });

    const handleUpload = async () => {
        uploadFiles(selectedFiles, root);
    }

    const alertOnError = () => {
        if (error) {
            return (
                <Alert.Root status="error">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>Upload failed</Alert.Title>
                        <Alert.Description>
                            {error}
                        </Alert.Description>
                    </Alert.Content>
                </Alert.Root>
            )
        }
    }

    return (
        <Center>
            <Stack>
                <Text 
                    textStyle="xl" 
                    fontWeight="bold" 
                    textAlign="center"
                >
                    Share something with the world!
                </Text>
                
                <Dropzone setSelectedFiles={setSelectedFiles} />
                <SelectedFilesList selectedFiles={selectedFiles} setSelectedFiles={setSelectedFiles} />

                {alertOnError()}
                
                <Button
                    size="lg"
                    disabled={selectedFiles.length === 0}
                    loading={isUploading}
                    loadingText="Uploading..."
                    onClick={handleUpload}
                >
                    Upload
                </Button>
            </Stack>
        </Center>
    );
}