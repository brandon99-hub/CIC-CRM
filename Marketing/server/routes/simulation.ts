import { Express } from "express";
import { SimulationService } from "../services/simulation-service";
import { marketingAuth, marketingAdminAuth } from "./marketing";
import { db } from "../db";
import { cases, caseComments, caseAttachments, caseHistory, intakeSignals, stakeholderInteractions } from "../../shared/crmSchema";
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
            pipelineType: z.enum(["b2c", "b2b"]).default("b2c"),
            volume: z.number().int().min(5).max(50).default(10),
            spreadStages: z.boolean().default(true),
        });

        try {
            const { pipelineType, volume, spreadStages } = bodySchema.parse(req.body);

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
            const stages = pipelineType === "b2c" ? b2cStages : b2bStages;
            const products = pipelineType === "b2c" ? b2cProducts : b2bProducts;

            let successCount = 0;
            const stageCounts: Record<string, number> = {};

            // We generate signals and pass them through AI triage sequentially
            for (let i = 0; i < volume; i++) {
                const productLine = pickWeighted(products).product;
                const channel = pickWeighted(sourceChannels).channel;
                const stage = spreadStages ? pickWeighted(stages).stage : "lead";

                let text = "";
                let metadata: any = {
                    pipelineType,
                    productLine,
                    source: channel,
                    request_type: pipelineType === "b2b" ? "corporate_scheme" : "product_inquiry",
                    simulated: true,
                    stage_hint: stage
                };

                if (pipelineType === "b2c") {
                    const fn = rnd(kenyanFirstNames);
                    const ln = rnd(kenyanLastNames);
                    text = `I need a quote for ${productLine} insurance for my personal use. My name is ${fn} ${ln}.`;
                    metadata.firstName = fn;
                    metadata.lastName = ln;
                    metadata.email = `b2c_${Date.now()}_${i}@example.com`;
                } else {
                    const orgTypePick = pickWeighted(b2bOrgTypes).type;
                    const orgName = orgTypePick === "sacco" ? rnd(saccoNames) : rnd(corporateNames);
                    const lives = Math.floor(Math.random() * 490 + 10);
                    text = `Our organization, ${orgName}, is looking to acquire a group ${productLine} scheme for our ${lives} members/employees. Please provide a proposal.`;
                    metadata.organization = orgName;
                    metadata.email = `b2b_${Date.now()}_${i}@${orgName.replace(/[^a-zA-Z]/g, '').toLowerCase()}.co.ke`;
                }

                try {
                    const createdCase = await SimulationService.simulateSignal({
                        source: channel,
                        text,
                        metadata
                    }, mktCategory?.id);

                    if (createdCase && createdCase.id) {
                        successCount++;
                        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
                    }
                } catch (err) {
                    console.error("Failed to simulate signal:", err);
                }
            }

            return res.json({
                success: true,
                batchId,
                pipelineType,
                marketingDepartment: mktDept.name,
                leadsGenerated: successCount,
                stageDistribution: stageCounts,
                message: `${successCount} simulated ${pipelineType.toUpperCase()} leads passed through AI triage (batch: ${batchId}). Review in the Pipeline Dashboard.`,
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
