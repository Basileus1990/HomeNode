export const useLittleEndian = import.meta.env.VITE_USE_LITTLE_ENDIAN === "true";

/**
 * takes binary message from server and extracts respondentId, type of message, flags byte and rest of buffer as binary payload
 */
export function disassemble(data: ArrayBuffer) {
    const view = new DataView(data);
    const respondentId = view.getUint32(0, useLittleEndian);
    const typeNo = view.getUint16(4, useLittleEndian);
    const payload = data.slice(6);
    return { respondentId, typeNo, payload };
};

/**
 * creates binary message for the server from respondentId, message type, flags byte and binary payload buffer
 */
export function assemble(respondentId: number, typeNo: number, payloadBuffer: ArrayBuffer): ArrayBuffer {
    const payloadView = new Uint8Array(payloadBuffer);
    const buffer = new ArrayBuffer(6 + payloadView.length);
    const view = new DataView(buffer);
    const byteView = new Uint8Array(buffer);

    view.setUint32(0, respondentId, useLittleEndian);
    view.setUint16(4, typeNo, useLittleEndian);
    byteView.set(payloadView, 6);
    return buffer;
};