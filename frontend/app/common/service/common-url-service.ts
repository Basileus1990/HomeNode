export function getResourceShareURL(hostId: string, resourceId: string) {
    return `${window.location.origin}/client/${hostId}/${resourceId}`;
}

export function getSubItemURL(name: string) {
    return `${window.location.href}/${name}`;
}