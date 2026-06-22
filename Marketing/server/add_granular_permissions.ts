import "dotenv/config";
import { db } from "./db";
import { systemPermissions } from "../shared/adminSchema";
import { eq } from "drizzle-orm";

async function addGranularPermissions() {
    console.log("🌱 Seeding Granular Marketing Permissions...");

    const permissions = [
        {
            key: "marketing.view_annual_summary",
            description: "Enables access to view the Annual Summary performance table and B2C commission structures",
            module: "marketing",
            isActive: true
        },
        {
            key: "marketing.view_top_performers",
            description: "Enables access to view the Top Performers leaderboard and ranking insights",
            module: "marketing",
            isActive: true
        },
        {
            key: "marketing.view_sales_won_vs_target",
            description: "Enables access to view individual closed sales/conversions vs set targets charts",
            module: "marketing",
            isActive: true
        }
    ];

    try {
        for (const perm of permissions) {
            const existing = await db
                .select()
                .from(systemPermissions)
                .where(eq(systemPermissions.key, perm.key))
                .limit(1);

            if (existing.length === 0) {
                await db.insert(systemPermissions).values(perm as any);
                console.log(`✅ Successfully seeded granular permission: ${perm.key}`);
            } else {
                console.log(`ℹ️ Granular permission already exists: ${perm.key}`);
            }
        }
        console.log("✨ Seeding process completed successfully!");
    } catch (error) {
        console.error("❌ Seeding granular permissions failed:", error);
    }
    process.exit(0);
}

addGranularPermissions();
