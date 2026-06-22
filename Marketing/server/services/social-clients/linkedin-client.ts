import { BaseSocialClient } from "./base-client";

export class LinkedInClient extends BaseSocialClient {
    async fetchLatestPosts(): Promise<any[]> {
        console.log(`[LinkedInClient] Fetching from ${this.config.baseUrl}...`);
        return [];
    }

    async validateConnection(): Promise<boolean> {
        return !!this.config.apiKey;
    }

    protected formatPayload(raw: any) {
        return {
            text: raw.commentary || raw.text,
            metadata: {
                platform: "linkedin",
                externalId: raw.id,
                author: raw.author
            }
        };
    }
}
