export function decodePerJson(data: ArrayBuffer): object {
    return JSON.parse(new TextDecoder().decode(data));
}

export function encodePerJson(payload: object): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(payload));
}

export function decodeUUID(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    if (bytes.length !== 16) {
        throw new Error("Invalid UUID byte array length");
    }

    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

    // Format: 8-4-4-4-12 (36 characters)
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function encodeUUID(uuid: string): Uint8Array {
    const hex = uuid.replace(/-/g, '');
    if (hex.length !== 32) throw new Error("Invalid UUID string");
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

export namespace FlagService {
    export const enum Flags {
        encryptionFlag = 1,
    };

    export function isEncrypted(flags: number): boolean {
        return (flags & Flags.encryptionFlag) == Flags.encryptionFlag
    }

    export function setEncrypted(flags: number): number {
        return (flags | Flags.encryptionFlag)
    } 
}