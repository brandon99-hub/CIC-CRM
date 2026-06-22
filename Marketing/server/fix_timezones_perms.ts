import "dotenv/config";
import { db } from "./db";
import { systemPermissions, systemRoles, systemRolePermissions } from "../shared/adminSchema";
import { eq } from "drizzle-orm";

async function fixTimezonesPerms() {
    console.log("Seeding Timezones permissions...");

    const permKey = "admin.timezones.manage";
    const permDesc = "Create, edit, and delete geographical regions and timezones";
    const permModule = "admin";

    // 1. Check if permission exists
    let permissionId;
    const existingPerm = await db.select().from(systemPermissions).where(eq(systemPermissions.key, permKey)).limit(1);
    
    if (existingPerm.length === 0) {
        const result = await db.insert(systemPermissions).values({
            key: permKey,
            description: permDesc,
            module: permModule,
            isActive: true
        } as any).returning();
        permissionId = result[0].id;
        console.log(`✅ Created permission: ${permKey}`);
    } else {
        permissionId = existingPerm[0].id;
        console.log(`ℹ️ Permission ${permKey} already exists.`);
    }

    // 2. Find System Admin role
    const systemAdminRole = await db.select().from(systemRoles).where(eq(systemRoles.name, 'System Admin')).limit(1);
    if (systemAdminRole.length > 0) {
        const roleId = systemAdminRole[0].id;
        // 3. Assign permission to System Admin if not already assigned
        const existingAssigned = await db.select().from(systemRolePermissions).where(eq(systemRolePermissions.permissionId, permissionId)).limit(1);
        const alreadyAssigned = existingAssigned.some(rp => rp.roleId === roleId);

        if (!alreadyAssigned) {
            await db.insert(systemRolePermissions).values({
                roleId: roleId,
                permissionId: permissionId
            } as any);
            console.log(`✅ Assigned ${permKey} to System Admin role.`);
        } else {
            console.log(`ℹ️ ${permKey} is already assigned to System Admin role.`);
        }
    } else {
        console.log("⚠️ System Admin role not found, skipping automatic assignment.");
    }

    console.log("Done seeding Timezones permissions!");
    process.exit(0);
}

fixTimezonesPerms().catch(e => {
    console.error(e);
    process.exit(1);
});
