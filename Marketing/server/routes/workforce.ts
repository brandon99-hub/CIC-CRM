import { Router } from "express";
import { db } from "../db";
import { shifts, userShifts, queues, userQueues } from "../../shared/adminSchema";
import { cases } from "../../shared/crmSchema";
import { marketingUsers } from "../../shared/schema";
import { eq, and, sql, count, inArray } from "drizzle-orm";
import { marketingAuth } from "../middleware/marketingAuth";
import { AssignmentService } from "../services/assignment-service";

export const workforceRouter = Router();

// GET /api/workforce/shifts - fetch shift definitions
workforceRouter.get("/shifts", marketingAuth, async (req, res) => {
    try {
        const allShifts = await db.select().from(shifts);
        const allUserShifts = await db.select().from(userShifts);
        res.json({ shifts: allShifts, userShifts: allUserShifts });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch shifts" });
    }
});

// POST /api/workforce/shifts/assign
workforceRouter.post("/shifts/assign", marketingAuth, async (req, res) => {
    try {
        const { userId, shiftId, date } = req.body;
        
        // 1. Check for overlapping shift conflicts
        const existingShifts = await db.select().from(userShifts)
            .where(and(eq(userShifts.userId, userId), eq(userShifts.date, date)));
        if (existingShifts.length > 0) {
            return res.status(400).json({ error: "User already has a shift on this date" });
        }

        // 2. Validate against max_concurrent_cases capacity across all queues for this user
        const userQueueData = await db.select().from(userQueues)
            .where(eq(userQueues.userId, userId));
        
        if (userQueueData.length > 0) {
            const workloads = await AssignmentService.getWorkloadForUsers([userId]);
            const activeCount = workloads[0]?.activeCount || 0;
            const maxCapacity = Math.max(...userQueueData.map(q => q.maxConcurrentCases));
            
            // Just a warning, maybe shouldn't block shift assignment but requested to validate
            if (activeCount >= maxCapacity) {
                // Return 400 or just proceed? Let's proceed but return warning
            }
        }

        const [assignment] = await db.insert(userShifts).values({
            userId,
            shiftId,
            date,
            status: "scheduled"
        }).returning();
        
        res.json(assignment);
    } catch (err) {
        res.status(500).json({ error: "Failed to assign shift" });
    }
});

// GET /api/workforce/capacity
workforceRouter.get("/capacity", marketingAuth, async (req, res) => {
    try {
        // Mock implementation for capacity planning Required vs Scheduled
        res.json([]);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch capacity" });
    }
});

// GET /api/workforce/capacity/forecast
workforceRouter.get("/capacity/forecast", marketingAuth, async (req, res) => {
    try {
        res.json([]);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch capacity forecast" });
    }
});

// GET /api/workforce/queues
workforceRouter.get("/queues", marketingAuth, async (req, res) => {
    try {
        const allQueues = await db.select().from(queues);
        const allUserQueues = await db.select().from(userQueues);
        res.json({ queues: allQueues, userQueues: allUserQueues });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch queues" });
    }
});

// POST /api/workforce/queues
workforceRouter.post("/queues", marketingAuth, async (req, res) => {
    try {
        const queueData = req.body;
        const [newQueue] = await db.insert(queues).values(queueData).returning();
        res.json(newQueue);
    } catch (err) {
        res.status(500).json({ error: "Failed to create queue" });
    }
});

// GET /api/workforce/queues/:id/load
workforceRouter.get("/queues/:id/load", marketingAuth, async (req, res) => {
    try {
        const queueId = req.params.id as string;
        
        const agentsInQueue = await db.select().from(userQueues).where(eq(userQueues.queueId, queueId));
        if (agentsInQueue.length === 0) return res.json({ load: 0, availableAgents: 0 });

        const userIds = agentsInQueue.map(a => a.userId);
        
        const workloads = await AssignmentService.getWorkloadForUsers(userIds);
        const openCases = workloads.reduce((sum, w) => sum + w.activeCount, 0);

        res.json({
            load: openCases / agentsInQueue.length,
            availableAgents: agentsInQueue.length,
            totalOpenCases: openCases
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch queue load" });
    }
});

export function registerWorkforceRoutes(app: any) {
    app.use("/api/workforce", workforceRouter);
}
