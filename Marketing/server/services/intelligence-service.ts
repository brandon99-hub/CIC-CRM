import { DiscoveryService } from "./discovery-service";
import { SegmentationService } from "./segmentation-service";
import { db } from "../db";
import { stakeholders } from "../../shared/crmSchema";

/**
 * IntelligenceService
 * 
 * Orchestrates periodic background jobs for the Stakeholder Intelligence Engine.
 * Ensures relationship mapping and segmentation flags stay up-to-date.
 */
export const IntelligenceService = {
    /**
     * Performs a full refresh of all intelligence metrics and relationships.
     * Ideal for background scheduling.
     */
    async refreshAll() {
        console.log("[Intelligence] Starting periodic engine refresh...");
        const start = Date.now();
        try {
            // 1. Run Relationship Discovery (Links, Anchors, Hierarchy)
            await DiscoveryService.discoverAll();

            // 2. Refresh Segmentation for all active stakeholders
            const allStakeholders = await db.select({ id: stakeholders.id }).from(stakeholders);
            console.log(`[Intelligence] Re-evaluating segments for ${allStakeholders.length} stakeholders...`);
            
            // Process in small batches to avoid blocking
            const batchSize = 50;
            for (let i = 0; i < allStakeholders.length; i += batchSize) {
                const batch = allStakeholders.slice(i, i + batchSize);
                await Promise.all(batch.map(s => SegmentationService.evaluateStakeholder(s.id)));
            }

            console.log(`[Intelligence] Engine refresh complete in ${Date.now() - start}ms.`);
        } catch (error) {
            console.error("[Intelligence] Error during engine refresh:", error);
        }
    }
};
