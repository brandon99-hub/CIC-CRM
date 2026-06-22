import type { Express } from "express";
import { db } from "../db";
import {
  marketingProspects,
  marketingLeads,
  marketingUsers,
  marketingSectors,
  marketingSalesWon,
  marketingDocuments,
  marketingActivities,
  marketingLostProjects,
  marketingExpectedOrders,
} from "../../shared/schema";
import { intakeSignals } from "../../shared/crmSchema";
import {
  marketingProspectCreateSchema,
  marketingProspectUpdateSchema,
  marketingSharedAccountSchema,
  marketingQuerySchema,
} from "../../shared/marketingSchema";
import { marketingAuth, marketingUserAuth } from "../middleware/marketingAuth";
import { logProjectAction } from "../middleware/comprehensiveAudit";
import { eq, and, desc, or, ilike, sql, count, inArray } from "drizzle-orm";
import { z } from "zod";
import { AuditService } from "../services/audit-service";
import { emailService } from "../services/emailService";

async function syncDormantStudents(db: any) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 120);

    const lapsedStudents = await db
      .select()
      .from(marketingProspects)
      .where(
        and(
          eq(marketingProspects.customerType, "student"),
          inArray(marketingProspects.stage, ["prospect_registration", "prospect_booking"]),
          sql`CAST(${marketingProspects.updatedAt} AS TIMESTAMP) < ${cutoffDate.toISOString()}`
        )
      );

    for (const student of lapsedStudents) {
      await db.insert(marketingLostProjects).values({
        organisationName: student.client || "Unknown Student",
        sector: "Student",
        product: student.stage === "prospect_booking" ? "Student Booking" : "Student Registration",
        revenue: student.revenue || "0",
        expectedQuarter: `Q${Math.floor(new Date().getMonth() / 3) + 1}`,
        comments: student.remarks || "Automatically marked dormant after 120 days of inactivity.",
        marketerId: student.marketerId,
        contactPerson: student.contactPerson || student.client,
        contactNumber: student.contactNumber,
        contactEmail: student.contactEmail,
        lostReason: "Inactivity exceeding 120 days",
        lostDate: new Date().toISOString().split('T')[0],
        status: "dormant",
        canRevive: true,
        createdAt: student.createdAt,
        updatedAt: new Date().toISOString(),
      });

      await db.delete(marketingProspects).where(eq(marketingProspects.id, student.id));
    }
  } catch (error) {
    console.error("Error in syncDormantStudents:", error);
  }
}

