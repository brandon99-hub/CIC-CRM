import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { 
  conversations, 
  messages, 
  metaLeads, 
  metaWebhookEvents, 
  dataDeletionRequests 
} from "../../shared/commsSchema";
import { intakeSignals, stakeholders } from "../../shared/crmSchema";

export class MetaDeletionService {
  /**
   * Processes a data deletion request in the background
   * @param userId The Meta user_id whose data must be deleted
   * @param requestId The ID of the dataDeletionRequests record
   */
  static async processDataDeletion(userId: string, requestId: string) {
    try {
      console.log(`[MetaDeletionService] Starting anonymization for Meta User: ${userId}`);

      // 1. Anonymize Meta Conversations (if externalConversationId contains userId or metadata contains it)
      await db.execute(sql`
        UPDATE conversations
        SET metadata = '{"anonymized": true}'::jsonb
        WHERE metadata::text LIKE '%"' || ${userId} || '"%'
           OR external_conversation_id LIKE '%' || ${userId} || '%'
      `);
        
      // Anonymize messages for conversations that belong to this user.
      const userConvos = await db.execute(sql`
        SELECT id FROM conversations
        WHERE metadata::text LIKE '%"' || ${userId} || '"%'
           OR external_conversation_id LIKE '%' || ${userId} || '%'
      `);
      
      const convoIds = (userConvos as any).rows.map((r: any) => r.id);
        
      for (const convoId of convoIds) {
        await db.update(messages)
          .set({
            body: "[Deleted by User Request]",
            attachments: sql`'[]'::jsonb`,
          })
          .where(eq(messages.conversationId, convoId));
      }

      // 2. Anonymize Meta Leads
      // Find leads that belong to this user. 
      await db.execute(sql`
        UPDATE meta_leads
        SET form_data = '{"status": "anonymized"}'::jsonb
        WHERE form_data::text LIKE '%"' || ${userId} || '"%'
      `);
      
      // Find stakeholder associated with this Meta User via intakeSignals
      const userSignals = await db.execute(sql`
        SELECT stakeholder_id FROM intake_signals
        WHERE raw_text LIKE '%' || ${userId} || '%'
           OR metadata::text LIKE '%"' || ${userId} || '"%'
      `);
        
      const stakeholderIdsToWipe = (userSignals as any).rows
        .filter((s: any) => s.stakeholder_id)
        .map((s: any) => s.stakeholder_id as string);
        
      // 3. Wipe Stakeholder Records completely (per user request)
      for (const stId of stakeholderIdsToWipe) {
        await db.delete(stakeholders).where(eq(stakeholders.id, stId));
      }

      // 4. Anonymize Webhook Events (if raw_payload contains the user_id)
      await db.execute(sql`
        UPDATE meta_webhook_events
        SET raw_payload = '{"anonymized": true}'::jsonb
        WHERE raw_payload::text LIKE '%"' || ${userId} || '"%'
      `);

      // 5. Anonymize Intake Signals
      await db.execute(sql`
        UPDATE intake_signals
        SET raw_text = '[Deleted by User Request]',
            metadata = '{"anonymized": true}'::jsonb
        WHERE raw_text LIKE '%' || ${userId} || '%'
           OR metadata::text LIKE '%"' || ${userId} || '"%'
      `);

      // 6. Mark Request as Completed
      await db.update(dataDeletionRequests)
        .set({
          status: "completed",
          completedAt: new Date().toISOString(),
        })
        .where(eq(dataDeletionRequests.id, requestId));

      console.log(`[MetaDeletionService] Completed anonymization for Meta User: ${userId}`);

    } catch (error) {
      console.error(`[MetaDeletionService] Error processing data deletion for user ${userId}:`, error);
      await db.update(dataDeletionRequests)
        .set({
          status: "failed",
          completedAt: new Date().toISOString(),
        })
        .where(eq(dataDeletionRequests.id, requestId));
    }
  }
}
