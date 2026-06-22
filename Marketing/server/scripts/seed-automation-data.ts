import "dotenv/config";
import { db } from "../db";
import { departments, systemRoles, serviceCategories, slaRules, escalationChains, escalationSteps, workflowRules } from "../../shared/adminSchema";
import { marketingUsers } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

async function seedAutomation() {
    console.log("🌱 Starting CIC Insurance automation seeding...");

    try {
        // 1. Fetch Department IDs (seeded separately — these are CIC departments)
        const allDepts = await db.select().from(departments);
        const deptMap = new Map(allDepts.map(d => [d.code, d.id]));

        const claimsDeptId = deptMap.get("CLAIMS");
        const financeDeptId = deptMap.get("FINANCE");
        const underwritingDeptId = deptMap.get("UNDERWRITING");
        const customerCareDeptId = deptMap.get("CUSTOMER_CARE");
        const salesDeptId = deptMap.get("SALES");

        // Fallback: if CIC depts not yet seeded, try legacy codes as safety net
        const fallbackDeptId = claimsDeptId || allDepts[0]?.id;

        if (!claimsDeptId || !financeDeptId) {
            console.warn("⚠️  CIC departments (CLAIMS, FINANCE) not found. Ensure departments are seeded first.");
        }

        // 2. Seed CIC Insurance Service Categories
        console.log("Creating CIC Service Categories...");
        const categories = [
            {
                name: "Claims Dispute",
                code: "CLAIMS_DISPUTE",
                description: "Client disputing a claims settlement decision or valuation",
                departmentId: claimsDeptId || fallbackDeptId,
                defaultPriority: "high"
            },
            {
                name: "Claims Status Inquiry",
                code: "CLAIMS_STATUS",
                description: "General query on the status of a submitted claim",
                departmentId: claimsDeptId || fallbackDeptId,
                defaultPriority: "medium"
            },
            {
                name: "Premium Dispute",
                code: "PREMIUM_DISPUTE",
                description: "Discrepancy in premium charged or M-PESA payment not reflected",
                departmentId: financeDeptId || fallbackDeptId,
                defaultPriority: "high"
            },
            {
                name: "Claim Payout Request",
                code: "CLAIM_PAYOUT",
                description: "Request for processing or expediting a claim payout",
                departmentId: financeDeptId || fallbackDeptId,
                defaultPriority: "medium"
            },
            {
                name: "Policy Enrollment Issue",
                code: "POLICY_ENROLLMENT",
                description: "Problem with new policy onboarding or cover activation",
                departmentId: underwritingDeptId || fallbackDeptId,
                defaultPriority: "medium"
            },
            {
                name: "Policy Amendment Request",
                code: "POLICY_AMENDMENT",
                description: "Request to amend policy details — beneficiaries, coverage, endorsements",
                departmentId: underwritingDeptId || fallbackDeptId,
                defaultPriority: "medium"
            },
            {
                name: "Renewal Notice",
                code: "RENEWAL_NOTICE",
                description: "Policy renewal inquiry, renewal quote request, or renewal processing",
                departmentId: salesDeptId || fallbackDeptId,
                defaultPriority: "medium"
            },
            {
                name: "General Inquiry",
                code: "GEN_INQUIRY",
                description: "General walk-in, portal, or social inquiry about CIC products and services",
                departmentId: customerCareDeptId || fallbackDeptId,
                defaultPriority: "low"
            },
        ];

        const insertedCategories = [];
        for (const cat of categories) {
            const existing = await db.select().from(serviceCategories).where(eq(serviceCategories.code, cat.code)).limit(1);
            if (existing.length === 0) {
                const res = await db.insert(serviceCategories).values(cat as any).returning();
                insertedCategories.push(res[0]);
                console.log(`✅ Created category: ${cat.name}`);
            } else {
                const updated = await db.update(serviceCategories)
                    .set({ description: cat.description, defaultPriority: cat.defaultPriority } as any)
                    .where(eq(serviceCategories.code, cat.code))
                    .returning();
                insertedCategories.push(updated[0]);
                console.log(`🔄 Updated category details for: ${cat.name}`);
            }
        }

        // Fetch ALL categories in DB (including any seeded by other scripts)
        const dbCategories = await db.select().from(serviceCategories);
        const allAvailableCategories = [...dbCategories];
        console.log(`📊 Found ${allAvailableCategories.length} categories in database.`);

        // 3. Seed SLA Rules
        console.log("Creating/Updating SLA Rules...");

        // Global priority fallback SLAs
        const genericSlas = [
            { name: "Global Critical SLA", priority: "critical", responseTimeMinutes: 60, resolutionTimeMinutes: 240 },
            { name: "Global High SLA", priority: "high", responseTimeMinutes: 120, resolutionTimeMinutes: 480 },
            { name: "Global Standard SLA", priority: "medium", responseTimeMinutes: 240, resolutionTimeMinutes: 1440 },
            { name: "Global Low SLA", priority: "low", responseTimeMinutes: 480, resolutionTimeMinutes: 2880 },
        ];

        const insertedSlas = [];
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

        // Category-specific SLAs for CIC Insurance
        const categorySlas = [
            { catCode: "CLAIMS_DISPUTE",   priority: "critical", resp: 60,   res: 240,   name: "Claims Dispute Urgent SLA", metricType: "resolution_time" },
            { catCode: "CLAIMS_STATUS",    priority: "medium",   resp: 120,  res: 480,   name: "Claims Status SLA", metricType: "first_response_time" },
            { catCode: "PREMIUM_DISPUTE",  priority: "high",     resp: 120,  res: 1440,  name: "Premium Dispute SLA", metricType: "processing_time" },
            { catCode: "CLAIM_PAYOUT",     priority: "medium",   resp: 240,  res: 4320,  name: "Claim Payout SLA", metricType: "delivery_time" },
            { catCode: "POLICY_ENROLLMENT",priority: "medium",   resp: 240,  res: 2880,  name: "Policy Enrollment SLA", metricType: "resolution_time" },
            { catCode: "POLICY_AMENDMENT", priority: "low",      resp: 240,  res: 2880,  name: "Policy Amendment SLA", metricType: "processing_time" },
            { catCode: "RENEWAL_NOTICE",   priority: "medium",   resp: 120,  res: 2880,  name: "Renewal Notice SLA", metricType: "delivery_time" },
            { catCode: "GEN_INQUIRY",      priority: "low",      resp: 480,  res: 2880,  name: "General Inquiry SLA", metricType: "first_response_time" },
            { catCode: "LEGAL_COMP",       priority: "high",     resp: 60,   res: 7200,  name: "Compliance/Legal SLA", metricType: "resolution_time" },
            { catCode: "MKT_SOCIAL",       priority: "medium",   resp: 30,   res: 240,   name: "Social Media SLA", metricType: "first_response_time" },
        ];

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
                metricType: spec.metricType,
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
        console.log("Creating CIC Escalation Chains...");
        
        const allUsers = await db.select().from(marketingUsers);
        const getStaff = (deptId: string | undefined) => allUsers.find(u => u.departmentId === deptId);

        const highSla = insertedSlas.find(s => s.priority === "high");

        // Claims Dispute Escalation
        const claimsDisputeCat = insertedCategories.find(c => c.code === "CLAIMS_DISPUTE");
        if (claimsDisputeCat && highSla) {
            const chainName = "Claims Dispute Escalation";
            let chain;
            const existingChain = await db.select().from(escalationChains).where(eq(escalationChains.name, chainName)).limit(1);

            if (existingChain.length === 0) {
                const res = await db.insert(escalationChains).values({
                    name: chainName,
                    serviceCategoryId: claimsDisputeCat.id,
                    slaId: highSla.id,
                    priority: "critical",
                    isActive: true
                } as any).returning();
                chain = res[0];
                console.log(`✅ Created Chain: ${chainName}`);
            } else {
                chain = existingChain[0];
                console.log(`ℹ️ Chain ${chainName} already exists.`);
            }

            const staff1 = getStaff(claimsDeptId);
            const staff2 = allUsers.filter(u => u.departmentId === claimsDeptId)[1] || staff1;
            const steps = [
                { chainId: chain.id, stepOrder: 1, assigneeUserId: staff1?.id, escalateAfterMinutes: 60, description: "Escalate to Claims Specialist" },
                { chainId: chain.id, stepOrder: 2, assigneeUserId: staff2?.id, assigneeDepartmentId: claimsDeptId, escalateAfterMinutes: 240, description: "Escalate to Claims Department Head" }
            ];

            for (const step of steps) {
                const existingStep = await db.select().from(escalationSteps).where(and(eq(escalationSteps.chainId, chain.id), eq(escalationSteps.stepOrder, step.stepOrder))).limit(1);
                if (existingStep.length === 0) {
                    await db.insert(escalationSteps).values(step as any);
                    console.log(`✅ Created Step ${step.stepOrder} for ${chainName}`);
                }
            }
        }

        // Premium Dispute Escalation
        const premiumDisputeCat = insertedCategories.find(c => c.code === "PREMIUM_DISPUTE");
        if (premiumDisputeCat && highSla) {
            const chainName = "Premium Dispute Escalation";
            let chain;
            const existingChain = await db.select().from(escalationChains).where(eq(escalationChains.name, chainName)).limit(1);

            if (existingChain.length === 0) {
                const res = await db.insert(escalationChains).values({
                    name: chainName,
                    serviceCategoryId: premiumDisputeCat.id,
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

            const fStaff1 = getStaff(financeDeptId);
            const fStaff2 = allUsers.filter(u => u.departmentId === financeDeptId)[1] || fStaff1;
            const steps = [
                { chainId: chain.id, stepOrder: 1, assigneeUserId: fStaff1?.id, escalateAfterMinutes: 120, description: "Escalate to Finance Analyst" },
                { chainId: chain.id, stepOrder: 2, assigneeUserId: fStaff2?.id, assigneeDepartmentId: financeDeptId, escalateAfterMinutes: 480, description: "Escalate to Finance Department Head" }
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
        console.log("Creating CIC Workflow Rules...");
        const workflows = [
            {
                name: "Claims Dispute Priority Auto-Set",
                description: "Automatically escalate priority to critical for all claims disputes",
                serviceCategoryId: claimsDisputeCat?.id,
                triggerEvent: "case_created",
                conditions: [{ field: "service_category_id", operator: "eq", value: claimsDisputeCat?.id }],
                actions: [{ type: "set_priority", params: { priority: "critical" } }],
                isActive: true
            },
            {
                name: "Premium Dispute Notification",
                description: "Notify client when a premium dispute case is opened for transparency",
                serviceCategoryId: premiumDisputeCat?.id,
                triggerEvent: "case_created",
                conditions: [{ field: "service_category_id", operator: "eq", value: premiumDisputeCat?.id }],
                actions: [{ type: "send_notification", params: { value: "Your premium dispute has been received. Our Finance team will contact you within 2 business hours." } }],
                isActive: true
            },
            {
                name: "Renewal Due Auto-Flag",
                description: "Flag renewal cases as medium priority and route to Sales team automatically",
                serviceCategoryId: insertedCategories.find(c => c.code === "RENEWAL_NOTICE")?.id,
                triggerEvent: "case_created",
                conditions: [{ field: "service_category_id", operator: "eq", value: insertedCategories.find(c => c.code === "RENEWAL_NOTICE")?.id }],
                actions: [{ type: "assign_department", params: { departmentId: salesDeptId } }],
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

        console.log("✨ CIC Insurance automation seeding completed successfully!");
    } catch (error) {
        console.error("❌ Error during CIC seeding:", error);
    }
}

seedAutomation();
