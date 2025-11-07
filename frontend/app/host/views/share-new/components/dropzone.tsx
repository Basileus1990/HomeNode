import { useState, useRef, useEffect } from "react";
import { useDropzone, type FileWithPath } from 'react-dropzone';
import { Button } from "@chakra-ui/react";

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
        <section className="container">
            <div style={{ marginBottom: 8 }}>
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
            </div>
            <div {...getRootProps({
                style: {
                    border: '2px dashed #0070f3',
                    borderRadius: '5px',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: '#f0f0f0',
                    color: '#333',
                    fontSize: '16px',
                    transition: 'background-color 0.3s ease',
                }
            })}>
                <input {...inputProps} />
                <p>Drag and drop files or folders here, or use the buttons above</p>
            </div>
        </section>
    );
}