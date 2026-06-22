import "dotenv/config";
import { db } from "../db";
import { 
    stakeholders, 
    stakeholderInteractions, 
    stakeholderRelationships, 
    cases, 
    caseHistory, 
    caseComments, 
    caseAttachments, 
    intakeSignals 
} from "../../shared/crmSchema";

async function clearStakeholders() {
    console.log("Starting to clear stakeholders and related data...");
    
    await db.transaction(async (tx) => {
        console.log("Deleting caseHistory...");
        await tx.delete(caseHistory);
        console.log("Deleting caseComments...");
        await tx.delete(caseComments);
        console.log("Deleting caseAttachments...");
        await tx.delete(caseAttachments);
        console.log("Deleting intakeSignals...");
        await tx.delete(intakeSignals);
        console.log("Deleting cases...");
        await tx.delete(cases);
        console.log("Deleting stakeholderInteractions...");
        await tx.delete(stakeholderInteractions);
        console.log("Deleting stakeholderRelationships...");
        await tx.delete(stakeholderRelationships);
        console.log("Deleting stakeholders...");
        await tx.delete(stakeholders);
    });

    console.log("Successfully cleared all stakeholders and related data.");
    process.exit(0);
}

clearStakeholders().catch((err) => {
    console.error("Error clearing stakeholders:", err);
    process.exit(1);
});
