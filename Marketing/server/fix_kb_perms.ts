import "dotenv/config";
import { db } from "./db";
import { systemPermissions } from "../shared/adminSchema";
import { eq } from "drizzle-orm";

async function fixKbPerms() {
    console.log("Seeding Knowledge Base permissions...");

    const permissions = [
        {
            key: "cases.kb.manage",
            description: "Create, edit, and delete Knowledge Base items (Templates, Scripts, FAQs, Policies)",
            module: "cases",
            isActive: true
        },
        {
            key: "cases.escalation.manage",
            description: "Create, edit, and delete Escalation Procedures",
            module: "cases",
            isActive: true
        }
    ];

    for (const perm of permissions) {
        const existing = await db.select().from(systemPermissions).where(eq(systemPermissions.key, perm.key)).limit(1);
        if (existing.length === 0) {
            await db.insert(systemPermissions).values(perm as any);
            console.log(`✅ Created permission: ${perm.key}`);
        } else {
            console.log(`ℹ️ Permission ${perm.key} already exists.`);
        }
    }

    console.log("Done seeding Knowledge Base permissions!");
    process.exit(0);
}

fixKbPerms().catch(e => {
    console.error(e);
    process.exit(1);
});
