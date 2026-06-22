import type { Express } from "express";
import { db } from "../db";
import { marketingUsers } from "../../shared/schema";
import { userNotifications, userPreferences } from "../../shared/crmSchema";
import { marketingAuth } from "../middleware/marketingAuth";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";

export function registerProfileRoutes(app: Express) {
    // Get current user profile and preferences
    app.get("/api/profile", marketingAuth, async (req, res) => {
        try {
            const userId = req.marketingUser!.id;

            // Fetch user and preferences in parallel
            const [userResults, prefResults] = await Promise.all([
                db.select().from(marketingUsers).where(eq(marketingUsers.id, userId)).limit(1),
                db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1)
            ]);

            if (userResults.length === 0) {
                return res.status(404).json({ error: "User not found" });
            }

            const user = userResults[0];
            let preferences = prefResults[0];

            // Initialize preferences if they don't exist
            if (!preferences) {
                const [newPrefs] = await db.insert(userPreferences).values({
                    userId,
                    notifyOnAssignment: true,
                    notifyOnSlaWarning: true,
                    notifyOnComment: true,
                    emailNotifications: true,
                    inAppNotifications: true,
                } as any).returning();
                preferences = newPrefs;
            }

            res.json({
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phoneNumber: user.phoneNumber,
                    role: user.role,
                    createdAt: user.createdAt,
                },
                preferences
            });
        } catch (error) {
            console.error("Error fetching profile:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Update profile details
    app.patch("/api/profile", marketingAuth, async (req, res) => {
        try {
            const userId = req.marketingUser!.id;
            const updateSchema = z.object({
                firstName: z.string().min(1).optional(),
                lastName: z.string().min(1).optional(),
                phoneNumber: z.string().optional(),
            });

            const data = updateSchema.parse(req.body);

            const updatedUser = await db.update(marketingUsers)
                .set({ ...data, updatedAt: new Date().toISOString() } as any)
                .where(eq(marketingUsers.id, userId))
                .returning();

            res.json({
                user: {
                    id: updatedUser[0].id,
                    firstName: updatedUser[0].firstName,
                    lastName: updatedUser[0].lastName,
                    phoneNumber: updatedUser[0].phoneNumber,
                }
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: "Validation error", details: error.errors });
            }
            console.error("Error updating profile:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Update preferences
    app.patch("/api/profile/preferences", marketingAuth, async (req, res) => {
        try {
            const userId = req.marketingUser!.id;
            const prefSchema = z.object({
                notifyOnAssignment: z.boolean().optional(),
                notifyOnSlaWarning: z.boolean().optional(),
                notifyOnComment: z.boolean().optional(),
                emailNotifications: z.boolean().optional(),
                inAppNotifications: z.boolean().optional(),
            });

            const data = prefSchema.parse(req.body);

            const updatedPrefs = await db.update(userPreferences)
                .set({ ...data, updatedAt: new Date().toISOString() } as any)
                .where(eq(userPreferences.userId, userId))
                .returning();

            res.json({ preferences: updatedPrefs[0] });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: "Validation error", details: error.errors });
            }
            console.error("Error updating preferences:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Get notifications
    app.get("/api/notifications", marketingAuth, async (req, res) => {
        try {
            const userId = req.marketingUser!.id;
            const notifications = await db.select()
                .from(userNotifications)
                .where(eq(userNotifications.userId, userId))
                .orderBy(desc(userNotifications.createdAt))
                .limit(50);

            res.json({ notifications });
        } catch (error) {
            console.error("Error fetching notifications:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Mark notification as read
    app.patch("/api/notifications/:id/read", marketingAuth, async (req, res) => {
        try {
            const userId = req.marketingUser!.id;
            const { id } = req.params;

            await db.update(userNotifications)
                .set({ isRead: true } as any)
                .where(and(eq(userNotifications.id, id as string), eq(userNotifications.userId, userId as string)));

            res.json({ success: true });
        } catch (error) {
            console.error("Error marking notification as read:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Mark all as read
    app.post("/api/notifications/read-all", marketingAuth, async (req, res) => {
        try {
            const userId = req.marketingUser!.id;

            await db.update(userNotifications)
                .set({ isRead: true } as any)
                .where(eq(userNotifications.userId, userId));

            res.json({ success: true });
        } catch (error) {
            console.error("Error marking all as read:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });
}
