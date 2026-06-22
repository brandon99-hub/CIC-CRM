import "dotenv/config";
import { db } from "../db";
import { marketingUsers } from "../../shared/schema";
import { departments, systemRoles, userRoles } from "../../shared/adminSchema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seedUsers() {
    console.log("Starting user seeding...");

    const password = "Exlifes_69";
    const hashedPassword = await bcrypt.hash(password, 10);

    const allDepts = await db.select().from(departments);
    const mktDept = allDepts.find((d: any) => d.code === "MRK");
    if (!mktDept) {
        console.warn("Marketing department (MRK) not found. Please create it manually first.");
    }

    const marketingUserNames = [
        { first: "John", last: "D" }, { first: "Mary", last: "K" },
        { first: "Robert", last: "O" }, { first: "Jennifer", last: "M" },
        { first: "Michael", last: "W" }, { first: "Linda", last: "A" }
    ];

    // 2. Create/Update 6 Marketing users
    for (let i = 0; i < 6; i++) {
        const index = i + 16;
        const email = `test${index}@gmail.com`;
        const nameData = marketingUserNames[i];

        // Check if user exists
        const existing = await db.select().from(marketingUsers).where(eq(marketingUsers.email, email)).limit(1);

        const userData = {
            email,
            password: hashedPassword,
            firstName: nameData.first,
            lastName: nameData.last,
            role: "marketer",
            departmentId: mktDept?.id,
            mustChangePassword: false,
            dashboardAccess: JSON.stringify(["marketing"])
        };

        if (existing.length === 0) {
            await db.insert(marketingUsers).values(userData as any).returning();
            console.log(`Created Marketing user: ${email} (${nameData.first} ${nameData.last})`);
        } else {
            await db.update(marketingUsers).set(userData as any).where(eq(marketingUsers.id, existing[0].id));
            console.log(`Updated Marketing user: ${email} (${nameData.first} ${nameData.last})`);
        }
    }

    console.log("Marketing User Seeding completed successfully.");
    process.exit(0);
}

seedUsers().catch(err => {
    console.error("Seeding failed:", err);
    process.exit(1);
});
