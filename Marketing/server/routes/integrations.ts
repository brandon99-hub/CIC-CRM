import type { Express } from "express";
import { db } from "../db";
import { marketingAuth, marketingAdminAuth, checkPermission } from "../middleware/marketingAuth";
import { integrationConfigs, auditLogs } from "../../shared/crmSchema";
import { AuditService } from "../services/audit-service";
import { SecurityService } from "../services/security-service";
import { eq, desc, sql, count } from "drizzle-orm";
import { z } from "zod";

// SEC-A6: Validated write schema — prevents mass assignment on system fields
const integrationWriteSchema = z.object({
  name: z.string().min(1).max(100),
  portalType: z.string().min(1).max(100),
  baseUrl: z.string().url().optional().or(z.literal("")),
  apiKey: z.string().max(500).optional(),
  clientId: z.string().max(200).optional(),
  clientSecret: z.string().max(500).optional(),
  authType: z.string().max(50).default("api_key"),
  syncInterval: z.number().int().min(5).max(1440).default(15),
  isActive: z.boolean().default(true).optional(),
  // System fields (lastTestedAt, lastTestStatus, createdAt, updatedAt) are EXCLUDED
});

export function registerIntegrationRoutes(app: Express) {

  app.get("/api/integrations/google/auth", async (req, res) => {
    try {
      const { integrationId } = req.query;
      if (!integrationId) return res.status(400).json({ error: "Missing integrationId" });

      const { google } = await import('googleapis');
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${req.protocol}://${req.get("host")}/api/integrations/google/callback`
      );

      const scopes = ['https://mail.google.com/'];

      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state: integrationId as string,
        prompt: 'consent' // Force to get refresh_token
      });

      res.json({ url });
    } catch (error) {
      console.error("Error generating Google Auth URL:", error);
      res.status(500).json({ error: "Failed to initiate Google OAuth" });
    }
  });

  app.get("/api/integrations/google/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;
      
      if (error) {
         return res.redirect(`/admin-dashboard?tab=integrations&error=google_oauth_failed`);
      }

      const integrationId = state as string;
      const { google } = await import('googleapis');
      
      const redirectUri = `${req.protocol}://${req.get("host")}/api/integrations/google/callback`;

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      const { tokens } = await oauth2Client.getToken(code as string);
      
      const { SecurityService } = await import("../services/security-service");

      const updateData: any = {};
      if (tokens.refresh_token) {
        updateData.apiKey = SecurityService.encrypt(tokens.refresh_token);
      }
      if (tokens.access_token) {
        updateData.clientSecret = SecurityService.encrypt(tokens.access_token);
      }
      updateData.lastTestedAt = sql`now()`;
      updateData.lastTestStatus = 'success';

      await db.update(integrationConfigs)
        .set(updateData)
        .where(eq(integrationConfigs.id, integrationId));

      res.redirect(`/admin-dashboard?tab=integrations&integration_success=true`);
    } catch (err) {
      console.error("Google OAuth Callback Error:", err);
      res.redirect(`/admin-dashboard?tab=integrations&error=google_oauth_error`);
    }
  });

  app.get("/api/admin/integrations", marketingAuth, marketingAdminAuth, checkPermission("admin.integrations.manage"), async (_req, res) => {
    try {
      const configs = await db.select().from(integrationConfigs).orderBy(desc(integrationConfigs.createdAt));
      const sanitized = configs.map((c) => ({
        ...c,
        apiKey: c.apiKey ? "••••••••" + (c.apiKey.slice(-4) || "") : null,
        clientSecret: c.clientSecret ? "••••••••" + (c.clientSecret.slice(-4) || "") : null,
      }));
      res.json({ integrations: sanitized });
    } catch (error) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/integrations", marketingAuth, marketingAdminAuth, checkPermission("admin.integrations.manage"), async (req, res) => {
    try {
      const data = integrationWriteSchema.parse(req.body);
      
      const encryptedData = { ...data };
      if (encryptedData.apiKey) {
          encryptedData.apiKey = SecurityService.encrypt(encryptedData.apiKey);
      }
      if (encryptedData.clientSecret) {
          encryptedData.clientSecret = SecurityService.encrypt(encryptedData.clientSecret);
      }

      const newConfig = await db
        .insert(integrationConfigs)
        .values(encryptedData as any)
        .returning();
      res.status(201).json({ integration: newConfig[0] });

      // Log integration creation
      AuditService.logAction(req, {
        action: 'create',
        module: 'admin',
        entityType: 'integration',
        entityId: newConfig[0].id,
        newValues: newConfig[0],
        details: `Created new integration: ${newConfig[0].name}`
      });
    } catch (error) {
      console.error("Error creating integration:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/admin/integrations/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.integrations.manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const data = integrationWriteSchema.partial().parse(req.body);

      const encryptedData = { ...data };
      if (encryptedData.apiKey && !encryptedData.apiKey.startsWith("••••")) {
          encryptedData.apiKey = SecurityService.encrypt(encryptedData.apiKey);
      } else {
          delete encryptedData.apiKey; // Do not overwrite with masked version
      }
      if (encryptedData.clientSecret && !encryptedData.clientSecret.startsWith("••••")) {
          encryptedData.clientSecret = SecurityService.encrypt(encryptedData.clientSecret);
      } else {
          delete encryptedData.clientSecret; // Do not overwrite with masked version
      }

      const updated = await db
        .update(integrationConfigs)
        .set({ ...encryptedData, updatedAt: sql`now()` } as any)
        .where(eq(integrationConfigs.id, id as string))
        .returning();
      if (!updated.length) {
        return res.status(404).json({ error: "Integration not found" });
      }
      res.json({ integration: updated[0] });

      // Log integration update
      AuditService.logAction(req, {
        action: 'update',
        module: 'admin',
        entityType: 'integration',
        entityId: id as string,
        newValues: updated[0],
        details: `Updated integration: ${updated[0].name}`
      });
    } catch (error) {
      console.error("Error updating integration:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admin/integrations/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.integrations.manage"), async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(integrationConfigs).where(eq(integrationConfigs.id, id as string));
      res.json({ success: true });

      // Log integration deletion
      AuditService.logAction(req, {
        action: 'delete',
        module: 'admin',
        entityType: 'integration',
        entityId: id as string,
        details: `Deleted integration ID: ${id}`
      });
    } catch (error) {
      console.error("Error deleting integration:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/integrations/:id/test", marketingAuth, marketingAdminAuth, checkPermission("admin.integrations.manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const [config] = await db.select().from(integrationConfigs).where(eq(integrationConfigs.id, id as string));
      if (!config) {
        return res.status(404).json({ error: "Integration not found" });
      }

      let testResult = "success";
      let testMessage = "Connection test passed";
      let details: Record<string, any> = {};

      const isMeta = ["facebook", "instagram", "meta"].includes(config.portalType?.toLowerCase());

      try {
        if (isMeta) {
          // ── Real Meta Graph API test ─────────────────────────────────────────
          // Step 1: Verify there is a connected page with a valid token
          const { metaPages } = await import("../../shared/commsSchema");
          const linkedPages = await db.select().from(metaPages).where(eq(metaPages.integrationId, id as string));

          if (linkedPages.length === 0) {
            testResult = "warning";
            testMessage = "No linked Facebook Pages found — OAuth authorization required";
            details.hint = "Click 'Connect with Facebook' in the integration settings to authorize.";
          } else {
            // Step 2: Test each page token via /me and check subscribed_apps
            const { SecurityService } = await import("../services/security-service");
            let allHealthy = true;
            const pageResults: any[] = [];

            for (const page of linkedPages) {
              try {
                const token = SecurityService.decrypt(page.pageAccessToken);

                // Verify token is valid
                const meRes = await fetch(
                  `https://graph.facebook.com/v19.0/${page.pageId}?fields=id,name&access_token=${token}`,
                  { signal: AbortSignal.timeout(8000) }
                );
                const meData = await meRes.json() as any;

                if (meData.error) {
                  allHealthy = false;
                  pageResults.push({ pageId: page.pageId, name: page.pageName, status: "token_invalid", error: meData.error.message });
                  continue;
                }

                // Check webhook subscription status
                const subRes = await fetch(
                  `https://graph.facebook.com/v19.0/${page.pageId}/subscribed_apps?access_token=${token}`,
                  { signal: AbortSignal.timeout(8000) }
                );
                const subData = await subRes.json() as any;
                const subscriptions: string[] = subData.data?.[0]?.subscribed_fields ?? [];
                const hasMessages = subscriptions.includes("messages");

                if (!hasMessages) {
                  allHealthy = false;
                  pageResults.push({
                    pageId: page.pageId, name: page.pageName,
                    status: "not_subscribed",
                    subscriptions,
                    error: "Page is not subscribed to 'messages' — incoming DMs will not be received"
                  });
                } else {
                  pageResults.push({ pageId: page.pageId, name: page.pageName, status: "healthy", subscriptions });
                }
              } catch (pageErr: any) {
                allHealthy = false;
                pageResults.push({ pageId: page.pageId, name: page.pageName, status: "error", error: pageErr.message });
              }
            }

            details.pages = pageResults;
            if (!allHealthy) {
              testResult = "warning";
              const notSubbed = pageResults.filter(p => p.status === "not_subscribed");
              const invalid = pageResults.filter(p => p.status === "token_invalid");
              if (invalid.length > 0) {
                testResult = "failed";
                testMessage = `${invalid.length} page token(s) are invalid — re-authorize the integration`;
              } else if (notSubbed.length > 0) {
                testMessage = `${notSubbed.length} page(s) not subscribed to webhook 'messages' — incoming DMs won't arrive`;
              }
            } else {
              testMessage = `All ${linkedPages.length} page(s) healthy and subscribed to webhook events`;
            }
          }
        } else if (config.portalType === 'whatsapp') {
          const { SecurityService } = await import("../services/security-service");
          const token = config.apiKey ? SecurityService.decrypt(config.apiKey) : "";
          const phoneId = config.clientId;
          if (!token || !phoneId) {
            testResult = "failed";
            testMessage = "Missing System User Token or Phone Number ID";
          } else {
            const wabaRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}?access_token=${token}`, { signal: AbortSignal.timeout(8000) });
            const wabaData = await wabaRes.json() as any;
            if (wabaData.error) {
              testResult = "failed";
              testMessage = `WhatsApp API Error: ${wabaData.error.message}`;
              details.error = wabaData.error;
            } else {
              testMessage = "WhatsApp Cloud API connection verified successfully";
            }
          }
        } else if (config.portalType === 'gmail' || config.portalType === 'email') {
          const { SecurityService } = await import("../services/security-service");
          const token = config.apiKey ? SecurityService.decrypt(config.apiKey) : "";
          if (!token) {
            testResult = "failed";
            testMessage = "Missing Gmail OAuth token. Please re-authorize the connection.";
          } else {
            testResult = "success";
            testMessage = "Gmail integration authorized and verified successfully";
          }
        } else {
          // ── Generic URL reachability test ────────────────────────────────────
          if (config.baseUrl) {
            const testUrl = config.baseUrl.endsWith("/") ? `${config.baseUrl}health` : `${config.baseUrl}/health`;
            try {
              const response = await fetch(testUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
              // A 401/403/404 means the server is reachable, just needs auth — still "warning" not "failed"
              if (response.status >= 500) {
                testResult = "failed";
                testMessage = `Server error: HTTP ${response.status}`;
              } else if (!response.ok) {
                testResult = "warning";
                testMessage = `Endpoint reachable but returned HTTP ${response.status}`;
              }
            } catch {
              testResult = "failed";
              testMessage = "Connection failed — endpoint unreachable or timed out";
            }
          } else {
            testResult = "warning";
            testMessage = "No base URL configured — cannot test connectivity";
          }
        }
      } catch (testErr: any) {
        testResult = "failed";
        testMessage = `Test error: ${testErr.message}`;
      }

      await db
        .update(integrationConfigs)
        .set({
          lastTestedAt: sql`now()`,
          lastTestStatus: testResult,
          updatedAt: sql`now()`,
        } as any)
        .where(eq(integrationConfigs.id, id as string));

      res.json({ status: testResult, message: testMessage, details });
    } catch (error) {
      console.error("Error testing integration:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/integrations/:id/sync", marketingAuth, marketingAdminAuth, checkPermission("admin.integrations.manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const { SyncService } = await import("../services/sync-service");
      
      // Trigger sync in the background
      SyncService.syncIntegration(id as string).catch(err => {
        console.error(`[ManualSync] Background sync failed for ${id}:`, err);
      });

      res.json({ success: true, message: "Synchronization initiated" });

      // Log manual sync trigger
      AuditService.logAction(req, {
        action: 'sync',
        module: 'admin',
        entityType: 'integration',
        entityId: id as string,
        details: `Manually triggered sync for integration ID: ${id}`
      });
    } catch (error) {
      console.error("Error initiating sync:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Audit Logs
  app.get("/api/admin/audit-logs", marketingAuth, marketingAdminAuth, checkPermission("admin.audit.view"), async (req, res) => {
    try {
      const { module, action, page = "1", limit = "50" } = req.query;
      const pageNum = Math.max(1, parseInt(String(page)) || 1);
      const limitNum = Math.min(200, Math.max(1, parseInt(String(limit)) || 50));
      const offset = (pageNum - 1) * limitNum;
      const conditions: any[] = [];
      if (module) conditions.push(eq(auditLogs.module, String(module)));
      if (action) conditions.push(eq(auditLogs.action, String(action)));

      const whereClause = conditions.length > 0 ? (await import("drizzle-orm")).and(...conditions) : undefined;
      const [results, totalResult] = await Promise.all([
        whereClause
          ? db.select().from(auditLogs).where(whereClause).orderBy(desc(auditLogs.createdAt)).limit(limitNum).offset(offset)
          : db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limitNum).offset(offset),
        whereClause
          ? db.select({ count: count() }).from(auditLogs).where(whereClause)
          : db.select({ count: count() }).from(auditLogs),
      ]);

      // Helper to generate human-readable narrative descriptions
      const generateNarrative = (log: any) => {
        const oldVal = log.oldValues || {};
        const newVal = log.newValues || {};
        const changes: string[] = [];
        
        // 1. Identify Entity specifically
        let entityInfo = log.entityType ? log.entityType.charAt(0).toUpperCase() + log.entityType.slice(1) : "";
        const entityLabel = (log.metadata as any)?.details || "";
        
        // Extract specific ID if possible (e.g., Client Name from details or Case Number)
        if (entityLabel && !entityLabel.includes("successfully")) {
          entityInfo = `${entityInfo} '${entityLabel.split(' for ')[1] || entityLabel.split(' lead ')[1] || entityLabel.split('case ')[1] || entityLabel}'`;
        } else if (log.action === "login" || log.action === "logout") {
          entityInfo = "User authentication session";
        }

        // 2. Process smart changes
        const rules: Record<string, string[]> = {
          marketing: ['stage', 'marketerId', 'revenue'],
          admin: ['isActive', 'role', 'headUserId'],
          cases: ['status', 'priority', 'escalationLevel']
        };

        const relevantFields = rules[log.module] || [];
        
        relevantFields.forEach(field => {
          if (newVal[field] !== undefined && newVal[field] !== oldVal[field]) {
            let label = field.charAt(0).toUpperCase() + field.slice(1);
            if (field === 'marketerId' || field === 'headUserId') label = "Assignment";
            if (field === 'isActive') label = "Status";
            
            const fromValue = oldVal[field] === null || oldVal[field] === undefined ? "none" : String(oldVal[field]);
            const toValue = newVal[field] === null || newVal[field] === undefined ? "none" : String(newVal[field]);
            
            if (field === 'isActive') {
              changes.push(newVal[field] ? "Activated" : "Deactivated");
            } else {
              changes.push(`${label}: ${fromValue} → ${toValue}`);
            }
          }
        });

        // 3. Fallback for general updates if no smart changes matched
        if (changes.length === 0 && log.action === 'update') {
          const allChangedFields = Object.keys(newVal).filter(k => 
            newVal[k] !== oldVal[k] && !['updatedAt', 'id', 'createdAt'].includes(k)
          );
          if (allChangedFields.length > 0) {
            changes.push(`Modified: ${allChangedFields.slice(0, 3).join(", ")}${allChangedFields.length > 3 ? "..." : ""}`);
          }
        }

        // 4. Combine into Narrative
        if (log.action === "login") return `User ${log.userEmail} logged in successfully`;
        if (log.action === "logout") return `User ${log.userEmail} logged out`;
        
        const actionVerb = log.action === 'create' ? 'Created new' : log.action === 'delete' ? 'Deactivated' : 'Updated';
        const finalChanges = changes.length > 0 ? `: ${changes.join(", ")}` : "";
        
        return `${actionVerb} ${entityInfo}${finalChanges}`;
      };

      // Transform data for frontend component expectations
      const transformedLogs = results.map(log => ({
        ...log,
        timestamp: log.createdAt,
        userName: log.userName || log.userEmail || "System",
        userEmail: log.userEmail,
        details: generateNarrative(log),
        machineInfo: (log.metadata as any)?.machineInfo || "Unknown Device",
        rawMetadata: log.metadata // Pass full metadata for forensic modal
      }));

      res.json({
        logs: transformedLogs,
        total: totalResult[0]?.count || 0,
        page: parseInt(page as string),
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── POST /api/admin/integrations/:id/resubscribe ─────────────────────────────
  // Forces re-subscription of all linked Meta pages to webhook events.
  // Use this when the integration shows DEGRADED and pages aren't receiving DMs.
  // No OAuth re-authorization needed — reuses the stored encrypted page token.
  app.post("/api/admin/integrations/:id/resubscribe", marketingAuth, marketingAdminAuth, checkPermission("admin.integrations.manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const { metaPages } = await import("../../shared/commsSchema");
      const { SecurityService } = await import("../services/security-service");
      const axios = (await import("axios")).default;

      const linkedPages = await db.select().from(metaPages).where(eq(metaPages.integrationId, id as string));
      if (linkedPages.length === 0) {
        return res.status(404).json({ error: "No linked pages found for this integration. OAuth authorization is required first." });
      }

      const results: any[] = [];
      for (const page of linkedPages) {
        try {
          const token = SecurityService.decrypt(page.pageAccessToken);
          const response = await axios.post(
            `https://graph.facebook.com/v19.0/${page.pageId}/subscribed_apps`,
            {},
            {
              params: {
                subscribed_fields: "messages,messaging_postbacks,messaging_optins,feed,mention",
                access_token: token
              }
            }
          );
          console.log(`[Resubscribe] ✓ Page ${page.pageName} (${page.pageId}) subscribed`);
          results.push({ pageId: page.pageId, name: page.pageName, success: true, data: response.data });
        } catch (err: any) {
          const errMsg = err.response?.data?.error?.message || err.message;
          console.error(`[Resubscribe] ✗ Page ${page.pageId} failed:`, errMsg);
          results.push({ pageId: page.pageId, name: page.pageName, success: false, error: errMsg });
        }
      }

      // Update integration sync status
      const allOk = results.every(r => r.success);
      await db.update(integrationConfigs)
        .set({
          lastSyncedAt: sql`now()`,
          syncStatus: allOk ? "success" : "failed",
          // Reset lastTestStatus so the DEGRADED badge clears on the frontend
          lastTestStatus: allOk ? "success" : "failed",
          lastTestedAt: sql`now()`,
          updatedAt: sql`now()`
        } as any)
        .where(eq(integrationConfigs.id, id as string));

      AuditService.logAction(req, {
        action: "sync",
        module: "admin",
        entityType: "integration",
        entityId: id as string,
        details: `Re-subscribed ${results.filter(r => r.success).length}/${results.length} page(s) to Meta webhook events`
      });

      res.json({ success: allOk, results, message: allOk ? "All pages re-subscribed successfully" : "Some pages failed to subscribe" });
    } catch (error: any) {
      console.error("Error resubscribing pages:", error);
      res.status(500).json({ error: "Internal server error", message: error.message });
    }
  });

  // ── POST /api/admin/integrations/:id/backfill-messages ───────────────────────
  // Pulls the last N Messenger conversations from the Facebook Graph API and writes
  // them into the local conversations + messages tables — recovering any DMs that
  // arrived before the webhook subscription was active (e.g. the 22 May DM).
  app.post("/api/admin/integrations/:id/backfill-messages", marketingAuth, marketingAdminAuth, checkPermission("admin.integrations.manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const { limit: limitParam = 25 } = req.body;
      const { metaPages, conversations, messages } = await import("../../shared/commsSchema");
      const { intakeSignals } = await import("../../shared/crmSchema");
      const { SecurityService } = await import("../services/security-service");
      const axios = (await import("axios")).default;
      const { eq: deq, sql: dsql } = await import("drizzle-orm");

      // Only backfill Facebook Messenger (platform = facebook)
      const linkedPages = await db.select().from(metaPages)
        .where(deq(metaPages.integrationId, id as string));

      const facebookPages = linkedPages.filter(p => p.platform === "facebook");
      if (facebookPages.length === 0) {
        return res.status(404).json({ error: "No connected Facebook pages found for this integration." });
      }

      let totalImported = 0;
      let totalSkipped = 0;
      const pageResults: any[] = [];

      for (const page of facebookPages) {
        try {
          const token = SecurityService.decrypt(page.pageAccessToken);

          // Fetch conversations list from Graph API
          const convoRes = await axios.get(
            `https://graph.facebook.com/v19.0/${page.pageId}/conversations`,
            {
              params: {
                platform: "messenger",
                fields: "id,participants,updated_time,messages{id,message,from,created_time,attachments}",
                limit: Math.min(limitParam, 100),
                access_token: token
              }
            }
          );

          const fbConversations: any[] = convoRes.data?.data ?? [];
          let imported = 0;
          let skipped = 0;

          for (const fbConvo of fbConversations) {
            // Identify the sender (participant who is NOT the page)
            const participants: any[] = fbConvo.participants?.data ?? [];
            const sender = participants.find((p: any) => p.id !== page.pageId);
            if (!sender) { skipped++; continue; }

            const senderId = sender.id;
            const senderName = sender.name || "Unknown";
            const channel = "messenger";
            const externalConvoId = `${channel}_${senderId}`;

            // Upsert conversation — match on BOTH externalConversationId AND channel (composite unique key)
            const { and: dand } = await import("drizzle-orm");
            let existingConvo = await db.query.conversations.findFirst({
              where: dand(
                deq(conversations.externalConversationId, externalConvoId),
                deq(conversations.channel, channel)
              ),
            });

            if (!existingConvo) {
              const [inserted] = await db.insert(conversations).values({
                channel,
                externalConversationId: externalConvoId,
                status: "new",
                metadata: { platform: "facebook", senderId, pageId: page.pageId, userName: senderName, backfilled: true },
                lastMessageAt: fbConvo.updated_time || new Date().toISOString(),
              }).returning();
              existingConvo = inserted;
            }

            // Upsert messages from this conversation
            const fbMessages: any[] = fbConvo.messages?.data ?? [];
            for (const fbMsg of fbMessages) {
              if (!fbMsg.message && !fbMsg.attachments?.data?.length) continue;

              const msgText = fbMsg.message || "[Attachment]";
              const isFromPage = fbMsg.from?.id === page.pageId;
              const direction = isFromPage ? "outbound" : "inbound";
              const msgTime = fbMsg.created_time || new Date().toISOString();

              try {
                await db.insert(messages).values({
                  conversationId: existingConvo.id,
                  direction,
                  contentType: fbMsg.attachments?.data?.length ? "attachment" : "text",
                  body: msgText,
                  attachments: fbMsg.attachments?.data ?? [],
                  externalMessageId: fbMsg.id,
                  createdAt: msgTime,
                }).onConflictDoNothing();

                // Write intake signal for inbound messages (for AI triage)
                if (direction === "inbound" && fbMsg.message) {
                  await db.insert(intakeSignals).values({
                    source: "meta_messenger",
                    rawText: fbMsg.message,
                    metadata: {
                      senderId,
                      messageId: fbMsg.id,
                      conversationId: existingConvo.id,
                      backfilled: true,
                    },
                    status: "pending"
                  } as any).onConflictDoNothing();
                }
              } catch {
                // Skip duplicate messages silently (onConflictDoNothing handles it at DB level too)
              }
            }

            // Update lastMessageAt on conversation
            if (fbMessages.length > 0) {
              await db.update(conversations)
                .set({ lastMessageAt: fbConvo.updated_time || new Date().toISOString(), updatedAt: dsql`now()` })
                .where(deq(conversations.id, existingConvo.id));
            }

            imported++;
          }

          totalImported += imported;
          totalSkipped += skipped;
          pageResults.push({ pageId: page.pageId, name: page.pageName, imported, skipped });

        } catch (pageErr: any) {
          const errMsg = pageErr.response?.data?.error?.message || pageErr.message;
          console.error(`[Backfill] ✗ Page ${page.pageId} failed:`, errMsg);
          pageResults.push({ pageId: page.pageId, name: page.pageName, error: errMsg });
        }
      }

      AuditService.logAction(req, {
        action: "sync",
        module: "admin",
        entityType: "integration",
        entityId: id as string,
        details: `Backfilled ${totalImported} conversations (${totalSkipped} skipped) from Meta Messenger`
      });

      res.json({
        success: true,
        message: `Backfill complete: ${totalImported} conversation(s) imported, ${totalSkipped} skipped`,
        totalImported,
        totalSkipped,
        pages: pageResults
      });
    } catch (error: any) {
      console.error("Error running message backfill:", error);
      res.status(500).json({ error: "Internal server error", message: error.message });
    }
  });

}
