import CryptoJS from "crypto-js";

/**
 * Encrypts a URL using a numeric PIN.
 */
export const encryptUrl = (url: string, pin: string): string => {
    return CryptoJS.AES.encrypt(url, pin).toString();
};

/**
 * Decrypts a URL using a numeric PIN.
 * Returns null if the PIN is incorrect or decryption fails.
 */
export const decryptUrl = (encryptedStr: string, pin: string): string | null => {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedStr, pin);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        if (originalText && (originalText.startsWith("http://") || originalText.startsWith("https://"))) {
            return originalText;
        }
        return null;
    } catch (e) {
        return null;
    }
};
