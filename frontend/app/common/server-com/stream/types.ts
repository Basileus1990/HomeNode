export type TransferProgressCallbacks = {
    onStart?: (totalSteps?: number) => void;
    onProgress?: (step?: number) => void;
    onEof?: () => void;
    onError?: () => void;
};