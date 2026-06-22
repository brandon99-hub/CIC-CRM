import "dotenv/config";
import fs from "fs";
import path from "path";
import { db } from "../db";
import { systemPermissions } from "../../shared/adminSchema";
import { sql } from "drizzle-orm";

async function importPermissions() {
  try {
    const dumpPath = path.resolve(process.cwd(), "permissions_dump.json");
    console.log(`Reading permissions from ${dumpPath}...`);
    
    if (!fs.existsSync(dumpPath)) {
      console.error("Permissions dump file not found.");
      process.exit(1);
    }

    const rawData = fs.readFileSync(dumpPath, "utf-8");
    const permissions = JSON.parse(rawData);

    if (!Array.isArray(permissions)) {
      console.error("Invalid format: expected an array of permissions.");
      process.exit(1);
    }

    console.log(`Found ${permissions.length} permissions to import.`);

    const batchSize = 100;
    for (let i = 0; i < permissions.length; i += batchSize) {
      const batch = permissions.slice(i, i + batchSize).map((p: any) => ({
        id: p.id,
        key: p.key,
        description: p.description,
        module: p.module,
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }));

      console.log(`Importing batch ${i / batchSize + 1} (${batch.length} records)...`);
      
      await db.insert(systemPermissions).values(batch).onConflictDoUpdate({
        target: systemPermissions.key,
        set: {
          description: sql`EXCLUDED.description`,
          module: sql`EXCLUDED.module`,
          isActive: sql`EXCLUDED.is_active`
        }
      });
    }

    console.log("Import completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to import permissions:", error);
    process.exit(1);
  }
}

importPermissions();
