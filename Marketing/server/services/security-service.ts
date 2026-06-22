import crypto from "crypto";

export class SecurityService {
    private static algorithm = "aes-256-gcm";
    private static getSecretKey(): Buffer {
        // Prefer FIELD_ENCRYPTION_KEY, fallback to ENCRYPTION_KEY, then hardcoded fallback for dev
        const hexKey = process.env.FIELD_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        // Ensure it's 32 bytes (64 hex characters)
        if (hexKey.length !== 64) {
            console.warn("[SecurityService] Key is not 64 hex characters long! Padding/Truncating to 32 bytes.");
        }
        return Buffer.from(hexKey.padEnd(64, '0').slice(0, 64), "hex");
    }

    public static encrypt(text: string): string {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(this.algorithm, this.getSecretKey(), iv) as crypto.CipherGCM;
        
        let encrypted = cipher.update(text, "utf8", "hex");
        encrypted += cipher.final("hex");
        
        const tag = cipher.getAuthTag();
        return `${iv.toString("hex")}:${encrypted}:${tag.toString("hex")}`;
    }

    public static decrypt(encryptedData: string): string {
        try {
            const [ivHex, encryptedHex, tagHex] = encryptedData.split(":");
            
            if (!ivHex || !encryptedHex || !tagHex) {
                return encryptedData; // Might be legacy unencrypted data, return as-is
            }

            const iv = Buffer.from(ivHex, "hex");
            const tag = Buffer.from(tagHex, "hex");
            const decipher = crypto.createDecipheriv(this.algorithm, this.getSecretKey(), iv) as crypto.DecipherGCM;
            decipher.setAuthTag(tag);
            
            let decrypted = decipher.update(encryptedHex, "hex", "utf8");
            decrypted += decipher.final("utf8");
            return decrypted;
        } catch (error) {
            console.error("[SecurityService] Decryption failed:", error);
            return encryptedData; // Fallback to raw data if decryption fails (e.g. legacy plain text)
        }
    }
}
