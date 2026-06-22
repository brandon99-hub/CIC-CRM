import "dotenv/config";
import { db } from "../db";
import { marketingUsers } from "../../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function changeAdminPassword() {
    const email = "brandmwenja@gmail.com";
    const newPassword = "temp_pass@123";

    try {
        console.log(`Hashing new password for ${email}...`);
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        console.log(`Updating password in database...`);
        const result = await db
            .update(marketingUsers)
            .set({
                password: hashedPassword,
                mustChangePassword: false
            } as any)
            .where(eq(marketingUsers.email, email))
            .returning();

        if (result.length > 0) {
            console.log(`Successfully updated password for ${email}.`);
        } else {
            console.log(`User ${email} not found.`);
        }
    } catch (error) {
        console.error("Error updating password:", error);
    } finally {
        process.exit(0);
    }
}

changeAdminPassword();
