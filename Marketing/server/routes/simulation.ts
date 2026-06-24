import { Express } from "express";
import { SimulationService } from "../services/simulation-service";
import { marketingAuth, marketingAdminAuth } from "./marketing";
import { db } from "../db";
import { stakeholders, intakeSignals, cases, caseHistory, caseComments, caseAttachments, stakeholderInteractions, stakeholderRelationships, knowledgeBase } from "../../shared/crmSchema";
import { departments, serviceCategories } from "../../shared/adminSchema";
import { cicLeads } from "../../shared/cicSchema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

export function registerSimulationRoutes(app: Express) {
    // 1. Trigger Scenario
    app.post("/api/simulation/scenario", marketingAuth, async (req, res) => {
        try {
            const { scenario } = req.body;
            if (!scenario) return res.status(400).json({ error: "Scenario is required" });

            const result = await SimulationService.triggerScenario(scenario);
            res.json({ message: "Scenario triggered successfully", case: result });
        } catch (error) {
            console.error("Simulation Error:", error);
            res.status(500).json({ error: "Failed to trigger scenario" });
        }
    });

    // 2. Custom Signal
    app.post("/api/simulation/signal", marketingAuth, async (req, res) => {
        try {
            const { source, text, metadata } = req.body;
            if (!source || !text) return res.status(400).json({ error: "Source and text are required" });

            const result = await SimulationService.simulateSignal({ source, text, metadata });
            res.json({ message: "Signal simulated successfully", case: result });
        } catch (error) {
            console.error("Simulation Error:", error);
            res.status(500).json({ error: "Failed to simulate signal" });
        }
    });

    // 3. Seed Stakeholders
    app.post("/api/simulation/seed-stakeholders", marketingAuth, async (req, res) => {
        try {
            const result = await SimulationService.seedStakeholders();
            res.json(result);
        } catch (error) {
            console.error("Stakeholder Seeding Error:", error);
            res.status(500).json({ error: "Failed to seed stakeholders" });
        }
    });

    // 4. Clear All Cases (keeps users, stakeholders, admin tables)
    app.post("/api/simulation/clear-cases", marketingAuth, async (req, res) => {
        try {
            // Delete in dependency order (children first)
            await db.delete(caseHistory);
            await db.delete(caseComments);
            await db.delete(caseAttachments);
            await db.delete(intakeSignals);
            await db.delete(stakeholderInteractions);
            await db.delete(cases);

            res.json({ message: "All cases, history, comments, attachments, interactions and triage signals cleared." });
        } catch (error) {
            console.error("Clear Cases Error:", error);
            res.status(500).json({ error: "Failed to clear cases" });
        }
    });

    app.post("/api/simulation/seed-templates", marketingAuth, async (req, res) => {
        try {
            // Seed 3 Knowledge Base Templates
            const cats = await db.select().from(serviceCategories).limit(3);
            if (cats.length >= 3) {
                const templatesData = [
                    {
                        title: "Standard Motor Claim Procedure",
                        category: "template",
                        isTemplate: true,
                        serviceCategoryId: cats[0].id,
                        rootCause: "Driver Error / Accident",
                        resolutionSummary: "Claim assessed and processed according to motor policy.",
                        sopSteps: ["Verify driver license and police abstract", "Assess vehicle damage", "Approve repair estimate", "Issue release letter"],
                        isPublished: true,
                        content: "This template covers the standard procedure for handling motor claims."
                    },
                    {
                        title: "General Health Pre-Auth",
                        category: "template",
                        isTemplate: true,
                        serviceCategoryId: cats[1].id,
                        rootCause: "Medical Necessity / Illness",
                        resolutionSummary: "Pre-auth approved based on inpatient policy limits.",
                        sopSteps: ["Verify member eligibility", "Review medical report and diagnosis", "Confirm hospital panel status", "Issue pre-auth letter"],
                        isPublished: true,
                        content: "Template for handling standard health pre-authorizations."
                    },
                    {
                        title: "Pension Payout Process",
                        category: "template",
                        isTemplate: true,
                        serviceCategoryId: cats[2].id,
                        rootCause: "Retirement / Separation",
                        resolutionSummary: "Pension funds disbursed to the verified member account.",
                        sopSteps: ["Verify member identity and separation letter", "Calculate accrued benefits", "Obtain RBA approval if necessary", "Process payment via finance"],
                        isPublished: true,
                        content: "Guidelines for processing member pension payouts."
                    }
                ];

                let seeded = 0;
                for (const tmpl of templatesData) {
                    const existingTmpl = await db.select().from(knowledgeBase).where(eq(knowledgeBase.title, tmpl.title)).limit(1);
                    if (existingTmpl.length === 0) {
                        await db.insert(knowledgeBase).values(tmpl as any);
                        seeded++;
                    }
                }
                res.json({ message: `Successfully seeded ${seeded} templates.` });
            } else {
                res.status(400).json({ message: "Not enough service categories to seed templates." });
            }
        } catch (error) {
            console.error("Seed Templates Error:", error);
            res.status(500).json({ error: "Failed to seed templates" });
        }
    });

    // 5. Full Reseed (Clear + Seed Stakeholders + Trigger 20 cases)
    app.post("/api/simulation/reseed", marketingAuth, async (req, res) => {
        try {
            const result = await SimulationService.reseedSystem();
            res.json(result);
        } catch (error) {
            console.error("Reseed Error:", error);
            res.status(500).json({ error: "Failed to perform system reseed" });
        }
    });

    // 6. Simulate Marketing Leads (CIC Pipeline Seed)
    // Generates synthetic B2C/B2B leads in cic_simulation_leads staging table.
    // Pre-flight: requires at least one department with is_marketing_department = true.
    app.post("/api/simulate/marketing-leads", marketingAuth, async (req, res) => {
        const bodySchema = z.object({
            pipeline_type: z.enum(["b2c", "b2b", "both"]).default("both"),
            count: z.number().int().min(5).max(50).default(20),
            stage_distribution: z.enum(["spread", "stage_1_only"]).default("spread"),
        });

        try {
            const { pipeline_type, count: volume, stage_distribution } = bodySchema.parse(req.body);
            const spreadStages = stage_distribution === "spread";

            // Pre-flight: verify marketing department is configured
            const [mktDept] = await db
                .select({ id: departments.id, name: departments.name })
                .from(departments)
                .where(eq(departments.isMarketingDepartment, true))
                .limit(1);

            if (!mktDept) {
                return res.status(422).json({
                    error: "marketing_dept_not_configured",
                    message: "No department has been flagged as the Marketing Department. Please configure this in Settings → Departments before running a simulation.",
                });
            }

            // ── Name pools (authentic Kenyan names) ─────────────────────────────
            const kenyanFirstNames = [
                "Amina", "Brian", "Caroline", "David", "Esther",
                "Francis", "Grace", "Hassan", "Irene", "James",
                "Kamau", "Lillian", "Moses", "Nancy", "Oscar",
                "Purity", "Quentin", "Rose", "Simon", "Tabitha",
            ];
            const kenyanLastNames = [
                "Wanjiku", "Otieno", "Kamau", "Njoroge", "Achieng",
                "Mutua", "Kiprop", "Mugo", "Odhiambo", "Waweru",
                "Ndungu", "Chebet", "Mwangi", "Adhiambo", "Kimani",
            ];
            const saccoNames = [
                "Kenya Police SACCO", "Harambee SACCO", "Mwalimu National SACCO",
                "Stima SACCO", "Kenya Bankers SACCO", "Tower SACCO",
                "Unaitas SACCO", "IMARIKA SACCO", "Bingwa SACCO",
                "UN SACCO", "Winas SACCO", "Kimisitu SACCO",
                "Kenya Airports SACCO", "Nation SACCO", "Afya SACCO",
            ];
            const corporateNames = [
                "Safaricom Ltd", "KCB Group", "Equity Bank", "Kenya Airways",
                "East African Breweries", "Nation Media Group", "Bamburi Cement",
                "KenGen", "KPLC", "Nairobi Hospital", "Aga Khan Hospital",
                "Kenya Railways", "KETRACO", "WPP Scangroup", "Co-op Bank",
            ];
            const kenyanCounties = [
                "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret",
                "Nyeri", "Machakos", "Meru", "Thika", "Garissa",
            ];
            
            const countriesData = [
                { country: "Kenya", regions: kenyanCounties, weight: 60 },
                { country: "Uganda", regions: ["Kampala", "Wakiso", "Mukono", "Jinja", "Mbarara"], weight: 20 },
                { country: "Malawi", regions: ["Lilongwe", "Blantyre", "Zomba", "Mzuzu"], weight: 10 },
                { country: "South Sudan", regions: ["Juba", "Malakal", "Wau", "Yei"], weight: 10 }
            ];

            const b2cOccupations = ["Teacher", "Doctor", "Engineer", "Business Owner", "Accountant", "Nurse", "Lawyer"];

            // ── Product line weights ─────────────────────────────────────────────
            const b2cProducts = [
                { product: "motor", weight: 35 }, { product: "medical", weight: 25 },
                { product: "life", weight: 20 }, { product: "personal_accident", weight: 10 },
                { product: "last_expense", weight: 10 },
            ];
            const b2bProducts = [
                { product: "medical", weight: 40 }, { product: "group_life", weight: 30 },
                { product: "personal_accident", weight: 15 }, { product: "pension", weight: 15 },
            ];
            const b2bOrgTypes = [
                { type: "sacco", weight: 45 }, { type: "corporate", weight: 30 },
                { type: "ngo", weight: 10 }, { type: "school", weight: 10 }, { type: "government", weight: 5 },
            ];
            const b2cStages = [
                { stage: "lead", weight: 40 }, { stage: "prospect", weight: 30 },
                { stage: "quote_underwriting", weight: 15 }, { stage: "policy_issued", weight: 10 }, { stage: "dormant", weight: 5 },
            ];
            const b2bStages = [
                { stage: "lead", weight: 40 }, { stage: "prospect", weight: 30 },
                { stage: "proposal_underwriting", weight: 15 }, { stage: "policy_issued", weight: 10 }, { stage: "active", weight: 5 },
            ];
            const sourceChannels = [
                { weight: 30, channel: "referral" }, { weight: 25, channel: "event" }, { weight: 20, channel: "direct" },
                { weight: 10, channel: "phone" }, { weight: 10, channel: "email" }, { weight: 5, channel: "walk_in" },
            ];

            // Weighted random picker
            function pickWeighted<T extends { weight: number }>(arr: T[]): T {
                const total = arr.reduce((s, x) => s + x.weight, 0);
                let r = Math.random() * total;
                for (const item of arr) { r -= item.weight; if (r <= 0) return item; }
                return arr[arr.length - 1];
            }
            function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

            // Fetch the marketing service category
            const [mktCategory] = await db
                .select({ id: serviceCategories.id, name: serviceCategories.name })
                .from(serviceCategories)
                .where(eq(serviceCategories.departmentId, mktDept.id))
                .limit(1);

            const batchId = crypto.randomUUID();
            let successCount = 0;
            const stageCounts: Record<string, number> = {};

            // We generate leads directly without relying on unpredictable AI triage
            for (let i = 0; i < volume; i++) {
                const currentPipelineType = pipeline_type === "both" ? (i % 2 === 0 ? "b2c" : "b2b") : pipeline_type;
                const products = currentPipelineType === "b2c" ? b2cProducts : b2bProducts;
                const stages = currentPipelineType === "b2c" ? b2cStages : b2bStages;
                
                const productLine = pickWeighted(products).product;
                const channel = pickWeighted(sourceChannels).channel;
                const stage = spreadStages ? pickWeighted(stages).stage : "lead";

                const countrySelection = pickWeighted(countriesData);
                const region = rnd(countrySelection.regions);

                let text = "";
                let metadata: any = {
                    pipelineType: currentPipelineType,
                    productLine,
                    source: channel,
                    request_type: currentPipelineType === "b2b" ? "corporate_scheme" : "product_inquiry",
                    simulated: true,
                    stage_hint: stage,
                    country: countrySelection.country,
                    county: region,
                };

                if (currentPipelineType === "b2c") {
                    const fn = rnd(kenyanFirstNames);
                    const ln = rnd(kenyanLastNames);
                    text = `I need a quote for ${productLine} insurance for my personal use. My name is ${fn} ${ln}.`;
                    metadata.firstName = fn;
                    metadata.lastName = ln;
                    metadata.email = `b2c_${Date.now()}_${i}@example.com`;
                    metadata.phone = `+2547${Math.floor(10000000 + Math.random() * 90000000)}`;
                    metadata.nationalIdNumber = `${Math.floor(10000000 + Math.random() * 30000000)}`;
                    metadata.kraPin = `A00${Math.floor(1000000 + Math.random() * 9000000)}B`;
                    metadata.occupation = rnd(b2cOccupations);
                    metadata.coverType = pickWeighted([{type: "Comprehensive", weight: 70}, {type: "Third Party", weight: 30}]).type;
                    metadata.gender = rnd(["Male", "Female"]);
                    metadata.dateOfBirth = `19${Math.floor(70 + Math.random() * 30)}-0${Math.floor(1 + Math.random() * 9)}-15`;
                    metadata.employerName = rnd(["Kenya Government", "Safaricom", "KCB", "Self Employed", "Private Practice"]);
                    metadata.nextOfKinName = `${rnd(kenyanFirstNames)} ${ln}`;
                    metadata.nextOfKinRelationship = rnd(["Spouse", "Sibling", "Parent"]);
                    metadata.dependantsCount = Math.floor(Math.random() * 5);
                    metadata.medicalHistoryFlag = rnd([true, false]);
                    
                    if (stage !== "lead") {
                        metadata.sumInsuredConfirmedKes = Math.floor(100000 + Math.random() * 4900000);
                        if (stage === "quote_underwriting" || stage === "policy_issued" || stage === "dormant") {
                            metadata.quotedPremiumKes = Math.floor(metadata.sumInsuredConfirmedKes * 0.05);
                            metadata.underwritingDecision = "accepted";
                        }
                    }
                } else {
                    const orgTypePick = pickWeighted(b2bOrgTypes).type;
                    const orgName = orgTypePick === "sacco" ? rnd(saccoNames) : rnd(corporateNames);
                    const lives = Math.floor(Math.random() * 490 + 10);
                    const fn = rnd(kenyanFirstNames);
                    const ln = rnd(kenyanLastNames);
                    text = `Our organization, ${orgName}, is looking to acquire a group ${productLine} scheme for our ${lives} members/employees. Please provide a proposal.`;
                    metadata.organization = orgName;
                    metadata.primaryContactName = `${fn} ${ln}`;
                    metadata.email = `b2b_${Date.now()}_${i}@${orgName.replace(/[^a-zA-Z]/g, '').toLowerCase()}.co.ke`;
                    metadata.phone = `+25420${Math.floor(1000000 + Math.random() * 9000000)}`;
                    metadata.orgType = orgTypePick;
                    metadata.totalMemberCount = lives;
                    metadata.sectorIndustry = rnd(["Finance", "Manufacturing", "Services", "Education", "Health"]);
                    metadata.kraPinOrg = `P00${Math.floor(1000000 + Math.random() * 9000000)}C`;
                    metadata.sasraStatus = orgTypePick === "sacco" ? "Compliant" : null;
                    metadata.existingInsurer = rnd(["Jubilee", "Britam", "ICEA Lion", "None"]);
                    
                    if (stage !== "lead") {
                        metadata.estimatedAnnualPremium = Math.floor(500000 + Math.random() * 9500000);
                        if (stage === "proposal_underwriting" || stage === "policy_issued" || stage === "active") {
                            metadata.quotedPremiumKes = Math.floor(metadata.estimatedAnnualPremium * 0.95);
                            metadata.underwritingDecision = "accepted";
                            metadata.priorLossRatio = `${Math.floor(Math.random() * 50 + 20)}%`;
                            metadata.yearsOfClaimsHistory = Math.floor(Math.random() * 5 + 1);
                            metadata.industryRiskRating = pickWeighted([{type: "Low", weight: 40}, {type: "Medium", weight: 40}, {type: "High", weight: 20}]).type;
                            metadata.fclApplicable = true;
                        }
                    }
                }
                
                if (stage === "policy_issued" || stage === "active") {
                    const startDate = new Date();
                    startDate.setMonth(startDate.getMonth() - Math.floor(Math.random() * 6));
                    const endDate = new Date(startDate);
                    endDate.setFullYear(endDate.getFullYear() + 1);
                    metadata.policyStartDateProposed = startDate.toISOString();
                    metadata.policyEndDateProposed = endDate.toISOString();
                }

                try {
                    const yearShort = new Date().getFullYear().toString().slice(-2);
                    const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
                    const caseNumber = `CIC-${yearShort}-${random}`;

                    await db.insert(cicLeads).values({
                        leadRef: `LEAD-${caseNumber}`,
                        pipelineType: currentPipelineType,
                        productLine: metadata.productLine,
                        sourceChannel: metadata.source,
                        firstName: metadata.firstName || "Unknown",
                        lastName: metadata.lastName || "Client",
                        organisationName: metadata.organization || null,
                        phone: metadata.phone || "TBD",
                        email: metadata.email || "TBD",
                        stage: metadata.stage_hint || "lead",
                        referredByStakeholderId: null,
                        country: metadata.country || "Kenya",
                        county: metadata.county || null,
                        nationalIdNumber: metadata.nationalIdNumber || null,
                        kraPin: metadata.kraPin || null,
                        occupation: metadata.occupation || null,
                        coverType: metadata.coverType || null,
                        sumInsuredConfirmedKes: metadata.sumInsuredConfirmedKes || null,
                        dateOfBirth: metadata.dateOfBirth || null,
                        gender: metadata.gender || null,
                        employerName: metadata.employerName || null,
                        nextOfKinName: metadata.nextOfKinName || null,
                        nextOfKinRelationship: metadata.nextOfKinRelationship || null,
                        dependantsCount: metadata.dependantsCount || null,
                        medicalHistoryFlag: metadata.medicalHistoryFlag || false,
                        kraPinOrg: metadata.kraPinOrg || null,
                        sasraStatus: metadata.sasraStatus || null,
                        existingInsurer: metadata.existingInsurer || null,
                        quotedPremiumKes: metadata.quotedPremiumKes || null,
                        underwritingDecision: metadata.underwritingDecision || null,
                        orgType: metadata.orgType || null,
                        totalMemberCount: metadata.totalMemberCount || null,
                        sectorIndustry: metadata.sectorIndustry || null,
                        estimatedAnnualPremium: metadata.estimatedAnnualPremium || null,
                        primaryContactName: metadata.primaryContactName || null,
                        priorLossRatio: metadata.priorLossRatio || null,
                        yearsOfClaimsHistory: metadata.yearsOfClaimsHistory || null,
                        industryRiskRating: metadata.industryRiskRating || null,
                        fclApplicable: metadata.fclApplicable || false,
                        policyStartDateProposed: metadata.policyStartDateProposed || null,
                        policyEndDateProposed: metadata.policyEndDateProposed || null
                    } as any);

                    successCount++;
                    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
                } catch (err) {
                    console.error("Failed to insert simulated lead:", err);
                }
            }

            return res.json({
                success: true,
                batchId,
                pipeline_type,
                marketingDepartment: mktDept.name,
                leadsGenerated: successCount,
                stageDistribution: stageCounts,
                message: `${successCount} simulated ${pipeline_type.toUpperCase()} leads passed. Review in the Pipeline Dashboard.`,
            });
        } catch (error: any) {
            if (error?.name === "ZodError") {
                return res.status(400).json({ error: "Invalid request parameters", details: error.errors });
            }
            console.error("Marketing Lead Simulation Error:", error);
            return res.status(500).json({ error: "Failed to generate simulated marketing leads" });
        }
    });
}
