
import { db } from "../db";
import { departments, systemRoles, serviceCategories, slaRules, escalationChains, escalationSteps, workflowRules } from "../../shared/adminSchema";
import { eq, and } from "drizzle-orm";

async function seedAutomation() {
    console.log("🌱 Starting automation seeding...");

    try {
        // 1. Fetch Department IDs
        const allDepts = await db.select().from(departments);
        const deptMap = new Map(allDepts.map(d => [d.code, d.id]));

        const examDeptId = deptMap.get("EXAM");
        const finDeptId = deptMap.get("FIN");
        const regDeptId = deptMap.get("REG");
        const genDeptId = deptMap.get("GEN");

        if (!examDeptId || !finDeptId) {
            console.error("❌ Required departments (EXAM, FIN) not found. Please ensure departments are seeded first.");
            return;
        }

        // 2. Seed Service Categories
        console.log("Creating Service Categories...");
        const categories = [
            { name: "Exam Appeal", code: "EXAM_APPEAL", description: "Student disputing an exam result", departmentId: examDeptId, defaultPriority: "high", keywords: ["appeal", "remark", "grade", "failed", "incorrect", "accounting", "law", "exam result"] },
            { name: "Result Query", code: "RESULT_QUERY", description: "General query about exam results", departmentId: examDeptId, defaultPriority: "medium", keywords: ["when", "release", "dates", "query", "missing", "grade"] },
            { name: "Fee Dispute", code: "FIN_DISPUTE", description: "Discrepancy in student account or fees", departmentId: finDeptId, defaultPriority: "high", keywords: ["balance", "m-pesa", "paid", "receipt", "wrong amount", "overcharge", "dispute"] },
            { name: "Refund Request", code: "REFUND_REQ", description: "Request for fee refund", departmentId: finDeptId, defaultPriority: "medium", keywords: ["refund", "money back", "overpaid", "withdrawal"] },
            { name: "Registration Issue", code: "REG_ISSUE", description: "Problem with student registration", departmentId: regDeptId, defaultPriority: "medium", keywords: ["register", "login", "portal", "password", "activation", "account"] },
            { name: "General Enquiry", code: "GEN_ENQUIRY", description: "General walk-in or portal enquiry", departmentId: genDeptId, defaultPriority: "low", keywords: ["how", "where", "info", "help", "price", "cost"] },
        ];

        const insertedCategories = [];
        for (const cat of categories) {
            const existing = await db.select().from(serviceCategories).where(eq(serviceCategories.code, cat.code)).limit(1);
            if (existing.length === 0) {
                const res = await db.insert(serviceCategories).values(cat as any).returning();
                insertedCategories.push(res[0]);
                console.log(`✅ Created category: ${cat.name}`);
            } else {
                // Upsert: always update keywords on existing categories
                const updated = await db.update(serviceCategories)
                    .set({ keywords: cat.keywords, description: cat.description, defaultPriority: cat.defaultPriority } as any)
                    .where(eq(serviceCategories.code, cat.code))
                    .returning();
                insertedCategories.push(updated[0]);
                console.log(`🔄 Updated keywords for: ${cat.name}`);
            }
        }

        // Fetch ALL categories (including those seeded by other scripts) to ensure SLAs can be linked
        const dbCategories = await db.select().from(serviceCategories);
        const allAvailableCategories = [...dbCategories];
        console.log(`📊 Found ${allAvailableCategories.length} categories in database.`);

        // 3. Seed SLA Rules
        console.log("Creating/Updating SLA Rules...");

        // Map of category codes to their specific SLA requirements
        const categorySlas = [
            { catCode: "EXAM_MISSING", priority: "high", resp: 120, res: 1440, name: "Missing Results SLA" },
            { catCode: "CERT_PROC", priority: "medium", resp: 240, res: 4320, name: "Certificate Process SLA" },
            { catCode: "TRANS_REQ", priority: "low", resp: 240, res: 2880, name: "Transcript Request SLA" },
            { catCode: "EXAM_DEFER", priority: "medium", resp: 120, res: 2880, name: "Exam Deferment SLA" },
            { catCode: "INST_ACC", priority: "medium", resp: 1440, res: 20160, name: "Accreditation SLA" },
            { catCode: "CERT_VERIF", priority: "medium", resp: 240, res: 1440, name: "Cert Verification SLA" },
            { catCode: "FEE_STMT", priority: "medium", resp: 120, res: 1440, name: "Fee Statement SLA" },
            { catCode: "REFUND_REQ", priority: "low", resp: 240, res: 7200, name: "Refund Request SLA" },
            { catCode: "LEGAL_COMP", priority: "high", resp: 60, res: 7200, name: "Compliance/Legal SLA" },
            { catCode: "MKT_SOCIAL", priority: "medium", resp: 30, res: 240, name: "Social Media SLA" },
            { catCode: "FIN_DISPUTE", priority: "high", resp: 240, res: 1440, name: "Finance Dispute SLA" },
            { catCode: "GEN_ENQUIRY", priority: "low", resp: 480, res: 2880, name: "General Enquiry SLA" },
            { catCode: "RESULT_QUERY", priority: "medium", resp: 120, res: 480, name: "Result Query SLA" },
            { catCode: "EXAM_APPEAL", priority: "critical", resp: 60, res: 240, name: "Urgent Exam Review SLA" }
        ];

        const insertedSlas = [];

        // First, handle the generic priority-based SLAs as fallbacks
        const genericSlas = [
            { name: "Global Critical SLA", priority: "critical", responseTimeMinutes: 60, resolutionTimeMinutes: 240 },
            { name: "Global High SLA", priority: "high", responseTimeMinutes: 120, resolutionTimeMinutes: 480 },
            { name: "Global Standard SLA", priority: "medium", responseTimeMinutes: 240, resolutionTimeMinutes: 1440 },
            { name: "Global Low SLA", priority: "low", responseTimeMinutes: 480, resolutionTimeMinutes: 2880 },
        ];

        for (const sla of genericSlas) {
            const existing = await db.select().from(slaRules).where(eq(slaRules.name, sla.name)).limit(1);
            if (existing.length === 0) {
                const res = await db.insert(slaRules).values(sla as any).returning();
                insertedSlas.push(res[0]);
                console.log(`✅ Created Global SLA: ${sla.name}`);
            } else {
                insertedSlas.push(existing[0]);
                console.log(`ℹ️ Global SLA ${sla.name} exists.`);
            }
        }

        // Now, handle the category-specific SLAs
        for (const spec of categorySlas) {
            const cat = allAvailableCategories.find(c => c.code === spec.catCode);
            if (!cat) {
                console.warn(`⚠️ Category ${spec.catCode} not found for SLA seeding.`);
                continue;
            }

            const slaVal = {
                name: spec.name,
                priority: spec.priority,
                responseTimeMinutes: spec.resp,
                resolutionTimeMinutes: spec.res,
                serviceCategoryId: cat.id
            };

            const existing = await db.select().from(slaRules).where(eq(slaRules.name, spec.name)).limit(1);
            if (existing.length === 0) {
                const res = await db.insert(slaRules).values(slaVal as any).returning();
                insertedSlas.push(res[0]);
                console.log(`✅ Created Category SLA: ${spec.name} -> ${spec.catCode}`);
            } else {
                const updated = await db.update(slaRules)
                    .set(slaVal as any)
                    .where(eq(slaRules.id, existing[0].id))
                    .returning();
                insertedSlas.push(updated[0]);
                console.log(`🔄 Updated Category SLA: ${spec.name}`);
            }
        }

        // 4. Seed Escalation Chains & Steps
        console.log("Creating Escalation Chains...");
        const roles = await db.select().from(systemRoles);
        const managerRole = roles.find(r => r.name === "Manager");
        const adminRole = roles.find(r => r.name === "Admin");

        // Exams Escalation Chain
        const examAppealCat = insertedCategories.find(c => c.code === "EXAM_APPEAL");
        const highSla = insertedSlas.find(s => s.priority === "high");

        if (examAppealCat && highSla) {
            const chainName = "Exams Appeal Escalation";
            let chain;
            const existingChain = await db.select().from(escalationChains).where(eq(escalationChains.name, chainName)).limit(1);

            if (existingChain.length === 0) {
                const res = await db.insert(escalationChains).values({
                    name: chainName,
                    serviceCategoryId: examAppealCat.id,
                    slaId: highSla.id,
                    priority: "high",
                    isActive: true
                } as any).returning();
                chain = res[0];
                console.log(`✅ Created Chain: ${chainName}`);
            } else {
                chain = existingChain[0];
                console.log(`ℹ️ Chain ${chainName} already exists.`);
            }

            // Steps
            const steps = [
                { chainId: chain.id, stepOrder: 1, assigneeRoleId: managerRole?.id, escalateAfterMinutes: 120, description: "Escalate to Exams Manager" },
                { chainId: chain.id, stepOrder: 2, assigneeDepartmentId: examDeptId, escalateAfterMinutes: 480, description: "Escalate to Exams Department Head" }
            ];

            for (const step of steps) {
                const existingStep = await db.select().from(escalationSteps).where(and(eq(escalationSteps.chainId, chain.id), eq(escalationSteps.stepOrder, step.stepOrder))).limit(1);
                if (existingStep.length === 0) {
                    await db.insert(escalationSteps).values(step as any);
                    console.log(`✅ Created Step ${step.stepOrder} for ${chainName}`);
                }
            }
        }

        // Finance Escalation Chain
        const finDisputeCat = insertedCategories.find(c => c.code === "FIN_DISPUTE");
        if (finDisputeCat && highSla) {
            const chainName = "Finance Dispute Escalation";
            let chain;
            const existingChain = await db.select().from(escalationChains).where(eq(escalationChains.name, chainName)).limit(1);

            if (existingChain.length === 0) {
                const res = await db.insert(escalationChains).values({
                    name: chainName,
                    serviceCategoryId: finDisputeCat.id,
                    slaId: highSla.id,
                    priority: "high",
                    isActive: true
                } as any).returning();
                chain = res[0];
                console.log(`✅ Created Chain: ${chainName}`);
            } else {
                chain = existingChain[0];
                console.log(`ℹ️ Chain ${chainName} already exists.`);
            }

            const steps = [
                { chainId: chain.id, stepOrder: 1, assigneeRoleId: managerRole?.id, escalateAfterMinutes: 120, description: "Escalate to Finance Manager" },
                { chainId: chain.id, stepOrder: 2, assigneeDepartmentId: finDeptId, escalateAfterMinutes: 480, description: "Escalate to Finance Department Head" }
            ];

            for (const step of steps) {
                const existingStep = await db.select().from(escalationSteps).where(and(eq(escalationSteps.chainId, chain.id), eq(escalationSteps.stepOrder, step.stepOrder))).limit(1);
                if (existingStep.length === 0) {
                    await db.insert(escalationSteps).values(step as any);
                    console.log(`✅ Created Step ${step.stepOrder} for ${chainName}`);
                }
            }
        }

        // 5. Seed Workflow Rules
        console.log("Creating Workflow Rules...");
        const workflows = [
            {
                name: "Appeal Priority Auto-Set",
                description: "Automatically set priority to high for exam appeals",
                serviceCategoryId: examAppealCat?.id,
                triggerEvent: "case_created",
                conditions: [{ field: "service_category_id", operator: "eq", value: examAppealCat?.id }],
                actions: [{ type: "set_priority", params: { priority: "high" } }],
                isActive: true
            },
            {
                name: "Finance Dispute Notification",
                description: "Notify student when a finance dispute case is opened",
                serviceCategoryId: finDisputeCat?.id,
                triggerEvent: "case_created",
                conditions: [{ field: "service_category_id", operator: "eq", value: finDisputeCat?.id }],
                actions: [{ type: "send_notification", params: { value: "Kindly Pay Fees" } }],
                isActive: true
            }
        ];

        for (const wf of workflows) {
            const existing = await db.select().from(workflowRules).where(eq(workflowRules.name, wf.name)).limit(1);
            if (existing.length === 0) {
                await db.insert(workflowRules).values(wf as any);
                console.log(`✅ Created Workflow Rule: ${wf.name}`);
            } else {
                console.log(`ℹ️ Workflow Rule ${wf.name} already exists.`);
            }
        }

        console.log("✨ Seeding completed successfully!");
    } catch (error) {
        console.error("❌ Error during seeding:", error);
    }
}

seedAutomation();
