export type StreamWorkerEntry = { worker: Worker; lastActive: number; };

export class StreamWorkerRegistry {
    private _workers = new Map<number, StreamWorkerEntry>();

    public set(downloadId: number, entry: StreamWorkerEntry) {
        this._workers.set(downloadId, entry);
    }

    public get(downloadId: number): StreamWorkerEntry | undefined {
        return this._workers.get(downloadId);
    }

    public delete(downloadId: number) {
        this._workers.delete(downloadId);
    }

    public entries() {
        return this._workers.entries();
    }
}
