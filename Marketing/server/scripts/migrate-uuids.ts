import "dotenv/config";
import { db } from "../db";
import { sql } from "drizzle-orm";

async function run() {
    const queries = [
        `ALTER TABLE "marketing_projects" ALTER COLUMN "sector_id" TYPE uuid USING NULLIF("sector_id", '')::uuid;`,
        `ALTER TABLE "marketing_projects" ALTER COLUMN "lead_marketer" TYPE uuid USING NULLIF("lead_marketer", '')::uuid;`,

        `ALTER TABLE "marketing_leads" ALTER COLUMN "marketer_id" TYPE uuid USING NULLIF("marketer_id", '')::uuid;`,
        `ALTER TABLE "marketing_leads" ALTER COLUMN "sector_id" TYPE uuid USING NULLIF("sector_id", '')::uuid;`,
        `ALTER TABLE "marketing_leads" ALTER COLUMN "shared_with_marketer_id" TYPE uuid USING NULLIF("shared_with_marketer_id", '')::uuid;`,

        `ALTER TABLE "marketing_prospects" ALTER COLUMN "marketer_id" TYPE uuid USING NULLIF("marketer_id", '')::uuid;`,
        `ALTER TABLE "marketing_prospects" ALTER COLUMN "sector_id" TYPE uuid USING NULLIF("sector_id", '')::uuid;`,
        `ALTER TABLE "marketing_prospects" ALTER COLUMN "shared_with_marketer_id" TYPE uuid USING NULLIF("shared_with_marketer_id", '')::uuid;`,

        `ALTER TABLE "marketing_sales_won" ALTER COLUMN "marketer_id" TYPE uuid USING NULLIF("marketer_id", '')::uuid;`,

        `ALTER TABLE "marketing_expected_orders" ALTER COLUMN "marketer_id" TYPE uuid USING NULLIF("marketer_id", '')::uuid;`,

        `ALTER TABLE "marketing_annual_summary" ALTER COLUMN "marketer_id" TYPE uuid USING NULLIF("marketer_id", '')::uuid;`,

        `ALTER TABLE "marketing_lost_projects" ALTER COLUMN "marketer_id" TYPE uuid USING NULLIF("marketer_id", '')::uuid;`
    ];

    for (const q of queries) {
        try {
            console.log("Running:", q);
            await db.execute(sql.raw(q));
        } catch (err: any) {
            console.error("Failed:", q, "- Reason:", err.message);
        }
    }
    console.log("Migration complete.");
    process.exit(0);
}

run();
