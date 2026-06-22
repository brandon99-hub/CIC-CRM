import "dotenv/config";
import { db } from "../db";
import { marketingUsers } from "../../shared/schema";
import { systemRoles, userRoles } from "../../shared/adminSchema";
import { eq } from "drizzle-orm";

async function auditUsers() {
    const users = await db.select().from(marketingUsers);
    const roles = await db.select().from(systemRoles);
    const assignments = await db.select().from(userRoles);

    const roleMap = new Map(roles.map(r => [r.id, r]));

    console.log("--- USER ROLE AUDIT ---");
    for (const user of users) {
        const userAssignments = assignments.filter(a => a.userId === user.id);
        const userRolesNames = userAssignments.map(a => roleMap.get(a.roleId)?.name || "Unknown");
        const userDashboards = new Set<string>();
        userAssignments.forEach(a => {
            const r = roleMap.get(a.roleId);
            if (r && Array.isArray(r.dashboards)) {
                r.dashboards.forEach(d => userDashboards.add(d));
            }
        });

        console.log(`User: ${user.email}`);
        console.log(`Roles: ${userRolesNames.join(", ")}`);
        console.log(`Dashboards: ${Array.from(userDashboards).join(", ")}`);
        console.log("------------------------");
    }

    process.exit(0);
}

auditUsers().catch(err => {
    console.error(err);
    process.exit(1);
});
