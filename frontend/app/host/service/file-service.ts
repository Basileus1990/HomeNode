import { removeHandle, downloadFileHandle, findHandle } from "~/common/fs/opfs";

export async function deleteResource(
    path: string, 
    onDelete?: () => Promise<void>, 
    onError?: (e: any) => Promise<void>,
    onFinally?: () => Promise<void>
) {
    return removeHandle(path)
        .then(() => onDelete && onDelete())
        .catch((e) => onError && onError(e))
        .finally(() => onFinally && onFinally());
}

export async function downloadFileLocally(
    filename: string, 
    path: string,
    onDownload?: () => Promise<void>, 
    onProgress?: (transferred: number, total?: number) => void,
    onError?: (e: any) => Promise<void>,
    onFinally?: () => Promise<void>
) {
    try {
        const handle = await findHandle(path);
        await downloadFileHandle(
            handle as FileSystemFileHandle, 
            filename,
            onProgress
        );
        if (onDownload)
            onDownload();
    } catch (e) {
        if (onError)
            onError(e);
    } finally {
        if (onFinally) 
            onFinally();
    }
}