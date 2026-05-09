// Robust Encryption utilities for desktop app using Web Crypto API (SubtleCrypto)

class CryptoUtils {
    /**
     * Generate RSA-OAEP Key Pair for E2E Identity
     */
    static async generateKeyPair() {
        try {
            const keyPair = await window.crypto.subtle.generateKey(
                {
                    name: "RSA-OAEP",
                    modulusLength: 2048,
                    publicExponent: new Uint8Array([1, 0, 1]),
                    hash: "SHA-256",
                },
                true,
                ["encrypt", "decrypt"]
            );

            // Export keys to JWK format for storage and sharing
            const publicKeyJWK = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
            const privateKeyJWK = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);

            return {
                publicKey: JSON.stringify(publicKeyJWK),
                privateKey: JSON.stringify(privateKeyJWK)
            };
        } catch (error) {
            console.error("RSA Key Generation error:", error);
            throw error;
        }
    }

    /**
     * SHA-256 Hash
     */
    static async sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Encrypt message using AES-GCM (Hardware accelerated & secure)
     */
    static async encryptMessage(message, encryptionKey) {
        try {
            const enc = new TextEncoder();
            const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
            
            // Derive AES Key from shared secret string
            const keyMaterial = await this.importAESKey(encryptionKey);
            
            const encryptedBuffer = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                keyMaterial,
                enc.encode(message)
            );

            return {
                encryptedContent: this.arrayBufferToBase64(encryptedBuffer),
                iv: this.arrayBufferToHex(iv)
            };
        } catch (error) {
            console.error("AES Encryption error:", error);
            throw error;
        }
    }

    /**
     * Decrypt message using AES-GCM
     */
    static async decryptMessage(encryptedContent, ivHex, encryptionKey) {
        try {
            const iv = this.hexToArrayBuffer(ivHex);
            const data = this.base64ToArrayBuffer(encryptedContent);
            
            const keyMaterial = await this.importAESKey(encryptionKey);
            
            const decryptedBuffer = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                keyMaterial,
                data
            );

            const dec = new TextDecoder();
            return dec.decode(decryptedBuffer);
        } catch (error) {
            console.error("AES Decryption error:", error);
            return '[암호화된 메시지 또는 복호화 실패]';
        }
    }

    /**
     * Create conversation key (SHA-256 derived)
     */
    static async createConversationKey(conversationId, participantKeys) {
        const sortedKeys = [...participantKeys].sort();
        const combined = conversationId + sortedKeys.join('');
        return await this.sha256(combined);
    }

    // Helper: Import string as AES Key
    static async importAESKey(keyStr) {
        const hash = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(keyStr));
        return await window.crypto.subtle.importKey(
            "raw",
            hash,
            { name: "AES-GCM" },
            false,
            ["encrypt", "decrypt"]
        );
    }

    // Utilities for buffer conversion
    static arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    static base64ToArrayBuffer(base64) {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    }

    static arrayBufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    static hexToArrayBuffer(hex) {
        const result = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            result[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        return result.buffer;
    }

    static generateRandomString(length = 32) {
        const bytes = window.crypto.getRandomValues(new Uint8Array(length));
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
}
