import { db } from "../db";
import { integrationConfigs, intakeSignals } from "../../shared/crmSchema";
import { eq, and, sql } from "drizzle-orm";
import { metaPages } from "../../shared/commsSchema";
import { CategorizationService } from "./categorization-service";
import { MetaClient } from "./social-clients/meta-client";
import { LinkedInClient } from "./social-clients/linkedin-client";
import { TwitterClient } from "./social-clients/twitter-client";

export class SyncService {
    /**
     * Orchestrates synchronization for all active integrations
     */
    static async syncAll() {
        try {
            const activeConfigs = await db
                .select()
                .from(integrationConfigs)
                .where(eq(integrationConfigs.isActive, true));

            for (const config of activeConfigs) {
                try {
                    // Check if it's time to sync based on syncInterval
                    const lastSynced = config.lastSyncedAt ? new Date(config.lastSyncedAt) : new Date(0);
                    const intervalMs = (config.syncInterval || 15) * 60 * 1000;
                    
                    if (Date.now() - lastSynced.getTime() >= intervalMs) {
                        await this.syncIntegration(config.id);
                    }
                } catch (error) {
                    console.error(`[SyncService] Scheduled sync fail for ${config.id}:`, error);
                }
            }
        } catch (globalError) {
            console.error("[SyncService] Critical failure in syncAll loop (possible DB connection issue):", globalError);
        }
    }

    /**
     * Syncs a single integration endpoint by ID
     */
    static async syncIntegration(id: string) {
        const config = await db.query.integrationConfigs.findFirst({
            where: eq(integrationConfigs.id, id)
        });

        if (!config || !config.isActive) return;

        // SEC-A6: Verify OAuth bindings exist before attempting sync to prevent false positives
        if (config.authType === 'oauth2' && ['meta', 'facebook', 'instagram'].includes(config.portalType.toLowerCase())) {
            const linkedPages = await db.query.metaPages.findMany({
                where: eq(metaPages.integrationId, id)
            });
            
            if (linkedPages.length === 0) {
                await db.update(integrationConfigs)
                    .set({ syncStatus: "pending_auth", updatedAt: sql`now()` } as any)
                    .where(eq(integrationConfigs.id, id));
                console.log(`[SyncService] Pending Auth: ${config.name}. No linked pages/accounts found.`);
                return;
            }
        }

        console.log(`[SyncService] Syncing: ${config.name} (${config.portalType})`);

        await db.update(integrationConfigs)
            .set({ syncStatus: "syncing" } as any)
            .where(eq(integrationConfigs.id, id));

        try {
            if (config.portalType === 'gmail' || config.portalType === 'email') {
                const { GmailSyncService } = await import("./gmail-sync-service");
                await GmailSyncService.syncIntegration(id);
                console.log(`[SyncService] Success: ${config.name} (Gmail/Email).`);
                return;
            }

            if (config.portalType === 'whatsapp') {
                console.log(`[SyncService] WhatsApp uses real-time webhooks. Skipping pull sync.`);
                await db.update(integrationConfigs).set({ syncStatus: "success", lastSyncedAt: sql`now()`, updatedAt: sql`now()` } as any).where(eq(integrationConfigs.id, id));
                return;
            }

            const client = this.getClient(config);
            if (!client) {
                throw new Error(`No client implemented for portal type: ${config.portalType}`);
            }

            const rawData = await client.fetchLatestPosts();
            let processedCount = 0;

            for (const item of rawData) {
                const categorization = CategorizationService.categorize({
                    source: config.portalType,
                    text: item.text,
                    metadata: item.metadata
                });

                await db.insert(intakeSignals).values({
                    source: "social_media_api",
                    rawText: item.text,
                    confidenceScore: categorization.priority === "critical" ? 100 : 70,
                    status: "pending",
                    metadata: {
                        ...item.metadata,
                        integrationId: config.id,
                        syncTimestamp: new Date().toISOString()
                    }
                } as any);
                processedCount++;
            }

            await db.update(integrationConfigs)
                .set({
                    lastSyncedAt: sql`now()`,
                    syncStatus: "success",
                    updatedAt: sql`now()`
                } as any)
                .where(eq(integrationConfigs.id, id));

            console.log(`[SyncService] Success: ${config.name}. Processed ${processedCount} items.`);
        } catch (error) {
            console.error(`[SyncService] Error syncing ${config.name}:`, error);
            try {
                await db.update(integrationConfigs)
                    .set({ 
                        syncStatus: "failed", 
                        updatedAt: sql`now()` 
                    } as any)
                    .where(eq(integrationConfigs.id, id));
            } catch (updateError) {
                console.error("[SyncService] Failed to record sync failure state:", updateError);
            }
        }
    }

    private static getClient(config: any) {
        // Mapping configurations to specific platform clients
        const normalizedName = config.name.toLowerCase();
        
        if (normalizedName.includes("facebook") || normalizedName.includes("instagram") || config.portalType === "social_media") {
            return new MetaClient(config);
        }
        if (normalizedName.includes("linkedin")) {
            return new LinkedInClient(config);
        }
        if (normalizedName.includes("twitter") || normalizedName.includes(" x ")) {
            return new TwitterClient(config);
        }
        
        return null;
    }
}
