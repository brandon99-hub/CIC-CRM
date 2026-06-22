import "dotenv/config";
import { db } from "../db";
import { departments } from "../../shared/adminSchema";
import { eq } from "drizzle-orm";

async function seedDepartments() {
    const depts = [
        { name: "Claims", code: "CLAIMS", description: "Claims processing" },
        { name: "Finance", code: "FINANCE", description: "Finance and accounting" },
        { name: "Underwriting", code: "UNDERWRITING", description: "Policy underwriting" },
        { name: "Customer Care", code: "CUSTOMER_CARE", description: "Customer support" },
        { name: "Sales", code: "SALES", description: "Sales and marketing" },
        { name: "Marketing", code: "MRK", description: "Marketing department" }
    ];

    for (const d of depts) {
        const existing = await db.select().from(departments).where(eq(departments.code, d.code)).limit(1);
        if (existing.length === 0) {
            await db.insert(departments).values(d as any);
            console.log(`Created department: ${d.name}`);
        } else {
            console.log(`Department already exists: ${d.name}`);
        }
    }
    process.exit(0);
}
seedDepartments();
