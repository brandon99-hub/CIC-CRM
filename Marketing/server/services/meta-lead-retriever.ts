import axios from "axios";
import crypto from "crypto";
import { db } from "../db";
import { metaPages } from "../../shared/commsSchema";
import { intakeSignals } from "../../shared/crmSchema";
import { eq } from "drizzle-orm";

import { SecurityService } from "./security-service";

export class MetaLeadRetriever {
    static async retrieveAndIngestLead(leadgenId: string, pageId: string) {
        const pageRecord = await db.query.metaPages.findFirst({
            where: eq(metaPages.pageId, pageId)
        });

        if (!pageRecord || !pageRecord.pageAccessToken) {
            console.error(`[MetaWebhook] No configured page or access token for pageId: ${pageId}`);
            return;
        }

        try {
            const pageAccessToken = SecurityService.decrypt(pageRecord.pageAccessToken);

            const response = await axios.get(`https://graph.facebook.com/v19.0/${leadgenId}`, {
                params: { access_token: pageAccessToken }
            });

            const leadData = response.data;
            const fields: Record<string, string> = {};
            
            if (leadData.field_data) {
                for (const item of leadData.field_data) {
                    if (item.values && item.values.length > 0) {
                        fields[item.name] = item.values[0];
                    }
                }
            }

            let rawPhone = fields["phone_number"] || fields["phone"] || "";
            if (rawPhone && !rawPhone.startsWith("+")) {
                if (rawPhone.startsWith("0")) {
                    rawPhone = "+254" + rawPhone.slice(1);
                } else if (rawPhone.startsWith("254")) {
                    rawPhone = "+" + rawPhone;
                }
            }

            const rawTextSummary = `Lead Form Submission - Name: ${fields["full_name"] || "Unknown"}, Email: ${fields["email"] || "None"}, Phone: ${rawPhone || "None"}`;

            await db.insert(intakeSignals).values({
                source: "meta_lead_ad",
                rawText: rawTextSummary,
                status: "pending",
                metadata: {
                    leadgenId: leadgenId,
                    formId: leadData.form_id || null,
                    pageId: pageId,
                    rawFieldData: fields,
                    timestamp: leadData.created_time
                }
            });

            console.log(`Successfully ingested Facebook Lead ID: ${leadgenId}`);

        } catch (error: any) {
            console.error(`Failed to retrieve lead data for ID ${leadgenId}:`, error.response?.data || error.message);
        }
    }
}
