import { useRevalidator } from "react-router";
import log from "loglevel";

import { removeHandle } from "~/common/fs/opfs";


export default function DeleteButton({path}: {path: string}) {
    const revalidator = useRevalidator();
    const handleDelete = async () => {
        try {
            await removeHandle(path);
            log.debug(`Successfully removed resource: ${path}`);
            revalidator.revalidate();
        } catch (ex) {
            log.warn(`Could not resource: ${path} due to ${ex}`);
        }
    }

    return (
        <button onClick={handleDelete}>Delete</button>
    )
}