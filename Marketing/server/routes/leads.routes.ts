import type { Express } from "express";
import { db } from "../db";
import {
  marketingLeads,
  marketingUsers,
  marketingSectors,
  marketingDocuments,
  marketingActivities,
  marketingProspects,
  marketingInteractions,
} from "../../shared/schema";
import { departments } from "../../shared/adminSchema";
import {
  marketingLeadCreateSchema,
  marketingLeadUpdateSchema,
  marketingQuerySchema,
} from "../../shared/marketingSchema";
import {
  marketingAuth,
  marketingUserAuth,
} from "../middleware/marketingAuth";
import { logProjectAction } from "../middleware/comprehensiveAudit";
import { eq, and, desc, or, ilike, sql, count, inArray, isNotNull, asc } from "drizzle-orm";
import { z } from "zod";
import { AuditService } from "../services/audit-service";

export function registerLeadsRoutes(app: Express) {
  // ─── List Leads ────────────────────────────────────────────────────────────
  app.get("/api/marketing/leads", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { page, limit, search, year, sectorId, marketerId, customerType } =
        marketingQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;

      const canViewAll =
        req.marketingUser?.role === "admin" ||
        req.marketingUser?.permissions?.includes("marketing.view_all");

      let whereCondition: any = and(
        eq(marketingLeads.stage, "lead"),
        marketerId
          ? eq(marketingLeads.marketerId, marketerId)
          : canViewAll
          ? undefined
          : eq(marketingLeads.marketerId, req.marketingUser!.id)
      );

      if (search) {
        whereCondition = whereCondition
          ? and(
              whereCondition,
              or(
                ilike(marketingLeads.client, `%${search}%`),
                ilike(marketingLeads.contactPerson, `%${search}%`),
                ilike(marketingLeads.contactEmail, `%${search}%`)
              )
            )
          : or(
              ilike(marketingLeads.client, `%${search}%`),
              ilike(marketingLeads.contactPerson, `%${search}%`),
              ilike(marketingLeads.contactEmail, `%${search}%`)
            );
      }

      if (year) {
        whereCondition = whereCondition
          ? and(
              whereCondition,
              sql`EXTRACT(YEAR FROM CAST(${marketingLeads.date} AS DATE)) = ${year}`
            )
          : sql`EXTRACT(YEAR FROM CAST(${marketingLeads.date} AS DATE)) = ${year}`;
      }

      if (customerType) {
        if (customerType === "business") {
          whereCondition = whereCondition
            ? and(
                whereCondition,
                inArray(marketingLeads.customerType, ["institution", "organization", "employer"])
              )
            : inArray(marketingLeads.customerType, ["institution", "organization", "employer"]);
        } else {
          whereCondition = whereCondition
            ? and(whereCondition, eq(marketingLeads.customerType, String(customerType)))
            : eq(marketingLeads.customerType, String(customerType));
        }
      }

      if (sectorId) {
        whereCondition = whereCondition
          ? and(whereCondition, eq(marketingLeads.sectorId, String(sectorId)))
          : eq(marketingLeads.sectorId, String(sectorId));
      }

      const baseQuery = db
        .select({
          id: marketingLeads.id,
          date: marketingLeads.date,
          client: marketingLeads.client,
          contactPerson: marketingLeads.contactPerson,
          contactNumber: marketingLeads.contactNumber,
          contactEmail: marketingLeads.contactEmail,
          customerType: marketingLeads.customerType,
          remarks: marketingLeads.remarks,
          revenue: marketingLeads.revenue,
          stage: marketingLeads.stage,
          marketerId: marketingLeads.marketerId,
          sectorId: marketingLeads.sectorId,
          sharedWithMarketerId: marketingLeads.sharedWithMarketerId,
          revenueSplit: marketingLeads.revenueSplit,
          createdAt: marketingLeads.createdAt,
          updatedAt: marketingLeads.updatedAt,
          bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
          bdEmail: marketingUsers.email,
          sectorName: marketingSectors.name,
        })
        .from(marketingLeads)
        .leftJoin(marketingUsers, eq(marketingLeads.marketerId, marketingUsers.id))
        .leftJoin(marketingSectors, eq(marketingLeads.sectorId, marketingSectors.id));

      const countQuery = db.select({ count: count() }).from(marketingLeads);

      const leadsQuery = whereCondition ? baseQuery.where(whereCondition) : baseQuery;
      const totalCountQuery = whereCondition ? countQuery.where(whereCondition) : countQuery;

      const [leads, totalCount] = await Promise.all([
        leadsQuery.orderBy(desc(marketingLeads.date)).limit(limit).offset(offset),
        totalCountQuery,
      ]);

      res.json({
        leads,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          pages: Math.ceil(totalCount[0].count / limit),
        },
      });
    } catch (error) {
      console.error("Fetch leads error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Create Lead ───────────────────────────────────────────────────────────
  app.post(
    "/api/marketing/leads",
    marketingAuth,
    marketingUserAuth,
    logProjectAction("create"),
    async (req, res) => {
      try {
        const leadData = marketingLeadCreateSchema.parse(req.body);

        const newLead = await db
          .insert(marketingLeads)
          .values({
            date: leadData.date,
            client: leadData.client,
            contactPerson: leadData.contactPerson,
            contactNumber: leadData.contactNumber,
            contactEmail: leadData.contactEmail,
            customerType: leadData.customerType,
            needAvailability: leadData.needAvailability,
            currentVendor: leadData.currentVendor,
            remarks: leadData.remarks,
            revenue: leadData.revenue?.toString(),
            stage: leadData.stage,
            marketerId: req.marketingUser!.id,
            sectorId: leadData.sectorId || null,
            sourceCampaignId: leadData.sourceCampaignId || null,
          } as any)
          .returning();

        res.status(201).json({ lead: newLead[0] });

        AuditService.logAction(req, {
          action: "create",
          module: "marketing",
          entityType: "lead",
          entityId: newLead[0].id,
          newValues: newLead[0],
          details: `Created new lead for ${newLead[0].client}`,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        console.error("Create lead error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Update Lead ───────────────────────────────────────────────────────────
  app.put(
    "/api/marketing/leads/:id",
    marketingAuth,
    marketingUserAuth,
    logProjectAction("update"),
    async (req, res) => {
      try {
        const id = req.params.id as string;
        const updateData = marketingLeadUpdateSchema.parse(req.body);

        const existing = await db
          .select()
          .from(marketingLeads)
          .where(eq(marketingLeads.id, id))
          .limit(1);

        if (existing.length === 0) return res.status(404).json({ error: "Lead not found" });

        if (
          req.marketingUser!.role !== "admin" &&
          existing[0].marketerId !== req.marketingUser!.id
        ) {
          return res.status(403).json({ error: "Access denied" });
        }

        const processed: any = {
          ...updateData,
          revenue: updateData.revenue?.toString(),
          updatedAt: new Date().toISOString(),
        };

        if (updateData.bdId !== undefined) {
          processed.marketerId = updateData.bdId || null;
          delete processed.bdId;
        }

        if (processed.sectorId === "") processed.sectorId = null;
        if (processed.marketerId === "") processed.marketerId = null;

        if (req.marketingUser!.role === "admin" && updateData.marketerId) {
          processed.marketerId = updateData.marketerId;
        }

        const updated = await db
          .update(marketingLeads)
          .set(processed)
          .where(eq(marketingLeads.id, id))
          .returning();

        if (updated.length === 0) {
          return res.status(404).json({ error: "Lead not found or update failed" });
        }

        res.json({ lead: updated[0] });

        AuditService.logAction(req, {
          action: "update",
          module: "marketing",
          entityType: "lead",
          entityId: updated[0].id,
          oldValues: existing[0],
          newValues: updated[0],
          details: `Updated lead for ${updated[0].client}`,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Update Lead Stage ─────────────────────────────────────────────────────
  app.put(
    "/api/marketing/leads/:id/stage",
    marketingAuth,
    marketingUserAuth,
    async (req, res) => {
      try {
        const id = req.params.id as string;
        const { stage, revenue } = req.body;

        const existingLead = await db
          .select()
          .from(marketingLeads)
          .where(eq(marketingLeads.id, id))
          .limit(1);

        if (existingLead.length === 0) {
          return res.status(404).json({ error: "Lead not found" });
        }

        const updateData: any = { stage, updatedAt: new Date().toISOString() };
        if (revenue !== undefined) updateData.revenue = revenue.toString();

        const updatedLead = await db
          .update(marketingLeads)
          .set(updateData)
          .where(eq(marketingLeads.id, id))
          .returning();

        if (updatedLead.length === 0) {
          return res.status(404).json({ error: "Lead not found or update failed" });
        }

        res.json({ message: "Lead stage updated", lead: updatedLead[0] });
      } catch (error) {
        console.error("Update lead stage error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Promote Lead to Prospect ──────────────────────────────────────────────
  app.post(
    "/api/marketing/leads/:id/promote",
    marketingAuth,
    marketingUserAuth,
    logProjectAction("update"),
    async (req, res) => {
      try {
        const id = req.params.id as string;
        const { stage = "opportunity" } = req.body;
        const lead = await db
          .select()
          .from(marketingLeads)
          .where(eq(marketingLeads.id, id))
          .limit(1);

        if (lead.length === 0) return res.status(404).json({ error: "Lead not found" });
        const l = lead[0];

        const [prospect] = await db
          .insert(marketingProspects)
          .values({
            date: l.date,
            client: l.client,
            contactPerson: l.contactPerson,
            contactNumber: l.contactNumber,
            contactEmail: l.contactEmail,
            remarks: l.remarks,
            revenue: l.revenue,
            stage,
            marketerId: l.marketerId,
            sectorId: l.sectorId,
            customerType: l.customerType,
          } as any)
          .returning();

        await Promise.all([
          db
            .update(marketingDocuments)
            .set({ prospectId: prospect.id })
            .where(eq(marketingDocuments.leadId, id)),
          db
            .update(marketingActivities)
            .set({ prospectId: prospect.id })
            .where(eq(marketingActivities.leadId, id)),
        ]);

        await db.delete(marketingLeads).where(eq(marketingLeads.id, id));
        res.json({ message: "Lead promoted to prospect", prospect });

        AuditService.logAction(req, {
          action: "update",
          module: "marketing",
          entityType: "lead",
          entityId: id,
          details: `Promoted lead ${l.client} to prospect`,
        });
      } catch (error) {
        console.error("Promote lead error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Duplicate Check ───────────────────────────────────────────────────────
  app.get("/api/marketing/duplicates", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { client, contactEmail, contactNumber } = req.query as any;
      if (!client) return res.status(400).json({ error: "Client name is required" });

      const [existingLeads, existingProspects] = await Promise.all([
        db
          .select()
          .from(marketingLeads)
          .where(
            and(
              eq(marketingLeads.client, client),
              or(
                contactEmail ? eq(marketingLeads.contactEmail, contactEmail) : sql`false`,
                contactNumber ? eq(marketingLeads.contactNumber, contactNumber) : sql`false`
              )
            )
          )
          .limit(5),
        db
          .select()
          .from(marketingProspects)
          .where(
            and(
              eq(marketingProspects.client, client),
              or(
                contactEmail ? eq(marketingProspects.contactEmail, contactEmail) : sql`false`,
                contactNumber ? eq(marketingProspects.contactNumber, contactNumber) : sql`false`
              )
            )
          )
          .limit(5),
      ]);

      const duplicates = [
        ...existingLeads.map(l => ({ ...l, type: "lead" })),
        ...existingProspects.map(p => ({ ...p, type: "prospect" })),
      ];

      res.json({ isDuplicate: duplicates.length > 0, duplicates });
    } catch (error) {
      console.error("Duplicate check error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Public Event Validation / Slug Check ─────────────────────────────────
  app.get("/api/events/validate/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const { campaigns } = await import("../../shared/crmSchema");
      
      const eventRows = await db
        .select()
        .from(campaigns)
        .where(eq((campaigns as any).registrationSlug, slug))
        .limit(1);

      if (eventRows.length === 0) {
        return res.status(404).json({ valid: false, error: "Event not found" });
      }

      const event = eventRows[0] as any;
      return res.json({ 
        valid: true, 
        event: { 
          id: event.id, 
          name: event.name, 
          scheduledAt: event.scheduledAt, 
          venue: event.venue, 
          description: event.description 
        } 
      });
    } catch (error) {
      console.error("Event validation error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Public Event Registration ─────────────────────────────────────────────
  app.post("/api/events/register", async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        institution,
        qualificationOfInterest,
        issuesReported,
        eventSlug,
        selectedPath,
      } = req.body;

      if (!phone || !eventSlug || !selectedPath) {
        return res.status(400).json({
          error: "Required fields: phone, eventSlug, selectedPath",
        });
      }

      const { campaigns } = await import("../../shared/crmSchema");
      const eventRows = await db
        .select()
        .from(campaigns)
        .where(eq((campaigns as any).registrationSlug, eventSlug))
        .limit(1);

      if (eventRows.length === 0) {
        return res.status(404).json({ error: "Event not found" });
      }

      const event = eventRows[0] as any;
      const now = new Date().toISOString();

      if (selectedPath === "support") {
        if (!issuesReported) {
          return res.status(400).json({ error: "issuesReported is required for support desk path" });
        }

        const newInteraction = await db
          .insert(marketingInteractions)
          .values({
            campaignId: event.id,
            interactionType: "support_submit",
            metadata: {
              firstName: firstName || "",
              lastName: lastName || "",
              email: email || "",
              phone,
              institution: institution || "",
              issuesReported,
              isDispatched: false,
              createdAt: now,
            },
            createdAt: now,
          } as any)
          .returning();

        return res.status(201).json({
          message: "Support ticket recorded successfully",
          lead: { id: newInteraction[0].id, type: "support" }
        });
      } else {
        if (!qualificationOfInterest) {
          return res.status(400).json({ error: "qualificationOfInterest is required for admissions path" });
        }

        const newInteraction = await db
          .insert(marketingInteractions)
          .values({
            campaignId: event.id,
            interactionType: "admissions_submit",
            metadata: {
              firstName: firstName || "",
              lastName: lastName || "",
              email: email || "",
              phone,
              institution: institution || "",
              qualificationOfInterest,
              createdAt: now,
            },
            createdAt: now,
          } as any)
          .returning();

        return res.status(201).json({
          message: "Admission registration recorded successfully",
          lead: { id: newInteraction[0].id, type: "admissions" }
        });
      }
    } catch (error) {
      console.error("Event registration error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Backward-compatible PUT fallback
  app.put("/api/events/register/:id/issues", async (req, res) => {
    return res.json({ success: true, message: "Handled inline in unified registration." });
  });

  // ─── Forensic Desk API Endpoints ──────────────────────────────────────────
  app.get("/api/marketing/events/:id/forensics", marketingAuth, async (req, res) => {
    try {
      const eventId = req.params.id as string;
      const { campaigns } = await import("../../shared/crmSchema");

      const [event] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, eventId))
        .limit(1);

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      // Fetch admissions submissions from marketingInteractions
      const admissionsSubmissions = await db
        .select()
        .from(marketingInteractions)
        .where(
          and(
            eq(marketingInteractions.campaignId, eventId),
            eq(marketingInteractions.interactionType, "admissions_submit")
          )
        )
        .orderBy(desc(marketingInteractions.createdAt));

      // Fetch support submissions from marketingInteractions
      const supportSubmissions = await db
        .select()
        .from(marketingInteractions)
        .where(
          and(
            eq(marketingInteractions.campaignId, eventId),
            eq(marketingInteractions.interactionType, "support_submit")
          )
        )
        .orderBy(desc(marketingInteractions.createdAt));

      // Filter support submissions in memory for simplicity
      const pendingSupport = supportSubmissions.filter((sub: any) => {
        const meta = sub.metadata || {};
        return meta.isDispatched !== true;
      });

      const activeDepartments = await db
        .select()
        .from(departments)
        .where(eq(departments.isActive, true))
        .orderBy(asc(departments.name));

      const activeUsers = await db
        .select({
          id: marketingUsers.id,
          firstName: marketingUsers.firstName,
          lastName: marketingUsers.lastName,
          email: marketingUsers.email,
          departmentId: marketingUsers.departmentId,
        })
        .from(marketingUsers)
        .where(eq(marketingUsers.isActive, true))
        .orderBy(asc(marketingUsers.firstName));

      return res.json({
        event: {
          id: event.id,
          name: event.name,
          scheduledAt: event.scheduledAt,
          eventDate: event.eventDate,
          venue: event.venue,
        },
        admissions: admissionsSubmissions.map((sub: any) => ({
          id: sub.id,
          createdAt: sub.createdAt,
          ...(sub.metadata || {}),
        })),
        pendingSupport: pendingSupport.map((sub: any) => ({
          id: sub.id,
          createdAt: sub.createdAt,
          ...(sub.metadata || {}),
        })),
        departments: activeDepartments,
        users: activeUsers,
      });
    } catch (error) {
      console.error("Forensic page fetch error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/marketing/forensics/dispatch", marketingAuth, async (req, res) => {
    try {
      const { submissionId, departmentId, officerId } = req.body;

      if (!submissionId || !departmentId || !officerId) {
        return res.status(400).json({ error: "submissionId, departmentId, and officerId are required" });
      }

      const [submission] = await db
        .select()
        .from(marketingInteractions)
        .where(eq(marketingInteractions.id, submissionId))
        .limit(1);

      if (!submission) {
        return res.status(404).json({ error: "Support submission not found" });
      }

      const meta = submission.metadata as any;
      if (meta.isDispatched === true) {
        return res.status(400).json({ error: "Submission already dispatched" });
      }

      const { cases, caseHistory } = await import("../../shared/crmSchema");
      
      const prefix = "KASNEB";
      const yearShort = new Date().getFullYear().toString().slice(-2);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
      const caseNumber = `${prefix}-${yearShort}-${random}`;

      const clientName = `${meta.firstName} ${meta.lastName}`.trim() || "Outreach Attendee";
      const now = new Date().toISOString();

      const { stakeholders } = await import("../../shared/crmSchema");
      const existingStakeholder = await db
        .select()
        .from(stakeholders)
        .where(or(
          eq(stakeholders.phone, meta.phone),
          meta.email ? eq(stakeholders.email, meta.email) : undefined
        ))
        .limit(1);

      let stakeholderId = existingStakeholder[0]?.id || null;

      if (!stakeholderId) {
        const [newStakeholder] = await db
          .insert(stakeholders)
          .values({
            firstName: meta.firstName || "Outreach",
            lastName: meta.lastName || "Attendee",
            phone: meta.phone,
            email: meta.email || `${meta.phone}@kasneb-outreach.or.ke`,
            type: "student",
            status: "active",
            createdAt: now,
            updatedAt: now,
          } as any)
          .returning();
        stakeholderId = newStakeholder.id;
      }

      const [newCase] = await db
        .insert(cases)
        .values({
          caseNumber,
          title: `Forensic Issue: ${clientName}`,
          description: meta.issuesReported || "Service complaint submitted from outreach desk.",
          priority: "high",
          status: "open",
          channel: "marketing_forensic",
          assignedDepartment: departmentId,
          assignedTo: officerId,
          stakeholderId,
          assignedAt: now,
          createdAt: now,
          updatedAt: now,
          metadata: {
            sourceCampaignId: submission.campaignId,
            sourceInteractionId: submission.id,
            origin: "Event Forensic Desk",
          },
        } as any)
        .returning();

      await db.insert(caseHistory).values({
        caseId: newCase.id,
        action: "created",
        newValue: `Case created via Forensic Desk dispatch. Assigned to department ${departmentId} and officer ${officerId}.`,
        changedBy: (req as any).marketingUser?.id,
        createdAt: now,
      } as any);

      const updatedMetadata = {
        ...meta,
        isDispatched: true,
        dispatchedAt: now,
        escalatedCaseId: newCase.id,
      };

      await db
        .update(marketingInteractions)
        .set({ metadata: updatedMetadata, updatedAt: now } as any)
        .where(eq(marketingInteractions.id, submissionId));

      return res.json({
        success: true,
        message: "Support ticket successfully dispatched to the central cases workspace.",
        caseId: newCase.id,
        caseNumber,
      });
    } catch (error) {
      console.error("Forensic dispatch error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Forensic Issues Feed (BD Dashboard) ──────────────────────────────────
  app.get(
    "/api/marketing/events/:id/forensic-feed",
    marketingAuth,
    async (req, res) => {
      try {
        const eventId = req.params.id;

        const leads = await db
          .select()
          .from(marketingLeads)
          .where(
            and(
              sql`${marketingLeads.sourceCampaignId} = ${eventId}`,
              isNotNull(marketingLeads.issuesReported)
            )
          )
          .orderBy(desc(marketingLeads.createdAt));

        const grouped: Record<string, any[]> = {};
        for (const lead of leads) {
          const inst = lead.institution || "Independent / Unknown";
          if (!grouped[inst]) grouped[inst] = [];
          grouped[inst].push(lead);
        }

        const result = Object.entries(grouped)
          .map(([institution, issues]) => ({ institution, issues }))
          .sort((a, b) => a.institution.localeCompare(b.institution));

        return res.json({ feed: result });
      } catch (error) {
        console.error("Forensic feed fetch error:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Forensic Escalation: Convert Issue to Case ────────────────────────────
  app.post(
    "/api/marketing/leads/:id/escalate-to-case",
    marketingAuth,
    async (req, res) => {
      try {
        const leadId = String(req.params.id);
        const { cases, auditLogs } = await import("../../shared/crmSchema");

        const leadRows = await db
          .select()
          .from(marketingLeads)
          .where(eq(marketingLeads.id, leadId))
          .limit(1);

        if (leadRows.length === 0) return res.status(404).json({ error: "Lead not found" });
        const lead = leadRows[0];

        if (lead.isEscalatedToCase) {
          return res.status(400).json({ error: "Lead is already escalated to a case" });
        }

        const prefix = "KASNEB";
        const yearShort = new Date().getFullYear().toString().slice(-2);
        const random = Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0");
        const caseNumber = `${prefix}-${yearShort}-${random}`;

        const insertResult = await db
          .insert(cases)
          .values({
            caseNumber,
            title: `Forensic Issue: ${lead.client} (${lead.institution || "Unknown Institution"})`,
            description: `Escalated from Marketing Event Forensic Feed.\n\nReported Issue:\n${lead.issuesReported || "No qualitative feedback provided."}\n\nClient Details:\nEmail: ${lead.contactEmail}\nPhone: ${lead.contactNumber}`,
            stakeholderId: (lead as any)["stakeholderId"] || null,
            status: "open",
            priority: "high",
            channel: "marketing_forensic",
            createdBy: req.marketingUser?.id,
            metadata: {
              sourceLeadId: lead.id,
              sourceCampaignId: lead.sourceCampaignId,
              qualification: lead.qualificationOfInterest,
            },
          } as any)
          .returning();
        const newCase = (insertResult as any)[0];

        await db
          .update(marketingLeads)
          .set({
            isEscalatedToCase: true,
            escalatedCaseId: newCase.id,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(marketingLeads.id, leadId));

        await db.insert(auditLogs).values({
          userId: req.marketingUser?.id,
          userEmail: req.marketingUser?.email,
          action: "ESCALATE_LEAD_TO_CASE",
          module: "Marketing",
          entityType: "Lead",
          entityId: lead.id,
          newValues: { caseId: newCase.id, caseNumber: newCase.caseNumber },
          createdAt: new Date().toISOString(),
        } as any);

        res.json({
          message: "Escalated successfully",
          caseId: newCase.id,
          caseNumber: newCase.caseNumber,
        });
      } catch (error) {
        console.error("Escalation error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );
}
