import { db } from "../db";
import { cases, caseComments, caseHistory } from "../../shared/crmSchema";
import { escalationChains, escalationSteps, serviceCategories } from "../../shared/adminSchema";
import { eq, and, or, lt, sql, inArray, isNotNull } from "drizzle-orm";
import { AssignmentService } from "./assignment-service";

/**
 * Service to handle automated background tasks for case management
 * like SLA breach detection and auto-escalation.
 */
export const AutomationService = {
    /**
     * Periodic check for cases that have breached their SLA or acceptance deadlines.
     */
    async checkDeadlines() {
        const now = new Date().toISOString();

        // 1. Find cases pending acceptance where deadline has passed
        const pendingAcceptanceBreaches = await db
            .select()
            .from(cases)
            .where(
                and(
                    eq(cases.status, "pending_acceptance"),
                    isNotNull(cases.acceptanceDeadline),
                    lt(cases.acceptanceDeadline, now)
                )
            );

        // 2. Find cases where SLA has breached (not yet flagged)
        const slaBreaches = await db
            .select()
            .from(cases)
            .where(
                and(
                    eq(cases.slaBreached, false),
                    inArray(cases.status, ["open", "in_progress"]),
                    or(
                        and(isNotNull(cases.slaDeadline), lt(cases.slaDeadline, now)),
                        and(isNotNull(cases.slaResponseDeadline), lt(cases.slaResponseDeadline, now), sql`${cases.firstResponseAt} IS NULL`)
                    )
                )
            );

        console.log(`[Automation] Found ${pendingAcceptanceBreaches.length} acceptance breaches and ${slaBreaches.length} SLA breaches.`);

        // Process Acceptance Breaches (Automatic Escalation to next level)
        for (const c of pendingAcceptanceBreaches) {
            await this.triggerEscalation(c.id, "Acceptance Deadline Exceeded");
        }

        // Process SLA Breaches (Flag and potentially escalate)
        for (const c of slaBreaches) {
            await db.update(cases).set({ slaBreached: true }).where(eq(cases.id, c.id));
            await this.triggerEscalation(c.id, "SLA Breached");
        }
    },

    /**
     * Triggers the next level of escalation for a case.
     */
    async triggerEscalation(caseId: string, reason: string) {
        // Fetch current case state
        const existingCase = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
        if (existingCase.length === 0) return;

        const c = existingCase[0];
        const currentLevel = c.escalationLevel || 0;
        const nextLevel = currentLevel + 1;

        // Find escalation chain and next step
        const chain = await db
            .select()
            .from(escalationChains)
            .where(and(eq(escalationChains.serviceCategoryId, c.serviceCategoryId as string), eq(escalationChains.isActive, true)))
            .limit(1);

        if (chain.length === 0) return;

        const step = await db
            .select()
            .from(escalationSteps)
            .where(and(eq(escalationSteps.chainId, chain[0].id), eq(escalationSteps.stepOrder, nextLevel)))
            .limit(1);

        if (step.length === 0) {
            console.log(`[Automation] No more escalation steps for case ${caseId} at level ${nextLevel}`);
            return;
        }

        let assignedTo = c.assignedTo;
        let assignedDepartment = c.assignedDepartment;
        let status = c.status;

        // Determine new assignee
        if (step[0].assigneeRoleId) {
            assignedTo = await AssignmentService.getOptimalAssignee(step[0].assigneeRoleId, (step[0] as any).targetDepartmentId || c.assignedDepartment);
            assignedDepartment = (step[0] as any).targetDepartmentId || c.assignedDepartment;
        } else if ((step[0] as any).assigneeDepartmentId) {
            assignedTo = null;
            assignedDepartment = (step[0] as any).assigneeDepartmentId;
        }

        // Determine new status based on consent requirement
        const requiresConsent = step[0].requiresConsent || false;
        status = requiresConsent ? "pending_acceptance" : "open";
        
        const updateData: any = {
            escalationLevel: nextLevel,
            assignedTo,
            assignedDepartment,
            status,
            priority: nextLevel >= 3 ? "critical" : nextLevel >= 2 ? "high" : c.priority,
            updatedAt: sql`now()`,
        };

        if (requiresConsent && step[0].gracePeriodMinutes > 0) {
            const deadline = new Date(Date.now() + step[0].gracePeriodMinutes * 60000);
            updateData.acceptanceDeadline = deadline.toISOString();
        } else {
            updateData.acceptanceDeadline = null;
        }

        await db.update(cases).set(updateData).where(eq(cases.id, caseId));
        
        await db.insert(caseComments).values({
            caseId: caseId,
            content: `Automated Escalation (Level ${nextLevel}): ${reason}`,
            isInternal: true,
            createdAt: sql`now()`,
        });

        await db.insert(caseHistory).values({
            caseId: caseId,
            action: "Automated Escalation",
            fieldChanged: "status",
            oldValue: c.status,
            newValue: status,
            createdAt: sql`now()`,
        });
        
        console.log(`[Automation] Case ${caseId} escalated to level ${nextLevel} due to ${reason}`);
    }
};
