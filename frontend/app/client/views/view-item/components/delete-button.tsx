import { useRevalidator } from "react-router";

import { HostWebSocketClient } from "~/client/service/server-com/ws/implemenation.js"
import { createCacheKey, deleteFromCache } from "~/client/service/cache-service";


export default function DeleteButton(
    {hostId, name, path}: 
    {hostId: string, name: string, path: string}) {

    const revalidator = useRevalidator();
    const handleDelete = async () => {
        HostWebSocketClient.deleteResource(hostId, path)
            .then(() => {
                window.alert(`Resource ${name} deleted`);
                const key = createCacheKey();
                deleteFromCache(key);
                revalidator.revalidate()
            })
            .catch((e) => window.alert(e))
    }

    return (
        <button onClick={handleDelete}>Delete</button>
    )
}