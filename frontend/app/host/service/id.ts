const HOST_ID_KEY = "hostId";

export function getNewUUID() {
    return crypto.randomUUID();
}

export function saveHostId(hostId: string) {
    console.log(hostId);
    localStorage.setItem(HOST_ID_KEY, hostId);
}

export function getHostId(): string | null {
    return localStorage.getItem(HOST_ID_KEY);
}