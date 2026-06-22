import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { intakeSignals, stakeholders, cases } from "../../shared/crmSchema";
import { metaWebhookEvents, conversations, messages, metaPages } from "../../shared/commsSchema";
import { MetaLeadRetriever } from "./meta-lead-retriever";

export class MetaWebhookService {
  static async processEvent(data: any) {
    if (data.object !== "page" && data.object !== "instagram") return;

    for (const entry of data.entry) {
      // ── 1. Lead Ads ──────────────────────────────────────────────────────────
      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.field === "leadgen") {
            const leadValue = change.value;
            await this.logEvent(data.object, "leadgen", leadValue.leadgen_id, data);
            await this.processLead(leadValue, leadValue.page_id || entry.id);
          }

          // ── 2. Post Comments (Facebook + Instagram) ─────────────────────────
          if (change.field === "feed" || change.field === "comments") {
            const v = change.value;
            if (v?.item === "comment" && v?.verb === "add" && v?.message) {
              const idempotencyKey = `comment_${v.comment_id}`;
              await this.logEvent(data.object, "comment", idempotencyKey, data);
              await this.processComment(v, data.object, entry.id);
            }
          }
        }
      }

      // ── 3. Direct Messages (Messenger & Instagram DM) ────────────────────────
      if (entry.messaging) {
        for (const msg of entry.messaging) {
          const messageId = msg.message?.mid || msg.postback?.mid || Date.now().toString();
          await this.logEvent(data.object, "messages", messageId, data);
          await this.processMessage(msg, data.object, entry.id);
        }
      }
    }
  }

  // ── Logging ─────────────────────────────────────────────────────────────────
  private static async logEvent(objectType: string, eventType: string, idempotencyKey: string, rawPayload: any) {
    try {
      await db.insert(metaWebhookEvents).values({
        objectType,
        eventType,
        idempotencyKey,
        rawPayload,
        receivedAt: new Date().toISOString(),
        processed: true
      }).onConflictDoNothing({ target: metaWebhookEvents.idempotencyKey });
    } catch (e) {
      console.error("Failed to log meta webhook event", e);
    }
  }

  // ── Lead Ads ─────────────────────────────────────────────────────────────────
  private static async processLead(leadValue: any, pageId: string) {
    await db.insert(intakeSignals).values({
      source: "meta_lead_ad",
      rawText: "New Facebook Lead Pending Retrieval",
      metadata: { leadgenId: leadValue.leadgen_id, formId: leadValue.form_id, pageId },
      status: "pending"
    });

    MetaLeadRetriever.retrieveAndIngestLead(leadValue.leadgen_id, pageId).catch((err: any) => {
      console.error("Failed to retrieve lead data in background", err);
    });
  }

  // ── Direct Messages ───────────────────────────────────────────────────────────
  private static async processMessage(messagingData: any, platform: string, pageId: string) {
    if (!messagingData.message || !messagingData.sender?.id) return;

    const senderId = messagingData.sender.id;
    const msgText = messagingData.message.text || "";
    const msgId = messagingData.message.mid || Date.now().toString();
    const channel = platform === "instagram" ? "instagram_dm" : "messenger";

    // Upsert conversation — one per (channel, external PSID)
    const externalConvoId = `${channel}_${senderId}`;

    let conversation = await db.query.conversations.findFirst({
      where: eq(conversations.externalConversationId, externalConvoId),
    });

    if (!conversation) {
      // Try to find a matching stakeholder by any signal with this PSID
      const [existingSignal] = await db.select({ stakeholderId: intakeSignals.stakeholderId })
        .from(intakeSignals)
        .where(sql`${intakeSignals.metadata}->>'senderId' = ${senderId}`)
        .limit(1);

      const insertedConvo = await db.insert(conversations).values({
        channel,
        externalConversationId: externalConvoId,
        stakeholderId: existingSignal?.stakeholderId ?? null,
        status: "new",
        metadata: { platform, senderId, pageId },
        lastMessageAt: new Date().toISOString(),
      }).returning();

      conversation = insertedConvo[0];
    } else {
      // Update lastMessageAt and status if resolved
      await db.update(conversations)
        .set({
          lastMessageAt: new Date().toISOString(),
          status: conversation.status === "resolved" ? "new" : conversation.status,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(conversations.id, conversation.id));
    }

    // Insert the inbound message (only if we have text or attachments)
    if (msgText || messagingData.message.attachments?.length) {
      await db.insert(messages).values({
        conversationId: conversation.id,
        direction: "inbound",
        contentType: messagingData.message.attachments?.length ? "attachment" : "text",
        body: msgText || "[Attachment]",
        attachments: messagingData.message.attachments || [],
        externalMessageId: msgId,
        createdAt: new Date().toISOString(),
      }).onConflictDoNothing();
    }

    // Check if the conversation is linked to an active case
    let shouldTriage = true;
    if (conversation.caseId) {
      const [linkedCase] = await db.select({ status: cases.status }).from(cases).where(eq(cases.id, conversation.caseId)).limit(1);
      if (linkedCase && linkedCase.status !== 'resolved' && linkedCase.status !== 'closed') {
        shouldTriage = false;
      }
    }

    // Also write an intake signal for AI triage if no active case
    if (msgText && shouldTriage) {
      await db.insert(intakeSignals).values({
        source: platform === "instagram" ? "meta_instagram_dm" : "meta_messenger",
        rawText: msgText,
        metadata: {
          senderId,
          recipientId: messagingData.recipient?.id,
          messageId: msgId,
          conversationId: conversation.id,
        },
        status: "pending"
      });
    }
  }

  // ── Post Comments ─────────────────────────────────────────────────────────────
  private static async processComment(commentData: any, platform: string, pageId: string) {
    const channel = platform === "instagram" ? "instagram_comment" : "facebook_comment";
    const postId = commentData.post_id || commentData.parent_id;
    const userId = commentData.from?.id || "unknown";
    const userName = commentData.from?.name || "Unknown User";

    // One conversation per post (all comments for a post go into one thread)
    const externalConvoId = `comment_${channel}_${postId}`;

    let conversation = await db.query.conversations.findFirst({
      where: eq(conversations.externalConversationId, externalConvoId),
    });

    if (!conversation) {
      const insertedConvo = await db.insert(conversations).values({
        channel,
        externalConversationId: externalConvoId,
        status: "new",
        metadata: { platform, postId, pageId },
        lastMessageAt: new Date().toISOString(),
      }).returning();

      conversation = insertedConvo[0];
    } else {
      await db.update(conversations)
        .set({ lastMessageAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(conversations.id, conversation.id));
    }

    // Insert the comment as an inbound message
    await db.insert(messages).values({
      conversationId: conversation.id,
      direction: "inbound",
      contentType: "text",
      body: commentData.message,
      attachments: [],
      externalMessageId: commentData.comment_id,
      metadata: { userId, userName, commentId: commentData.comment_id, postId },
      createdAt: new Date(commentData.created_time * 1000).toISOString(),
    } as any).onConflictDoNothing();
  }
}
