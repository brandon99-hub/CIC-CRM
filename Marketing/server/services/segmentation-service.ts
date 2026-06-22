import { db } from "../db";
import { stakeholders, stakeholderInteractions, cases } from "../../shared/crmSchema";
import { eq, and, or, sql, desc, gte, lte, count } from "drizzle-orm";
import { subDays } from "date-fns";

/**
 * SegmentationService — CIC Insurance Group
 *
 * Evaluates stakeholders against dynamic rules to produce segment flags.
 * Uses the composite model: Behavioral + Demographic + Lifecycle.
 *
 * Retained generic flags (work for any CRM):
 *   - promoter:         Avg satisfaction ≥4, low escalation, no SLA breaches
 *   - detractor:        Avg satisfaction ≤2 OR high escalation OR SLA breaches
 *   - churn_risk:       Dormant/suspended with no recent interaction
 *
 * CIC Insurance-specific flags:
 *   - renewal_due:          Policy renewal date ≤ 60 days
 *   - renewal_urgent:       Policy renewal date ≤ 14 days
 *   - lapsed_policyholder:  Past renewal date > 30 days, stage = lapsed
 *   - product_motor:        productLine === 'motor'
 *   - product_life:         productLine === 'life'
 *   - product_medical:      productLine === 'medical'
 *   - product_property:     productLine === 'property'
 *   - new_client:           Account age ≤ 30 days
 *   - high_value:           Multiple active policies or long claims-free history
 *   - sacco_partner:        type === 'sacco_cooperative', stage = scheme_active
 *   - corporate_scheme:     type === 'corporate_client', stage = scheme_active
 *   - agent_active:         type === 'agent', stage = active
 *   - international:        country !== 'Kenya'
 */
