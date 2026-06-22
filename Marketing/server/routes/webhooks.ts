import express from "express";
import crypto from "crypto";
import { MetaWebhookService } from "../services/meta-webhook.service";
import { MetaDeletionService } from "../services/meta-deletion.service";
import { db } from "../db";
import { dataDeletionRequests } from "../../shared/commsSchema";
import { eq } from "drizzle-orm";

const router = express.Router();

// Meta GET Verification Challenge
router.get("/api/webhooks/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    console.log("Meta Webhook Verified");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Meta Webhook Inbound Events (POST)
// Use express.raw to preserve exact payload for HMAC signature validation
router.post(
  "/api/webhooks/meta",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const signature = req.headers["x-hub-signature-256"] as string;
    if (!signature) {
      console.warn("Missing Meta Webhook Signature");
      return res.status(401).send("Missing signature");
    }

    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      console.error("META_APP_SECRET is not configured");
      return res.status(500).send("Internal Configuration Error");
    }

    const hmac = crypto.createHmac("sha256", appSecret);
    const digest = "sha256=" + hmac.update(req.body).digest("hex");

    // Avoid throwing an error if the lengths don't match; pad or handle
    const sigBuffer = Buffer.from(signature);
    const digestBuffer = Buffer.from(digest);
    if (sigBuffer.length !== digestBuffer.length || !crypto.timingSafeEqual(sigBuffer, digestBuffer)) {
      console.warn("Invalid Meta Webhook Signature");
      return res.status(401).send("Invalid signature");
    }

    // Process event asynchronously to prevent Meta's 20-second timeout
    try {
      const payloadString = req.body.toString("utf8");
      const payload = JSON.parse(payloadString);

      MetaWebhookService.processEvent(payload).catch((err: any) => {
        console.error("MetaWebhookService async error:", err);
      });

    } catch (e) {
      console.error("Failed to parse Meta webhook JSON payload");
      return res.status(400).send("Invalid JSON");
    }

    // Always return 200 OK immediately for valid signed requests
    res.status(200).send("EVENT_RECEIVED");
  }
);

// Meta Data Deletion Request Endpoint (POST)
router.post(
  "/api/webhooks/meta/data-deletion",
  express.urlencoded({ extended: true }),
  async (req, res) => {
    const signedRequest = req.body.signed_request;
    if (!signedRequest) {
      return res.status(400).send("Missing signed_request");
    }

    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      console.error("META_APP_SECRET is not configured for data deletion");
      return res.status(500).send("Internal Configuration Error");
    }

    try {
      const [encodedSig, encodedPayload] = signedRequest.split(".");
      if (!encodedSig || !encodedPayload) {
        return res.status(400).send("Malformed signed_request");
      }

      // Base64url decode
      const sigBuffer = Buffer.from(encodedSig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
      const payloadString = Buffer.from(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
      
      // Verify signature
      const hmac = crypto.createHmac("sha256", appSecret);
      const expectedSigBuffer = hmac.update(encodedPayload).digest();

      if (sigBuffer.length !== expectedSigBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
        console.warn("Invalid Meta Data Deletion Signature");
        return res.status(401).send("Invalid signature");
      }

      const payload = JSON.parse(payloadString);
      const userId = payload.user_id;
      
      if (!userId) {
        return res.status(400).send("Missing user_id in payload");
      }

      // Generate confirmation code and save to DB
      const record = await db.insert(dataDeletionRequests).values({
        userId,
        status: "processing",
      }).returning();

      const confirmationCode = record[0].confirmationCode;
      
      // Send response immediately to Meta
      const baseUrl = process.env.NODE_ENV === "production" 
        ? "https://kasneb-crm.onrender.com" 
        : `http://${req.get("host")}`;
        
      res.status(200).json({
        url: `${baseUrl}/api/data-deletion/status/${confirmationCode}`,
        confirmation_code: confirmationCode
      });

      // Process deletion asynchronously
      MetaDeletionService.processDataDeletion(userId, record[0].id).catch(err => {
        console.error("Error in background deletion task:", err);
      });

    } catch (error) {
      console.error("Error processing Meta data deletion request:", error);
      res.status(400).send("Invalid request format");
    }
  }
);

// Meta Data Deletion Status Endpoint (GET)
router.get("/api/data-deletion/status/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const records = await db.select()
      .from(dataDeletionRequests)
      .where(eq(dataDeletionRequests.confirmationCode, code as string))
      .limit(1);

    if (records.length === 0) {
      return res.status(404).send("Confirmation code not found");
    }

    res.status(200).json({
      confirmation_code: records[0].confirmationCode,
      status: records[0].status
    });
  } catch (error) {
    console.error("Error checking data deletion status:", error);
    res.status(500).send("Internal Server Error");
  }
});

export default router;
