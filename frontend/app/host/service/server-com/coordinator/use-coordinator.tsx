import { useEffect, useRef } from "react";
import { useRevalidator } from "react-router";

import { saveHostId } from "../../id";

export default function useCoordinatorWorker() {
    const workerRef = useRef<Worker | null>(null);
    const revalidator = useRevalidator();

    // Worker will handle disconnect from socket
    // and cleanup on its own
    const disconnect = () => {
        if (workerRef.current) {
            console.log('worker disconneted');
            workerRef.current.postMessage({ type: "stop" });
            workerRef.current = null;
        }
    };

    useEffect(() => {
        // Initialize the worker only once on component mount
        workerRef.current = new Worker(new URL("./coordinator.worker.ts", import.meta.url), {
            type: "module",});

        workerRef.current.onmessage = (event) => {
            // coordinator received new host UUID assigned by the server
            if (event.data.type === "hostId") {
                saveHostId(event.data.hostId);
                revalidator.revalidate();   // refresh UI to display the UUID
            }
        };

        // Cleanup the worker when the component unmounts
        return () => {
            if (workerRef.current) {
                disconnect();
            }
        };
    }, []);

    return disconnect;
}