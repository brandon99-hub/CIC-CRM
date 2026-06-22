import type { Express } from "express";
import { db } from "../db";
import { eq, desc, and, sql } from "drizzle-orm";
import { marketingAuth } from "../middleware/marketingAuth";
import { conversations, messages, conversationEvents, metaPages } from "../../shared/commsSchema";
import { stakeholders, cases, integrationConfigs, intakeSignals } from "../../shared/crmSchema";
import { serviceCategories } from "../../shared/adminSchema";
import { MetaSendService } from "../services/meta-send.service";
import { AuditService } from "../services/audit-service";

function generateCaseNumber(): string {
  const prefix = "KASNEB";
  const yearShort = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${prefix}-${yearShort}-${random}`;
}

export function registerInboxRoutes(app: Express) {

  // ── GET /api/conversations — list with channel filter ──────────────────────
  app.get("/api/conversations", marketingAuth, async (req, res) => {
    try {
      const channel = req.query.channel as string;
      const status  = req.query.status  as string;
      const page    = parseInt(req.query.page  as string || "1");
      const limit   = parseInt(req.query.limit as string || "30");
      const offset  = (page - 1) * limit;

      const conditions: any[] = [];
      if (channel && channel !== "all") conditions.push(eq(conversations.channel, channel));
      if (status  && status  !== "all") conditions.push(eq(conversations.status, status));
      const where = conditions.length ? and(...conditions) : undefined;

      const rows = await db
        .select({
          id:                     conversations.id,
          channel:                conversations.channel,
          externalConversationId: conversations.externalConversationId,
          status:                 conversations.status,
          lastMessageAt:          conversations.lastMessageAt,
          assignedTo:             conversations.assignedTo,
          caseId:                 conversations.caseId,
          metadata:               conversations.metadata,
          createdAt:              conversations.createdAt,
          // Resolve display name: stakeholder first, then metadata senderName/userName, then senderId, then Unknown
          stakeholderName: sql<string>`COALESCE(
            NULLIF(TRIM(COALESCE(${stakeholders.firstName}, '') || ' ' || COALESCE(${stakeholders.lastName}, '')), ''),
            NULLIF(${conversations.metadata}->>'senderName', ''),
            NULLIF(${conversations.metadata}->>'userName', ''),
            NULLIF(${conversations.metadata}->>'senderId', ''),
            'Unknown'
          )`,
        })
        .from(conversations)
        .leftJoin(stakeholders, eq(conversations.stakeholderId, stakeholders.id))
        .where(where)
        .orderBy(desc(conversations.lastMessageAt))
        .limit(limit)
        .offset(offset);

      // Attach last message body
      const withLastMsg = await Promise.all(rows.map(async (c) => {
        const [lastMsg] = await db
          .select({ body: messages.body, direction: messages.direction, createdAt: messages.createdAt })
          .from(messages)
          .where(eq(messages.conversationId, c.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);
        return { ...c, lastMessage: lastMsg ?? null };
      }));

      res.json({ conversations: withLastMsg });
    } catch (err) {
      console.error("Error fetching conversations:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── GET /api/conversations/:id/messages ────────────────────────────────────
  app.get("/api/conversations/:id/messages", marketingAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const msgs = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, id))
        .orderBy(messages.createdAt);

      // Also fetch conversation metadata (for 24hr check)
      const [convo] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
      if (!convo) return res.status(404).json({ error: "Conversation not found" });

      // 24-hour messaging window check (Meta rule)
      const lastInbound = msgs.filter(m => m.direction === "inbound").slice(-1)[0];
      const withinWindow = lastInbound
        ? (Date.now() - new Date(lastInbound.createdAt).getTime()) < 24 * 60 * 60 * 1000
        : false;

      res.json({ conversation: convo, messages: msgs, withinWindow });
    } catch (err) {
      console.error("Error fetching messages:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── POST /api/conversations/:id/reply — send an outbound message ───────────
  app.post("/api/conversations/:id/reply", marketingAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { text } = req.body;
      if (!text?.trim()) return res.status(400).json({ error: "Message text required" });

      const [convo] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
      if (!convo) return res.status(404).json({ error: "Conversation not found" });

      const meta: any = convo.metadata || {};

      // Check 24-hour window for DM channels
      if (convo.channel === "messenger" || convo.channel === "instagram_dm" || convo.channel === "whatsapp") {
        const [lastInbound] = await db
          .select({ createdAt: messages.createdAt })
          .from(messages)
          .where(and(eq(messages.conversationId, id), eq(messages.direction, "inbound")))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        if (lastInbound) {
          const age = Date.now() - new Date(lastInbound.createdAt).getTime();
          if (age > 24 * 60 * 60 * 1000) {
            return res.status(403).json({ error: "24_HOUR_WINDOW_EXPIRED", message: "Meta's 24-hour messaging window has expired. You cannot send standard replies to this conversation." });
          }
        }
      }

      // ── Self-heal: if WhatsApp conversation is missing integrationId, look it up ──
      if (convo.channel === "whatsapp" && !meta.integrationId) {
        const [waIntegration] = await db
          .select()
          .from(integrationConfigs)
          .where(and(eq(integrationConfigs.portalType, "whatsapp"), eq(integrationConfigs.isActive, true)))
          .limit(1);
        if (waIntegration) {
          meta.integrationId = waIntegration.id;
          // Patch the conversation so future replies don't need this fallback
          await db.update(conversations)
            .set({ metadata: { ...meta, integrationId: waIntegration.id }, updatedAt: new Date().toISOString() })
            .where(eq(conversations.id, id));
          console.log(`[Inbox] Self-healed integrationId for conversation ${id}`);
        }
      }

      // ── Self-heal: if email conversation is missing integrationId, look it up ──
      if (convo.channel === "email" && !meta.integrationId) {
        const [emailIntegration] = await db
          .select()
          .from(integrationConfigs)
          .where(and(eq(integrationConfigs.portalType, "gmail"), eq(integrationConfigs.isActive, true)))
          .limit(1);
        if (emailIntegration) {
          meta.integrationId = emailIntegration.id;
          await db.update(conversations)
            .set({ metadata: { ...meta, integrationId: emailIntegration.id }, updatedAt: new Date().toISOString() })
            .where(eq(conversations.id, id));
          console.log(`[Inbox] Self-healed email integrationId for conversation ${id}`);
        }
      }

      // Determine page info for sending
      let externalMsgId: string | undefined;

      if (convo.channel === "messenger" && meta.senderId && meta.pageId) {
        const pages = await db.select({ pageId: metaPages.pageId }).from(metaPages).where(eq(metaPages.pageId, meta.pageId)).limit(1);
        if (pages.length) {
          const result = await MetaSendService.sendMessengerReply(meta.pageId, meta.senderId, text);
          externalMsgId = result?.message_id;
        }
      } else if (convo.channel === "instagram_dm" && meta.senderId) {
        const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
        if (igAccountId) {
          const result = await MetaSendService.sendInstagramReply(igAccountId, meta.senderId, text);
          externalMsgId = result?.message_id;
        }
      } else if ((convo.channel === "facebook_comment" || convo.channel === "instagram_comment") && meta.pageId) {
        // For comment replies we need the latest comment ID from the request body
        const { commentId } = req.body;
        if (commentId) {
          await MetaSendService.replyToComment(meta.pageId, commentId, text);
        }
      } else if (convo.channel === "email" && meta.integrationId) {
         const { GmailSyncService } = await import("../services/gmail-sync-service");
         const toEmail = convo.externalConversationId?.replace('email_', '') || '';
         const subject = (meta.subject && !meta.subject.startsWith('Re:')) ? `Re: ${meta.subject}` : (meta.subject || "Re: Your message");
         const resData = await GmailSyncService.sendEmail(meta.integrationId, toEmail, subject, text);
         externalMsgId = resData?.id ?? undefined;
      } else if (convo.channel === "whatsapp" && meta.integrationId) {
         const { WhatsappSendService } = await import("../services/whatsapp-send-service");
         const toPhone = meta.fromPhone || (convo.externalConversationId ? convo.externalConversationId.replace('wa_', '') : '');
         if (!toPhone) throw new Error("No phone number found for this conversation");
         const resData = await WhatsappSendService.sendTextMessage(meta.integrationId, toPhone, text);
         externalMsgId = resData?.messages?.[0]?.id;
      }

      // Store outbound message
      const user: any = (req as any).user;
      const [newMsg] = await db.insert(messages).values({
        conversationId: id,
        direction: "outbound",
        contentType: "text",
        body: text,
        attachments: [],
        externalMessageId: externalMsgId,
        sentBy: user?.id ?? null,
        createdAt: new Date().toISOString(),
      }).returning();

      // Update conversation
      await db.update(conversations)
        .set({ lastMessageAt: new Date().toISOString(), status: "active", updatedAt: new Date().toISOString() })
        .where(eq(conversations.id, id));

      // Automate SLA First Response
      if (convo.caseId) {
        const [linkedCase] = await db.select().from(cases).where(eq(cases.id, convo.caseId)).limit(1);
        if (linkedCase && !linkedCase.firstResponseAt) {
           await db.update(cases)
             .set({ 
               firstResponseAt: new Date().toISOString(),
               status: linkedCase.status === 'open' ? 'in_progress' : linkedCase.status,
               updatedAt: new Date().toISOString()
             })
             .where(eq(cases.id, convo.caseId));
        }
      }

      AuditService.logAction(req, {
        action: "reply",
        module: "communications",
        entityType: "conversation",
        entityId: id,
        details: `Replied to ${convo.channel} conversation`
      });

      res.json({ message: newMsg });
    } catch (err: any) {
      console.error("Error sending reply:", err);
      if (err?.response?.data) {
        return res.status(400).json({ error: err.response.data.error?.message || "Meta API error" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── POST /api/conversations/:id/status — resolve / reopen ──────────────────
  app.post("/api/conversations/:id/status", marketingAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { status } = req.body;
      const allowed = ["new", "active", "resolved", "escalated"];
      if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });

      const [updated] = await db.update(conversations)
        .set({ status, updatedAt: new Date().toISOString(), resolvedAt: status === "resolved" ? new Date().toISOString() : null })
        .where(eq(conversations.id, id))
        .returning();

      res.json({ conversation: updated });
    } catch (err) {
      console.error("Error updating conversation status:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── POST /api/conversations/:id/resolve ──────────────────────────────────────
  app.post("/api/conversations/:id/resolve", marketingAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { resolutionNotes, saveToKb, sopSteps, rootCause } = req.body;
      const user: any = (req as any).marketingUser || (req as any).user;

      const [updated] = await db.update(conversations)
        .set({ 
          status: "resolved", 
          updatedAt: new Date().toISOString(), 
          resolvedAt: new Date().toISOString() 
        })
        .where(eq(conversations.id, id))
        .returning();

      AuditService.logAction(req, {
        action: "resolve_conversation",
        module: "communications",
        entityType: "conversation",
        entityId: id,
        details: `Resolved conversation with root cause: ${rootCause || 'N/A'}`
      });

      res.json({ conversation: updated });
    } catch (err) {
      console.error("Error resolving conversation:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── POST /api/conversations/:id/escalate ─────────────────────────────────────
  app.post("/api/conversations/:id/escalate", marketingAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { categoryId, assignedTo } = req.body;
      
      const [updated] = await db.update(conversations)
        .set({ 
          status: "escalated", 
          assignedTo: assignedTo || null,
          updatedAt: new Date().toISOString() 
        })
        .where(eq(conversations.id, id))
        .returning();

      AuditService.logAction(req, {
        action: "escalate_conversation",
        module: "communications",
        entityType: "conversation",
        entityId: id,
        details: `Escalated conversation to category ${categoryId}`
      });

      res.json({ conversation: updated });
    } catch (err) {
      console.error("Error escalating conversation:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── POST /api/conversations/:id/assign ─────────────────────────────────────
  app.post("/api/conversations/:id/assign", marketingAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { userId } = req.body;
      const [updated] = await db.update(conversations)
        .set({ assignedTo: userId, updatedAt: new Date().toISOString() })
        .where(eq(conversations.id, id))
        .returning();
      res.json({ conversation: updated });
    } catch (err) {
      console.error("Error assigning conversation:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── POST /api/conversations/:id/triage — Trigger AI Triage ─────────────────
  app.post("/api/conversations/:id/triage", marketingAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const [convo] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
      if (!convo) return res.status(404).json({ error: "Conversation not found" });

      if (convo.caseId) {
        return res.status(400).json({ error: "Conversation is already linked to a case" });
      }

      // Fetch all messages in the conversation to give AI full context
      const convoMsgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
      if (convoMsgs.length === 0) {
        return res.status(400).json({ error: "No messages to screen" });
      }

      const fullChatHistory = convoMsgs.map(m => `${m.direction === 'inbound' ? 'User' : 'Agent'}: ${m.body}`).join('\n');

      const { screenInboundMessage } = await import("../routes/ai");
      const screening = await screenInboundMessage(fullChatHistory, convo.channel);

      if (!screening.shouldCreateSignal) {
        return res.json({ result: "no_action_needed", message: "AI did not detect a clear request." });
      }

      // Look up category ID if AI suggested one
      let suggestedCategoryId: string | null = null;
      if (screening.suggestedCategory) {
        const [cat] = await db
          .select({ id: serviceCategories.id })
          .from(serviceCategories)
          .where(and(
            eq(serviceCategories.name, screening.suggestedCategory),
            eq(serviceCategories.isActive, true)
          ))
          .limit(1);
        suggestedCategoryId = cat?.id || null;
      }

      const meta: any = convo.metadata || {};

      // Auto-route if confidence > 90%
      if (screening.confidence > 90 && suggestedCategoryId) {
        // Create Case
        const [newCase] = await db.insert(cases).values({
          caseNumber: generateCaseNumber(),
          title: `[${convo.channel.toUpperCase()}] ${screening.intent || 'Request'}`,
          description: fullChatHistory,
          status: "open",
          priority: "medium",
          serviceCategoryId: suggestedCategoryId,
          stakeholderId: convo.stakeholderId,
          channel: convo.channel,
          createdAt: sql`now()`,
          updatedAt: sql`now()`,
          openedAt: sql`now()`
        } as any).returning();

        // Assign Case using Auto-Router
        try {
          const { AssignmentService } = await import("../services/assignment-service");
          const { systemRoles } = await import("../../shared/adminSchema");
          const { ilike } = await import("drizzle-orm");
          const officerRole = await db.select().from(systemRoles).where(ilike(systemRoles.name, '%officer%')).limit(1);
          if (officerRole.length > 0) {
            await AssignmentService.autoAssignCase(newCase.id, officerRole[0].id);
          }
        } catch (assignErr) {
          console.error("Auto assignment failed:", assignErr);
        }

        // Update conversation with caseId
        const [updatedConvo] = await db.update(conversations)
          .set({ caseId: newCase.id, updatedAt: sql`now()` })
          .where(eq(conversations.id, id))
          .returning();

        // If there was a pending signal, mark it mapped
        if (meta.pendingSignalId) {
          await db.update(intakeSignals)
            .set({ status: "mapped", mappedCaseId: newCase.id })
            .where(eq(intakeSignals.id, meta.pendingSignalId));
        }

        return res.json({ result: "case_created", case: newCase, conversation: updatedConvo });
      } else {
        // Create Intake Signal for manual review
        const [signal] = await db.insert(intakeSignals).values({
          source: convo.channel,
          rawText: fullChatHistory,
          confidenceScore: screening.confidence,
          suggestedCategoryId,
          stakeholderId: convo.stakeholderId,
          metadata: {
            conversationId: convo.id,
            aiIntent: screening.intent,
          },
          status: "pending"
        }).returning();

        // Update conversation metadata with pendingSignalId
        meta.pendingSignalId = signal.id;
        const [updatedConvo] = await db.update(conversations)
          .set({ metadata: meta, updatedAt: sql`now()` })
          .where(eq(conversations.id, id))
          .returning();

        return res.json({ result: "signal_created", signal, conversation: updatedConvo });
      }
    } catch (err: any) {
      console.error("Error running AI triage:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── POST /api/conversations/:id/star — star/unstar a conversation ──────────
  app.post("/api/conversations/:id/star", marketingAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const [convo] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
      if (!convo) return res.status(404).json({ error: "Conversation not found" });

      const meta: any = convo.metadata || {};
      const newStarred = !meta.starred;

      const [updated] = await db.update(conversations)
        .set({ metadata: { ...meta, starred: newStarred }, updatedAt: new Date().toISOString() })
        .where(eq(conversations.id, id))
        .returning();

      res.json({ conversation: updated, starred: newStarred });
    } catch (err) {
      console.error("Error starring conversation:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── POST /api/conversations/:id/hide-comment ───────────────────────────────
  app.post("/api/conversations/:id/hide-comment", marketingAuth, async (req, res) => {
    try {
      const { commentId, hide = true } = req.body;
      const [convo] = await db.select().from(conversations).where(eq(conversations.id, req.params.id as string)).limit(1);
      if (!convo) return res.status(404).json({ error: "Conversation not found" });
      const meta: any = convo.metadata || {};
      const result = await MetaSendService.hideComment(meta.pageId, commentId, hide);
      res.json({ success: true, result });
    } catch (err: any) {
      console.error("Error hiding comment:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── DELETE /api/conversations/:id/delete-comment ───────────────────────────
  app.delete("/api/conversations/:id/delete-comment", marketingAuth, async (req, res) => {
    try {
      const { commentId } = req.body;
      const [convo] = await db.select().from(conversations).where(eq(conversations.id, req.params.id as string)).limit(1);
      if (!convo) return res.status(404).json({ error: "Conversation not found" });
      const meta: any = convo.metadata || {};
      await MetaSendService.deleteComment(meta.pageId, commentId);

      // Mark message as deleted in our DB
      if (commentId) {
        await db.update(messages)
          .set({ body: "[Deleted]", contentType: "deleted" } as any)
          .where(eq(messages.externalMessageId, commentId));
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting comment:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/conversations/:id/like-comment ───────────────────────────────
  app.post("/api/conversations/:id/like-comment", marketingAuth, async (req, res) => {
    try {
      const { commentId } = req.body;
      const [convo] = await db.select().from(conversations).where(eq(conversations.id, req.params.id as string)).limit(1);
      if (!convo) return res.status(404).json({ error: "Conversation not found" });
      const meta: any = convo.metadata || {};
      const result = await MetaSendService.likeComment(meta.pageId, commentId);
      res.json({ success: true, result });
    } catch (err: any) {
      console.error("Error liking comment:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/conversations/:id/note — add internal note ──────────────────
  app.post("/api/conversations/:id/note", marketingAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { text } = req.body;
      const user: any = (req as any).user;
      const [newMsg] = await db.insert(messages).values({
        conversationId: id,
        direction: "outbound",
        contentType: "text",
        body: text,
        attachments: [],
        isInternalNote: true,
        sentBy: user?.id ?? null,
        createdAt: new Date().toISOString(),
      }).returning();
      res.json({ message: newMsg });
    } catch (err) {
      console.error("Error adding note:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
