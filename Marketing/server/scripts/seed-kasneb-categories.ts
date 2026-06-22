import "dotenv/config";
import { db } from "../db";
import { departments, serviceCategories } from "../../shared/adminSchema";
import { eq } from "drizzle-orm";

async function seedCategories() {
    console.log("--- Seeding KASNEB Service Categories ---");

    try {
        // 1. Fetch available departments
        const allDepts = await db.select().from(departments);
        const getDept = (code: string) => allDepts.find(d => d.code === code);

        const examDept = getDept("EXAM");
        const finDept = getDept("FIN");
        const regDept = getDept("REG");
        const legDept = getDept("LEG");
        const genDept = getDept("GEN");

        const categories = [
            {
                name: "Missing Exam Results",
                code: "EXAM_MISSING",
                description: "Inquiry regarding results not appearing after an exam series (e.g., November sittings).",
                departmentId: examDept?.id,
                defaultPriority: "medium",
                keywords: ["missing results", "exam result", "result status", "not appearing", "missing mark", "corporate governance"]
            },
            {
                name: "Certificate Processing",
                code: "CERT_PROC",
                description: "Status tracking and requests for collection or dispatch of physical certificates.",
                departmentId: examDept?.id,
                defaultPriority: "medium",
                keywords: ["certificate", "collection", "dispatch", "parchment", "lost certificate", "physical copy"]
            },
            {
                name: "Transcript Request",
                code: "TRANS_REQ",
                description: "Generation and dispatch of official academic transcripts for students and employers.",
                departmentId: examDept?.id,
                defaultPriority: "low",
                keywords: ["transcript", "academic record", "official copy", "grades list", "academic history"]
            },
            {
                name: "Exam Deferment",
                code: "EXAM_DEFER",
                description: "Requests to move current exam sittings to a subsequent series due to medical or social reasons.",
                departmentId: regDept?.id,
                defaultPriority: "medium",
                keywords: ["defer", "postpone", "next sitting", "reschedule exam", "deferment", "medical grounds"]
            },
            {
                name: "Institution Accreditation",
                code: "INST_ACC",
                description: "New school approvals, inspection scheduling, and renewal of accreditation status.",
                departmentId: regDept?.id,
                defaultPriority: "medium",
                keywords: ["accreditation", "inspection", "new institution", "renewal", "school approval", "training center"]
            },
            {
                name: "Certificate Verification",
                code: "CERT_VERIF",
                description: "Third-party requests (usually from employers) to confirm the validity of student credentials.",
                departmentId: regDept?.id,
                defaultPriority: "medium",
                keywords: ["verification", "verify", "employers portal", "validity", "candidate check", "auth"]
            },
            {
                name: "Fee Statement Inquiry",
                code: "FEE_STMT",
                description: "Discrepancies in student fee accounts, payment reflects, and general balance history.",
                departmentId: finDept?.id,
                defaultPriority: "medium",
                keywords: ["fee statement", "balance inquiry", "payment status", "statement discrepancy", "ledger"]
            },
            {
                name: "Refund Request",
                code: "REFUND_REQ",
                description: "Formal requests for overpayment or cancellation refunds processed via finance.",
                departmentId: finDept?.id,
                defaultPriority: "low",
                keywords: ["refund", "repayment", "money back", "overpaid", "excess payment", "claim"]
            },
            {
                name: "Compliance Issue",
                code: "LEGAL_COMP",
                description: "Institutional regulatory compliance risks, litigation, and ethical flags.",
                departmentId: legDept?.id,
                defaultPriority: "high",
                keywords: ["compliance", "regulatory", "legal requirement", "ethics", "litigation", "court"]
            },
            {
                name: "General Enquiry",
                code: "GEN_ENQUIRY",
                description: "General questions regarding KASNEB services not covered by specific departments.",
                departmentId: genDept?.id,
                defaultPriority: "low",
                keywords: ["info", "how to", "details", "query", "asking", "help", "information"]
            },
            {
                name: "Social Media Outreach",
                code: "MKT_SOCIAL",
                description: "Engagement, brand mentions, and enquiries originating from social platforms (Meta, LinkedIn).",
                departmentId: genDept?.id,
                defaultPriority: "medium",
                keywords: ["facebook", "twitter", "mention", "social media", "dm", "comment", "linkedin"]
            },
            {
                name: "Exam Fee Dispute",
                code: "FIN_DISPUTE",
                description: "Discrepancy in student account specifically regarding exam registration payments.",
                departmentId: finDept?.id,
                defaultPriority: "high",
                keywords: ["fee dispute", "exam payment", "discrepancy", "payment failed", "transaction"]
            }
        ];

        for (const cat of categories) {
            const existing = await db.select().from(serviceCategories).where(eq(serviceCategories.code, cat.code)).limit(1);
            if (existing.length === 0) {
                await db.insert(serviceCategories).values(cat as any);
                console.log(`Created: ${cat.name}`);
            } else {
                await db.update(serviceCategories).set(cat as any).where(eq(serviceCategories.code, cat.code));
                console.log(`Updated: ${cat.name}`);
            }
        }

        console.log("Seeding completed.");
        process.exit(0);
    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    }
}

seedCategories();
