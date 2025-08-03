import { OPFS } from "../../fs/opfs";

let socket: WebSocket | null = null;
let counter = 0;


self.onmessage = (event) => {
    const { type, payload } = event.data;

    if (type === "start") {
        console.log("Worker started");
        socket = new WebSocket("wss://echo.websocket.org/");

        if (!socket) {
            console.error("Failed to create WebSocket");
            return;
        }

        // Connection opened
        socket.addEventListener("open", (event) => {
            socket?.send("Hello Server!");
        });

        // Listen for messages
        socket.addEventListener("message", (event) => {
            console.log("Message from app ", event.data);
        });

        setInterval(async () => {
            const files = await OPFS.getAllRecords().then((data) => data.files);
            if (files.length > 0) {
                const file = files[0];
                const fileData = await (await file.getHandle()).getFile();
                const fileName = fileData.name;
                socket?.send(`My file is ${fileName} + ${counter++}`);
            } else {
                socket?.send(`My counter is ${counter++}`);
            }
            socket?.send("Hello Server!");
        }, 5000);
        
    } else if (type === "stop") {
        console.log("Worker stopped");
        if (socket) {
            socket.close();
            socket = null;
            console.log("Socket closed by worker");
        }
        self.close();
    }
}