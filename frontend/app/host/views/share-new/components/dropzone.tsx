import { useState, useRef, useEffect } from "react";
import { useDropzone, type FileWithPath } from 'react-dropzone';
import { Button, Box, VStack, HStack } from "@chakra-ui/react";

export default function Dropzone({ setSelectedFiles }: { setSelectedFiles: React.Dispatch<React.SetStateAction<FileWithPath[]>> }) {
    const [mode, setMode] = useState<"files" | "folder">("files");
    const pendingOpen = useRef<null | "files" | "folder">(null);

    const { getRootProps, getInputProps, open } = useDropzone({
        onDropAccepted: (files) => {
            setSelectedFiles(files);
        },
        multiple: true,
        useFsAccessApi: false,
        noClick: true,
        noKeyboard: true,
    });

    // Custom input props based on mode
    const inputProps = mode === "folder"
        ? { ...getInputProps(), webkitdirectory: "true" }
        : getInputProps();

    // Effect to handle pending open after mode change
    useEffect(() => {
        if (pendingOpen.current === mode) {
            open();
            pendingOpen.current = null;
        }
    }, [mode, open]);

    return (
        <VStack>
            <HStack>
                <Button
                    type="button"
                    onClick={() => {
                        if (mode === "files") {
                            open();
                        } else {
                            pendingOpen.current = "files";
                            setMode("files");
                        }
                    }}
                    style={{ marginRight: 8 }}
                >
                    Select Files
                </Button>
                <Button
                    type="button"
                    onClick={() => {
                        if (mode === "folder") {
                            open();
                        } else {
                            pendingOpen.current = "folder";
                            setMode("folder");
                        }
                    }}
                >
                    Select Folder
                </Button>
            </HStack>
            <Box
                borderColor="colorPalette.200"
                borderWidth="2px"
                rounded="sm"
            >
            <div {...getRootProps({
                style: {
                    padding: '20px',
                    textAlign: 'center',
                }
            })}>
                <input {...inputProps} />
                <p>Drag and drop files or folders here, or use the buttons above</p>
            </div>
            </Box>
        </VStack>
    );
}