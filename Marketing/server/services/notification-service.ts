import { db } from "../db";
import { userNotifications, userPreferences } from "../../shared/crmSchema";
import { eq, and } from "drizzle-orm";

export class NotificationService {
    static async createNotification(userId: string, type: string, title: string, message: string, link?: string) {
        try {
            // 1. Get user preferences
            let [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);

            // If no prefs exist, create default
            if (!prefs) {
                [prefs] = await db.insert(userPreferences).values({
                    userId,
                    emailNotifications: true,
                    inAppNotifications: true,
                    notifyOnAssignment: true,
                    notifyOnSlaWarning: true,
                    notifyOnComment: true
                }).returning();
            }

            // 2. Check if this notification should be sent based on type
            let shouldSend = prefs.inAppNotifications;
            if (type === 'assignment' && !prefs.notifyOnAssignment) shouldSend = false;
            if (type === 'sla_warning' && !prefs.notifyOnSlaWarning) shouldSend = false;
            if (type === 'comment' && !prefs.notifyOnComment) shouldSend = false;

            if (shouldSend) {
                await db.insert(userNotifications).values({
                    userId,
                    type,
                    title,
                    message,
                    link,
                    isRead: false,
                    createdAt: new Date().toISOString()
                });
            }

            // 3. Handle Email (Future expansion)
            if (prefs.emailNotifications) {
                // Email logic would go here
                console.log(`[EMAIL] To: ${userId}, Title: ${title}`);
            }

        } catch (error) {
            console.error("Error creating notification:", error);
        }
    }
}