export function registerProspectsRoutes(app: Express) {
  // ─── List Prospects ────────────────────────────────────────────────────────
  app.get("/api/marketing/prospects", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      await syncDormantStudents(db);
      const {
        page,
        limit,
        search,
        year,
        sectorId,
        stage,
        marketerId,
        customerType,
      } = marketingQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;

      const canViewAll =
        req.marketingUser?.role === "admin" ||
        req.marketingUser?.permissions?.includes("marketing.view_all");

      let whereCondition: any = marketerId
        ? eq(marketingProspects.marketerId, marketerId)
        : canViewAll
        ? undefined
        : eq(marketingProspects.marketerId, req.marketingUser!.id);

      if (search) {
        whereCondition = whereCondition
          ? and(
              whereCondition,
              or(
                ilike(marketingProspects.client, `%${search}%`),
                ilike(marketingProspects.contactPerson, `%${search}%`),
                ilike(marketingProspects.contactEmail, `%${search}%`)
              )
            )
          : or(
              ilike(marketingProspects.client, `%${search}%`),
              ilike(marketingProspects.contactPerson, `%${search}%`),
              ilike(marketingProspects.contactEmail, `%${search}%`)
            );
      }

      if (year) {
        whereCondition = whereCondition
          ? and(
              whereCondition,
              sql`EXTRACT(YEAR FROM CAST(${marketingProspects.date} AS DATE)) = ${year}`
            )
          : sql`EXTRACT(YEAR FROM CAST(${marketingProspects.date} AS DATE)) = ${year}`;
      }

      // For students, query the prospects table with registration/booking stages
      if (customerType === "student") {
        let studentWhere = and(
          inArray(marketingProspects.stage, ["prospect_registration", "prospect_booking"]),
          marketerId
            ? eq(marketingProspects.marketerId, marketerId)
            : canViewAll
            ? undefined
            : eq(marketingProspects.marketerId, req.marketingUser!.id)
        );

        if (search) {
          studentWhere = and(
            studentWhere,
            or(
              ilike(marketingProspects.client, `%${search}%`),
              ilike(marketingProspects.contactPerson, `%${search}%`),
              ilike(marketingProspects.contactEmail, `%${search}%`)
            )
          );
        }

        const baseQuery = db
          .select({
            id: marketingProspects.id,
            date: marketingProspects.date,
            client: marketingProspects.client,
            contactPerson: marketingProspects.contactPerson,
            contactNumber: marketingProspects.contactNumber,
            contactEmail: marketingProspects.contactEmail,
            needAvailability: sql<string>`NULL`,
            currentVendor: sql<string>`NULL`,
            remarks: marketingProspects.remarks,
            revenue: marketingProspects.revenue,
            stage: marketingProspects.stage,
            customerType: marketingProspects.customerType,
            marketerId: marketingProspects.marketerId,
            sectorId: marketingProspects.sectorId,
            sharedWithMarketerId: marketingProspects.sharedWithMarketerId,
            revenueSplit: marketingProspects.revenueSplit,
            createdAt: marketingProspects.createdAt,
            updatedAt: marketingProspects.updatedAt,
            bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
            bdEmail: marketingUsers.email,
            sectorName: marketingSectors.name,
          })
          .from(marketingProspects)
          .leftJoin(marketingUsers, eq(marketingProspects.marketerId, marketingUsers.id))
          .leftJoin(marketingSectors, eq(marketingProspects.sectorId, marketingSectors.id));

        const countQuery = db
          .select({ count: count() })
          .from(marketingProspects)
          .where(studentWhere);

        const [prospects, totalCount] = await Promise.all([
          baseQuery
            .where(studentWhere)
            .orderBy(desc(marketingProspects.date))
            .limit(limit)
            .offset(offset),
          countQuery,
        ]);

        return res.json({
          prospects,
          pagination: {
            page,
            limit,
            total: totalCount[0].count,
            pages: Math.ceil(totalCount[0].count / limit),
          },
        });
      }

      // Default: business/other prospects from marketingProspects table
      whereCondition = marketerId
        ? eq(marketingProspects.marketerId, marketerId)
        : canViewAll
        ? undefined
        : eq(marketingProspects.marketerId, req.marketingUser!.id);

      if (search) {
        whereCondition = whereCondition
          ? and(
              whereCondition,
              or(
                ilike(marketingProspects.client, `%${search}%`),
                ilike(marketingProspects.contactPerson, `%${search}%`),
                ilike(marketingProspects.contactEmail, `%${search}%`)
              )
            )
          : or(
              ilike(marketingProspects.client, `%${search}%`),
              ilike(marketingProspects.contactPerson, `%${search}%`),
              ilike(marketingProspects.contactEmail, `%${search}%`)
            );
      }

      if (year) {
        whereCondition = whereCondition
          ? and(
              whereCondition,
              sql`EXTRACT(YEAR FROM CAST(${marketingProspects.date} AS DATE)) = ${year}`
            )
          : sql`EXTRACT(YEAR FROM CAST(${marketingProspects.date} AS DATE)) = ${year}`;
      }

      if (sectorId) {
        whereCondition = whereCondition
          ? and(whereCondition, eq(marketingProspects.sectorId, String(sectorId)))
          : eq(marketingProspects.sectorId, String(sectorId));
      }

      if (stage) {
        whereCondition = whereCondition
          ? and(whereCondition, eq(marketingProspects.stage, String(stage)))
          : eq(marketingProspects.stage, String(stage));
      }

      if (customerType) {
        if (customerType === "business") {
          whereCondition = whereCondition
            ? and(
                whereCondition,
                inArray(marketingProspects.customerType, [
                  "institution",
                  "organization",
                  "employer",
                ])
              )
            : inArray(marketingProspects.customerType, [
                "institution",
                "organization",
                "employer",
              ]);
        } else {
          whereCondition = whereCondition
            ? and(whereCondition, eq(marketingProspects.customerType, String(customerType)))
            : eq(marketingProspects.customerType, String(customerType));
        }
      }

      const baseQuery = db
        .select({
          id: marketingProspects.id,
          date: marketingProspects.date,
          client: marketingProspects.client,
          contactPerson: marketingProspects.contactPerson,
          contactNumber: marketingProspects.contactNumber,
          contactEmail: marketingProspects.contactEmail,
          needAvailability: marketingProspects.needAvailability,
          currentVendor: marketingProspects.currentVendor,
          remarks: marketingProspects.remarks,
          revenue: marketingProspects.revenue,
          stage: marketingProspects.stage,
          customerType: marketingProspects.customerType,
          marketerId: marketingProspects.marketerId,
          sectorId: marketingProspects.sectorId,
          sharedWithMarketerId: marketingProspects.sharedWithMarketerId,
          revenueSplit: marketingProspects.revenueSplit,
          createdAt: marketingProspects.createdAt,
          updatedAt: marketingProspects.updatedAt,
          bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
          bdEmail: marketingUsers.email,
          sectorName: marketingSectors.name,
        })
        .from(marketingProspects)
        .leftJoin(marketingUsers, eq(marketingProspects.marketerId, marketingUsers.id))
        .leftJoin(marketingSectors, eq(marketingProspects.sectorId, marketingSectors.id));

      const countQuery = db.select({ count: count() }).from(marketingProspects);
      const prospectsQuery = whereCondition ? baseQuery.where(whereCondition) : baseQuery;
      const totalCountQuery = whereCondition ? countQuery.where(whereCondition) : countQuery;

      const [prospects, totalCount] = await Promise.all([
        prospectsQuery
          .orderBy(desc(marketingProspects.date))
          .limit(limit)
          .offset(offset),
        totalCountQuery,
      ]);

      res.json({
        prospects,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          pages: Math.ceil(totalCount[0].count / limit),
        },
      });
    } catch (error) {
      console.error("Fetch prospects error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── List Dormant Students ──────────────────────────────────────────────────
  app.get("/api/marketing/dormant-students", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      await syncDormantStudents(db);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;
      const search = req.query.search as string;
      const marketerId = req.query.marketerId as string;

      const canViewAll =
        req.marketingUser?.role === "admin" ||
        req.marketingUser?.permissions?.includes("marketing.view_all");

      let whereCondition: any = eq(marketingLostProjects.status, "dormant");

      if (marketerId && marketerId !== "all") {
        whereCondition = and(whereCondition, eq(marketingLostProjects.marketerId, marketerId));
      } else if (!canViewAll) {
        whereCondition = and(whereCondition, eq(marketingLostProjects.marketerId, req.marketingUser!.id));
      }

      if (search) {
        whereCondition = and(
          whereCondition,
          or(
            ilike(marketingLostProjects.organisationName, `%${search}%`),
            ilike(marketingLostProjects.contactPerson, `%${search}%`),
            ilike(marketingLostProjects.contactEmail, `%${search}%`)
          )
        );
      }

      const baseQuery = db
        .select({
          id: marketingLostProjects.id,
          date: marketingLostProjects.createdAt,
          client: marketingLostProjects.organisationName,
          contactPerson: marketingLostProjects.contactPerson,
          contactNumber: marketingLostProjects.contactNumber,
          contactEmail: marketingLostProjects.contactEmail,
          remarks: marketingLostProjects.comments,
          revenue: marketingLostProjects.revenue,
          stage: sql<string>`'dormant'`,
          customerType: sql<string>`'student'`,
          marketerId: marketingLostProjects.marketerId,
          createdAt: marketingLostProjects.createdAt,
          updatedAt: marketingLostProjects.updatedAt,
          bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
          bdEmail: marketingUsers.email,
        })
        .from(marketingLostProjects)
        .leftJoin(marketingUsers, eq(marketingLostProjects.marketerId, marketingUsers.id))
        .where(whereCondition);

      const countQuery = db
        .select({ count: count() })
        .from(marketingLostProjects)
        .where(whereCondition);

      const [dormantStudents, totalCount] = await Promise.all([
        baseQuery
          .orderBy(desc(marketingLostProjects.updatedAt))
          .limit(limit)
          .offset(offset),
        countQuery,
      ]);

      res.json({
        dormantStudents,
        totalCount: totalCount[0].count,
        page,
        limit,
        totalPages: Math.ceil(totalCount[0].count / limit),
      });
    } catch (error) {
      console.error("Fetch dormant students error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Create Prospect ───────────────────────────────────────────────────────
  app.post(
    "/api/marketing/prospects",
    marketingAuth,
    marketingUserAuth,
    logProjectAction("create"),
    async (req, res) => {
      try {
        const prospectData = marketingProspectCreateSchema.parse(req.body);

        const newProspect = await db
          .insert(marketingProspects)
          .values({
            date: prospectData.date,
            client: prospectData.client,
            contactPerson: prospectData.contactPerson,
            contactNumber: prospectData.contactNumber,
            contactEmail: prospectData.contactEmail,
            remarks: prospectData.remarks,
            revenue: prospectData.revenue?.toString(),
            stage: prospectData.stage,
            marketerId: req.marketingUser!.id,
            sectorId: prospectData.sectorId || null,
            sourceCampaignId: prospectData.sourceCampaignId || null,
          } as any)
          .returning();

        res.status(201).json({ prospect: newProspect[0] });

        AuditService.logAction(req, {
          action: "create",
          module: "marketing",
          entityType: "prospect",
          entityId: newProspect[0].id,
          newValues: newProspect[0],
          details: `Created new prospect for ${newProspect[0].client}`,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Update Prospect ───────────────────────────────────────────────────────
  app.put(
    "/api/marketing/prospects/:id",
    marketingAuth,
    marketingUserAuth,
    logProjectAction("update"),
    async (req, res) => {
      try {
        const id = req.params.id as string;
        const updateData = marketingProspectUpdateSchema.parse(req.body);

        const existingProspect = await db
          .select()
          .from(marketingProspects)
          .where(eq(marketingProspects.id, id))
          .limit(1);

        if (existingProspect.length === 0) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        if (
          req.marketingUser!.role !== "admin" &&
          existingProspect[0].marketerId !== req.marketingUser!.id
        ) {
          return res.status(403).json({ error: "Access denied" });
        }

        const processedUpdateData: any = {
          ...updateData,
          revenue: updateData.revenue?.toString(),
          updatedAt: new Date().toISOString(),
        };

        if (updateData.bdId !== undefined) {
          processedUpdateData.marketerId = updateData.bdId || null;
          delete processedUpdateData.bdId;
        }

        if (processedUpdateData.sectorId === "") processedUpdateData.sectorId = null;
        if (processedUpdateData.marketerId === "") processedUpdateData.marketerId = null;

        if (req.marketingUser!.role === "admin" && (updateData.marketerId || updateData.bdId)) {
          processedUpdateData.marketerId =
            updateData.marketerId || updateData.bdId || processedUpdateData.marketerId;
        }

        const updatedProspect = await db
          .update(marketingProspects)
          .set(processedUpdateData)
          .where(eq(marketingProspects.id, id))
          .returning();

        if (updatedProspect.length === 0) {
          return res.status(404).json({ error: "Prospect not found or update failed" });
        }

        res.json({ prospect: updatedProspect[0] });

        AuditService.logAction(req, {
          action: "update",
          module: "marketing",
          entityType: "prospect",
          entityId: updatedProspect[0].id,
          oldValues: existingProspect[0],
          newValues: updatedProspect[0],
          details: `Updated prospect for ${updatedProspect[0].client}`,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Delete Prospect ───────────────────────────────────────────────────────
  app.delete(
    "/api/marketing/prospects/:id",
    marketingAuth,
    marketingUserAuth,
    logProjectAction("delete"),
    async (req, res) => {
      try {
        const id = req.params.id as string;

        if (req.marketingUser!.role !== "admin") {
          const existing = await db
            .select()
            .from(marketingProspects)
            .where(
              and(
                eq(marketingProspects.id, id),
                eq(marketingProspects.marketerId, req.marketingUser!.id)
              )
            )
            .limit(1);

          if (existing.length === 0) {
            return res.status(404).json({ error: "Prospect not found" });
          }
        }

        await db.delete(marketingProspects).where(eq(marketingProspects.id, id));
        res.json({ message: "Prospect deleted successfully" });

        AuditService.logAction(req, {
          action: "delete",
          module: "marketing",
          entityType: "prospect",
          entityId: id,
          details: `Deleted prospect ID: ${id}`,
        });
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Update Stage (with cross-table transitions) ───────────────────────────
  app.put(
    "/api/marketing/prospects/:id/stage",
    marketingAuth,
    marketingUserAuth,
    async (req, res) => {
      try {
        const id = req.params.id as string;
        const { stage, revenue, lostReason } = req.body;

        let stakeholder: any;
        let isLead = false;

        const existingProspect = await db
          .select({
            id: marketingProspects.id,
            date: marketingProspects.date,
            client: marketingProspects.client,
            contactPerson: marketingProspects.contactPerson,
            contactNumber: marketingProspects.contactNumber,
            contactEmail: marketingProspects.contactEmail,
            remarks: marketingProspects.remarks,
            revenue: marketingProspects.revenue,
            stage: marketingProspects.stage,
            marketerId: marketingProspects.marketerId,
            sectorId: marketingProspects.sectorId,
            sectorName: marketingSectors.name,
            customerType: marketingProspects.customerType,
          })
          .from(marketingProspects)
          .leftJoin(marketingSectors, eq(marketingProspects.sectorId, marketingSectors.id))
          .where(eq(marketingProspects.id, id))
          .limit(1);

        if (existingProspect.length > 0) {
          stakeholder = existingProspect[0];
        } else {
          const existingLead = await db
            .select({
              id: marketingLeads.id,
              date: marketingLeads.date,
              client: marketingLeads.client,
              contactPerson: marketingLeads.contactPerson,
              contactNumber: marketingLeads.contactNumber,
              contactEmail: marketingLeads.contactEmail,
              remarks: marketingLeads.remarks,
              revenue: marketingLeads.revenue,
              stage: marketingLeads.stage,
              marketerId: marketingLeads.marketerId,
              sectorId: marketingLeads.sectorId,
              customerType: marketingLeads.customerType,
            })
            .from(marketingLeads)
            .where(eq(marketingLeads.id, id))
            .limit(1);

          if (existingLead.length > 0) {
            stakeholder = existingLead[0];
            isLead = true;
          } else {
            return res.status(404).json({ error: "Stakeholder not found" });
          }
        }

        if (
          req.marketingUser!.role !== "admin" &&
          stakeholder.marketerId !== req.marketingUser!.id
        ) {
          return res.status(403).json({ error: "Access denied" });
        }

        if (stage === "dormant") {
          const newLostProject = await db
            .insert(marketingLostProjects)
            .values({
              organisationName: stakeholder.client,
              sector: "Student",
              product: stakeholder.stage === "prospect_booking" ? "Student Booking" : "Student Registration",
              revenue: revenue ? revenue.toString() : stakeholder.revenue || "0",
              expectedQuarter: `Q${Math.floor(new Date().getMonth() / 3) + 1}`,
              comments: stakeholder.remarks,
              marketerId: stakeholder.marketerId,
              contactPerson: stakeholder.contactPerson,
              contactNumber: stakeholder.contactNumber,
              contactEmail: stakeholder.contactEmail,
              lostReason: "Manually promoted to dormant",
              lostDate: new Date().toISOString(),
              status: "dormant",
              canRevive: true,
              createdAt: stakeholder.date || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            .returning();

          if (isLead) {
            await db.delete(marketingLeads).where(eq(marketingLeads.id, id));
          } else {
            await db.delete(marketingProspects).where(eq(marketingProspects.id, id));
          }

          return res.json({
            message: "Student moved to dormant",
            lostProject: newLostProject[0],
          });
        }

        if (isLead) {
          const prospectStages = ['prospect', 'opportunity', 'engagement', 'prospect_registration', 'prospect_booking'];
          if (prospectStages.includes(stage)) {
            const [prospect] = await db
              .insert(marketingProspects)
              .values({
                date: stakeholder.date,
                client: stakeholder.client,
                contactPerson: stakeholder.contactPerson,
                contactNumber: stakeholder.contactNumber,
                contactEmail: stakeholder.contactEmail,
                remarks: stakeholder.remarks,
                revenue: revenue ? revenue.toString() : stakeholder.revenue,
                stage,
                marketerId: stakeholder.marketerId,
                sectorId: stakeholder.sectorId,
                customerType: stakeholder.customerType,
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
            return res.json({ message: "Lead stage updated and promoted to prospect", prospect });
          } else {
            await db
              .update(marketingLeads)
              .set({
                stage,
                revenue: revenue ? revenue.toString() : stakeholder.revenue,
              })
              .where(eq(marketingLeads.id, id));
            return res.json({ message: "Stage updated successfully" });
          }
        }

        const prospect = stakeholder;

        if (stage === "sales_won") {
          const newSalesWon = await db
            .insert(marketingSalesWon)
            .values({
              organisationName: prospect.client,
              sector: prospect.sectorId || prospect.sectorName || "Unknown",
              product: "Service",
              contractAmount: revenue ? revenue.toString() : "0",
              expectedQuarter: "Q1",
              comments: prospect.remarks,
              marketerId: prospect.marketerId,
              contactPerson: prospect.contactPerson,
              contactNumber: prospect.contactNumber,
              contactEmail: prospect.contactEmail,
              customerType: prospect.customerType,
              createdAt: prospect.date,
            })
            .returning();

          await db.delete(marketingProspects).where(eq(marketingProspects.id, id));

          await Promise.all([
            db
              .update(marketingDocuments)
              .set({ salesWonId: newSalesWon[0].id })
              .where(eq(marketingDocuments.prospectId, id)),
            db
              .update(marketingActivities)
              .set({ salesWonId: newSalesWon[0].id })
              .where(eq(marketingActivities.prospectId, id)),
          ]);

          return res.json({ message: "Prospect moved to sales won", salesWon: newSalesWon[0] });
        } else if (stage === "expected_order") {
          const newExpectedOrder = await db
            .insert(marketingExpectedOrders)
            .values({
              organisationName: prospect.client,
              sector: prospect.sectorId || prospect.sectorName || "Unknown",
              product: "Service",
              revenue: revenue ? revenue.toString() : "0",
              expectedQuarter: "Q1",
              comments: prospect.remarks,
              marketerId: prospect.marketerId,
              contactPerson: prospect.contactPerson,
              contactNumber: prospect.contactNumber,
              contactEmail: prospect.contactEmail,
              customerType: prospect.customerType,
              createdAt: prospect.date,
            })
            .returning();

          await db.delete(marketingProspects).where(eq(marketingProspects.id, id));

          await Promise.all([
            db
              .update(marketingDocuments)
              .set({ expectedOrderId: newExpectedOrder[0].id })
              .where(eq(marketingDocuments.prospectId, id)),
            db
              .update(marketingActivities)
              .set({ expectedOrderId: newExpectedOrder[0].id })
              .where(eq(marketingActivities.prospectId, id)),
          ]);

          return res.json({
            message: "Prospect moved to expected orders",
            expectedOrder: newExpectedOrder[0],
          });
        } else if (stage === "lost") {
          if (!lostReason || lostReason.trim().length < 10) {
            return res
              .status(400)
              .json({ error: "Lost reason is required and must be at least 10 characters long" });
          }

          const newLostProject = await db
            .insert(marketingLostProjects)
            .values({
              organisationName: prospect.client,
              sector: prospect.sectorId || prospect.sectorName || "Unknown",
              product: "Service",
              revenue: revenue ? revenue.toString() : prospect.revenue || "0",
              expectedQuarter: "Q1",
              comments: prospect.remarks,
              marketerId: prospect.marketerId,
              contactPerson: prospect.contactPerson,
              contactNumber: prospect.contactNumber,
              contactEmail: prospect.contactEmail,
              lostReason: lostReason.trim(),
              lostDate: new Date().toISOString(),
            })
            .returning();

          await db.delete(marketingProspects).where(eq(marketingProspects.id, id));

          return res.json({
            message: "Prospect moved to lost projects",
            lostProject: newLostProject[0],
          });
        } else {
          const updateData: any = { stage, updatedAt: new Date().toISOString() };
          if (revenue !== undefined) updateData.revenue = revenue.toString();

          const updatedProspect = await db
            .update(marketingProspects)
            .set(updateData)
            .where(eq(marketingProspects.id, id))
            .returning();

          if (updatedProspect.length === 0) {
            return res.status(404).json({ error: "Prospect not found or update failed" });
          }

          return res.json({ prospect: updatedProspect[0] });
        }
      } catch (error) {
        console.error("Error updating prospect stage:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Won Prospect (Handover to Case Management) ────────────────────────────
  app.post(
    "/api/marketing/prospects/:id/won",
    marketingAuth,
    marketingUserAuth,
    logProjectAction("update"),
    async (req, res) => {
      try {
        const id = req.params.id as string;
        const prospect = await db
          .select()
          .from(marketingProspects)
          .where(eq(marketingProspects.id, id))
          .limit(1);

        if (prospect.length === 0) return res.status(404).json({ error: "Prospect not found" });
        const p = prospect[0];

        await db.insert(intakeSignals).values({
          source: "marketing",
          rawText: `Won Prospect: ${p.client} - ${p.contactPerson} (${p.contactEmail})`,
          metadata: {
            marketingProspectId: p.id,
            client: p.client,
            contactPerson: p.contactPerson,
            contactNumber: p.contactNumber,
            contactEmail: p.contactEmail,
            revenue: p.revenue,
            remarks: p.remarks,
            sectorId: p.sectorId,
            marketerId: p.marketerId,
          },
          status: "pending",
        } as any);

        const [salesWon] = await db
          .insert(marketingSalesWon)
          .values({
            organisationName: p.client,
            sector: p.sectorId || "Unknown",
            product: "Service",
            contractAmount: p.revenue || "0",
            expectedQuarter: "Q1",
            comments: p.remarks,
            marketerId: p.marketerId,
            contactPerson: p.contactPerson,
            contactNumber: p.contactNumber,
            contactEmail: p.contactEmail,
          } as any)
          .returning();

        await Promise.all([
          db
            .update(marketingDocuments)
            .set({ salesWonId: salesWon.id })
            .where(eq(marketingDocuments.prospectId, id)),
          db
            .update(marketingActivities)
            .set({ salesWonId: salesWon.id })
            .where(eq(marketingActivities.prospectId, id)),
        ]);

        await db.delete(marketingProspects).where(eq(marketingProspects.id, id));
        res.json({ message: "Prospect marked as won and handed over to Case Management" });

        AuditService.logAction(req, {
          action: "update",
          module: "marketing",
          entityType: "prospect",
          entityId: id,
          details: `Marked prospect ${p.client} as WON and handed over to Case Management`,
        });
      } catch (error) {
        console.error("Handover error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Split Account (shared revenue) ───────────────────────────────────────
  app.post(
    "/api/marketing/prospects/:id/split-account",
    marketingAuth,
    marketingUserAuth,
    async (req, res) => {
      try {
        const id = req.params.id as string;
        const { sharedWithMarketerId, revenueSplit } =
          marketingSharedAccountSchema.parse(req.body);

        const originalProspect = await db
          .select()
          .from(marketingProspects)
          .where(eq(marketingProspects.id, id))
          .limit(1);

        if (originalProspect.length === 0) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const updatedProspect = await db
          .update(marketingProspects)
          .set({
            sharedWithMarketerId,
            revenueSplit: revenueSplit.toString(),
            updatedAt: new Date().toISOString(),
          } as any)
          .where(eq(marketingProspects.id, id))
          .returning();

        const [originalMarketer, sharedMarketer] = await Promise.all([
          db
            .select()
            .from(marketingUsers)
            .where(eq(marketingUsers.id, originalProspect[0].marketerId as string))
            .limit(1),
          db
            .select()
            .from(marketingUsers)
            .where(eq(marketingUsers.id, sharedWithMarketerId))
            .limit(1),
        ]);

        if (originalMarketer.length > 0) {
          try {
            await emailService.sendEmail({
              to: originalMarketer[0].email,
              subject: "Account Shared - Revenue Split Confirmed",
              html: `<h2>Account Shared</h2><p>Your prospect "${originalProspect[0].client}" shared with ${sharedMarketer[0]?.firstName}.</p>`,
              text: `Account Shared: ${originalProspect[0].client} with ${sharedMarketer[0]?.firstName}`,
            });
          } catch (e) {}
        }

        res.json({ message: "Account shared successfully", prospect: updatedProspect[0] });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );
}
