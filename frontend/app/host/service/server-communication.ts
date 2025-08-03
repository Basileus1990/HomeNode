export async function getRecordId() {
    console.log("Asking the server for UUID");
    await new Promise((resolve) => setTimeout(resolve, 200));
    return crypto.randomUUID();
}