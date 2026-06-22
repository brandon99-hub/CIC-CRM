import "dotenv/config";
import cron from "node-cron";
import { SyncService } from "../Marketing/server/services/sync-service";
import { AutomationService } from "../Marketing/server/services/automation-service";
import { IntelligenceService } from "../Marketing/server/services/intelligence-service";
import { RegistrationAutomationService } from "../Marketing/server/services/registration-automation";

console.log("[Worker] Starting background job worker...");

function runWithRecovery(name: string, fn: () => Promise<void>) {
    let isRunning = false;
    return async () => {
        if (isRunning) {
            console.warn(`[${name}] Previous run still executing, skipping this cycle.`);
            return;
        }
        isRunning = true;
        try {
            await fn();
        } catch (error) {
            console.error(`[${name}] Error during execution:`, error);
        } finally {
            isRunning = false;
        }
    };
}

const runSyncSafe = runWithRecovery("SyncService", async () => await SyncService.syncAll());
const runAutoSafe = runWithRecovery("AutomationService", async () => await AutomationService.checkDeadlines());
const runIntelSafe = runWithRecovery("IntelligenceService", async () => await IntelligenceService.refreshAll());
const runRegSafe = runWithRecovery("RegistrationAutomationService", async () => await RegistrationAutomationService.processRegistrationLifecycles());

// 1. Sync Service (runs every 5 minutes)
console.log("[Worker] Scheduling Sync Service...");
runSyncSafe();
cron.schedule("*/30 * * * *", runSyncSafe);

// 2. Automation Service (runs every 2 minutes)
console.log("[Worker] Scheduling Automation Service...");
runAutoSafe();
cron.schedule("*/30 * * * *", runAutoSafe);

// 3. Intelligence Service (runs every 30 minutes)
console.log("[Worker] Scheduling Intelligence Service...");
runIntelSafe();
cron.schedule("*/30 * * * *", runIntelSafe);

// 4. Registration Automation Service (runs daily at midnight)
console.log("[Worker] Scheduling Registration Automation Service...");
// Run once on startup if needed, but daily schedule is better:
cron.schedule("0 0 * * *", runRegSafe);
