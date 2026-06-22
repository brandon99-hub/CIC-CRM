import "dotenv/config";
import { db } from "../db";
import { marketingUsers } from "../../shared/schema";
import { departments, systemRoles, userRoles } from "../../shared/adminSchema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seedUsers() {
    console.log("Starting user seeding...");

    const password = "Temp_pass_69";
    const hashedPassword = await bcrypt.hash(password, 10);

    const allDepts = await db.select().from(departments);
    if (allDepts.length === 0) {
        console.warn("No departments found. Please run automation seed first.");
        return;
    }

    const firstNames = ["John", "Mary", "Robert", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy"];
    const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"];
    
    let userCounter = 1;
    for (const dept of allDepts) {
        console.log(`Seeding 3 users for department: ${dept.code} - ${dept.name}`);
        for (let i = 0; i < 3; i++) {
            const first = firstNames[Math.floor(Math.random() * firstNames.length)];
            const last = lastNames[Math.floor(Math.random() * lastNames.length)];
            const email = `${first.toLowerCase()}.${last.toLowerCase()}${userCounter}@cic.co.ke`;
            const phone = `+254 7${Math.floor(Math.random() * 90000000 + 10000000)}`;

            const userData = {
                email,
                password: hashedPassword,
                firstName: first,
                lastName: last,
                phoneNumber: phone,
                role: "user",
                departmentId: dept.id,
                mustChangePassword: false,
                dashboardAccess: JSON.stringify(["marketing", "cases"])
            };

            const existing = await db.select().from(marketingUsers).where(eq(marketingUsers.email, email)).limit(1);

            if (existing.length === 0) {
                await db.insert(marketingUsers).values(userData as any).returning();
                console.log(`  -> Created: ${email} (${first} ${last}) [${dept.code}]`);
            } else {
                await db.update(marketingUsers).set(userData as any).where(eq(marketingUsers.id, existing[0].id));
                console.log(`  -> Updated: ${email} (${first} ${last}) [${dept.code}]`);
            }
            userCounter++;
        }
    }

    console.log("CIC User Seeding completed successfully.");
    process.exit(0);
}

seedUsers().catch(err => {
    console.error("Seeding failed:", err);
    process.exit(1);
});
