import { db } from "../db";
import { stakeholders, stakeholderInteractions, cases } from "../../shared/crmSchema";
import { eq, and, or, sql, desc, gte, lte, count } from "drizzle-orm";
import { subDays } from "date-fns";

/**
 * SegmentationService
 * 
 * Evaluates stakeholders against dynamic rules to identify segments.
 * Uses the composite model: Behavioral + Demographic + Lifecycle.
 * 
 * Segment Flags:
 *   - promoter:              Avg satisfaction ≥4, low escalation, no SLA breaches
 *   - detractor:             Avg satisfaction ≤2 OR high escalation OR SLA breaches
 *   - churn_risk:            Dormant/suspended with no recent interaction
 *   - exam_ready:            Student with exam sitting ≤60 days away
 *   - certification_pending: Student close to completing certification
 */
export const SegmentationService = {
    /**
     * Evaluates a stakeholder for potential segmentation flags.
     */
    async evaluateStakeholder(stakeholderId: string) {
        console.log(`[Segmentation] Evaluating stakeholder: ${stakeholderId}`);
        const [s] = await db.select().from(stakeholders).where(eq(stakeholders.id, stakeholderId)).limit(1);
        if (!s) return;

        // Skip anchor record types that don't need segmentation
        const skipTypes = ["department", "organization"];
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

        // Derive in-memory case metrics
        const totalCases = allCases.length;
        const ratedCases = allCases.filter(c => c.satisfactionRating !== null && c.satisfactionRating !== undefined);
        
        const avgRating = ratedCases.length > 0
            ? ratedCases.reduce((sum, c) => sum + Number(c.satisfactionRating), 0) / ratedCases.length
            : null;

        const escalatedCaseCount = allCases.filter(c => (c.escalationLevel ?? 0) > 0).length;
        const escalatedRate = totalCases > 0 ? escalatedCaseCount / totalCases : 0;
        const slaBreachCount = allCases.filter(c => c.slaBreached).length;

        // ── SEGMENT 2: seg:detractor ──
        // (Evaluate first so mutual exclusion on promoter works correctly)
        let isDetractor = false;
        if (
            (avgRating !== null && avgRating <= 2.0 && ratedCases.length >= 2) ||
            (escalatedRate > 0.4 && totalCases >= 3) ||
            (slaBreachCount >= 2)
        ) {
            flags.push("detractor");
            isDetractor = true;
        }

        // ── SEGMENT 1: seg:promoter ──
        if (!isDetractor && ratedCases.length >= 3) {
            if (avgRating !== null && avgRating >= 4.0 && escalatedRate < 0.15 && slaBreachCount === 0) {
                flags.push("promoter");
            }
        }

        // ── SEGMENT 3: seg:churn_risk ──
        const stage = s.lifecycleStage?.toLowerCase();
        const allowedStages = ["active", "dormant", "suspended"];
        
        if (allowedStages.includes(stage)) {
            // Signal A - Interaction decay: Last interaction > 60d or none
            const sixtyDaysAgo = subDays(new Date(), 60).toISOString();
            const [lastInt] = await db.select()
                .from(stakeholderInteractions)
                .where(eq(stakeholderInteractions.stakeholderId, stakeholderId))
                .orderBy(desc(stakeholderInteractions.date))
                .limit(1);
            
            const signalA = !lastInt || lastInt.date < sixtyDaysAgo;

            // Signal B - Case friction: At least 1 unresolved case open > 72 hours
            const signalB = allCases.some(c => {
                const isOpen = ["open", "in_progress", "pending", "escalated"].includes(c.status);
                if (!isOpen) return false;
                const ageMs = Date.now() - new Date(c.createdAt).getTime();
                return ageMs > 72 * 60 * 60 * 1000;
            });

            // Signal C - Satisfaction decline: Average of last 3 rated cases ≤ 2.5
            const sortedRatedCases = [...ratedCases].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            const recentRated = sortedRatedCases.slice(0, 3);
            const avgRecentRating = recentRated.length > 0
                ? recentRated.reduce((sum, c) => sum + Number(c.satisfactionRating), 0) / recentRated.length
                : null;
            
            const signalC = avgRecentRating !== null && avgRecentRating <= 2.5;

            // Count signals
            let signalCount = 0;
            if (signalA) signalCount++;
            if (signalB) signalCount++;
            if (signalC) signalCount++;

            const requiredSignals = (stage === "dormant" || stage === "suspended") ? 1 : 2;
            if (signalCount >= requiredSignals) {
                flags.push("churn_risk");
            }
        }

        // ── SEGMENT 4: seg:exam_ready ──
        const metadata = s.metadata as any;
        if (s.type === "student" && metadata?.exam_sitting && stage === "active") {
            const sittingDate = new Date(metadata.exam_sitting);
            if (!isNaN(sittingDate.getTime())) {
                const daysUntil = (sittingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                if (daysUntil > 0 && daysUntil <= 60) {
                    flags.push("exam_ready");
                    if (daysUntil <= 14) {
                        flags.push("exam_critical");
                    }
                }
            }
        }

        // ── SEGMENT 5: seg:certification_pending ──
        const accountAgeDays = (Date.now() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (
            s.type === "student" &&
            stage === "registered" &&
            accountAgeDays > 730 &&
            metadata?.current_part !== undefined &&
            Number(metadata.current_part) >= 3 &&
            !flags.includes("exam_ready")
        ) {
            flags.push("certification_pending");
            if (metadata.exams_passed !== undefined && Number(metadata.exams_passed) >= 6) {
                flags.push("near_completion");
            }
        }

        // ── SEGMENT 6: Kasneb Qualifications ──
        if (["student", "international_student", "alumni"].includes(s.type) && s.qualificationPathway) {
            const pathway = s.qualificationPathway.toLowerCase().trim();
            const validPathways = ["cams", "atd", "dcnsa", "ddma", "dqm", "cpa", "cs", "cifa", "ccp", "cisse", "cqp", "cffe", "cpfm"];
            if (validPathways.includes(pathway)) {
                flags.push(`qual_${pathway}`);
            }
        }

        // ── SEGMENT 7: International Students ──
        if (s.type === "student" && s.country && s.country.toLowerCase() !== "kenya") {
            flags.push("international");
        }

        // ── SEGMENT 8: New Registrants ──
        if (s.type === "student" && accountAgeDays <= 30) {
            flags.push("new_registrant");
        }

        // ── SEGMENT 9: Dormant Students ──
        if (s.type === "student" && stage === "dormant") {
            flags.push("dormant");
        }

        // ── SEGMENT 10: Accredited Institutions ──
        if (s.type === "institution" && stage === "accredited") {
            flags.push("accredited_institution");
        }

        // ── SEGMENT 11: Employers ──
        if (s.type === "employer") {
            flags.push("employer");
        }

        console.log(`[Segmentation] Flags for ${stakeholderId}:`, flags);

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
