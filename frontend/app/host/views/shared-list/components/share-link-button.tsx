import { getResourceShareURL } from "~/host/service/url-service";

export default function ShareLinkButton({hostId, path}: {hostId: string, path: string}) {
    const handleClick = async () => {
        const link = getResourceShareURL(hostId, path); 
        await navigator.clipboard.writeText(link);
    }
    
    return (
        <button onClick={handleClick}>
            Share
        </button>
    );
}