export const SegmentationService = {
    /**
     * Evaluates a stakeholder for all applicable CIC Insurance segment flags.
     */
    async evaluateStakeholder(stakeholderId: string) {
        console.log(`[Segmentation] Evaluating stakeholder: ${stakeholderId}`);
        const [s] = await db.select().from(stakeholders).where(eq(stakeholders.id, stakeholderId)).limit(1);
        if (!s) return;

        const skipTypes = ["department", "organization", "staff"];
        if (skipTypes.includes(s.type)) return;

        const flags: string[] = [];

        // ── Fetch all cases for this stakeholder once ──
        const allCases = await db.select({
            status: cases.status,
            slaBreached: cases.slaBreached,
            escalationLevel: cases.escalationLevel,
            satisfactionRating: cases.satisfactionRating,
            createdAt: cases.createdAt,
        }).from(cases).where(eq(cases.stakeholderId, stakeholderId));

        const totalCases = allCases.length;
        const ratedCases = allCases.filter(c => c.satisfactionRating !== null && c.satisfactionRating !== undefined);

        const avgRating = ratedCases.length > 0
            ? ratedCases.reduce((sum, c) => sum + Number(c.satisfactionRating), 0) / ratedCases.length
            : null;

        const escalatedCaseCount = allCases.filter(c => (c.escalationLevel ?? 0) > 0).length;
        const escalatedRate = totalCases > 0 ? escalatedCaseCount / totalCases : 0;
        const slaBreachCount = allCases.filter(c => c.slaBreached).length;

        const accountAgeDays = (Date.now() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        const stage = s.lifecycleStage?.toLowerCase();
        const metadata = s.metadata as any;

        // ── SEGMENT: detractor (evaluate first for mutual exclusion) ──
        let isDetractor = false;
        if (
            (avgRating !== null && avgRating <= 2.0 && ratedCases.length >= 2) ||
            (escalatedRate > 0.4 && totalCases >= 3) ||
            (slaBreachCount >= 2)
        ) {
            flags.push("detractor");
            isDetractor = true;
        }

        // ── SEGMENT: promoter ──
        if (!isDetractor && ratedCases.length >= 3) {
            if (avgRating !== null && avgRating >= 4.0 && escalatedRate < 0.15 && slaBreachCount === 0) {
                flags.push("promoter");
            }
        }

        // ── SEGMENT: churn_risk ──
        const churnStages = ["active", "lapsed", "suspended", "onboarded", "scheme_active"];
        if (churnStages.includes(stage)) {
            const sixtyDaysAgo = subDays(new Date(), 60).toISOString();
            const [lastInt] = await db.select()
                .from(stakeholderInteractions)
                .where(eq(stakeholderInteractions.stakeholderId, stakeholderId))
                .orderBy(desc(stakeholderInteractions.date))
                .limit(1);

            const signalA = !lastInt || lastInt.date < sixtyDaysAgo;

            const signalB = allCases.some(c => {
                const isOpen = ["open", "in_progress", "pending", "escalated"].includes(c.status);
                if (!isOpen) return false;
                const ageMs = Date.now() - new Date(c.createdAt).getTime();
                return ageMs > 72 * 60 * 60 * 1000;
            });

            const sortedRatedCases = [...ratedCases].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            const recentRated = sortedRatedCases.slice(0, 3);
            const avgRecentRating = recentRated.length > 0
                ? recentRated.reduce((sum, c) => sum + Number(c.satisfactionRating), 0) / recentRated.length
                : null;

            const signalC = avgRecentRating !== null && avgRecentRating <= 2.5;

            let signalCount = 0;
            if (signalA) signalCount++;
            if (signalB) signalCount++;
            if (signalC) signalCount++;

            const requiredSignals = (stage === "lapsed" || stage === "suspended") ? 1 : 2;
            if (signalCount >= requiredSignals) {
                flags.push("churn_risk");
            }
        }

        // ── SEGMENT: renewal_due / renewal_urgent ──
        if (s.policyRenewalDate && ["individual_policyholder", "sacco_cooperative", "corporate_client"].includes(s.type)) {
            const renewalDate = new Date(s.policyRenewalDate);
            if (!isNaN(renewalDate.getTime())) {
                const daysUntilRenewal = (renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                if (daysUntilRenewal > 0 && daysUntilRenewal <= 60) {
                    flags.push("renewal_due");
                    if (daysUntilRenewal <= 14) {
                        flags.push("renewal_urgent");
                    }
                }
            }
        }

        // ── SEGMENT: lapsed_policyholder ──
        if (s.type === "individual_policyholder" && stage === "lapsed" && s.policyRenewalDate) {
            const renewalDate = new Date(s.policyRenewalDate);
            const daysPastRenewal = (Date.now() - renewalDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysPastRenewal > 30) {
                flags.push("lapsed_policyholder");
            }
        }

        // ── SEGMENT: product line flags ──
        if (s.productLine) {
            const line = s.productLine.toLowerCase().trim();
            const validLines = ["motor", "life", "medical", "property", "marine", "pension", "group_life", "micro_insurance"];
            if (validLines.includes(line)) {
                flags.push(`product_${line}`);
            }
        }

        // ── SEGMENT: new_client ──
        if (["individual_policyholder", "sacco_cooperative", "corporate_client"].includes(s.type) && accountAgeDays <= 30) {
            flags.push("new_client");
        }

        // ── SEGMENT: high_value ──
        const policyHistory = (s.policyHistory as any[] || []);
        const activePolicies = policyHistory.filter((p: any) => p.status === "Active").length;
        const claimsHistory = (s.claimsHistory as any[] || []);
        const claimsCount = claimsHistory.length;
        if (activePolicies >= 2 || (claimsCount === 0 && accountAgeDays > 365)) {
            flags.push("high_value");
        }

        // ── SEGMENT: sacco_partner ──
        if (s.type === "sacco_cooperative" && stage === "scheme_active") {
            flags.push("sacco_partner");
        }

        // ── SEGMENT: corporate_scheme ──
        if (s.type === "corporate_client" && stage === "scheme_active") {
            flags.push("corporate_scheme");
        }

        // ── SEGMENT: agent_active ──
        if (s.type === "agent" && stage === "active") {
            flags.push("agent_active");
        }

        // ── SEGMENT: international ──
        if (s.country && s.country.toLowerCase() !== "kenya") {
            flags.push("international");
        }

        console.log(`[Segmentation] CIC flags for ${stakeholderId}:`, flags);

        // ── Update stakeholder tags ──
        const existingTags = s.tags as string[] || [];
        const dynamicPrefix = "seg:";
        const cleanedTags = existingTags.filter(t => !t.startsWith(dynamicPrefix));
        const newTags = [...cleanedTags, ...flags.map(f => `${dynamicPrefix}${f}`)];

        await db.update(stakeholders)
            .set({ tags: newTags })
            .where(eq(stakeholders.id, stakeholderId));
    }
};
