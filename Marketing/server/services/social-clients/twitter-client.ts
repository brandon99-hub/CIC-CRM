import { BaseSocialClient } from "./base-client";

export class TwitterClient extends BaseSocialClient {
    async fetchLatestPosts(): Promise<any[]> {
        console.log(`[TwitterClient] Monitoring timeline via ${this.config.baseUrl}...`);
        return [];
    }

    async validateConnection(): Promise<boolean> {
        return !!this.config.apiKey || !!this.config.bearerToken;
    }

    protected formatPayload(raw: any) {
        return {
            text: raw.text,
            metadata: {
                platform: "twitter",
                externalId: raw.id,
                authorId: raw.author_id
            }
        };
    }
}
