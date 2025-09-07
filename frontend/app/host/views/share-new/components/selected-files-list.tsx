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

    return (
        <div>
            <h4>Selected Files</h4>
            <button onClick={handleRemoveAllFiles}>Clear</button>
            <ul>
                {selectedFiles.map((file) => (
                    <li key={file.name}>
                        {file.name} :: {file.size}b :: {file.path}
                        <button onClick={() => handleRemoveFile(file)}>X</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}