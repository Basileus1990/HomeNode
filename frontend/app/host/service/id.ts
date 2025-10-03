const HOST_ID_KEY = "hostId";
const HOST_KEY_KEY = "hostKey";

export function getNewUUID() {
    return crypto.randomUUID();
}

export function saveHostId(hostId: string) {
    localStorage.setItem(HOST_ID_KEY, hostId);
}

export function getHostId(): string | null {
    return localStorage.getItem(HOST_ID_KEY);
}

export function saveHostKey(hostKey: string) {
    localStorage.setItem(HOST_KEY_KEY, hostKey);
}

export function getHostKey(): string | null {
    return localStorage.getItem(HOST_KEY_KEY);
}