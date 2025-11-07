import { 
    DrawerRoot,
    DrawerTrigger,
    DrawerContent,
    DrawerHeader,
    DrawerBody,
    DrawerFooter,
    DrawerBackdrop,
    DrawerCloseTrigger,
} from "~/components/ui/drawer";
import { Tooltip } from "~/components/ui/tooltip";
import { IconButton, Button, For, VStack, Text, Flex, Float, Circle } from "@chakra-ui/react";
import { FiMenu, FiBox, FiTrash } from "react-icons/fi";
import type { FileWithPath } from "react-dropzone";

export default function SelectedFilesList({ selectedFiles, setSelectedFiles }: 
    { selectedFiles: FileWithPath[]; setSelectedFiles: React.Dispatch<React.SetStateAction<FileWithPath[]>> }
) {
    const handleRemoveFile = (file: File) => {
        setSelectedFiles((prevFiles) => prevFiles.filter((f) => f !== file));
    };
    const handleRemoveAllFiles = () => {
        setSelectedFiles([]);
    };

    const floatSelectedFilesCount = () => {
        if (selectedFiles.length) {
            return (
                <Float>
                    <Circle size="5" bg="red" color="white">
                        {selectedFiles.length}
                    </Circle>
                </Float>
            );
        }
    }

    return (
        <DrawerRoot size="md">
            <DrawerTrigger asChild>
                <IconButton
                    aria-label="Open list of selected files"
                    position="fixed"
                    right="4"
                    bottom="4"
                    borderRadius="full"
                    boxShadow="lg"
                    colorScheme="blue"
                    zIndex={1000}
                >
                    <Tooltip content="Selected files">
                        <FiMenu />
                    </Tooltip>
                    {floatSelectedFilesCount()}
                </IconButton>
            </DrawerTrigger>

            <DrawerBackdrop />

            <DrawerContent portalled offset="0">
                <DrawerCloseTrigger />

                <DrawerHeader>Selected Files</DrawerHeader>

                <DrawerBody>
                    <For
                        each={selectedFiles}
                        fallback={
                            <VStack textAlign="center" fontWeight="medium">
                                <FiBox />
                                Nothing selected to share
                            </VStack>
                        }
                    >
                        {(item, index) => (
                            <Flex 
                                flexDirection="row"
                                justifyContent="space-between"
                            >
                                <Text fontWeight="bold">{item.path ? item.path : item.name}</Text>
                                <IconButton onClick={() => handleRemoveFile(item)}>
                                    <FiTrash />
                                </IconButton>
                            </Flex>
                        )}
                    </For>
                </DrawerBody>

                <DrawerFooter>
                    <Button 
                        variant="outline" 
                        onClick={handleRemoveAllFiles}
                    >
                        Clear all
                    </Button>
                </DrawerFooter>
            </DrawerContent>
        </DrawerRoot>
    );
}