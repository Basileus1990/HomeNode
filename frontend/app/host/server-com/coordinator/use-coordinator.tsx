import { useEffect, useRef } from "react";
import { useRevalidator } from "react-router";
import log from "loglevel";

import { saveHostId } from "../../service/id";
import type { CoorindatorToUI } from "../types";
import type { HomeNodeFrontendConfig } from "~/config";

export default function useCoordinatorWorker(config: HomeNodeFrontendConfig) {
    const workerRef = useRef<Worker | null>(null);
    const revalidator = useRevalidator();

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
        workerRef.current = new Worker(new URL("./coordinator.worker.ts", import.meta.url), {
            type: "module",});

        workerRef.current.onmessage = (event: MessageEvent<CoorindatorToUI>) => {

            switch (event.data.type) {
                case ("hostId"):
                    log.log("Host received new ID from server")
                    saveHostId(event.data.hostId);
                    revalidator.revalidate();   // refresh UI to display the UUID
                    break;
            }
        };

        workerRef.current.postMessage({
            type: "start",
            config
        })

        // Cleanup the worker when the component unmounts
        return () => {
            if (workerRef.current) {
                disconnect();
            }
        };
    }, []);

    return disconnect;
}