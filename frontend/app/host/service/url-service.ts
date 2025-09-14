export function getResourceShareURL(hostId: string, resourceId: string) {
    return `${window.location.origin}/client/${hostId}/${resourceId}`;
}