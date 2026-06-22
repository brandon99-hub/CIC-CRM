import { Express } from "express";
import { SimulationService } from "../services/simulation-service";
import { marketingAuth, marketingAdminAuth } from "./marketing";
import { db } from "../db";
import { cases, caseComments, caseAttachments, caseHistory, intakeSignals, stakeholderInteractions } from "../../shared/crmSchema";

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
}
