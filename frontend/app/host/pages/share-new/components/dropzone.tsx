import { useDropzone, type FileWithPath } from 'react-dropzone';

export default function Dropzone({ setSelectedFiles }: { setSelectedFiles: React.Dispatch<React.SetStateAction<FileWithPath[]>> }) {
    const { getRootProps, getInputProps } = useDropzone({
        onDropAccepted: (files) => {
            console.log('Accepted files:', files);
            setSelectedFiles(files);
        },
        onDropRejected: (fileRejections, event) => {
            console.log('File Rejections:', fileRejections);
            console.log('Event:', event);
        },
        multiple: true,
        useFsAccessApi: true, 
    });

    return (
        <section className="container">
            <div {...getRootProps({ style: {
                border: '2px dashed #0070f3',
                borderRadius: '5px',
                padding: '20px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: '#f0f0f0',
                color: '#333',
                fontSize: '16px',
                transition: 'background-color 0.3s ease',
            } })}>
                <input {...getInputProps({
                    webkitdirectory: "true", // Allow directory selection
                    //directory: "true", // Allow directory selection
                    //multiple: true, // Allow multiple files
                })} />
                <p>Drag and drop some files here, or click to select files</p>
            </div>
        </section>
    );
}