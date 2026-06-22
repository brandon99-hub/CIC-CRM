export abstract class BaseSocialClient {
    protected config: any;

    constructor(config: any) {
        this.config = config;
    }

    /**
     * Standardized method to fetch latest data/posts from a platform
     */
    abstract fetchLatestPosts(): Promise<any[]>;

    /**
     * Standardized method to validate connectivity (Health Check)
     */
    abstract validateConnection(): Promise<boolean>;

    /**
     * Helper to format raw API data into unified IntakeSignal format
     */
    protected abstract formatPayload(raw: any): any;
}
