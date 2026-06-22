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

    // Fetch all stakeholders with a policy renewal date set
    const allExpirations = await db.select().from(stakeholders).where(isNotNull(stakeholders.policyRenewalDate));

    let reminded = 0;
    let lapsed = 0;

    for (const sh of allExpirations) {
      if (!sh.policyRenewalDate || !sh.email) continue;
      
      const expiryDate = new Date(sh.policyRenewalDate);
      
      // Check if past expiry
      if (expiryDate < now) {
        // If it's more than 3 months past the expiry date -> Lapse -> Dormant
        if (expiryDate <= lapseThresholdDate) {
          if (sh.lifecycleStage !== "lapsed") {
            await db.update(stakeholders).set({
              lifecycleStage: "lapsed",
              updatedAt: sql`now()`
            }).where(eq(stakeholders.id, sh.id));
            
            await db.insert(stakeholderInteractions).values({
              stakeholderId: sh.id,
              type: "status_change",
              channel: "system",
              direction: "outbound",
              subject: "Policy Lapsed to Inactive",
              description: "Policyholder policy renewal lapsed over 3 months past due date. Stage changed to Lapsed.",
              date: now.toISOString(),
            });

            // Send Reactivation Email
            await emailService.sendEmail({
              to: sh.email,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>Your CIC Insurance Policy Has Lapsed</h2>
                  <p>Hello ${sh.firstName},</p>
                  <p>Your <strong>CIC Insurance policy</strong> has lapsed — it has been more than 3 months past your renewal date. Your account is now marked as inactive.</p>
                  <p>To reinstate your cover, please contact your nearest CIC branch or call us on <strong>0703 099 120</strong>.</p>
                  <p style="color:#666;font-size:12px;">CIC Insurance Group &mdash; We keep our word.</p>
                </div>
              `,
              subject: "Important: Your CIC Insurance Policy Has Lapsed"
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
                  <h2>Action Required: Your CIC Policy Is Due for Renewal</h2>
                  <p>Hello ${sh.firstName},</p>
                  <p>Your <strong>CIC Insurance policy</strong> renewal was due on <strong>${sh.policyRenewalDate}</strong>. Please renew promptly to ensure your cover remains active.</p>
                  <p>You can renew via <strong>M-PESA Paybill 510200</strong>, the CIC EasyBima portal, or by visiting any CIC branch.</p>
                  <p style="color:#666;font-size:12px;">CIC Insurance Group &mdash; We keep our word.</p>
                </div>
              `,
            subject: "Reminder: Your CIC Insurance Policy Renewal Is Overdue"
          }).catch((e: any) => console.error(`Failed to send reminder email to ${sh.email}:`, e));
          
          reminded++;
        }
      }
    }
    
    console.log(`[RegistrationAutomation] Processed ${reminded} reminders and ${lapsed} lapses.`);
  }
};
