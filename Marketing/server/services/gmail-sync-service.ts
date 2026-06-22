import { google } from "googleapis";
import { db } from "../db";
import { integrationConfigs, auditLogs, stakeholders, intakeSignals } from "../../shared/crmSchema";
import { serviceCategories } from "../../shared/adminSchema";
import { conversations, messages } from "../../shared/commsSchema";
import { SecurityService } from "./security-service";
import { eq, sql, and } from "drizzle-orm";

export class GmailSyncService {
  /**
   * Syncs emails for a given integration ID.
   * This is meant to be called by a cron job or manual trigger.
   */
  static async syncIntegration(integrationId: string) {
    try {
      const config = await db.query.integrationConfigs.findFirst({
        where: eq(integrationConfigs.id, integrationId),
      });

      if (!config) throw new Error("Integration not found");
      if (!config.apiKey) {
        console.warn(`[GmailSync] Missing API key/refresh token for integration ${integrationId}. Setting to pending_auth.`);
        await db.update(integrationConfigs).set({ syncStatus: "pending_auth" }).where(eq(integrationConfigs.id, integrationId));
        return { imported: 0 };
      }

      const refreshToken = SecurityService.decrypt(config.apiKey);
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      // Fetch user profile to know the integration's own email address
      const profile = await gmail.users.getProfile({ userId: "me" });
      const myEmail = profile.data.emailAddress;

      // Search for unread emails in Inbox
      const response = await gmail.users.messages.list({
        userId: "me",
        q: "is:unread in:inbox",
        maxResults: 50
      });

      const messageList = response.data.messages || [];
      let imported = 0;

      for (const msgInfo of messageList) {
        if (!msgInfo.id) continue;

        const msgDetails = await gmail.users.messages.get({
          userId: "me",
          id: msgInfo.id,
          format: "full"
        });

        const payload = msgDetails.data.payload;
        if (!payload || !payload.headers) continue;

        const headers = payload.headers;
        const subjectHeader = headers.find(h => h.name?.toLowerCase() === "subject")?.value || "(No Subject)";
        const fromHeader = headers.find(h => h.name?.toLowerCase() === "from")?.value || "";
        const dateHeader = headers.find(h => h.name?.toLowerCase() === "date")?.value;

        // Parse From header: "Name <email@domain.com>" or just "email@domain.com"
        const emailMatch = fromHeader.match(/<([^>]+)>/);
        const senderEmail = emailMatch ? emailMatch[1] : fromHeader;
        const senderName = fromHeader.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || senderEmail;

        if (!senderEmail || senderEmail === myEmail) {
          continue; // Skip emails sent from ourselves in the inbox or invalid
        }

        // Get body
        let body = "";
        if (payload.parts && payload.parts.length > 0) {
          // Look for text/plain or text/html
          const textPart = payload.parts.find(p => p.mimeType === "text/plain") || payload.parts.find(p => p.mimeType === "text/html");
          if (textPart && textPart.body?.data) {
            body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
          } else if (payload.parts[0].parts) {
            // Nested multipart (e.g., multipart/alternative inside multipart/mixed)
            const nestedTextPart = payload.parts[0].parts.find((p: any) => p.mimeType === "text/plain") || payload.parts[0].parts.find((p: any) => p.mimeType === "text/html");
            if (nestedTextPart && nestedTextPart.body?.data) {
              body = Buffer.from(nestedTextPart.body.data, "base64").toString("utf-8");
            }
          }
        } else if (payload.body?.data) {
           body = Buffer.from(payload.body.data, "base64").toString("utf-8");
        }

        // 1. Ensure Stakeholder Profile Exists
        const { and } = await import("drizzle-orm");
        let stakeholder = await db.query.stakeholders.findFirst({
          where: eq(stakeholders.email, senderEmail),
        });

        if (!stakeholder) {
           const [newStakeholder] = await db.insert(stakeholders).values({
             type: "individual", // Default
             firstName: senderName.split(' ')[0] || senderName,
             lastName: senderName.split(' ').slice(1).join(' ') || "Unknown",
             email: senderEmail,
             isActive: true
           }).returning();
           stakeholder = newStakeholder;
        }

        const externalConvoId = `email_${senderEmail}`;
        const channel = "email";
        const msgTime = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();

        // 2. Ensure Conversation Exists
        let existingConvo = await db.query.conversations.findFirst({
          where: and(
            eq(conversations.externalConversationId, externalConvoId),
            eq(conversations.channel, channel)
          ),
        });

        if (!existingConvo) {
          const [inserted] = await db.insert(conversations).values({
            channel,
            externalConversationId: externalConvoId,
            stakeholderId: stakeholder.id,
            status: "new",
            metadata: { 
              platform: "email", 
              subject: subjectHeader, 
              integrationId,
              myEmail,
              senderName,  // store for name display in ChatWindow
            },
            lastMessageAt: msgTime,
          }).returning();
          existingConvo = inserted;
        }

        // 3. Insert Message
        try {
          await db.insert(messages).values({
            conversationId: existingConvo.id,
            direction: "inbound",
            contentType: "text",
            body: body || "*(Empty body)*",
            externalMessageId: msgDetails.data.id || msgInfo.id,
            createdAt: msgTime,
            metadata: { subject: subjectHeader }
          } as any).onConflictDoNothing();
          
          imported++;

          // Mark email as read in Gmail so we don't process it again
          await gmail.users.messages.modify({
             userId: "me",
             id: msgInfo.id,
             requestBody: {
               removeLabelIds: ["UNREAD"]
             }
          });

          // Update lastMessageAt on conversation
          await db.update(conversations)
            .set({ lastMessageAt: msgTime, updatedAt: sql`now()` })
            .where(eq(conversations.id, existingConvo.id));


        } catch (e) {
          console.error("Failed to insert message:", e);
        }
      }

      // Update sync status
      await db.update(integrationConfigs).set({
        lastSyncedAt: sql`now()`,
        syncStatus: "success",
      }).where(eq(integrationConfigs.id, integrationId));

      return { imported };

    } catch (error: any) {
      console.error(`Gmail Sync failed for integration ${integrationId}:`, error);
      await db.update(integrationConfigs).set({
        syncStatus: "failed",
      }).where(eq(integrationConfigs.id, integrationId));
      throw error;
    }
  }

  /**
   * Sends an email via the Gmail API
   */
  static async sendEmail(integrationId: string, toEmail: string, subject: string, htmlBody: string) {
     const config = await db.query.integrationConfigs.findFirst({
        where: eq(integrationConfigs.id, integrationId),
     });

     if (!config) throw new Error("Integration not found");
     if (!config.apiKey) throw new Error("No refresh token (apiKey) stored for this integration");

     const refreshToken = SecurityService.decrypt(config.apiKey);
      
     const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
     );

     oauth2Client.setCredentials({ refresh_token: refreshToken });

     const gmail = google.gmail({ version: "v1", auth: oauth2Client });

     // Construct RFC 2822 email
     const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
     const messageParts = [
       `To: ${toEmail}`,
       `Subject: ${utf8Subject}`,
       "Content-Type: text/html; charset=utf-8",
       "MIME-Version: 1.0",
       "",
       htmlBody
     ];
     const message = messageParts.join('\n');
     const encodedMessage = Buffer.from(message)
       .toString('base64')
       .replace(/\+/g, '-')
       .replace(/\//g, '_')
       .replace(/=+$/, '');

     const res = await gmail.users.messages.send({
       userId: "me",
       requestBody: {
         raw: encodedMessage
       }
     });

     return res.data;
  }
}
