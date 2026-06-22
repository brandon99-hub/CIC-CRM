import { BaseSocialClient } from "./base-client";

export class MetaClient extends BaseSocialClient {
    async fetchLatestPosts(): Promise<any[]> {
        console.log(`[MetaClient] Fetching from ${this.config.baseUrl}...`);
        // Actual implementation would use fetch() with Graph API
        // For now, return empty to support simulated flow
        return [];
    }

    async validateConnection(): Promise<boolean> {
        try {
            if (!this.config.baseUrl) return false;
            // Add real Graph API /me test here
            return true;
        } catch {
            return false;
        }
    }

    protected formatPayload(raw: any) {
        return {
            text: raw.message || raw.caption,
            metadata: {
                platform: "meta",
                externalId: raw.id,
                permalink: raw.permalink
            }
        };
    }
}
