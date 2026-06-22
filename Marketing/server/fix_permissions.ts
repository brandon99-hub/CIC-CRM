import "dotenv/config";
import { db } from "./db";
import { marketingUsers } from "../shared/schema";
import { systemRoles, systemPermissions, systemRolePermissions, userRoles } from "../shared/adminSchema";
import { eq, and } from "drizzle-orm";

async function fixPermissions() {
    try {
        console.log("Starting permission fix...");

        // 1. Ensure 'admin.view' permission exists
        const adminViewKey = "admin.view";
        let adminViewPerm = await db.select().from(systemPermissions).where(eq(systemPermissions.key, adminViewKey)).limit(1);

        if (adminViewPerm.length === 0) {
            console.log("Creating 'admin.view' permission...");
            const created = await db.insert(systemPermissions).values({
                key: adminViewKey,
                description: "Access to administrative dashboard and bypass for global checks",
                module: "admin",
                isActive: true
            } as any).returning();
            adminViewPerm = created;
        }
        const permId = adminViewPerm[0].id;

        // 2. Ensure 'Admin' role has 'admin.view'
        const adminRole = await db.select().from(systemRoles).where(eq(systemRoles.name, "Admin")).limit(1);
        if (adminRole.length > 0) {
            const roleId = adminRole[0].id;
            const linkExists = await db.select().from(systemRolePermissions)
                .where(and(eq(systemRolePermissions.roleId, roleId), eq(systemRolePermissions.permissionId, permId)))
                .limit(1);

            if (linkExists.length === 0) {
                console.log("Linking 'admin.view' to 'Admin' role...");
                await db.insert(systemRolePermissions).values({
                    roleId: roleId,
                    permissionId: permId
                } as any);
            }

            // Ensure Admin role has ALL dashboard access and is marked as a system role
            console.log("Updating Admin role dashboard access and isSystem flag...");
            await db.update(systemRoles)
                .set({
                    dashboards: ["marketing", "cases", "stakeholders", "executive", "admin"],
                    isSystem: true,
                } as any)
                .where(eq(systemRoles.id, roleId));
        }

        // 3. Ensure 'test3@gmail.com' has 'Admin' role
        const targetEmail = "test3@gmail.com";
        const user = await db.select().from(marketingUsers).where(eq(marketingUsers.email, targetEmail)).limit(1);

        if (user.length > 0 && adminRole.length > 0) {
            const userId = user[0].id;
            const roleId = adminRole[0].id;

            const userRoleExists = await db.select().from(userRoles)
                .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
                .limit(1);

            if (userRoleExists.length === 0) {
                console.log(`Assigning 'Admin' role to ${targetEmail}...`);
                await db.insert(userRoles).values({
                    userId: userId,
                    roleId: roleId
                } as any);
            }
        }

        // 4. Also add other critical missing permissions to Admin role
        const criticalKeys = [
            "admin.create",
            "admin.edit",
            "admin.delete",
            "admin.users.manage",
            "admin.roles.manage",
            "admin.departments.manage",
            "admin.categories.manage",
            "admin.sla.manage",
            "admin.escalation.manage",
            "admin.workflows.manage",
            "admin.integrations.manage",
            "admin.audit.view",
            "admin.roles.view",
            "admin.departments.view",
            "admin.categories.view",
            "admin.sla.view",
            "marketing.view_all",
            "marketing.view_campaigns",
            "marketing.create_campaigns",
            "marketing.view_surveys",
            "marketing.create_surveys",
            "marketing.view_assigned",
            "cases.view_all",
            "cases.view_channel_dist",
            "cases.view_volume_trends",
            "cases.view_hotspots",
            "cases.create",
            "cases.escalate",
            "stakeholders.view_all"
        ];
 
        const keyDescriptions: Record<string, string> = {
            "marketing.view_campaigns": "View marketing campaigns",
            "marketing.create_campaigns": "Create and manage marketing campaigns",
            "marketing.view_surveys": "View feedback surveys and responses",
            "marketing.create_surveys": "Create and manage feedback surveys",
            "marketing.view_assigned": "View only marketing data assigned to the user",
            "cases.create": "Create new support cases manually",
            "cases.escalate": "Manually escalate cases to other departments or supervisors"
        };

        for (const key of criticalKeys) {
            let perm = await db.select().from(systemPermissions).where(eq(systemPermissions.key, key)).limit(1);
            if (perm.length === 0) {
                console.log(`Creating '${key}' permission...`);
                const created = await db.insert(systemPermissions).values({
                    key: key,
                    description: keyDescriptions[key] || `Access for ${key}`,
                    module: key.startsWith("marketing") ? "marketing" : (key.startsWith("cases") ? "cases" : "admin"),
                    isActive: true
                } as any).returning();
                perm = created;
            }

            if (adminRole.length > 0) {
                const roleId = adminRole[0].id;
                const permId = perm[0].id;
                const linkExists = await db.select().from(systemRolePermissions)
                    .where(and(eq(systemRolePermissions.roleId, roleId), eq(systemRolePermissions.permissionId, permId)))
                    .limit(1);
                if (linkExists.length === 0) {
                    console.log(`Linking '${key}' to 'Admin' role...`);
                    await db.insert(systemRolePermissions).values({
                        roleId: roleId,
                        permissionId: permId
                    } as any);
                }
            }
        }

        // 5. Assign view permissions to non-admin roles to fix dashboard redirection
        const viewKeys = [
            "admin.roles.view",
            "admin.departments.view",
            "admin.categories.view",
            "admin.sla.view"
        ];

        const otherRolesNames = ["Case Management Officer", "Manager", "Executive", "Marketer", "Business Development"];

        for (const roleName of otherRolesNames) {
            const role = await db.select().from(systemRoles).where(eq(systemRoles.name, roleName)).limit(1);
            if (role.length > 0) {
                const roleId = role[0].id;
                for (const key of viewKeys) {
                    const perm = await db.select().from(systemPermissions).where(eq(systemPermissions.key, key)).limit(1);
                    if (perm.length > 0) {
                        const permId = perm[0].id;
                        const linkExists = await db.select().from(systemRolePermissions)
                            .where(and(eq(systemRolePermissions.roleId, roleId), eq(systemRolePermissions.permissionId, permId)))
                            .limit(1);
                        if (linkExists.length === 0) {
                            console.log(`Linking '${key}' to '${roleName}' role...`);
                            await db.insert(systemRolePermissions).values({
                                roleId: roleId,
                                permissionId: permId
                            } as any);
                        }
                    }
                }
            }
        }

        // 6. Fix Case Filtering Permissions
        console.log("Fixing Case Filtering permissions...");
        const managerRole = await db.select().from(systemRoles).where(eq(systemRoles.name, "Manager")).limit(1);
        const officerRole = await db.select().from(systemRoles).where(eq(systemRoles.name, "Case Management Officer")).limit(1);

        if (managerRole.length > 0) {
            const roleId = managerRole[0].id;
            // Remove view_all if exists
            const viewAllPerm = await db.select().from(systemPermissions).where(eq(systemPermissions.key, "cases.view_all")).limit(1);
            if (viewAllPerm.length > 0) {
                console.log("Removing 'cases.view_all' from Manager role...");
                await db.delete(systemRolePermissions)
                    .where(and(eq(systemRolePermissions.roleId, roleId), eq(systemRolePermissions.permissionId, viewAllPerm[0].id)));
            }

            // Ensure view_department
            const viewDeptKey = "cases.view_department";
            let viewDeptPerm = await db.select().from(systemPermissions).where(eq(systemPermissions.key, viewDeptKey)).limit(1);
            if (viewDeptPerm.length === 0) {
                const created = await db.insert(systemPermissions).values({
                    key: viewDeptKey,
                    description: "View cases in assigned department",
                    module: "cases",
                    isActive: true
                } as any).returning();
                viewDeptPerm = created;
            }
            const linkDept = await db.select().from(systemRolePermissions)
                .where(and(eq(systemRolePermissions.roleId, roleId), eq(systemRolePermissions.permissionId, viewDeptPerm[0].id)))
                .limit(1);
            if (linkDept.length === 0) {
                console.log("Linking 'cases.view_department' to Manager role...");
                await db.insert(systemRolePermissions).values({ roleId: roleId, permissionId: viewDeptPerm[0].id } as any);
            }
        }

        if (officerRole.length > 0) {
            const roleId = officerRole[0].id;
            // Ensure view_assigned
            const viewAssignedKey = "cases.view_assigned";
            let viewAssignedPerm = await db.select().from(systemPermissions).where(eq(systemPermissions.key, viewAssignedKey)).limit(1);
            if (viewAssignedPerm.length === 0) {
                const created = await db.insert(systemPermissions).values({
                    key: viewAssignedKey,
                    description: "View cases assigned to the user",
                    module: "cases",
                    isActive: true
                } as any).returning();
                viewAssignedPerm = created;
            }
            const linkAssigned = await db.select().from(systemRolePermissions)
                .where(and(eq(systemRolePermissions.roleId, roleId), eq(systemRolePermissions.permissionId, viewAssignedPerm[0].id)))
                .limit(1);
            if (linkAssigned.length === 0) {
                console.log("Linking 'cases.view_assigned' to Case Management Officer role...");
                await db.insert(systemRolePermissions).values({ roleId: roleId, permissionId: viewAssignedPerm[0].id } as any);
            }
        }

        console.log("Permission fix completed successfully.");

    } catch (e) {
        console.error("Error during permission fix:", e);
    }
}

fixPermissions().then(() => process.exit(0));
