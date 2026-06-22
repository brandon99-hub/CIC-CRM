import type { Express } from "express";
import { db } from "../db";
import { integrationConfigs, stakeholders, cases, intakeSignals } from "../../shared/crmSchema";
import { conversations, messages } from "../../shared/commsSchema";
import { serviceCategories } from "../../shared/adminSchema";
import { eq, sql, and } from "drizzle-orm";
import { screenInboundMessage } from "../routes/ai";

export function registerWhatsappWebhookRoutes(app: Express) {
  // Webhook Verification Endpoint
  app.get("/api/webhooks/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (mode && token) {
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(400);
    }
  });

  // Webhook Event Endpoint
  app.post("/api/webhooks/whatsapp", async (req, res) => {
    // Always respond 200 immediately to Meta so it doesn't retry
    res.sendStatus(200);

    try {
      const body = req.body;

      if (body.object !== "whatsapp_business_account") return;

      for (const entry of body.entry) {
        const changes = entry.changes;
        for (const change of changes) {
          if (!change.value?.messages) continue;

          const phoneNumberId = change.value.metadata.phone_number_id;
          const msg = change.value.messages[0];
          const contact = change.value.contacts?.[0];

          if (!msg) continue;

          const senderPhone = msg.from;
          const senderName = contact?.profile?.name || "WhatsApp User";
          const messageText = msg.text?.body || "(Non-text message)";
          const metaMsgId = msg.id;

          // Find the integration associated with this phone number ID
          const [integration] = await db
            .select()
            .from(integrationConfigs)
            .where(eq(integrationConfigs.clientId, phoneNumberId));

          if (!integration) {
            console.error(`[WhatsApp] No integration found for Phone Number ID: ${phoneNumberId}`);
            continue;
          }

          // 1. Find or create stakeholder by phone
          const matchedStakeholders = await db
            .select()
            .from(stakeholders)
            .where(eq(stakeholders.phone, `+${senderPhone}`));

          let stakeholder = matchedStakeholders[0];

          if (!stakeholder) {
            const nameParts = senderName.split(" ");
            const [newStakeholder] = await db.insert(stakeholders).values({
              type: "individual",
              firstName: nameParts[0] || "WhatsApp",
              lastName: nameParts.slice(1).join(" ") || "User",
              phone: `+${senderPhone}`,
              isActive: true,
              preferredChannel: "whatsapp"
            }).returning();
            stakeholder = newStakeholder;
          } else if (
            (stakeholder.firstName === "Unknown" || stakeholder.firstName === "WhatsApp") &&
            senderName !== "WhatsApp User"
          ) {
            // Update stakeholder name if we now have a real name
            const nameParts = senderName.split(" ");
            await db.update(stakeholders)
              .set({
                firstName: nameParts[0],
                lastName: nameParts.slice(1).join(" ") || stakeholder.lastName,
              })
              .where(eq(stakeholders.id, stakeholder.id));
          }

          // 2. Find or create conversation
          const externalConvoId = `wa_${senderPhone}`;
          const activeConvos = await db
            .select()
            .from(conversations)
            .where(eq(conversations.externalConversationId, externalConvoId));

          let conversation = activeConvos.find(c => c.status !== "closed");

          if (!conversation) {
            const [newConvo] = await db.insert(conversations).values({
              stakeholderId: stakeholder.id,
              channel: "whatsapp",
              externalConversationId: externalConvoId,
              status: "new",
              metadata: {
                integrationId: integration.id,
                senderName,
                subject: `WhatsApp Conversation with ${senderName}`,
                priority: "medium"
              }
            }).returning();
            conversation = newConvo;
          } else {
            // Patch existing conversations that may be missing integrationId or senderName
            const existingMeta: any = conversation.metadata || {};
            const needsPatch = !existingMeta.integrationId || !existingMeta.senderName;
            if (needsPatch) {
              const patchedMeta = {
                ...existingMeta,
                integrationId: existingMeta.integrationId || integration.id,
                senderName: existingMeta.senderName || senderName,
              };
              await db.update(conversations)
                .set({ metadata: patchedMeta, updatedAt: sql`now()` })
                .where(eq(conversations.id, conversation.id));
              conversation = { ...conversation, metadata: patchedMeta };
              console.log(`[WhatsApp] Patched metadata for conversation ${conversation.id}`);
            }
          }

          // 3. Insert the inbound message (idempotent)
          await db.insert(messages).values({
            conversationId: conversation.id,
            direction: "inbound",
            contentType: "text",
            body: messageText,
            externalMessageId: metaMsgId,
            createdAt: sql`now()`
          }).onConflictDoNothing();

          // 4. Update conversation status to open
          await db.update(conversations)
            .set({ status: "open", updatedAt: sql`now()`, lastMessageAt: sql`now()` })
            .where(eq(conversations.id, conversation.id));


        }
      }
    } catch (error) {
      console.error("[WhatsApp] Error processing webhook:", error);
    }
  });
}
