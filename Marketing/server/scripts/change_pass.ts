import "dotenv/config";
import { db } from "../db";
import { marketingUsers } from "../../shared/schema";
import { systemRoles, userRoles, systemPermissions, systemRolePermissions } from "../../shared/adminSchema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function provisionAdmin() {
    const email = "brandmwenja@gmail.com";
    const newPassword = "temp_pass@123";

    try {
        console.log(`Hashing password for ${email}...`);
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 1. Upsert Admin User
        console.log(`Checking if user exists...`);
        let [user] = await db.select().from(marketingUsers).where(eq(marketingUsers.email, email)).limit(1);

        if (user) {
            console.log(`User found. Updating...`);
            [user] = await db.update(marketingUsers).set({
                password: hashedPassword,
                mustChangePassword: false,
                role: "admin",
                dashboardAccess: JSON.stringify(["marketing", "stakeholders", "cases", "executive", "admin"])
            }).where(eq(marketingUsers.email, email)).returning();
        } else {
            console.log(`Creating new user...`);
            [user] = await db.insert(marketingUsers).values({
                email,
                password: hashedPassword,
                firstName: "Brand",
                lastName: "Admin",
                role: "admin",
                isActive: true,
                mustChangePassword: false,
                dashboardAccess: JSON.stringify(["marketing", "stakeholders", "cases", "executive", "admin"])
            }).returning();
        }

        // 2. Upsert Admin Role
        console.log(`Checking if Admin role exists...`);
        let [role] = await db.select().from(systemRoles).where(eq(systemRoles.name, "admin")).limit(1);
        if (!role) {
            console.log(`Creating Admin role...`);
            [role] = await db.insert(systemRoles).values({
                name: "admin",
                description: "Super Administrator Role",
                isSystem: true,
                isActive: true,
                dashboards: JSON.stringify(["marketing", "stakeholders", "cases", "executive", "admin"])
            }).returning();
        }

        // 3. Assign Role to User
        console.log(`Assigning Admin role to user...`);
        const existingMapping = await db.select().from(userRoles).where(and(eq(userRoles.userId, user.id), eq(userRoles.roleId, role.id))).limit(1);
        if (existingMapping.length === 0) {
            await db.insert(userRoles).values({
                userId: user.id,
                roleId: role.id
            });
        }

        // 4. Assign All Permissions to Admin Role
        console.log(`Fetching all system permissions...`);
        const allPerms = await db.select().from(systemPermissions);
        console.log(`Found ${allPerms.length} permissions.`);

        if (allPerms.length > 0) {
            console.log(`Wiping existing permissions for Admin role to refresh...`);
            await db.delete(systemRolePermissions).where(eq(systemRolePermissions.roleId, role.id));

            console.log(`Assigning ${allPerms.length} permissions to Admin role...`);
            const permMappings = allPerms.map(p => ({
                roleId: role.id,
                permissionId: p.id
            }));

            // Insert in batches of 100
            for (let i = 0; i < permMappings.length; i += 100) {
                await db.insert(systemRolePermissions).values(permMappings.slice(i, i + 100));
            }
        }

        console.log(`Successfully provisioned Admin account, role, and permissions.`);
    } catch (error) {
        console.error("Error provisioning admin account:", error);
    } finally {
        process.exit(0);
    }
}

provisionAdmin();
