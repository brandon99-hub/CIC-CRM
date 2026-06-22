import type { Express } from "express";
import { db } from "../db";
import { cases, stakeholders } from "../../shared/crmSchema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { SegmentationService } from "../services/segmentation-service";
import { DiscoveryService } from "../services/discovery-service";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "marketing-pipeline-secret-key";

interface SatisfactionPayload {
  caseId: string;
  stakeholderId: string;
}

export function registerSatisfactionRoutes(app: Express) {
  /**
   * GET /api/satisfaction/rate/:token
   * Public endpoint — validates JWT and returns case info for the rating page.
   */
  app.get("/api/satisfaction/rate/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const decoded = jwt.verify(token, JWT_SECRET) as SatisfactionPayload;

      const [caseData] = await db.select({
        id: cases.id,
        caseNumber: cases.caseNumber,
        title: cases.title,
        satisfactionRating: cases.satisfactionRating,
      }).from(cases).where(eq(cases.id, decoded.caseId)).limit(1);

      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      if (caseData.satisfactionRating) {
        return res.json({ alreadyRated: true, caseNumber: caseData.caseNumber });
      }

      res.json({
        caseId: caseData.id,
        caseNumber: caseData.caseNumber,
        title: caseData.title,
        alreadyRated: false,
      });
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        return res.status(410).json({ error: "This rating link has expired" });
      }
      console.error("[Satisfaction] Token validation error:", error);
      res.status(400).json({ error: "Invalid or expired rating link" });
    }
  });

  /**
   * POST /api/satisfaction/rate/:token
   * Public endpoint — submits rating + optional feedback.
   */
  app.post("/api/satisfaction/rate/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const decoded = jwt.verify(token, JWT_SECRET) as SatisfactionPayload;
      const { rating, feedback } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }

      // Check if already rated
      const [existing] = await db.select({ satisfactionRating: cases.satisfactionRating })
        .from(cases).where(eq(cases.id, decoded.caseId)).limit(1);

      if (existing?.satisfactionRating) {
        return res.status(409).json({ error: "This case has already been rated" });
      }

      // Write the rating
      await db.update(cases).set({
        satisfactionRating: rating,
        satisfactionFeedback: feedback || null,
      }).where(eq(cases.id, decoded.caseId));

      // ── Real-Time Intelligence ──────────────────────────────────────────────
      // Re-evaluate stakeholder segments now that we have satisfaction data
      SegmentationService.evaluateStakeholder(decoded.stakeholderId).catch(err =>
        console.error(`[Segmentation] Deferred error after rating for ${decoded.stakeholderId}:`, err)
      );

      console.log(`[Satisfaction] Case ${decoded.caseId} rated ${rating}/5 by stakeholder ${decoded.stakeholderId}`);

      res.json({ success: true, message: "Thank you for your feedback!" });
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        return res.status(410).json({ error: "This rating link has expired" });
      }
      console.error("[Satisfaction] Rating submission error:", error);
      res.status(400).json({ error: "Invalid or expired rating link" });
    }
  });

}

// Standalone token generator for use outside routes
export function generateSatisfactionToken(caseId: string, stakeholderId: string): string {
  return jwt.sign(
    { caseId, stakeholderId } as SatisfactionPayload,
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}
