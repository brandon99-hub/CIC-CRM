import type { Express } from "express";
import { db } from "../db";
import {
  marketingExpectedOrders,
  marketingSalesWon,
  marketingProspects,
  marketingLostProjects,
  marketingUsers,
  marketingSectors,
  marketingDocuments,
  marketingActivities,
} from "../../shared/schema";
import {
  marketingExpectedOrdersCreateSchema,
  marketingExpectedOrdersUpdateSchema,
  marketingQuerySchema,
} from "../../shared/marketingSchema";
import { marketingAuth, marketingUserAuth } from "../middleware/marketingAuth";
import { eq, and, desc, ilike, sql, count, inArray } from "drizzle-orm";
import { z } from "zod";
import { AuditService } from "../services/audit-service";

export function registerExpectedOrdersRoutes(app: Express) {
  // ─── List Expected Orders ──────────────────────────────────────────────────
  app.get(
    "/api/marketing/expected-orders",
    marketingAuth,
    marketingUserAuth,
    async (req, res) => {
      try {
        const { page, limit, search, year, quarter, marketerId, customerType } =
          marketingQuerySchema.parse(req.query);
        const offset = (page - 1) * limit;

        const canViewAll =
          req.marketingUser?.role === "admin" ||
          req.marketingUser?.permissions?.includes("marketing.view_all");

        let whereCondition: any = marketerId
          ? eq(marketingExpectedOrders.marketerId, marketerId)
          : canViewAll
          ? undefined
          : eq(marketingExpectedOrders.marketerId, req.marketingUser!.id);

        if (search) {
          whereCondition = whereCondition
            ? and(
                whereCondition,
                ilike(marketingExpectedOrders.organisationName, `%${search}%`)
              )
            : ilike(marketingExpectedOrders.organisationName, `%${search}%`);
        }

        if (year) {
          whereCondition = whereCondition
            ? and(
                whereCondition,
                sql`EXTRACT(YEAR FROM CAST(${marketingExpectedOrders.createdAt} AS DATE)) = ${year}`
              )
            : sql`EXTRACT(YEAR FROM CAST(${marketingExpectedOrders.createdAt} AS DATE)) = ${year}`;
        }

        if (quarter) {
          whereCondition = whereCondition
            ? and(whereCondition, eq(marketingExpectedOrders.expectedQuarter, quarter))
            : eq(marketingExpectedOrders.expectedQuarter, quarter);
        }

        if (customerType) {
          if (customerType === "business") {
            whereCondition = whereCondition
              ? and(
                  whereCondition,
                  inArray(marketingExpectedOrders.customerType, [
                    "institution",
                    "organization",
                    "employer",
                  ])
                )
              : inArray(marketingExpectedOrders.customerType, [
                  "institution",
                  "organization",
                  "employer",
                ]);
          } else {
            whereCondition = whereCondition
              ? and(
                  whereCondition,
                  eq(marketingExpectedOrders.customerType, String(customerType))
                )
              : eq(marketingExpectedOrders.customerType, String(customerType));
          }
        }

        const [expectedOrders, totalCount] = await Promise.all([
          db
            .select({
              id: marketingExpectedOrders.id,
              organisationName: marketingExpectedOrders.organisationName,
              sector: sql<string>`COALESCE(${marketingSectors.name}, ${marketingExpectedOrders.sector})`,
              product: marketingExpectedOrders.product,
              revenue: marketingExpectedOrders.revenue,
              expectedQuarter: marketingExpectedOrders.expectedQuarter,
              comments: marketingExpectedOrders.comments,
              marketerId: marketingExpectedOrders.marketerId,
              contactPerson: marketingExpectedOrders.contactPerson,
              contactNumber: marketingExpectedOrders.contactNumber,
              contactEmail: marketingExpectedOrders.contactEmail,
              customerType: marketingExpectedOrders.customerType,
              createdAt: marketingExpectedOrders.createdAt,
              updatedAt: marketingExpectedOrders.updatedAt,
              marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
              marketerEmail: marketingUsers.email,
            })
            .from(marketingExpectedOrders)
            .leftJoin(
              marketingUsers,
              eq(marketingExpectedOrders.marketerId, marketingUsers.id)
            )
            .leftJoin(
              marketingSectors,
              sql`${marketingExpectedOrders.sector}::text = ${marketingSectors.id}::text`
            )
            .where(whereCondition)
            .orderBy(desc(marketingExpectedOrders.createdAt))
            .limit(limit)
            .offset(offset),
          db
            .select({ count: count() })
            .from(marketingExpectedOrders)
            .where(whereCondition),
        ]);

        res.json({
          expectedOrders,
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
    }
  );

  // ─── Create Expected Order ─────────────────────────────────────────────────
  app.post(
    "/api/marketing/expected-orders",
    marketingAuth,
    marketingUserAuth,
    async (req, res) => {
      try {
        const expectedOrdersData = marketingExpectedOrdersCreateSchema.parse(req.body);

        const newExpectedOrders = await db
          .insert(marketingExpectedOrders)
          .values({
            organisationName: expectedOrdersData.organisationName,
            sector: expectedOrdersData.sector,
            product: expectedOrdersData.product,
            revenue: expectedOrdersData.revenue.toString(),
            expectedQuarter: expectedOrdersData.expectedQuarter,
            comments: expectedOrdersData.comments,
            customerType: expectedOrdersData.customerType || "institution",
            sourceCampaignId: expectedOrdersData.sourceCampaignId,
            marketerId: req.marketingUser!.id,
          } as any)
          .returning();

        res.status(201).json({ expectedOrders: newExpectedOrders[0] });

        AuditService.logAction(req, {
          action: "create",
          module: "marketing",
          entityType: "expected_order",
          entityId: newExpectedOrders[0].id,
          newValues: newExpectedOrders[0],
          details: `Created new expected order for ${newExpectedOrders[0].organisationName}`,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Update Expected Order ─────────────────────────────────────────────────
  app.put(
    "/api/marketing/expected-orders/:id",
    marketingAuth,
    marketingUserAuth,
    async (req, res) => {
      try {
        const id = req.params.id as string;
        const updateData = marketingExpectedOrdersUpdateSchema.parse(req.body);

        if (req.marketingUser!.role !== "admin") {
          const existing = await db
            .select()
            .from(marketingExpectedOrders)
            .where(
              and(
                eq(marketingExpectedOrders.id, id),
                eq(marketingExpectedOrders.marketerId, req.marketingUser!.id)
              )
            )
            .limit(1);

          if (existing.length === 0) {
            return res.status(404).json({ error: "Expected orders record not found" });
          }
        }

        const processedUpdateData: any = {
          ...updateData,
          revenue: updateData.revenue?.toString(),
          updatedAt: new Date().toISOString(),
        };

        if (req.marketingUser!.role === "admin" && updateData.marketerId) {
          processedUpdateData.marketerId = updateData.marketerId;
        }

        const updatedExpectedOrders = await db
          .update(marketingExpectedOrders)
          .set(processedUpdateData)
          .where(eq(marketingExpectedOrders.id, id))
          .returning();

        if (updatedExpectedOrders.length === 0) {
          return res.status(404).json({ error: "Expected orders record not found" });
        }

        res.json({ expectedOrders: updatedExpectedOrders[0] });

        AuditService.logAction(req, {
          action: "update",
          module: "marketing",
          entityType: "expected_order",
          entityId: updatedExpectedOrders[0].id,
          newValues: updatedExpectedOrders[0],
          details: `Updated expected order for ${updatedExpectedOrders[0].organisationName}`,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Delete Expected Order ─────────────────────────────────────────────────
  app.delete(
    "/api/marketing/expected-orders/:id",
    marketingAuth,
    marketingUserAuth,
    async (req, res) => {
      try {
        const id = req.params.id as string;

        if (req.marketingUser!.role !== "admin") {
          const existing = await db
            .select()
            .from(marketingExpectedOrders)
            .where(
              and(
                eq(marketingExpectedOrders.id, id),
                eq(marketingExpectedOrders.marketerId, req.marketingUser!.id)
              )
            )
            .limit(1);

          if (existing.length === 0) {
            return res.status(404).json({ error: "Expected orders record not found" });
          }
        }

        await db
          .delete(marketingExpectedOrders)
          .where(eq(marketingExpectedOrders.id, id));

        res.json({ message: "Expected orders record deleted successfully" });

        AuditService.logAction(req, {
          action: "delete",
          module: "marketing",
          entityType: "expected_order",
          entityId: id,
          details: `Deleted expected order record ID: ${id}`,
        });
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Change Stage (cross-table transitions) ────────────────────────────────
  app.put(
    "/api/marketing/expected-orders/:id/stage",
    marketingAuth,
    marketingUserAuth,
    async (req, res) => {
      try {
        const id = req.params.id as string;
        const { stage, revenue, lostReason } = req.body;

        if (!stage) return res.status(400).json({ error: "Stage is required" });

        const expectedOrder = await db
          .select()
          .from(marketingExpectedOrders)
          .where(eq(marketingExpectedOrders.id, id))
          .limit(1);

        if (expectedOrder.length === 0) {
          return res.status(404).json({ error: "Expected order not found" });
        }

        const order = expectedOrder[0];

        if (
          req.marketingUser!.role !== "admin" &&
          order.marketerId !== req.marketingUser!.id
        ) {
          return res.status(403).json({ error: "Access denied" });
        }

        if (stage === "sales_won") {
          const newSalesWon = await db
            .insert(marketingSalesWon)
            .values({
              organisationName: order.organisationName,
              sector: order.sector,
              product: order.product,
              contractAmount: revenue ? revenue.toString() : order.revenue,
              expectedQuarter: order.expectedQuarter,
              comments: order.comments,
              marketerId: order.marketerId,
              contactPerson: order.contactPerson,
              contactNumber: order.contactNumber,
              contactEmail: order.contactEmail,
              customerType: order.customerType,
              sourceCampaignId: order.sourceCampaignId,
              createdAt: order.createdAt,
            })
            .returning();

          await db.delete(marketingExpectedOrders).where(eq(marketingExpectedOrders.id, id));

          await Promise.all([
            db
              .update(marketingDocuments)
              .set({ salesWonId: newSalesWon[0].id })
              .where(eq(marketingDocuments.expectedOrderId, id)),
            db
              .update(marketingActivities)
              .set({ salesWonId: newSalesWon[0].id })
              .where(eq(marketingActivities.expectedOrderId, id)),
          ]);

          return res.json({
            message: "Expected order moved to sales won",
            salesWon: newSalesWon[0],
          });
        } else if (stage === "lead" || stage === "prospect") {
          const newProspect = await db
            .insert(marketingProspects)
            .values({
              date: order.createdAt,
              client: order.organisationName,
              contactPerson: order.contactPerson,
              contactNumber: order.contactNumber,
              contactEmail: order.contactEmail,
              systemInPlace: "none" as any,
              needAvailability: "none" as any,
              currentVendor: "",
              remarks: order.comments,
              revenue: revenue ? revenue.toString() : order.revenue,
              stage,
              marketerId: order.marketerId,
              sectorId: order.sector,
              sourceCampaignId: order.sourceCampaignId,
            } as any)
            .returning();

          await db.delete(marketingExpectedOrders).where(eq(marketingExpectedOrders.id, id));

          return res.json({
            message: `Expected order moved to ${stage}`,
            prospect: newProspect[0],
          });
        } else if (stage === "lost") {
          if (!lostReason || lostReason.trim().length < 10) {
            return res.status(400).json({
              error: "Lost reason is required and must be at least 10 characters long",
            });
          }

          const newLostProject = await db
            .insert(marketingLostProjects)
            .values({
              organisationName: order.organisationName,
              sector: order.sector,
              product: order.product,
              revenue: revenue ? revenue.toString() : order.revenue,
              expectedQuarter: order.expectedQuarter,
              comments: order.comments,
              marketerId: order.marketerId,
              contactPerson: order.contactPerson,
              contactNumber: order.contactNumber,
              contactEmail: order.contactEmail,
              lostReason: lostReason.trim(),
              sourceCampaignId: order.sourceCampaignId,
              lostDate: new Date().toISOString(),
            })
            .returning();

          await db.delete(marketingExpectedOrders).where(eq(marketingExpectedOrders.id, id));

          return res.json({
            message: "Expected order moved to lost projects",
            lostProject: newLostProject[0],
          });
        }

        res.status(400).json({ error: "Invalid stage transition" });
      } catch (error) {
        console.error("Error changing expected order stage:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );
}
