import "dotenv/config";
import { db } from "./db";
import { systemPermissions } from "../shared/adminSchema";
import { eq, inArray } from "drizzle-orm";

async function fixStakeholderPerms() {
    console.log("Fixing stakeholder permissions...");

    // 1. Move stakeholders.view_all to stakeholders module
    await db.update(systemPermissions)
        .set({ module: "stakeholders" } as any)
        .where(eq(systemPermissions.key, "stakeholders.view_all"));
    console.log("Moved stakeholders.view_all to stakeholders module");

    // 2. Add stakeholders.delete if missing
    const delPerm = await db.select().from(systemPermissions).where(eq(systemPermissions.key, "stakeholders.delete")).limit(1);
    if (delPerm.length === 0) {
        await db.insert(systemPermissions).values({
            key: "stakeholders.delete",
            description: "Ability to delete stakeholder profiles",
            module: "stakeholders",
            isActive: true
        } as any);
        console.log("Created stakeholders.delete permission");
    } else {
        await db.update(systemPermissions).set({ module: "stakeholders" } as any).where(eq(systemPermissions.key, "stakeholders.delete"));
        console.log("stakeholders.delete already exists, updated module");
    }

    // 3. Ensure other stakeholder permissions are in the correct module
    await db.update(systemPermissions)
        .set({ module: "stakeholders" } as any)
        .where(inArray(systemPermissions.key, ["stakeholders.edit", "stakeholders.create", "stakeholders.view"]));
    console.log("Ensured edit/create/view are in stakeholders module");

    console.log("Done!");
    process.exit(0);
}

fixStakeholderPerms().catch(e => {
    console.error(e);
    process.exit(1);
});
