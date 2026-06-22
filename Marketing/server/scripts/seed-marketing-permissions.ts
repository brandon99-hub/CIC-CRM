
import "dotenv/config";
import { db } from "../db";
import { systemPermissions, systemRoles, systemRolePermissions } from "../../shared/adminSchema";
import { eq, and } from "drizzle-orm";

async function seedMarketingPermissions() {
    console.log("🌱 Seeding Marketing Permissions...");

    const permissions = [
        { key: "marketing.view_roi", description: "View financial ROI data and performance dashboards", module: "marketing" },
        { key: "marketing.view_analytics", description: "View marketing performance analytics and charts", module: "marketing" },
        { key: "marketing.kanban.view", description: "View the marketing pipeline Kanban board", module: "marketing" },
        { key: "marketing.forecast.view", description: "View revenue forecasting charts", module: "marketing" },
        { key: "marketing.view_documents", description: "View and manage marketing documents", module: "marketing" },
        { key: "marketing.view_activities", description: "View and manage marketing activities", module: "marketing" },
    ];

    try {
        for (const perm of permissions) {
            const existing = await db.select().from(systemPermissions).where(eq(systemPermissions.key, perm.key)).limit(1);
            if (existing.length === 0) {
                await db.insert(systemPermissions).values(perm as any);
                console.log(`✅ Created permission: ${perm.key}`);
            } else {
                console.log(`ℹ️ Permission ${perm.key} already exists.`);
            }
        }

        // Auto-assign these to 'Admin' and 'Manager' roles if they exist
        const roles = await db.select().from(systemRoles);
        const adminRole = roles.find(r => r.name === "Admin");
        const managerRole = roles.find(r => r.name === "Manager");

        const allPerms = await db.select().from(systemPermissions).where(eq(systemPermissions.module, "marketing"));

        for (const role of [adminRole, managerRole]) {
            if (role) {
                for (const perm of allPerms) {
                    const existingLink = await db.select()
                        .from(systemRolePermissions)
                        .where(and(
                            eq(systemRolePermissions.roleId, role.id),
                            eq(systemRolePermissions.permissionId, perm.id)
                        ))
                        .limit(1);
                    
                    if (existingLink.length === 0) {
                        await db.insert(systemRolePermissions).values({
                            roleId: role.id,
                            permissionId: perm.id
                        } as any);
                        console.log(`🔗 linked ${perm.key} to ${role.name}`);
                    }
                }
            }
        }

        console.log("✨ Marketing Permission Seeding completed!");
    } catch (error) {
        console.error("❌ Seeding failed:", error);
    }
    process.exit(0);
}

seedMarketingPermissions();
