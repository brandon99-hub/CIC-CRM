import crypto from "crypto";

const getEncryptionKey = () => {
  const keyHex = process.env.FIELD_ENCRYPTION_KEY;
  if (!keyHex) {
    // Return a dummy key for development/build if not set, or throw error in prod
    if (process.env.NODE_ENV === "production") {
      throw new Error("FIELD_ENCRYPTION_KEY environment variable is missing");
    }
    return crypto.randomBytes(32);
  }
  return Buffer.from(keyHex, "hex");
};

const KEY = getEncryptionKey();

export function encryptField(value: string | null | undefined): string | null {
  if (!value) return null;
  
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
  } catch (err) {
    console.error("Encryption error:", err);
    return null;
  }
}

export function decryptField(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.includes(":")) return stored; // Return plaintext if not encrypted
  
  try {
    const [ivHex, tagHex, encryptedHex] = stored.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(encryptedHex, "hex")) + decipher.final("utf8");
  } catch (err) {
    console.error("Decryption error:", err);
    return null;
  }
}
