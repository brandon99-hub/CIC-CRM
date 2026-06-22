import type { Express } from "express";
import { db } from "../db";
import crypto from "crypto";
import { marketingAuth, checkPermission } from "../middleware/marketingAuth";
import { campaigns, feedbackSurveys, feedbackResponses, communications, stakeholders } from "../../shared/crmSchema";
import { marketingLeads, marketingProspects, marketingSalesWon, marketingInteractions } from "../../shared/schema";
import { eq, desc, sql, count, and, or, ilike } from "drizzle-orm";
import { AuditService } from "../services/audit-service";

export function registerCommunicationRoutes(app: Express) {

  // Postgres-JSONB optimized real-time stakeholder segment counts helper
  async function getMatchingStakeholderCount(targetAudience: any) {
    if (!targetAudience) return 0;
    const { segment, stakeholderType } = targetAudience;

    const conditions: any[] = [eq(stakeholders.isActive, true)];

    if (stakeholderType && stakeholderType !== "all") {
      conditions.push(eq(stakeholders.type, stakeholderType));
    }

    if (segment && segment !== "all") {
      conditions.push(sql`${stakeholders.tags} @> ${JSON.stringify([segment])}::jsonb`);
    }

    const countResult = await db
      .select({ count: count() })
      .from(stakeholders)
      .where(and(...conditions));

    return countResult[0]?.count || 0;
  }

  // Campaigns
  app.get("/api/campaigns", marketingAuth, checkPermission("marketing.view_campaigns"), async (req, res) => {
    try {
      const status = req.query.status as string;
      const search = req.query.search as string;
      const page = req.query.page as string || "1";
      const limit = req.query.limit as string || "10";
      
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      const conditions: any[] = [];
      if (status && status !== "all") {
        conditions.push(eq(campaigns.status, status));
      }
      if (search) {
        conditions.push(or(
          ilike(campaigns.name, `%${search}%`),
          ilike(campaigns.subject, `%${search}%`),
          ilike(campaigns.content, `%${search}%`)
        ));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await db
        .select()
        .from(campaigns)
        .where(whereClause)
        .orderBy(desc(campaigns.createdAt))
        .limit(parseInt(limit))
        .offset(offset);

      const totalResult = await db
        .select({ total: count() })
        .from(campaigns)
        .where(whereClause);
      
      const total = totalResult[0].total;

      const campaignsWithCounts = await Promise.all(
        results.map(async (campaign) => {
          let currentCampaign = { ...campaign };
          if (campaign.type === "event" && !campaign.registrationSlug) {
            const generatedSlug = campaign.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "") + "-" + Math.floor(1000 + Math.random() * 9000);
            
            await db
              .update(campaigns)
              .set({ registrationSlug: generatedSlug })
              .where(eq(campaigns.id, campaign.id));
              
            currentCampaign.registrationSlug = generatedSlug;
          }
          
          const matchingCount = await getMatchingStakeholderCount(currentCampaign.targetAudience);
          return {
            ...currentCampaign,
            totalRecipients: matchingCount
          };
        })
      );

      res.json({ 
        campaigns: campaignsWithCounts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  function sanitizeCampaignData(data: any) {
    const sanitized = { ...data };
    
    const numFields = ["budget", "actualCost", "requestedAmount", "expectedCapacity"];
    numFields.forEach((field) => {
      if (sanitized[field] === "" || sanitized[field] === undefined || sanitized[field] === null) {
        sanitized[field] = null;
      } else {
        const parsed = parseInt(sanitized[field], 10);
        sanitized[field] = isNaN(parsed) ? null : parsed;
      }
    });

    const dateFields = ["eventDate", "scheduledAt"];
    dateFields.forEach((field) => {
      if (sanitized[field] === "" || sanitized[field] === undefined || sanitized[field] === null) {
        sanitized[field] = null;
      }
    });

    if (sanitized.type === "event" && !sanitized.registrationSlug) {
      sanitized.registrationSlug = sanitized.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") + "-" + Math.floor(1000 + Math.random() * 9000);
    }

    return sanitized;
  }

  app.post("/api/campaigns", marketingAuth, checkPermission("marketing.create_campaigns"), async (req, res) => {
    try {
      const data = sanitizeCampaignData(req.body);
      const newCampaign = await db
        .insert(campaigns)
        .values(data as any)
        .returning();
      
      let campaign = newCampaign[0];

      // Post-process content to replace placeholder with real ID if present
      if (campaign.content?.includes("{{ID}}")) {
        const updatedContent = campaign.content.replace(/{{ID}}/g, campaign.id);
        await db.update(campaigns).set({ content: updatedContent }).where(eq(campaigns.id, campaign.id));
        campaign = { ...campaign, content: updatedContent };
      }

      res.status(201).json({ campaign });

      // Log campaign creation
      AuditService.logAction(req, {
        action: 'create',
        module: 'communications',
        entityType: 'campaign',
        entityId: campaign.id,
        newValues: campaign,
        details: `Created new campaign: ${campaign.name}`
      });
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/campaigns/:id", marketingAuth, checkPermission("marketing.create_campaigns"), async (req, res) => {
    try {
      const { id } = req.params;
      const data = sanitizeCampaignData(req.body);
      const updated = await db
        .update(campaigns)
        .set({ ...data, updatedAt: sql`now()` } as any)
        .where(eq(campaigns.id, id as string))
        .returning();
      res.json({ campaign: updated[0] });

      // Log campaign update
      AuditService.logAction(req, {
        action: 'update',
        module: 'communications',
        entityType: 'campaign',
        entityId: updated[0].id,
        newValues: updated[0],
        details: `Updated campaign: ${updated[0].name}`
      });
    } catch (error) {
      console.error("Error updating campaign:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/campaigns/:id", marketingAuth, checkPermission("marketing.create_campaigns"), async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(campaigns).where(eq(campaigns.id, id as string));
      res.json({ success: true });

      // Log campaign deletion
      AuditService.logAction(req, {
        action: 'delete',
        module: 'communications',
        entityType: 'campaign',
        entityId: id as string,
        details: `Deleted campaign ID: ${id}`
      });
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Campaign ROI & Performance
  app.get("/api/campaigns/:id/roi", marketingAuth, checkPermission("marketing.view_roi"), async (req, res) => {
    try {
      const id = req.params.id as string;
      // 1. Get Campaign Financials
      const campaignData = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, id))
        .limit(1);

      if (campaignData.length === 0) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const campaign = campaignData[0];
      const budget = parseFloat(campaign.budget || "0");
      const actualCost = parseFloat(campaign.actualCost || "0");
      const costBasis = actualCost > 0 ? actualCost : budget;

      // 2. Get Attributed Metrics
      const [leads, prospects, salesWon, interactions] = await Promise.all([
        db.select({ count: count() }).from(marketingLeads).where(eq(marketingLeads.sourceCampaignId, id)),
        db.select({ count: count() }).from(marketingProspects).where(eq(marketingProspects.sourceCampaignId, id)),
        db.select().from(marketingSalesWon).where(eq(marketingSalesWon.sourceCampaignId, id)),
        db.select({ count: count() }).from(marketingInteractions).where(eq(marketingInteractions.campaignId, id))
      ]);

      // 3. Parallel B2C Student Bookings Query
      const b2cBookingsRaw = await db
        .select()
        .from(marketingProspects)
        .where(
          and(
            eq(marketingProspects.sourceCampaignId, id),
            eq(marketingProspects.stage, "prospect_booking"),
            eq(marketingProspects.customerType, "student")
          )
        );

      // Trailing 180 Days check in JS for robust database-agnostic safety
      const campaignDateStr = campaign.scheduledAt || campaign.eventDate || campaign.createdAt;
      const campaignDate = campaignDateStr ? new Date(campaignDateStr) : new Date();
      const trailingLimitTime = campaignDate.getTime() + 180 * 24 * 60 * 60 * 1000;

      const qualifyingB2CBookings = b2cBookingsRaw.filter(booking => {
        const bookingTime = booking.createdAt ? new Date(booking.createdAt).getTime() : 0;
        return bookingTime > 0 && bookingTime <= trailingLimitTime;
      });

      const b2cRevenue = qualifyingB2CBookings.reduce((sum, booking) => {
        const bookingAmt = parseFloat(booking.revenue?.replace(/[^0-9.]/g, '') || "0");
        return sum + bookingAmt;
      }, 0);

      // Calculate B2B Corporate Revenue
      const b2bRevenue = salesWon.reduce((sum, sale) => {
          const amount = parseFloat(sale.contractAmount?.replace(/[^0-9.]/g, '') || "0");
          return sum + amount;
      }, 0);

      const totalRevenue = b2bRevenue + b2cRevenue;

      const leadCount = leads[0]?.count || 0;
      const prospectCount = prospects[0]?.count || 0;
      // Total won conversions count = B2B Sales Won + B2C Student Bookings
      const wonCount = salesWon.length + qualifyingB2CBookings.length;
      const clickCount = interactions[0]?.count || 0;

      // 4. ROI & Conversion Calculations
      const roi = costBasis > 0 ? ((totalRevenue - costBasis) / costBasis) * 100 : 0;
      const conversionRate = leadCount > 0 ? (wonCount / leadCount) * 100 : 0;
      const clickToLeadRate = clickCount > 0 ? (leadCount / clickCount) * 100 : 0;

      res.json({
        campaignId: id,
        campaignName: campaign.name,
        metrics: {
          budget,
          actualCost,
          totalRevenue,
          roi: Math.round(roi * 100) / 100,
          counts: {
            clicks: clickCount,
            leads: leadCount,
            prospects: prospectCount,
            salesWon: wonCount
          },
          conversionRate: Math.round(conversionRate * 100) / 100,
          ctr: Math.round(clickToLeadRate * 100) / 100
        }
      });

    } catch (error) {
      console.error("Error calculating Campaign ROI:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Feedback Surveys
  app.get("/api/surveys", marketingAuth, checkPermission("marketing.view_surveys"), async (req, res) => {
    try {
      const search = req.query.search as string;
      const page = req.query.page as string || "1";
      const limit = req.query.limit as string || "10";
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const conditions: any[] = [];
      if (search) {
        conditions.push(or(
          ilike(feedbackSurveys.name, `%${search}%`),
          ilike(feedbackSurveys.description, `%${search}%`)
        ));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await db
        .select()
        .from(feedbackSurveys)
        .where(whereClause)
        .orderBy(desc(feedbackSurveys.createdAt))
        .limit(parseInt(limit))
        .offset(offset);

      const totalResult = await db
        .select({ total: count() })
        .from(feedbackSurveys)
        .where(whereClause);
      
      const total = totalResult[0].total;

      res.json({ 
        surveys: results,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error("Error fetching surveys:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/surveys", marketingAuth, checkPermission("marketing.create_surveys"), async (req, res) => {
    try {
      const data = req.body;
      const newSurvey = await db
        .insert(feedbackSurveys)
        .values(data as any)
        .returning();
      res.status(201).json({ survey: newSurvey[0] });

      // Log survey creation
      AuditService.logAction(req, {
        action: 'create',
        module: 'communications',
        entityType: 'survey',
        entityId: newSurvey[0].id,
        newValues: newSurvey[0],
        details: `Created new survey: ${newSurvey[0].name}`
      });
    } catch (error) {
      console.error("Error creating survey:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/surveys/:id", marketingAuth, checkPermission("marketing.create_surveys"), async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const updated = await db
        .update(feedbackSurveys)
        .set({ ...data, updatedAt: sql`now()` } as any)
        .where(eq(feedbackSurveys.id, id as string))
        .returning();
      res.json({ survey: updated[0] });

      // Log survey update
      AuditService.logAction(req, {
        action: 'update',
        module: 'communications',
        entityType: 'survey',
        entityId: updated[0].id,
        newValues: updated[0],
        details: `Updated survey: ${updated[0].name}`
      });
    } catch (error) {
      console.error("Error updating survey:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/surveys/:id/responses", marketingAuth, checkPermission("marketing.create_surveys"), async (req, res) => {
    try {
      const { id } = req.params;
      const data = { ...req.body, surveyId: id };
      const newResponse = await db
        .insert(feedbackResponses)
        .values(data as any)
        .returning();

      await db
        .update(feedbackSurveys)
        .set({ totalResponses: sql`total_responses + 1`, updatedAt: sql`now()` } as any)
        .where(eq(feedbackSurveys.id, id as string));

      res.status(201).json({ response: newResponse[0] });
    } catch (error) {
      console.error("Error creating survey response:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/surveys/:id/responses", marketingAuth, checkPermission("marketing.create_surveys"), async (req, res) => {
    try {
      const { id } = req.params;
      const results = await db
        .select()
        .from(feedbackResponses)
        .where(eq(feedbackResponses.surveyId, id as string))
        .orderBy(desc(feedbackResponses.createdAt));
      res.json({ responses: results });
    } catch (error) {
      console.error("Error fetching survey responses:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Communications log
  app.get("/api/communications", marketingAuth, async (req, res) => {
    try {
      const channel = req.query.channel as string;
      const direction = req.query.direction as string;
      const page = req.query.page as string || "1";
      const limit = req.query.limit as string || "50";
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const conditions: any[] = [];
      if (channel) conditions.push(eq(communications.channel, channel));
      if (direction) conditions.push(eq(communications.direction, direction));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await db
        .select()
        .from(communications)
        .where(whereClause)
        .orderBy(desc(communications.createdAt))
        .limit(parseInt(limit))
        .offset(offset);

      const totalResult = await db
        .select({ total: count() })
        .from(communications)
        .where(whereClause);
      
      const total = totalResult[0].total;

      res.json({ 
        communications: results,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error("Error fetching communications:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/communications", marketingAuth, async (req, res) => {
    try {
      const data = req.body;
      const newComm = await db
        .insert(communications)
        .values(data as any)
        .returning();
      res.status(201).json({ communication: newComm[0] });
    } catch (error) {
      console.error("Error creating communication:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Tracking Redirect
  app.get("/api/track/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const sid = req.query.sid as string; // Stakeholder ID
      const sig = req.query.sig as string;

      if (process.env.TRACKING_SECRET) {
        if (!sig) return res.status(400).send("Invalid tracking link");
        const expectedSig = crypto.createHmac("sha256", process.env.TRACKING_SECRET)
          .update(`${id}:${sid || ''}`)
          .digest("hex")
          .slice(0, 16);
        if (sig !== expectedSig) return res.status(400).send("Invalid tracking signature");
      }

      // Fetch campaign to verify and get type
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, id as string))
        .limit(1);

      if (!campaign) {
        return res.status(404).send("Campaign not found");
      }

      // Log interaction
      await db.insert(marketingInteractions).values({
        campaignId: id as string,
        stakeholderId: sid || null,
        interactionType: 'click',
        metadata: {
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString()
        },
        ipAddress: req.ip as string,
        userAgent: req.headers['user-agent'] as string
      });

      // Update campaign click count
      await db
        .update(campaigns)
        .set({ clicked: (campaign.clicked || 0) + 1 })
        .where(eq(campaigns.id, id as string));

      // Resolve redirect URL
      const host = req.get('host');
      const protocol = req.protocol;
      const baseUrl = process.env.VITE_APP_URL || process.env.FRONTEND_URL || `${protocol}://${host}`;
      
      // Determine landing page based on campaign type
      let landingPath = "/marketing/campaign-landing";
      
      let redirectUrl = `${baseUrl}${landingPath}/${id}`;
      if (sid) {
        redirectUrl += `?sid=${sid}`;
      }

      res.redirect(redirectUrl);
    } catch (error) {
      console.error("Error in tracking redirect:", error);
      res.status(500).send("Tracking error");
    }
  });

  // Public Campaign Data (for landing pages)
  app.get("/api/public/campaigns/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [campaign] = await db
        .select({
          id: campaigns.id,
          name: campaigns.name,
          type: campaigns.type,
          subject: campaigns.subject,
          content: campaigns.content,
          scheduledAt: campaigns.scheduledAt,
        })
        .from(campaigns)
        .where(eq(campaigns.id, id as string))
        .limit(1);

      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      res.json(campaign);
    } catch (error) {
      console.error("Error fetching public campaign:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
