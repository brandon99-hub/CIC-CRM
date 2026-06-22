import type { Express } from "express";
import { db } from "../db";
import { marketingUsers, marketingAnnualSummary } from "../../shared/schema";
import { departments } from "../../shared/adminSchema";
import { marketingUserUpdateSchema, marketingQuerySchema } from "../../shared/marketingSchema";
import {
  marketingAuth,
  marketingAdminAuth,
} from "../middleware/marketingAuth";
import { eq, and, desc, or, sql, count } from "drizzle-orm";
import { z } from "zod";

export function registerUsersRoutes(app: Express) {
  // ─── List Users ────────────────────────────────────────────────────────────
  app.get(
    "/api/marketing/users",
    marketingAuth,
    (req, res, next) => {
      if (
        req.marketingUser?.role === "admin" ||
        req.marketingUser?.permissions?.includes("marketing.view_all")
      ) {
        next();
      } else {
        res.status(403).json({ error: "Insufficient permissions" });
      }
    },
    async (req, res) => {
      try {
        const { page, limit, search } = marketingQuerySchema.parse(req.query);
        const offset = (page - 1) * limit;

        const mktDept = await db
          .select({ id: departments.id })
          .from(departments)
          .where(
            or(
              eq(departments.code, "MRK"),
              sql`LOWER(${departments.name}) LIKE '%marketing%'`
            )
          )
          .limit(1);
        const mktDeptId = mktDept[0]?.id;

        let whereCondition: any = eq(marketingUsers.isActive, true);

        if (mktDeptId) {
          whereCondition = and(
            eq(marketingUsers.isActive, true),
            eq(marketingUsers.departmentId, mktDeptId)
          );
        }

        if (search) {
          whereCondition = and(
            whereCondition,
            sql`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName}, ' ', ${marketingUsers.email}) ILIKE ${`%${search}%`}`
          );
        }

        const [users, totalCount] = await Promise.all([
          db
            .select({
              id: marketingUsers.id,
              email: marketingUsers.email,
              firstName: marketingUsers.firstName,
              lastName: marketingUsers.lastName,
              role: marketingUsers.role,
              isActive: marketingUsers.isActive,
              mustChangePassword: marketingUsers.mustChangePassword,
              lastLoginAt: marketingUsers.lastLoginAt,
              createdAt: marketingUsers.createdAt,
              bdType: marketingUsers.bdType,
            })
            .from(marketingUsers)
            .where(whereCondition)
            .orderBy(desc(marketingUsers.createdAt))
            .limit(limit)
            .offset(offset),
          db.select({ count: count() }).from(marketingUsers).where(whereCondition),
        ]);

        res.json({
          users,
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

  // ─── Update User ───────────────────────────────────────────────────────────
  app.put("/api/marketing/users/:id", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = marketingUserUpdateSchema.parse(req.body);

      const updatedUser = await db
        .update(marketingUsers)
        .set({ ...updateData, updatedAt: new Date().toISOString() } as any)
        .where(eq(marketingUsers.id, id as string))
        .returning();

      if (updatedUser.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        user: {
          id: updatedUser[0].id,
          email: updatedUser[0].email,
          firstName: updatedUser[0].firstName,
          lastName: updatedUser[0].lastName,
          role: updatedUser[0].role,
          isActive: updatedUser[0].isActive,
          bdType: updatedUser[0].bdType,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Deactivate User (soft-delete) ─────────────────────────────────────────
  app.delete("/api/marketing/users/:id", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const id = req.params.id as string;

      const updatedUser = await db
        .update(marketingUsers)
        .set({ isActive: false, updatedAt: new Date().toISOString() } as any)
        .where(eq(marketingUsers.id, id))
        .returning();

      if (updatedUser.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ message: "User deactivated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Get Dashboard Access ──────────────────────────────────────────────────
  app.get(
    "/api/marketing/users/:id/dashboard-access",
    marketingAuth,
    marketingAdminAuth,
    async (req, res) => {
      try {
        const { id } = req.params;
        const users = await db
          .select()
          .from(marketingUsers)
          .where(eq(marketingUsers.id, id as string))
          .limit(1);

        if (users.length === 0) return res.status(404).json({ error: "User not found" });

        const access = users[0].dashboardAccess
          ? JSON.parse(users[0].dashboardAccess)
          : ["marketing", "stakeholders", "cases", "executive"];

        res.json({ dashboardAccess: access });
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Update Dashboard Access ───────────────────────────────────────────────
  app.put(
    "/api/marketing/users/:id/dashboard-access",
    marketingAuth,
    marketingAdminAuth,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { dashboardAccess } = req.body;

        if (!Array.isArray(dashboardAccess)) {
          return res.status(400).json({ error: "dashboardAccess must be an array" });
        }

        const valid = ["marketing", "stakeholders", "cases", "executive", "admin"];
        const filtered = dashboardAccess.filter((d: string) => valid.includes(d));

        await db
          .update(marketingUsers)
          .set({ dashboardAccess: JSON.stringify(filtered), updatedAt: new Date().toISOString() } as any)
          .where(eq(marketingUsers.id, id as string));

        res.json({ dashboardAccess: filtered });
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // Admin endpoint to set targets for any user
  app.post("/api/marketing/admin/set-target", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { marketerId, year, target, revisedTarget, bookingTarget, registrationTarget, commissionPercentage } = req.body;

      if (!marketerId || !year) {
        return res.status(400).json({ error: "marketerId and year are required" });
      }

      // Check if annual summary already exists for this marketer and year
      const existingSummary = await db
        .select()
        .from(marketingAnnualSummary)
        .where(and(
          eq(marketingAnnualSummary.marketerId, marketerId),
          eq(marketingAnnualSummary.year, year)
        ))
        .limit(1);

      const targetData = {
        year,
        salesExecutive: "", // Will be filled from user data
        target: target ? target.toString() : "0",
        revisedTarget: revisedTarget ? revisedTarget.toString() : (target ? target.toString() : "0"),
        won: existingSummary[0]?.won || "0",
        targetAchieved: existingSummary[0]?.targetAchieved || "0",
        expectedOrders: existingSummary[0]?.expectedOrders || "0",
        statusQuo: existingSummary[0]?.statusQuo || "0",
        deviationFromTarget: existingSummary[0]?.deviationFromTarget || "0",
        sumSalesExpected: existingSummary[0]?.sumSalesExpected || "0",
        expectedTarget: revisedTarget ? revisedTarget.toString() : (target ? target.toString() : "0"),
        marketerId,
        bookingTarget: bookingTarget ? parseInt(bookingTarget) : 0,
        registrationTarget: registrationTarget ? parseInt(registrationTarget) : 0,
        commissionPercentage: commissionPercentage !== undefined ? parseInt(commissionPercentage) : 5,
      };

      if (existingSummary.length > 0) {
        // Update existing summary
        const updatedSummary = await db
          .update(marketingAnnualSummary)
          .set({
            target: targetData.target,
            revisedTarget: targetData.revisedTarget,
            expectedTarget: targetData.expectedTarget,
            bookingTarget: targetData.bookingTarget,
            registrationTarget: targetData.registrationTarget,
            commissionPercentage: targetData.commissionPercentage,
            updatedAt: new Date().toISOString()
          })
          .where(eq(marketingAnnualSummary.id, existingSummary[0].id))
          .returning();

        res.json({ annualSummary: updatedSummary[0] });
      } else {
        // Create new summary
        // Get user name for sales executive
        const user = await db
          .select({
            firstName: marketingUsers.firstName,
            lastName: marketingUsers.lastName,
          })
          .from(marketingUsers)
          .where(eq(marketingUsers.id, marketerId))
          .limit(1);

        const salesExecutive = user[0] ? `${user[0].firstName} ${user[0].lastName}` : "Unknown";

        const newSummary = await db
          .insert(marketingAnnualSummary)
          .values({
            ...targetData,
            salesExecutive,
            target: targetData.target,
            revisedTarget: targetData.revisedTarget,
            won: targetData.won,
            targetAchieved: targetData.targetAchieved,
            expectedOrders: targetData.expectedOrders,
            statusQuo: targetData.statusQuo,
            deviationFromTarget: targetData.deviationFromTarget,
            sumSalesExpected: targetData.sumSalesExpected,
            expectedTarget: targetData.expectedTarget,
            bookingTarget: targetData.bookingTarget,
            registrationTarget: targetData.registrationTarget,
            commissionPercentage: targetData.commissionPercentage,
          } as any)
          .returning();

        res.status(201).json({ annualSummary: newSummary[0] });
      }
    } catch (error) {
      console.error("Error setting target:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
