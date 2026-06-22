import "dotenv/config";
import { db } from "../db";
import { departments, queues, userQueues } from "../../shared/adminSchema";
import { marketingUsers } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

async function seedQueues() {
    console.log("Starting Workforce Queues seeding...");

    const allDepts = await db.select().from(departments);
    if (allDepts.length === 0) {
        console.warn("No departments found. Please run department seed first.");
        return;
    }

    const allUsers = await db.select().from(marketingUsers);
    
    for (const dept of allDepts) {
        const queueName = `${dept.name} Queue`;
        
        // 1. Check or Create Queue
        let targetQueueId: string;
        const existingQueue = await db.select().from(queues).where(eq(queues.departmentId, dept.id)).limit(1);
        
        if (existingQueue.length === 0) {
            const [newQueue] = await db.insert(queues).values({
                name: queueName,
                departmentId: dept.id,
                description: `Handles auto-assigned cases for the ${dept.name} department.`,
                priorityOrder: 1,
                isActive: true
            } as any).returning();
            targetQueueId = newQueue.id;
            console.log(`Created new Queue: ${queueName}`);
        } else {
            targetQueueId = existingQueue[0].id;
            console.log(`Queue already exists: ${queueName}`);
        }

        // 2. Assign staff to Queue
        const deptUsers = allUsers.filter(u => u.departmentId === dept.id);
        
        for (const user of deptUsers) {
            const existingAssignment = await db.select()
                .from(userQueues)
                .where(and(
                    eq(userQueues.userId, user.id),
                    eq(userQueues.queueId, targetQueueId)
                )).limit(1);

            if (existingAssignment.length === 0) {
                await db.insert(userQueues).values({
                    userId: user.id,
                    queueId: targetQueueId,
                    skillLevel: 5,
                    maxConcurrentCases: 5,
                    isActive: true
                } as any);
                console.log(`  -> Assigned ${user.firstName} ${user.lastName} to ${queueName}`);
            } else {
                console.log(`  -> ${user.firstName} ${user.lastName} is already assigned to ${queueName}`);
            }
        }
    }

    console.log("Workforce Queues seeding completed successfully.");
    process.exit(0);
}

seedQueues().catch(err => {
    console.error("Seeding failed:", err);
    process.exit(1);
});
