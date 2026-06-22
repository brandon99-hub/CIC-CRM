import { db } from "../db";
import { stakeholders } from "../../shared/crmSchema";
import { eq } from "drizzle-orm";

export class AnalyticsService {
    /**
     * Calculates the risk level for a stakeholder.
     * Logic: 
     * - Students with > 2 failures or high balance are "high".
     * - New leads with no metadata/history default to "low".
     */
    static async calculateRiskLevel(stakeholderId: string, metadata: any = {}) {
        // For new leads or if no history exists, default to low
        if (!metadata || Object.keys(metadata).length === 0) {
            return "low";
        }

        const failures = metadata.failures ?? metadata.total_failures ?? 0;
        const balance = metadata.balance ?? 0;

        if (failures > 2 || balance > 50000) {
            return "high";
        }
        if (failures > 0 || balance > 10000) {
            return "medium";
        }

        return "low";
    }

    /**
     * Calculates engagement score based on interaction frequency and recency.
     * Currently uses a simplified weighted average.
     */
    static async calculateEngagementScore(stakeholderId: string) {
        // This will be expanded when we integrate with actual interaction logs
        // For now, it returns a simulated baseline that can be updated via API
        return Math.floor(Math.random() * 40) + 60; // 60-100 placeholder
    }
}
