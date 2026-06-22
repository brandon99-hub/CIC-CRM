import { db } from "../db";
import { cases } from "../../shared/crmSchema";
import { userRoles, queues, userQueues } from "../../shared/adminSchema";
import { marketingUsers } from "../../shared/schema";
import { eq, and, sql, inArray, count } from "drizzle-orm";

/**
 * Service to handle balanced assignment of cases to users
 * based on their current workload, queues, and capacity.
 */
export const AssignmentService = {
    /**
     * Calculates the current workload of users in a specific role or queue.
     */
    async getWorkloadForUsers(userIds: string[]) {
        if (userIds.length === 0) return [];

        const workloads = await db
            .select({
                userId: cases.assignedTo,
                activeCount: count(cases.id),
            })
            .from(cases)
            .where(
                and(
                    inArray(cases.assignedTo, userIds),
                    inArray(cases.status, ["open", "pending_acceptance", "in_progress"])
                )
            )
            .groupBy(cases.assignedTo);

        return userIds.map(uid => {
            const w = workloads.find(wl => wl.userId === uid);
            return {
                userId: uid,
                activeCount: Number(w?.activeCount || 0),
            };
        });
    },

    /**
     * Finds the optimal assignee respecting queue limits and max concurrent cases.
     */
    async getOptimalAssignee(roleId?: string | null, departmentId?: string, serviceCategoryId?: string): Promise<string | null> {
        // 1. Try to find a matching queue for this category or department
        let targetQueueId: string | null = null;
        if (serviceCategoryId) {
            const [queue] = await db.select().from(queues)
                .where(and(eq(queues.serviceCategoryId, serviceCategoryId), eq(queues.isActive, true)))
                .limit(1);
            if (queue) targetQueueId = queue.id;
        }

        if (!targetQueueId && departmentId) {
             const [queue] = await db.select().from(queues)
                .where(and(eq(queues.departmentId, departmentId), eq(queues.isActive, true)))
                .orderBy(queues.priorityOrder)
                .limit(1);
             if (queue) targetQueueId = queue.id;
        }

        let candidates: Array<{ userId: string, activeCount: number, maxCapacity: number }> = [];

        // 2. If a queue was found, get agents in this queue
        if (targetQueueId) {
            const agentsInQueue = await db.select().from(userQueues)
                .where(and(eq(userQueues.queueId, targetQueueId), eq(userQueues.isActive, true)));

            if (agentsInQueue.length > 0) {
                const userIds = agentsInQueue.map(a => a.userId);
                const workloads = await this.getWorkloadForUsers(userIds);
                
                candidates = workloads.map(w => {
                    const agentQueue = agentsInQueue.find(a => a.userId === w.userId);
                    return {
                        userId: w.userId,
                        activeCount: w.activeCount,
                        maxCapacity: agentQueue?.maxConcurrentCases || 5
                    };
                }).filter(c => c.activeCount < c.maxCapacity);
            }
        }

        // 3. Fallback: If no queue or all agents at capacity, fallback to users with case management dashboard access
        if (candidates.length === 0) {
            const { systemRoles } = await import("../../shared/adminSchema");
            const conditions = [eq(systemRoles.isActive, true), sql`${systemRoles.dashboards} @> '"cases"'::jsonb`];
            
            if (departmentId) {
                conditions.push(eq(marketingUsers.departmentId, departmentId));
            }

            const usersInRole = await db
                .select({ userId: userRoles.userId })
                .from(userRoles)
                .innerJoin(systemRoles, eq(userRoles.roleId, systemRoles.id))
                .innerJoin(marketingUsers, sql`${userRoles.userId}::uuid = ${marketingUsers.id}`)
                .where(and(...conditions));

            if (usersInRole.length > 0) {
                const userIds = usersInRole.map(u => u.userId);
                const workloads = await this.getWorkloadForUsers(userIds);
                
                // Fallback default max capacity is 5 if not in queue
                candidates = workloads.map(w => ({
                    userId: w.userId,
                    activeCount: w.activeCount,
                    maxCapacity: 5 
                }));
            }
        }

        if (candidates.length === 0) return null;

        // 4. Find the minimum workload among available candidates
        const minWorkload = Math.min(...candidates.map(c => c.activeCount));
        const bestCandidates = candidates.filter(c => c.activeCount === minWorkload);

        // 5. Pick one at random to break ties
        const randomIndex = Math.floor(Math.random() * bestCandidates.length);
        return bestCandidates[randomIndex].userId;
    },

    /**
     * Automatically assigns a case to the best user in a role.
     */
    async autoAssignCase(caseId: string, roleId?: string | null, departmentId?: string, requiresConsent: boolean = false, gracePeriodMinutes: number = 0) {
        // Fetch the case to get serviceCategoryId
        const [targetCase] = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
        if (!targetCase) return null;

        const bestUser = await this.getOptimalAssignee(roleId, departmentId, targetCase.serviceCategoryId || undefined);
        if (!bestUser) return null;

        const updateData: any = {
            assignedTo: bestUser,
            status: requiresConsent ? "pending_acceptance" : "open",
            updatedAt: sql`now()`,
        };

        if (requiresConsent && gracePeriodMinutes > 0) {
            const now = new Date();
            const deadline = new Date(now.getTime() + gracePeriodMinutes * 60000);
            updateData.acceptanceDeadline = deadline.toISOString();
        }

        const updatedCase = await db
            .update(cases)
            .set(updateData)
            .where(eq(cases.id, caseId))
            .returning();

        return updatedCase[0];
    }
};
