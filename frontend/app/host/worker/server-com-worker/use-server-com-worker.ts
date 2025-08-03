import { useEffect, useRef } from "react";

export default function useServerCommunicatorWorker() {
    const workerRef = useRef<Worker | null>(null);

    // Worker will handle disconnect from socket
    // and cleanup on its own
    const disconnect = () => {
        if (workerRef.current) {
            workerRef.current.postMessage({ type: "stop" });
            workerRef.current = null;
        }
    };

    useEffect(() => {
        // Initialize the worker only once on component mount
        workerRef.current = new Worker(new URL("./app-com-worker.ts", import.meta.url), {
            type: "module",});

        workerRef.current.onmessage = (event) => {
            const { type, payload } = event.data;
            if (type === "socketData") {
                console.log("Data received from worker:", payload);
                // Handle socket data if needed
            }
        };

        workerRef.current.postMessage({ type: "start" });

        // Cleanup the worker when the component unmounts
        return () => {
            if (workerRef.current) {
                disconnect();
            }
        };
    }, []);

    return disconnect;
}