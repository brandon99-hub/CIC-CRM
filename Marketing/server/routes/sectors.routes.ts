import type { Express } from "express";
import { db } from "../db";
import { marketingSectors } from "../../shared/schema";
import {
  marketingSectorCreateSchema,
  marketingSectorUpdateSchema,
  marketingQuerySchema,
} from "../../shared/marketingSchema";
import { marketingAuth, marketingAdminAuth } from "../middleware/marketingAuth";
import { eq, and, desc, ilike, count } from "drizzle-orm";
import { z } from "zod";

export function registerSectorsRoutes(app: Express) {
  // ─── List Sectors ──────────────────────────────────────────────────────────
  app.get("/api/marketing/sectors", marketingAuth, async (req, res) => {
    try {
      const { page, limit, search } = marketingQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;

      let whereCondition: any = eq(marketingSectors.isActive, true);

      if (search) {
        whereCondition = and(
          eq(marketingSectors.isActive, true),
          ilike(marketingSectors.name, `%${search}%`)
        );
      }

      const [sectors, totalCount] = await Promise.all([
        db
          .select()
          .from(marketingSectors)
          .where(whereCondition)
          .orderBy(desc(marketingSectors.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: count() }).from(marketingSectors).where(whereCondition),
      ]);

      res.json({
        sectors,
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

  // ─── Create Sector ─────────────────────────────────────────────────────────
  app.post("/api/marketing/sectors", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const sectorData = marketingSectorCreateSchema.parse(req.body);

      const newSector = await db
        .insert(marketingSectors)
        .values({
          ...sectorData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any)
        .returning();

      res.status(201).json({ sector: newSector[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Update Sector ─────────────────────────────────────────────────────────
  app.put(
    "/api/marketing/sectors/:id",
    marketingAuth,
    marketingAdminAuth,
    async (req, res) => {
      try {
        const { id } = req.params;
        const updateData = marketingSectorUpdateSchema.parse(req.body);

        const updatedSector = await db
          .update(marketingSectors)
          .set({ ...updateData, updatedAt: new Date().toISOString() } as any)
          .where(eq(marketingSectors.id, id as string))
          .returning();

        if (updatedSector.length === 0) {
          return res.status(404).json({ error: "Sector not found" });
        }

        res.json({ sector: updatedSector[0] });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ─── Deactivate Sector (soft-delete) ───────────────────────────────────────
  app.delete(
    "/api/marketing/sectors/:id",
    marketingAuth,
    marketingAdminAuth,
    async (req, res) => {
      try {
        const { id } = req.params;

        const updatedSector = await db
          .update(marketingSectors)
          .set({ isActive: false, updatedAt: new Date().toISOString() } as any)
          .where(eq(marketingSectors.id, id as string))
          .returning();

        if (updatedSector.length === 0) {
          return res.status(404).json({ error: "Sector not found" });
        }

        res.json({ message: "Sector deactivated successfully" });
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );
}
