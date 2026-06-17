import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
// Use a secure key from environment, fallback to a development key if not provided
// In production, ENCRYPTION_KEY must be a 32-byte hex string (64 characters)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000000';

function getKey(): Buffer {
    return Buffer.from(ENCRYPTION_KEY, 'hex');
}

export function encrypt(text: string): string {
    if (!text) return text;

    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const salt = crypto.randomBytes(SALT_LENGTH);
        const key = crypto.pbkdf2Sync(getKey(), salt, 100000, KEY_LENGTH, 'sha512');

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        const encrypted = Buffer.concat([
            cipher.update(text, 'utf8'),
            cipher.final()
        ]);

        const tag = cipher.getAuthTag();

        // Format: iv:salt:tag:encrypted
        return `${iv.toString('hex')}:${salt.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
    } catch (error) {
        console.error('Encryption failed:', error);
        throw new Error('Failed to encrypt data');
    }
}

export function decrypt(encryptedText: string): string {
    if (!encryptedText) return encryptedText;

    try {
        // If it's not our encrypted format, just return it (e.g. legacy cleartext)
        if (!encryptedText.includes(':')) return encryptedText;

        const parts = encryptedText.split(':');
        if (parts.length !== 4) return encryptedText;

        const iv = Buffer.from(parts[0], 'hex');
        const salt = Buffer.from(parts[1], 'hex');
        const tag = Buffer.from(parts[2], 'hex');
        const encrypted = Buffer.from(parts[3], 'hex');

        const key = crypto.pbkdf2Sync(getKey(), salt, 100000, KEY_LENGTH, 'sha512');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);

        return decrypted.toString('utf8');
    } catch (error) {
        console.error('Decryption failed:', error);
        // Be careful not to leak the actual error to avoid padding oracle attacks
        throw new Error('Failed to decrypt data');
    }
}
