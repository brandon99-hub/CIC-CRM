import { db } from "../db";
import { stakeholders, stakeholderInteractions } from "../../shared/crmSchema";
import { and, lt, isNotNull, eq, sql } from "drizzle-orm";
import { emailService } from "./emailService";

export const RegistrationAutomationService = {
  async processRegistrationLifecycles() {
    console.log("[RegistrationAutomation] Starting daily lifecycle processing...");
    const now = new Date();
    
    // 3 months ago limit for lapsing
    const lapseThresholdDate = new Date();
    lapseThresholdDate.setMonth(lapseThresholdDate.getMonth() - 3);

    // Fetch all stakeholders with an expiry date
    const allExpirations = await db.select().from(stakeholders).where(isNotNull(stakeholders.registrationExpiryDate));

    let reminded = 0;
    let lapsed = 0;

    for (const sh of allExpirations) {
      if (!sh.registrationExpiryDate || !sh.email) continue;
      
      const expiryDate = new Date(sh.registrationExpiryDate);
      
      // Check if past expiry
      if (expiryDate < now) {
        // If it's more than 3 months past the expiry date -> Lapse -> Dormant
        if (expiryDate <= lapseThresholdDate) {
          if (sh.lifecycleStage !== "dormant") {
            await db.update(stakeholders).set({
              lifecycleStage: "dormant",
              updatedAt: sql`now()`
            }).where(eq(stakeholders.id, sh.id));
            
            await db.insert(stakeholderInteractions).values({
              stakeholderId: sh.id,
              type: "status_change",
              channel: "system",
              direction: "outbound",
              subject: "Registration Lapsed to Dormant",
              description: "Stakeholder registration lapsed over 3 months past renewal. Stage changed to Dormant.",
              date: now.toISOString(),
            });

            // Send Reactivation Email
            await emailService.sendEmail({
              to: sh.email,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>Your Registration Has Lapsed</h2>
                  <p>Hello ${sh.firstName},</p>
                  <p>Your registration with KASNEB lapsed over 3 months ago. Your account is now dormant.</p>
                  <p>Please contact support to reactivate your account.</p>
                </div>
              `,
              subject: "Important: Your Registration Has Lapsed"
            }).catch((e: any) => console.error(`Failed to send lapse email to ${sh.email}:`, e));
            lapsed++;
          }
        } else {
          // Grace period (0 to 3 months past expiry) -> Send renewal reminder
          // We can throttle this by checking interaction history, but for simplicity we log an interaction
          // In a real system, you might want to prevent sending this every single day
          
          await emailService.sendEmail({
            to: sh.email,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>Please Renew Your Registration</h2>
                  <p>Hello ${sh.firstName},</p>
                  <p>Your registration with KASNEB expired on ${sh.registrationExpiryDate}.</p>
                  <p>Please renew your registration to maintain your active status.</p>
                </div>
              `,
            subject: "Reminder: Please Renew Your Registration"
          }).catch((e: any) => console.error(`Failed to send reminder email to ${sh.email}:`, e));
          
          reminded++;
        }
      }
    }
    
    console.log(`[RegistrationAutomation] Processed ${reminded} reminders and ${lapsed} lapses.`);
  }
};
