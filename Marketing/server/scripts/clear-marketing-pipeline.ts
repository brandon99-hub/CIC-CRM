import "dotenv/config";
import { db } from "../db";
import {
  marketingLeads,
  marketingProspects,
  marketingExpectedOrders,
  marketingSalesWon,
  marketingLostProjects,
  marketingActivities,
  marketingDocuments
} from "../../shared/schema";

async function clearPipeline() {
  console.log("⚠️ Starting full cleanup of KASNEB CRM Marketing Pipeline tables...");

  try {
    // We execute deletes in transaction for safety
    await db.transaction(async (tx) => {
      console.log("- Deleting all Activities...");
      await tx.delete(marketingActivities);

      console.log("- Deleting all Documents...");
      await tx.delete(marketingDocuments);

      console.log("- Deleting all Sales Won records...");
      await tx.delete(marketingSalesWon);

      console.log("- Deleting all Expected Orders...");
      await tx.delete(marketingExpectedOrders);

      console.log("- Deleting all Prospects...");
      await tx.delete(marketingProspects);

      console.log("- Deleting all Leads...");
      await tx.delete(marketingLeads);

      console.log("- Deleting all Lost Projects...");
      await tx.delete(marketingLostProjects);
    });

    console.log("✅ Marketing pipeline tables have been cleared successfully!");
    console.log("You can now test adding fresh data from the UI or importing records.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to clear pipeline tables:", error);
    process.exit(1);
  }
}

clearPipeline();
