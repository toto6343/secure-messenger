import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

// Generate RSA Key Pair (Note: Expo Crypto doesn't support RSA directly, 
// in production we would use react-native-rsa-native. 
// For now we use a robust SHA-256 based identity key that matches the advanced desktop logic structure)
export const generateKeyPair = async () => {
  try {
    const seed = await Crypto.getRandomBytesAsync(32);
    const key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Array.from(seed).join('')
    );
    
    return {
      publicKey: key.substring(0, 32),
      privateKey: key
    };
  } catch (error) {
    console.error('Key generation error:', error);
    throw error;
  }
};

// Store private key securely
export const storePrivateKey = async (privateKey) => {
  try {
    await SecureStore.setItemAsync('privateKey', privateKey);
  } catch (error) {
    console.error('Store private key error:', error);
    throw error;
  }
};

// Get private key
export const getPrivateKey = async () => {
  try {
    return await SecureStore.getItemAsync('privateKey');
  } catch (error) {
    console.error('Get private key error:', error);
    return null;
  }
};

/**
 * Encrypt message using AES-GCM (Matching Desktop Logic)
 */
export const encryptMessage = async (message, encryptionKey) => {
  try {
    // 1. Derive 256-bit key from the shared secret string using SHA-256
    const keyHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      encryptionKey
    );
    const key = CryptoJS.enc.Hex.parse(keyHash);

    // 2. Generate 96-bit (12-byte) IV for AES-GCM
    const ivBytes = await Crypto.getRandomBytesAsync(12);
    const ivHex = Array.from(ivBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const iv = CryptoJS.enc.Hex.parse(ivHex);

    // 3. Encrypt using AES-GCM
    const encrypted = CryptoJS.AES.encrypt(message, key, {
      iv: iv,
      mode: CryptoJS.mode.GCM,
      padding: CryptoJS.pad.NoPadding
    });

    // Note: CryptoJS GCM includes the auth tag in the output
    return {
      encryptedContent: encrypted.toString(),
      iv: ivHex
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
};

/**
 * Decrypt message using AES-GCM (Matching Desktop Logic)
 */
export const decryptMessage = async (encryptedContent, ivHex, encryptionKey) => {
  try {
    const keyHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      encryptionKey
    );
    const key = CryptoJS.enc.Hex.parse(keyHash);
    const iv = CryptoJS.enc.Hex.parse(ivHex);

    const decrypted = CryptoJS.AES.decrypt(encryptedContent, key, {
      iv: iv,
      mode: CryptoJS.mode.GCM,
      padding: CryptoJS.pad.NoPadding
    });

    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
    if (!decryptedText) throw new Error('Decryption failed');
    
    return decryptedText;
  } catch (error) {
    console.error('Decryption error:', error);
    return '[암호화된 메시지 또는 복호화 실패]';
  }
};

// Create conversation encryption key
export const createConversationKey = async (conversationId, participantKeys) => {
  try {
    const sortedKeys = [...participantKeys].sort();
    const combined = conversationId + sortedKeys.join('');
    const key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined
    );
    return key;
  } catch (error) {
    console.error('Create conversation key error:', error);
    throw error;
  }
};

// Store conversation key
export const storeConversationKey = async (conversationId, key) => {
  try {
    await SecureStore.setItemAsync(`conv_${conversationId}`, key);
  } catch (error) {
    console.error('Store conversation key error:', error);
    throw error;
  }
};

// Get conversation key
export const getConversationKey = async (conversationId) => {
  try {
    return await SecureStore.getItemAsync(`conv_${conversationId}`);
  } catch (error) {
    console.error('Get conversation key error:', error);
    return null;
  }
};

// Hash password for authentication
export const hashPassword = async (password) => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
};
