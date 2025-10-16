export type WorkerEntry = { worker: Worker; lastActive: number; };

export class WorkerRegistry {
    private _workers = new Map<number, WorkerEntry>();

    public set(streamId: number, entry: WorkerEntry) {
        this._workers.set(streamId, entry);
    }

    public get(streamId: number): WorkerEntry | undefined {
        return this._workers.get(streamId);
    }

    public delete(streamId: number) {
        this._workers.delete(streamId);
    }

    public entries() {
        return this._workers.entries();
    }
}
