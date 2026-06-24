import { db } from "../db";
import { cases, caseHistory, caseComments, caseAttachments } from "../../shared/crmSchema";
import { conversations, messages, conversationEvents } from "../../shared/commsSchema";

async function clearCasesAndComms() {
  console.log("Starting to clear cases and communications data...");
  try {
    await db.transaction(async (tx) => {
      console.log("Deleting messages...");
      await tx.delete(messages);
      console.log("Deleting conversationEvents...");
      await tx.delete(conversationEvents);
      console.log("Deleting conversations...");
      await tx.delete(conversations);
      
      console.log("Deleting caseHistory...");
      await tx.delete(caseHistory);
      console.log("Deleting caseComments...");
      await tx.delete(caseComments);
      console.log("Deleting caseAttachments...");
      await tx.delete(caseAttachments);
      console.log("Deleting cases...");
      await tx.delete(cases);
    });
    console.log("Successfully cleared all cases and communications data.");
  } catch (error) {
    console.error("Error clearing data:", error);
    throw error;
  }
}

clearCasesAndComms().catch((err) => {
  console.error("Error clearing cases:", err);
  process.exit(1);
});
