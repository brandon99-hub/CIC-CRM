export type IntakeType = "enquiry" | "complaint" | "lead" | "service_request";

export interface IntakeSignal {
    source: string;
    text: string;
    metadata?: any;
}

export const CategorizationService = {
    /**
     * Categorizes a raw inbound signal based on keyword analysis and source metadata.
     */
    categorize(signal: IntakeSignal): { type: IntakeType; priority: "low" | "medium" | "high" | "critical" } {
        const text = signal.text.toLowerCase();

        // 1. Complaint Logic (High Priority / Specific Keywords)
        const complaintKeywords = ["missing result", "failed", "dispute", "error", "delay", "rude", "complaint", "wrong", "overcharge"];
        if (complaintKeywords.some(kw => text.includes(kw))) {
            return { type: "complaint", priority: "high" };
        }

        // 2. Lead Logic (Marketing / Social Media / Interest)
        const leadKeywords = ["interest", "price", "cost", "how much", "how do i join", "scholarship", "prospectus", "partnership"];
        if (leadKeywords.some(kw => text.includes(kw)) || signal.source === "instagram" || signal.source === "facebook") {
            // Marketing/Social signals are often leads or general enquiries
            if (text.includes("complaint")) return { type: "complaint", priority: "medium" };
            return { type: "lead", priority: "medium" };
        }

        // 3. Service Request (Actionable tasks)
        const requestKeywords = ["certify", "authenticate", "renewal", "exempt", "registration", "book exam"];
        if (requestKeywords.some(kw => text.includes(kw))) {
            return { type: "service_request", priority: "medium" };
        }

        // Default: General Enquiry
        return { type: "enquiry", priority: "low" };
    }
};
