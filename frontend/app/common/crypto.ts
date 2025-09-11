// code based on https://github.com/mdn/dom-examples/blob/main/web-crypto/derive-key/pbkdf2.js

const PBKDF2_ITERATIONS = parseInt(import.meta.env.VITE_PBKDF2_ITERATIONS);
const AES_KEY_LENGTH = parseInt(import.meta.env.VITE_AES_KEY_LENGTH);
const AES_IV_BYTES = parseInt(import.meta.env.VITE_AES_IV_BYTES);
const SALT_BYTES = parseInt(import.meta.env.VITE_SALT_BYTES);

/**
 * get CryptoKey for deriving key with PBKDF2 based on user password
 */
export function getKeyMaterial(password: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    return window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        [ "deriveKey" ]
    );
}

/**
 * derive AES-GCM key with PBKDF2 and SHA-256
 */
export function getKey(keyMaterial: CryptoKey, salt: BufferSource): Promise<CryptoKey> {
    return window.crypto.subtle.deriveKey(
        {
            "name": "PBKDF2",
            salt: salt,
            "iterations": PBKDF2_ITERATIONS,
            "hash": "SHA-256"
        },
        keyMaterial,
        { 
            "name": "AES-GCM", 
            "length": AES_KEY_LENGTH
        },
        false,
        [ 
            "decrypt", 
            "encrypt"
        ]
    );
}

export function encrypt(key: CryptoKey, iv: BufferSource, data: BufferSource): Promise<ArrayBuffer> {    
    return window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        data
    );
}

export async function decrypt(key: CryptoKey, iv: BufferSource, ciphertext: BufferSource): Promise<ArrayBuffer> {
    return window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        ciphertext
    );
}

/**
 * derives key and encrypts 
 */
export async function encryptBuffer(password: string, data: BufferSource, salt?: Uint8Array<ArrayBuffer>, iv?: Uint8Array<ArrayBuffer>): Promise<{salt: Uint8Array, iv: Uint8Array, ciphertext: ArrayBuffer}> {
    const _salt = salt ?? window.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const _iv = iv ?? window.crypto.getRandomValues(new Uint8Array(AES_IV_BYTES));

    const keyMaterial = await getKeyMaterial(password);
    const key = await getKey(keyMaterial, _salt);
    const ciphertext = await encrypt(key, _iv, data);

    return {
        salt: _salt,
        iv: _iv,
        ciphertext: ciphertext
    };
}

/**
 * derives key and decrypts
 */
export async function decryptBuffer(password: string, salt: BufferSource, iv: BufferSource, ciphertext: ArrayBuffer): Promise<ArrayBuffer> {
    const keyMaterial = await getKeyMaterial(password);
    const key = await getKey(keyMaterial, salt);
    return decrypt(key, iv, ciphertext);
}

export type EncryptionData = {
    salt: Uint8Array<ArrayBuffer>;
    iv: Uint8Array<ArrayBuffer>;
    password: string;
}