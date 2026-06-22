import "dotenv/config";
import { db } from "../db";
import { intakeSignals } from "../../shared/crmSchema";

async function clearTriage() {
    console.log("--- Clearing Intake Triage Signals ---");
    try {
        const result = await db.delete(intakeSignals);
        console.log("Successfully cleared all triage signals.");
        process.exit(0);
    } catch (error) {
        console.error("Error clearing triage signals:", error);
        process.exit(1);
    }
}

clearTriage();
