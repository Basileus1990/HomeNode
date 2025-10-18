import log from "loglevel";

const metadataCache = new Map<string, any>();

export function setToCache(key: string, item: any) {
    log.debug(`Caching ${key}`);
    metadataCache.set(key, item);
}

export function deleteFromCache(key: string) {
    log.debug(`Deleting ${key} from cache`);
    metadataCache.delete(key);
}

export function checkKeyInCache(key: string) {
    return metadataCache.has(key);
}

export function getFromCache(key: string) {
    log.debug(`Retrieving ${key} from cache`);
    return metadataCache.get(key);
}

export function createCacheKey() {
    return window.location.pathname;
}