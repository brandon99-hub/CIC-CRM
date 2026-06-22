import type { Express } from "express";
import { db } from "../db";
import {
  marketingSalesWon,
  marketingLeads,
  marketingUsers,
  marketingSectors,
} from "../../shared/schema";
import {
  marketingSalesWonCreateSchema,
  marketingSalesWonUpdateSchema,
  marketingQuerySchema,
} from "../../shared/marketingSchema";
import { marketingAuth, marketingUserAuth } from "../middleware/marketingAuth";
import { logProjectAction } from "../middleware/comprehensiveAudit";
import { eq, and, desc, ilike, sql, count, inArray } from "drizzle-orm";
import { z } from "zod";
import { AuditService } from "../services/audit-service";

export function registerSalesWonRoutes(app: Express) {
  // ─── List Sales Won ────────────────────────────────────────────────────────
  app.get("/api/marketing/sales-won", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { page, limit, search, year, quarter, marketerId, customerType } =
        marketingQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;

      const canViewAll =
        req.marketingUser?.role === "admin" ||
        req.marketingUser?.permissions?.includes("marketing.view_all");

      let whereCondition: any = marketerId
        ? eq(marketingSalesWon.marketerId, marketerId)
        : canViewAll
        ? undefined
        : eq(marketingSalesWon.marketerId, req.marketingUser!.id);

      if (search) {
        whereCondition = whereCondition
          ? and(whereCondition, ilike(marketingSalesWon.organisationName, `%${search}%`))
          : ilike(marketingSalesWon.organisationName, `%${search}%`);
      }

      if (year) {
        whereCondition = whereCondition
          ? and(
              whereCondition,
              sql`EXTRACT(YEAR FROM CAST(${marketingSalesWon.createdAt} AS DATE)) = ${year}`
            )
          : sql`EXTRACT(YEAR FROM CAST(${marketingSalesWon.createdAt} AS DATE)) = ${year}`;
      }

      if (quarter) {
        whereCondition = whereCondition
          ? and(whereCondition, eq(marketingSalesWon.expectedQuarter, quarter))
          : eq(marketingSalesWon.expectedQuarter, quarter);
      }

      // For students, sales won are converted-stage leads
      if (customerType === "student") {
        let studentWhere = and(
          eq(marketingLeads.stage, "converted"),
          marketerId
            ? eq(marketingLeads.marketerId, marketerId)
            : canViewAll
            ? undefined
            : eq(marketingLeads.marketerId, req.marketingUser!.id)
        );

        if (search) {
          studentWhere = and(
            studentWhere,
            ilike(marketingLeads.client, `%${search}%`)
          );
        }

        const baseQuery = db
          .select({
            id: marketingLeads.id,
            organisationName: marketingLeads.client,
            sector: marketingSectors.name,
            product: sql<string>`'Service'`,
            contractAmount: marketingLeads.revenue,
            expectedQuarter: sql<string>`'Q1'`,
            comments: marketingLeads.remarks,
            marketerId: marketingLeads.marketerId,
            marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
            marketerEmail: marketingUsers.email,
            contactPerson: marketingLeads.contactPerson,
            contactNumber: marketingLeads.contactNumber,
            contactEmail: marketingLeads.contactEmail,
            createdAt: marketingLeads.createdAt,
            updatedAt: marketingLeads.updatedAt,
            customerType: marketingLeads.customerType,
          })
          .from(marketingLeads)
          .leftJoin(marketingUsers, eq(marketingLeads.marketerId, marketingUsers.id))
          .leftJoin(marketingSectors, eq(marketingLeads.sectorId, marketingSectors.id));

        const countQuery = db
          .select({ count: count() })
          .from(marketingLeads)
          .where(studentWhere);

        const [salesWon, totalCount] = await Promise.all([
          baseQuery
            .where(studentWhere)
            .orderBy(desc(marketingLeads.createdAt))
            .limit(limit)
            .offset(offset),
          countQuery,
        ]);

        return res.json({
          salesWon,
          pagination: {
            page,
            limit,
            total: totalCount[0].count,
            pages: Math.ceil(totalCount[0].count / limit),
          },
        });
      }

      if (customerType) {
        if (customerType === "business") {
          whereCondition = whereCondition
            ? and(
                whereCondition,
                inArray(marketingSalesWon.customerType, [
                  "institution",
                  "organization",
                  "employer",
                ])
              )
            : inArray(marketingSalesWon.customerType, [
                "institution",
                "organization",
                "employer",
              ]);
        } else {
          whereCondition = whereCondition
            ? and(whereCondition, eq(marketingSalesWon.customerType, String(customerType)))
            : eq(marketingSalesWon.customerType, String(customerType));
        }
      }

      const baseQuery = db
        .select({
          id: marketingSalesWon.id,
          organisationName: marketingSalesWon.organisationName,
          sector: sql<string>`COALESCE(${marketingSectors.name}, ${marketingSalesWon.sector})`,
          product: marketingSalesWon.product,
          contractAmount: marketingSalesWon.contractAmount,
          expectedQuarter: marketingSalesWon.expectedQuarter,
          comments: marketingSalesWon.comments,
          marketerId: marketingSalesWon.marketerId,
          contactPerson: marketingSalesWon.contactPerson,
          contactNumber: marketingSalesWon.contactNumber,
          contactEmail: marketingSalesWon.contactEmail,
          customerType: marketingSalesWon.customerType,
          createdAt: marketingSalesWon.createdAt,
          updatedAt: marketingSalesWon.updatedAt,
          marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
          marketerEmail: marketingUsers.email,
        })
        .from(marketingSalesWon)
        .leftJoin(marketingUsers, eq(marketingSalesWon.marketerId, marketingUsers.id))
        .leftJoin(
          marketingSectors,
          sql`${marketingSalesWon.sector}::text = ${marketingSectors.id}::text`
        );

      const countQuery = db.select({ count: count() }).from(marketingSalesWon);
      const salesWonQuery = whereCondition ? baseQuery.where(whereCondition) : baseQuery;
      const totalCountQuery = whereCondition ? countQuery.where(whereCondition) : countQuery;

      const [salesWon, totalCount] = await Promise.all([
        salesWonQuery
          .orderBy(desc(marketingSalesWon.createdAt))
          .limit(limit)
          .offset(offset),
        totalCountQuery,
      ]);

      res.json({
        salesWon,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          pages: Math.ceil(totalCount[0].count / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Create Sales Won ──────────────────────────────────────────────────────
  app.post(
    "/api/marketing/sales-won",
    marketingAuth,
    marketingUserAuth,
    logProjectAction("create"),
    async (req, res) => {
      try {
        const salesWonData = marketingSalesWonCreateSchema.parse(req.body);

        const newSalesWon = await db
          .insert(marketingSalesWon)
          .values({
            organisationName: salesWonData.organisationName,
            sector: salesWonData.sector,
            product: salesWonData.product,
            contractAmount: salesWonData.contractAmount.toString(),
            expectedQuarter: salesWonData.expectedQuarter,
            comments: salesWonData.comments,
            customerType: salesWonData.customerType || "institution",
            sourceCampaignId: salesWonData.sourceCampaignId,
            marketerId: req.marketingUser!.id,
          } as any)
          .returning();

        res.status(201).json({ salesWon: newSalesWon[0] });

        AuditService.logAction(req, {
          action: "create",
          module: "marketing",
          entityType: "sales_won",
          entityId: newSalesWon[0].id,
          newValues: newSalesWon[0],
          details: `Created new sales won entry for ${newSalesWon[0].organisationName}`,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Update Sales Won ──────────────────────────────────────────────────────
  app.put(
    "/api/marketing/sales-won/:id",
    marketingAuth,
    marketingUserAuth,
    logProjectAction("update"),
    async (req, res) => {
      try {
        const id = req.params.id as string;
        const updateData = marketingSalesWonUpdateSchema.parse(req.body);

        if (req.marketingUser!.role !== "admin") {
          const existing = await db
            .select()
            .from(marketingSalesWon)
            .where(
              and(
                eq(marketingSalesWon.id, id),
                eq(marketingSalesWon.marketerId, req.marketingUser!.id)
              )
            )
            .limit(1);

          if (existing.length === 0) {
            return res.status(404).json({ error: "Sales won record not found" });
          }
        }

        const processedUpdateData: any = {
          ...updateData,
          contractAmount: updateData.contractAmount?.toString(),
          updatedAt: sql`now()`,
        };

        if (req.marketingUser!.role === "admin" && updateData.marketerId) {
          processedUpdateData.marketerId = updateData.marketerId;
        }

        const updatedSalesWon = await db
          .update(marketingSalesWon)
          .set(processedUpdateData)
          .where(eq(marketingSalesWon.id, id))
          .returning();

        if (updatedSalesWon.length === 0) {
          return res.status(404).json({ error: "Sales won record not found" });
        }

        res.json({ salesWon: updatedSalesWon[0] });

        AuditService.logAction(req, {
          action: "update",
          module: "marketing",
          entityType: "sales_won",
          entityId: updatedSalesWon[0].id,
          newValues: updatedSalesWon[0],
          details: `Updated sales won record for ${updatedSalesWon[0].organisationName}`,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Delete Sales Won ──────────────────────────────────────────────────────
  app.delete(
    "/api/marketing/sales-won/:id",
    marketingAuth,
    marketingUserAuth,
    logProjectAction("delete"),
    async (req, res) => {
      try {
        const id = req.params.id as string;

        if (req.marketingUser!.role !== "admin") {
          const existing = await db
            .select()
            .from(marketingSalesWon)
            .where(
              and(
                eq(marketingSalesWon.id, id),
                eq(marketingSalesWon.marketerId, req.marketingUser!.id)
              )
            )
            .limit(1);

          if (existing.length === 0) {
            return res.status(404).json({ error: "Sales won record not found" });
          }
        }

        await db.delete(marketingSalesWon).where(eq(marketingSalesWon.id, id));
        res.json({ message: "Sales won record deleted successfully" });

        AuditService.logAction(req, {
          action: "delete",
          module: "marketing",
          entityType: "sales_won",
          entityId: id,
          details: `Deleted sales won record ID: ${id}`,
        });
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );
}
