import { useState } from "react";
import type { FileWithPath } from "react-dropzone";

import Dropzone from "./components/dropzone";
import SelectedFilesList from "./components/selected-files-list";
import ShareButton from "./components/share-button";

export default function Share() {
    const [selectedFiles, setSelectedFiles] = useState<FileWithPath[]>([]);
    const [error, setError] = useState<string | null>(null);

    return (
        <article>
            <h1>Share a file</h1>
            <Dropzone setSelectedFiles={setSelectedFiles} />
            <SelectedFilesList selectedFiles={selectedFiles} setSelectedFiles={setSelectedFiles} />
            {error && <p style={{ color: "red" }}>{error}</p>}
            <ShareButton selectedFiles={selectedFiles} setError={setError} />
        </article>
    );
}