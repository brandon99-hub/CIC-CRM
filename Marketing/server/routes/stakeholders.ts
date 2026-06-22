import type { Express } from "express";
import { db } from "../db";
import { stakeholderWriteSchema } from "../../shared/marketingSchema";
import { encryptField, decryptField } from "../utils/encryption";
import { marketingAuth, checkPermission } from "../middleware/marketingAuth";
import { z } from "zod";

import {
  stakeholders,
  stakeholderInteractions,
  stakeholderRelationships,
  cases,
} from "../../shared/crmSchema";
import { departments, serviceCategories } from "../../shared/adminSchema";
import { marketingUsers } from "../../shared/schema";
import { eq, desc, sql, ilike, or, and, count, avg, aliasedTable, ne, inArray } from "drizzle-orm";
import { shifts, userShifts, queues, userQueues } from "../../shared/adminSchema";
import { sanitizeSearchInput, sanitizeInteger } from "../utils/sanitize";
import { AuditService } from "../services/audit-service";
import { DiscoveryService } from "../services/discovery-service";
import { SegmentationService } from "../services/segmentation-service";

// ── Engagement Score Formula ──────────────────────────────────────────────────
// Computes a 0-100 engagement score for a stakeholder based on:
//   40pts – Interaction frequency (each interaction = +5, cap 40)
//   25pts – Recency (last interaction within 30d=25, 90d=15, older=5, never=0)
//   15pts – Channel diversity (unique channels used / 4 channels * 15)
//   10pts – Case linkage (at least 1 case linked = 10)
//   10pts – Relationship depth (each relationship = +5, cap 10)
async function computeEngagementScore(stakeholderId: string): Promise<number> {
  // Fetch all interactions for this stakeholder
  const interactions = await db
    .select({
      date: stakeholderInteractions.date,
      channel: stakeholderInteractions.channel,
    })
    .from(stakeholderInteractions)
    .where(eq(stakeholderInteractions.stakeholderId, stakeholderId));

  // Interaction frequency (40 pts)
  const totalInteractions = interactions.length;
  const freqScore = Math.min(totalInteractions * 5, 40);

  // Recency (25 pts)
  let recencyScore = 0;
  if (interactions.length > 0) {
    const dates = interactions.map((i) => new Date(i.date).getTime()).filter(Boolean);
    const latestMs = Math.max(...dates);
    const daysSinceLast = (Date.now() - latestMs) / (1000 * 60 * 60 * 24);
    if (daysSinceLast < 30) recencyScore = 25;
    else if (daysSinceLast < 90) recencyScore = 15;
    else recencyScore = 5;
  }

  // Channel diversity (15 pts)
  const uniqueChannels = new Set(interactions.map((i) => i.channel).filter(Boolean)).size;
  const channelScore = Math.round((Math.min(uniqueChannels, 4) / 4) * 15);

  // Case linkage (10 pts)
  const [caseResult] = await db
    .select({ count: count() })
    .from(cases)
    .where(eq(cases.stakeholderId, stakeholderId));
  const caseScore = (caseResult?.count ?? 0) > 0 ? 10 : 0;

  // Relationship depth (10 pts)
  const [relResultA] = await db
    .select({ count: count() })
    .from(stakeholderRelationships)
    .where(eq(stakeholderRelationships.stakeholderAId, stakeholderId));
  const [relResultB] = await db
    .select({ count: count() })
    .from(stakeholderRelationships)
    .where(eq(stakeholderRelationships.stakeholderBId, stakeholderId));
  const totalRels = (relResultA?.count ?? 0) + (relResultB?.count ?? 0);
  const relScore = Math.min(totalRels * 5, 10);

  return Math.min(freqScore + recencyScore + channelScore + caseScore + relScore, 100);
}

// ── Composite Risk Engine ──────────────────────────────────────────────────
// 3-Signal Model:
//   Signal 1: Case Health (0-40)  – open cases, overdue, SLA, satisfaction
//   Signal 2: Churn Indicators (0-35) – lifecycle regression, interaction decay, escalation
//   Signal 3: Engagement Context (0-25) – engagement + satisfaction relationship
//
// Total 0-100 → low (0-20), medium (21-40), high (41-65), critical (66+)
async function computeRiskLevel(stakeholderId: string): Promise<string> {
  // ── Fetch all required data in parallel ──
  const [stakeholder] = await db.select().from(stakeholders).where(eq(stakeholders.id, stakeholderId)).limit(1);
  if (!stakeholder) return 'low';

  const allCases = await db.select({
    id: cases.id,
    priority: cases.priority,
    status: cases.status,
    createdAt: cases.createdAt,
    slaBreached: cases.slaBreached,
    escalationLevel: cases.escalationLevel,
    satisfactionRating: cases.satisfactionRating,
  }).from(cases).where(eq(cases.stakeholderId, stakeholderId));

  const openCases = allCases.filter(c => ['open', 'in_progress', 'pending', 'escalated'].includes(c.status));

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGNAL 1: Case Health (0-40 pts)
  // ═══════════════════════════════════════════════════════════════════════════
  // Open case volume (0-10)
  const openCount = openCases.length;
  const volumeScore = openCount === 0 ? 0 : openCount <= 2 ? 3 : openCount <= 5 ? 7 : 10;

  // Overdue cases > 48h (0-10)
  const isOverdue = (dateStr: string) => {
    if (!dateStr) return false;
    return (Date.now() - new Date(dateStr).getTime()) > (48 * 60 * 60 * 1000);
  };
  const overdueCount = openCases.filter(c => isOverdue(c.createdAt)).length;
  const overdueScore = Math.min(overdueCount * 5, 10);

  // SLA Breaches (0-10)
  const slaBreachCount = allCases.filter(c => c.slaBreached).length;
  const slaScore = Math.min(slaBreachCount * 5, 10);

  // Satisfaction Deficit (0-10)
  const ratingsArr = allCases.map(c => c.satisfactionRating).filter((r): r is number => r !== null && r !== undefined);
  let satisfactionScore = 2; // Default: no data = slight unknown risk
  if (ratingsArr.length > 0) {
    const avgRating = ratingsArr.reduce((a, b) => a + b, 0) / ratingsArr.length;
    if (avgRating >= 4) satisfactionScore = 0;
    else if (avgRating >= 3) satisfactionScore = 3;
    else if (avgRating >= 2) satisfactionScore = 7;
    else satisfactionScore = 10;
  }

  const signal1 = volumeScore + overdueScore + slaScore + satisfactionScore;

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGNAL 2: Churn Indicators (0-35 pts)
  // ═══════════════════════════════════════════════════════════════════════════
  // Lifecycle regression (0-15)
  let lifecycleScore = 0;
  const stage = stakeholder.lifecycleStage?.toLowerCase();
  if (stage === 'dormant' || stage === 'churned') lifecycleScore = 15;
  else if (stage === 'suspended') lifecycleScore = 10;

  // Interaction decay (0-10) – had past interactions but none recently
  const interactions = await db.select({ date: stakeholderInteractions.date })
    .from(stakeholderInteractions)
    .where(eq(stakeholderInteractions.stakeholderId, stakeholderId))
    .orderBy(desc(stakeholderInteractions.date))
    .limit(1);

  let decayScore = 0;
  if (interactions.length > 0) {
    const lastDate = new Date(interactions[0].date).getTime();
    const daysSince = (Date.now() - lastDate) / (1000 * 60 * 60 * 24);
    if (daysSince > 180) decayScore = 5;
    else if (daysSince > 90) decayScore = 10;
  }
  // No interactions ever + short tenure is handled in Signal 3

  // Escalation frequency (0-10)
  let escalationScore = 0;
  if (allCases.length > 0) {
    const escalatedCount = allCases.filter(c => (c.escalationLevel ?? 0) > 0).length;
    const escalationRate = escalatedCount / allCases.length;
    if (escalationRate > 0.5) escalationScore = 10;
    else if (escalationRate > 0.25) escalationScore = 5;
  }

  const signal2 = lifecycleScore + decayScore + escalationScore;

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGNAL 3: Engagement Context (0-25 pts)
  // ═══════════════════════════════════════════════════════════════════════════
  const engScore = stakeholder.engagementScore ?? 0;
  const accountAge = (Date.now() - new Date(stakeholder.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const avgSatisfaction = ratingsArr.length > 0
    ? ratingsArr.reduce((a, b) => a + b, 0) / ratingsArr.length
    : null;

  let signal3 = 0;
  if (engScore > 60 && avgSatisfaction !== null && avgSatisfaction < 3) {
    // High engagement + Low satisfaction = WORST (actively unhappy)
    signal3 = 25;
  } else if (engScore < 30 && accountAge < 180) {
    // Low engagement + Short tenure (<6mo) = disengagement signal
    signal3 = 10;
  } else if (engScore < 30 && avgSatisfaction === null) {
    // Low engagement + No satisfaction data = unknown
    signal3 = 5;
  }
  // Low engagement + Long tenure = "Silent Satisfied" → 0
  // High engagement + High satisfaction → 0

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL COMPOSITE
  // ═══════════════════════════════════════════════════════════════════════════
  const totalRisk = signal1 + signal2 + signal3;

  if (totalRisk >= 66) return 'critical';
  if (totalRisk >= 41) return 'high';
  if (totalRisk >= 21) return 'medium';
  return 'low';
}

export function registerStakeholderRoutes(app: Express) {

  // ── Zod write schemas (prevent mass assignment) ───────────────────────────
  const interactionWriteSchema = z.object({
    type: z.enum(["call", "email", "meeting", "portal", "social", "sms", "event"]),
    channel: z.enum(["phone", "email", "in_person", "portal", "social_media", "sms"]),
    subject: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
    direction: z.enum(["inbound", "outbound"]).default("inbound"),
    caseId: z.string().uuid().optional(),
    date: z.string().optional(),
  });

  const relationshipWriteSchema = z.object({
    stakeholderBId: z.string().uuid(),
    relationshipType: z.enum(["employer", "alumni_of", "member_of", "parent_of", "partner", "vendor", "sponsor"]),
    description: z.string().max(500).optional(),
  });

  // ── GET /api/stakeholders ─────────────────────────────────────────────────
  app.get("/api/stakeholders", marketingAuth, checkPermission("stakeholders.view_all"), async (req, res) => {
    try {
      const { type, lifecycleStage, search } = req.query;
      const pageNum = sanitizeInteger(req.query.page, 1, 1, 1000);
      const limitNum = sanitizeInteger(req.query.limit, 20, 1, 100);
      const offset = (pageNum - 1) * limitNum;

      const conditions: any[] = [];

      if (type && type !== "all") {
        conditions.push(eq(stakeholders.type, type as string));
      }
      if (lifecycleStage && lifecycleStage !== "all") {
        conditions.push(eq(stakeholders.lifecycleStage, lifecycleStage as string));
      }
      if (search) {
        const s = sanitizeSearchInput(search as string);
        conditions.push(
          or(
            ilike(stakeholders.firstName, `%${s}%`),
            ilike(stakeholders.lastName, `%${s}%`),
            ilike(stakeholders.email, `%${s}%`),
            ilike(stakeholders.organization, `%${s}%`),
            ilike(stakeholders.registrationNumber, `%${s}%`)
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [results, totalResult] = await Promise.all([
        db.select({
          id: stakeholders.id,
          type: stakeholders.type,
          firstName: stakeholders.firstName,
          lastName: stakeholders.lastName,
          email: stakeholders.email,
          phone: stakeholders.phone,
          organization: stakeholders.organization,
          designation: stakeholders.designation,
          county: stakeholders.county,
          registrationNumber: stakeholders.registrationNumber,
          engagementScore: stakeholders.engagementScore,
          riskLevel: stakeholders.riskLevel,
          lifecycleStage: stakeholders.lifecycleStage,
          isActive: stakeholders.isActive,
          status: sql<string>`CASE WHEN ${stakeholders.isActive} THEN 'active' ELSE 'inactive' END`,
          portalAccess: stakeholders.portalAccess,
          createdAt: stakeholders.createdAt,
          // nationalId intentionally OMITTED from list view (SEC-A9 — DPA 2019 data minimisation)
        })
          .from(stakeholders)
          .where(whereClause!)
          .orderBy(desc(stakeholders.createdAt))
          .limit(limitNum)
          .offset(offset),
        db.select({ count: count() }).from(stakeholders).where(whereClause!),
      ]);

      // Fix SCAL-B1: N+1 aggregation issue
      const orgNames = results.map(r => r.organization).filter((org): org is string => !!org);
      let orgAggregates: any[] = [];

      if (orgNames.length > 0) {
        orgAggregates = await db
          .select({
            organization: stakeholders.organization,
            memberCount: count(),
            avgEngagement: avg(stakeholders.engagementScore),
            primaryLifecycle: stakeholders.lifecycleStage,
            type: stakeholders.type,
          })
          .from(stakeholders)
          .where(inArray(stakeholders.organization, orgNames))
          .groupBy(stakeholders.organization, stakeholders.lifecycleStage, stakeholders.type);
          
        // Since groupBy returns multiple rows per org if they have different lifecycle/type, 
        // we map it such that the 'institution' type's lifecycle takes precedence.
        const mergedAggregates = new Map();
        for (const row of orgAggregates) {
          const existing = mergedAggregates.get(row.organization);
          if (!existing) {
            mergedAggregates.set(row.organization, {
              ...row,
              memberCount: Number(row.memberCount),
              primaryLifecycle: row.type === 'institution' || row.type === 'employer' || row.type === 'organization' ? row.primaryLifecycle : null
            });
          } else {
            existing.memberCount += Number(row.memberCount);
            if (row.type === 'institution' || row.type === 'employer' || row.type === 'organization') {
              existing.primaryLifecycle = row.primaryLifecycle;
            }
          }
        }
        orgAggregates = Array.from(mergedAggregates.values());
      }

      const orgMap = new Map(orgAggregates.map(o => [o.organization, o]));

      const stakeholdersWithAgg = results.map((sh) => {
        // riskLevel is already fetched directly from DB in the select above.

        if (sh && (sh.type === 'institution' || sh.type === 'employer' || sh.type === 'organization') && sh.organization) {
          const orgStats = orgMap.get(sh.organization);
          if (orgStats && orgStats.memberCount > 1) {
            // Member count includes the org itself, so subtract 1 for children
            return {
              ...sh,
              engagementScore: orgStats.avgEngagement ? Math.round(Number(orgStats.avgEngagement)) : sh.engagementScore,
              isAggregated: true,
              aggregatedLifecycle: orgStats.primaryLifecycle || sh.lifecycleStage,
              memberCount: Math.max(0, Number(orgStats.memberCount) - 1)
            };
          }
        }
        return sh;
      });

      res.json({
        stakeholders: stakeholdersWithAgg,
        total: totalResult[0]?.count || 0,
        page: pageNum,
        totalPages: Math.ceil((totalResult[0]?.count || 0) / limitNum),
      });
    } catch (error) {
      console.error("Error fetching stakeholders:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── GET /api/stakeholders/stats ───────────────────────────────────────────
  app.get("/api/stakeholders/stats", marketingAuth, checkPermission("stakeholders.view_all"), async (_req, res) => {
    try {
      const [totals] = await db.select({
        total: count(),
        active: count(sql`CASE WHEN ${stakeholders.isActive} = true THEN 1 END`),
        avgEngagement: avg(stakeholders.engagementScore),
      }).from(stakeholders);

      const [typeEngStats, riskStats, regionalStats] = await Promise.all([
        db.select({
          type: stakeholders.type,
          count: count(),
          avgEngagement: avg(stakeholders.engagementScore)
        }).from(stakeholders).groupBy(stakeholders.type),
        db.select({ riskLevel: stakeholders.riskLevel, count: count() }).from(stakeholders).groupBy(stakeholders.riskLevel),
        db.select({ country: stakeholders.country, count: count() }).from(stakeholders).groupBy(stakeholders.country),
      ]);

      // Determine most engaged type by highest average engagement score
      let mostEngagedTooltip = { type: "", avg: -1 };
      for (const row of typeEngStats) {
        const avgVal = Number(row.avgEngagement || 0);
        if (avgVal > mostEngagedTooltip.avg) {
          mostEngagedTooltip = { type: row.type, avg: avgVal };
        }
      }

      // Convert byType array → Record<string, number> for frontend
      const byType: Record<string, number> = {};
      const avgEngagementByType: Record<string, number> = {};
      for (const row of typeEngStats) {
        byType[row.type] = Number(row.count);
        avgEngagementByType[row.type] = Math.round(Number(row.avgEngagement || 0) * 10) / 10;
      }

      // Convert byRisk array → Record<string, number> for frontend
      const riskDistribution: Record<string, number> = {};
      for (const row of riskStats) {
        if (row.riskLevel) riskDistribution[row.riskLevel] = Number(row.count);
      }

      // Convert regional array → Record<string, number> for frontend
      const regionalDistribution: Record<string, number> = {};
      for (const row of regionalStats) {
        if (row.country) regionalDistribution[row.country] = Number(row.count);
      }

      const totalNum = Number(totals.total);
      const activeNum = Number(totals.active);

      res.json({
        total: totalNum,
        activeCount: activeNum,
        inactiveCount: totalNum - activeNum,
        avgEngagement: Math.round(Number(totals.avgEngagement || 0) * 10) / 10,
        byType,
        avgEngagementByType,
        riskDistribution,
        regionalDistribution,
        mostEngagedTypeLastWeek: mostEngagedTooltip.type ? {
          type: mostEngagedTooltip.type,
          avg: Math.round(mostEngagedTooltip.avg * 10) / 10
        } : null,
        // Legacy keys kept for compatibility
        totalActive: activeNum,
        totalOverall: totalNum,
        byRisk: riskStats,
      });
    } catch (error) {
      console.error("Error fetching stakeholder stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── GET /api/stakeholders/segments ────────────────────────────────────────
  app.get("/api/stakeholders/segments", marketingAuth, checkPermission("stakeholders.view_all"), async (req, res) => {
    try {
      const pageNum = parseInt(req.query.page as string) || 1;
      const limitNum = parseInt(req.query.limit as string) || 10;
      const offset = (pageNum - 1) * limitNum;
      const search = (req.query.search as string || "").toLowerCase();

      const baseWhere = sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${stakeholders.tags}) AS t WHERE t#>>'{}' LIKE 'seg:%')`;
      const searchWhere = search ? or(
        ilike(stakeholders.firstName, `%${search}%`),
        ilike(stakeholders.lastName, `%${search}%`),
        ilike(stakeholders.organization, `%${search}%`)
      ) : undefined;

      const [totalResult] = await db.select({ count: count() })
        .from(stakeholders)
        .where(and(baseWhere, searchWhere));

      const totalItems = Number(totalResult?.count || 0);

      const allStakeholders = await db.select({
        id: stakeholders.id,
        firstName: stakeholders.firstName,
        lastName: stakeholders.lastName,
        organization: stakeholders.organization,
        type: stakeholders.type,
        tags: stakeholders.tags,
        riskLevel: stakeholders.riskLevel,
        engagementScore: stakeholders.engagementScore,
        lifecycleStage: stakeholders.lifecycleStage
      })
        .from(stakeholders)
        .where(and(baseWhere, searchWhere))
        .limit(limitNum)
        .offset(offset);

      const getSegmentDescription = (id: string) => {
        const descriptions: Record<string, string> = {
          "seg:promoter": "Highly engaged with high satisfaction scores",
          "seg:detractor": "Low satisfaction or high escalation rates",
          "seg:churn_risk": "Inactive in dormant or suspended stages",
          "seg:silent_satisfied": "Low engagement but high tenure",
          "seg:high_engagement": "Active recent interaction and high scores",
          "seg:inactive_90d": "No interaction recorded in >90 days",
          "seg:exam_ready": "Upcoming exam sittings detected",
          "seg:certification_pending": "Nearing program completion",
          "seg:alumni_network": "Alumni lifecycle phase",
          "seg:efficient_collaborator": "High resolution rate for marker/setter cases",

          // New Kasneb specific ones:
          "seg:qual_cams": "Certificate in Accounting and Management Skills (CAMS)",
          "seg:qual_atd": "Accounting Technicians Diploma (ATD)",
          "seg:qual_dcnsa": "Diploma in Computer Networks and Systems Administration",
          "seg:qual_ddma": "Diploma in Data Management and Analytics",
          "seg:qual_dqm": "Diploma in Quality Management",
          "seg:qual_cpa": "Certified Public Accountants (CPA)",
          "seg:qual_cs": "Certified Secretaries (CS)",
          "seg:qual_cifa": "Certified Investment and Financial Analysts (CIFA)",
          "seg:qual_ccp": "Certified Credit Professionals (CCP)",
          "seg:qual_cisse": "Certified Information Systems Security Professional",
          "seg:qual_cqp": "Certified Quality Professional",
          "seg:qual_cffe": "Certified Forensic Fraud Examiner",
          "seg:qual_cpfm": "Certified Public Financial Management",
          "seg:international": "Stakeholders based outside Kenya",
          "seg:new_registrant": "Recently registered stakeholders",
          "seg:dormant": "Stakeholders in a dormant lifecycle stage",
          "seg:accredited_institution": "Fully accredited active partner institutions",
          "seg:employer": "Partner Employers in the KASNEB ecosystem"
        };
        return descriptions[id] || "Behavioral clustering segment";
      };

      const result = allStakeholders.map(s => {
        const rawTags = s.tags;
        const tags = typeof rawTags === 'string' ? JSON.parse(rawTags) : rawTags;
        const stakeholderSegments = (tags || [])
          .filter((t: string) => t.startsWith("seg:"))
          .map((id: string) => ({
            id,
            name: id.replace("seg:", "").split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
            description: getSegmentDescription(id)
          }));

        return {
          ...s,
          segments: stakeholderSegments
        };
      });

      res.json({
        stakeholders: result,
        pagination: {
          total: totalItems,
          page: pageNum,
          totalPages: Math.ceil(totalItems / limitNum)
        }
      });
    } catch (error) {
      console.error("Error fetching stakeholder segments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── GET /api/stakeholders/:id ─────────────────────────────────────────────
  app.get("/api/stakeholders/:id", marketingAuth, checkPermission("stakeholders.view_all"), async (req, res) => {
    try {
      const id = req.params.id as string;
      const stakeholder = await db.select().from(stakeholders).where(eq(stakeholders.id, id));
      if (!stakeholder.length) {
        return res.status(404).json({ error: "Stakeholder not found" });
      }

      const [interactionList, relationsA, relationsB, stakeholderCases] = await Promise.all([
        db.select()
          .from(stakeholderInteractions)
          .where(eq(stakeholderInteractions.stakeholderId, id))
          .orderBy(desc(stakeholderInteractions.createdAt))
          .limit(50),
        db.select({
          id: stakeholderRelationships.id,
          relationshipType: stakeholderRelationships.relationshipType,
          description: stakeholderRelationships.description,
          targetName: sql<string>`CASE 
            WHEN ${stakeholders.lastName} IS NOT NULL AND ${stakeholders.lastName} != '' 
            THEN CONCAT(${stakeholders.firstName}, ' ', ${stakeholders.lastName})
            ELSE ${stakeholders.firstName}
          END`,
          targetType: stakeholders.type,
        })
          .from(stakeholderRelationships)
          .innerJoin(stakeholders, eq(stakeholderRelationships.stakeholderBId, stakeholders.id))
          .where(eq(stakeholderRelationships.stakeholderAId, id)),
        db.select({
          id: stakeholderRelationships.id,
          relationshipType: stakeholderRelationships.relationshipType,
          description: stakeholderRelationships.description,
          targetName: sql<string>`CASE 
            WHEN ${stakeholders.lastName} IS NOT NULL AND ${stakeholders.lastName} != '' 
            THEN CONCAT(${stakeholders.firstName}, ' ', ${stakeholders.lastName})
            ELSE ${stakeholders.firstName}
          END`,
          targetType: stakeholders.type,
        })
          .from(stakeholderRelationships)
          .innerJoin(stakeholders, eq(stakeholderRelationships.stakeholderAId, stakeholders.id))
          .where(eq(stakeholderRelationships.stakeholderBId, id)),
        db.select({
          id: cases.id,
          caseNumber: cases.caseNumber,
          title: cases.title,
          description: cases.description,
          priority: cases.priority,
          status: cases.status,
          channel: cases.channel,
          createdAt: cases.createdAt,
          assignedTo: cases.assignedTo,
          assignedToName: sql<string>`${marketingUsers.firstName} || ' ' || ${marketingUsers.lastName}`,
          assignedDepartment: cases.assignedDepartment,
          departmentName: departments.name,
          categoryName: serviceCategories.name,
        })
          .from(cases)
          .leftJoin(departments, eq(cases.assignedDepartment, departments.id))
          .leftJoin(marketingUsers, eq(cases.assignedTo, marketingUsers.id))
          .leftJoin(serviceCategories, eq(cases.serviceCategoryId, serviceCategories.id))
          .where(eq(cases.stakeholderId, id))
          .orderBy(desc(cases.createdAt)),
      ]);

      const sh = stakeholder[0] as any;
      if (sh && sh.nationalId) {
        const decrypted = decryptField(sh.nationalId);
        if (decrypted !== null) sh.nationalId = decrypted;
      }

      // ── Refresh Engagement & Risk for individual ───────────────────────────
      // Only for non-org types or as a base for org types
      if (sh) {
        sh.riskLevel = await computeRiskLevel(id);
        // Note: engagementScore is updated on interaction, but we could refresh here too if needed
      }

      // ── Aggregated Data for Institutions/Organizations ─────────────────────
      if (sh && (sh.type === 'institution' || sh.type === 'employer' || sh.type === 'organization')) {
        const orgName = sh.organization || sh.name;
        if (orgName) {
          const members = await db.select({
            id: stakeholders.id,
            engagementScore: stakeholders.engagementScore,
            riskLevel: stakeholders.riskLevel,
          })
            .from(stakeholders)
            .where(and(
              eq(stakeholders.organization, orgName),
              ne(stakeholders.id, id as string)
            ));

          if (members.length > 0) {
            // Include members + the record itself in aggregation
            const allMembers = [...members.map(m => ({ ...m, riskLevel: m.riskLevel || 'low' })), { engagementScore: sh.engagementScore, riskLevel: sh.riskLevel }];

            const totalEng = allMembers.reduce((sum, m) => sum + (m.engagementScore || 0), 0);
            sh.aggregatedEngagement = Math.round(totalEng / allMembers.length);

            const riskMap: any = { low: 1, medium: 2, high: 3, critical: 4 };
            const revRiskMap: any = { 1: 'low', 2: 'medium', 3: 'high', 4: 'critical' };

            // For institutions, "Risk" is the average risk of members
            const totalRiskVal = allMembers.reduce((sum, m) => sum + (riskMap[m.riskLevel?.toLowerCase() || 'low'] || 1), 0);
            sh.aggregatedRisk = revRiskMap[Math.round(totalRiskVal / allMembers.length)] || 'low';
            sh.memberCount = members.length;
          }
        }
      }

      const relationships = [...relationsA, ...relationsB];

      const segments = (sh.tags || [])
        .filter((tag: string) => tag.startsWith('seg:'))
        .map((tag: string) => {
          const id = tag.replace('seg:', '');
          return {
            id: tag,
            name: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            description: getSegmentDescription(id)
          };
        });

      // ── Staff-Specific Data Fetching ───────────────────────────────────────
      let staffMetrics = null;
      let staffCases: any[] = [];
      let staffShifts: any[] = [];
      let staffQueues: any[] = [];
      
      if (sh && sh.type === 'staff' && sh.email) {
        // Attempt to match the internal user
        const matchedUsers = await db.select()
          .from(marketingUsers)
          .where(eq(marketingUsers.email, sh.email))
          .limit(1);
          
        if (matchedUsers.length > 0) {
          const internalUserId = matchedUsers[0].id;
          
          // Fetch cases assigned to this staff member
          staffCases = await db.select({
            id: cases.id,
            caseNumber: cases.caseNumber,
            title: cases.title,
            priority: cases.priority,
            status: cases.status,
            createdAt: cases.createdAt,
            resolvedAt: cases.resolvedAt,
            resolutionDurationMinutes: cases.resolutionDurationMinutes,
          })
            .from(cases)
            .where(eq(cases.assignedTo, internalUserId))
            .orderBy(desc(cases.createdAt));
            
          const assignedCasesCount = staffCases.length;
          const resolvedCasesCount = staffCases.filter(c => c.status === 'resolved' || c.status === 'closed').length;
          
          let avgResolutionTime = 0;
          const resolvedWithDuration = staffCases.filter(c => c.resolutionDurationMinutes !== null);
          if (resolvedWithDuration.length > 0) {
            const sumDuration = resolvedWithDuration.reduce((acc, c) => acc + (c.resolutionDurationMinutes || 0), 0);
            avgResolutionTime = Math.round(sumDuration / resolvedWithDuration.length);
          }
          
          // Fetch active shifts for this staff member
          staffShifts = await db.select({
            id: userShifts.id,
            date: userShifts.date,
            status: userShifts.status,
            shiftName: shifts.name,
            startTime: shifts.startTime,
            endTime: shifts.endTime,
          })
            .from(userShifts)
            .innerJoin(shifts, eq(userShifts.shiftId, shifts.id))
            .where(eq(userShifts.userId, internalUserId))
            .orderBy(desc(userShifts.date));
            
          const activeShiftsCount = staffShifts.filter(s => s.status === 'scheduled' || s.status === 'active').length;
          
          // Fetch queues for this staff member
          staffQueues = await db.select({
            id: userQueues.id,
            queueName: queues.name,
            skillLevel: userQueues.skillLevel,
            maxConcurrentCases: userQueues.maxConcurrentCases,
            isActive: userQueues.isActive
          })
            .from(userQueues)
            .innerJoin(queues, eq(userQueues.queueId, queues.id))
            .where(eq(userQueues.userId, internalUserId));
            
          staffMetrics = {
            assignedCases: assignedCasesCount,
            casesResolved: resolvedCasesCount,
            activeShifts: activeShiftsCount,
            avgResolutionTime,
          };
        }
      }

      res.json({
        stakeholder: sh,
        interactions: interactionList,
        relationships,
        cases: stakeholderCases,
        segments,
        staffMetrics,
        staffCases,
        staffShifts,
        staffQueues,
      });
    } catch (error) {
      console.error("Error fetching stakeholder:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── POST /api/stakeholders ────────────────────────────────────────────────
  app.post("/api/stakeholders", marketingAuth, checkPermission("stakeholders.create"), async (req, res) => {
    try {
      const data = stakeholderWriteSchema.parse(req.body);
      if (data.nationalId) {
        data.nationalId = encryptField(data.nationalId) || data.nationalId;
      }
      const newStakeholder = await db
        .insert(stakeholders)
        .values(data as any)
        .returning();
      res.status(201).json({ stakeholder: newStakeholder[0] });

      // Log stakeholder creation
      AuditService.logAction(req, {
        action: 'create',
        module: 'stakeholders',
        entityType: 'stakeholder',
        entityId: newStakeholder[0].id,
        newValues: newStakeholder[0],
        details: `Created new stakeholder: ${newStakeholder[0].firstName} ${newStakeholder[0].lastName}`
      });

      // ── Real-Time Intelligence ──────────────────────────────────────────────
      // Triggered asynchronously to avoid blocking the main response
      DiscoveryService.discoverForStakeholder(newStakeholder[0].id).catch(err =>
        console.error(`[Discovery] Deferred error for ${newStakeholder[0].id}:`, err)
      );
      SegmentationService.evaluateStakeholder(newStakeholder[0].id).catch(err =>
        console.error(`[Segmentation] Deferred error for ${newStakeholder[0].id}:`, err)
      );
    } catch (error) {
      console.error("Error creating stakeholder:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── PUT /api/stakeholders/:id ─────────────────────────────────────────────
  app.put("/api/stakeholders/:id", marketingAuth, checkPermission("stakeholders.edit"), async (req, res) => {
    try {
      const id = req.params.id as string;
      const parsedData = stakeholderWriteSchema.parse(req.body);
      const data: any = { ...parsedData };
      if (data.nationalId) {
        data.nationalId = encryptField(data.nationalId) || data.nationalId;
      }

      // Automated Alumni Transition Logic: Capture current institution before it's overwritten by an employer
      if (data.lifecycleStage === "alumni") {
        const [current] = await db.select({ organization: stakeholders.organization, metadata: stakeholders.metadata })
          .from(stakeholders).where(eq(stakeholders.id, id)).limit(1);

        if (current?.organization && /university|college|school|institute/i.test(current.organization)) {
          data.metadata = {
            ...(current.metadata as any || {}),
            alumni_institution: current.organization
          };
        }
      }

      const updated = await db
        .update(stakeholders)
        .set({ ...data, updatedAt: sql`now()` })
        .where(eq(stakeholders.id, id))
        .returning();
      if (!updated.length) {
        return res.status(404).json({ error: "Stakeholder not found" });
      }
      res.json({ stakeholder: updated[0] });

      // Log stakeholder update
      AuditService.logAction(req, {
        action: 'update',
        module: 'stakeholders',
        entityType: 'stakeholder',
        entityId: id,
        newValues: updated[0],
        details: `Updated stakeholder: ${updated[0].firstName} ${updated[0].lastName}`
      });

      // ── Real-Time Intelligence ──────────────────────────────────────────────
      DiscoveryService.discoverForStakeholder(id).catch(err =>
        console.error(`[Discovery] Deferred error for ${id}:`, err)
      );
      SegmentationService.evaluateStakeholder(id).catch(err =>
        console.error(`[Segmentation] Deferred error for ${id}:`, err)
      );
    } catch (error) {
      console.error("Error updating stakeholder:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── POST /api/stakeholders/:id/interactions ───────────────────────────────
  app.post("/api/stakeholders/:id/interactions", marketingAuth, checkPermission("stakeholders.create"), async (req, res) => {
    try {
      const id = req.params.id as string;
      const currentUser = (req as any).marketingUser;
      // SEC-A5: Validated write schema — prevent mass assignment
      const data = interactionWriteSchema.parse(req.body);
      const newInteraction = await db
        .insert(stakeholderInteractions)
        .values({ ...data, stakeholderId: id, performedBy: currentUser.id } as any)
        .returning();

      // Recompute engagement score using full formula
      const newScore = await computeEngagementScore(id);
      await db
        .update(stakeholders)
        .set({ engagementScore: newScore, updatedAt: sql`now()` } as any)
        .where(eq(stakeholders.id, id));

      res.status(201).json({ interaction: newInteraction[0] });

      // Log interaction creation
      AuditService.logAction(req, {
        action: 'create',
        module: 'stakeholders',
        entityType: 'interaction',
        entityId: newInteraction[0].id,
        newValues: newInteraction[0],
        details: `Logged ${newInteraction[0].channel} interaction for stakeholder ID: ${id}`
      });
    } catch (error) {
      console.error("Error creating interaction:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── POST /api/stakeholders/relationships ──────────────────────────────────
  app.post("/api/stakeholders/relationships", marketingAuth, checkPermission("stakeholders.create"), async (req, res) => {
    try {
      const currentUser = (req as any).marketingUser;
      // SEC-A5: Validated write schema — prevent mass assignment; stakeholderAId comes from currentUser
      const parsed = relationshipWriteSchema.parse(req.body);
      const stakeholderAId: string = (req.body.stakeholderAId as string); // source must be provided by caller
      const newRelationship = await db
        .insert(stakeholderRelationships)
        .values({
          stakeholderAId,
          stakeholderBId: parsed.stakeholderBId,
          relationshipType: parsed.relationshipType,
          description: parsed.description,
        } as any)
        .returning();

      // Recompute engagement for both linked stakeholders
      if (stakeholderAId) {
        const scoreA = await computeEngagementScore(stakeholderAId);
        await db.update(stakeholders).set({ engagementScore: scoreA, updatedAt: sql`now()` } as any).where(eq(stakeholders.id, stakeholderAId));
      }
      if (parsed.stakeholderBId && parsed.stakeholderBId !== stakeholderAId) {
        const scoreB = await computeEngagementScore(parsed.stakeholderBId);
        await db.update(stakeholders).set({ engagementScore: scoreB, updatedAt: sql`now()` } as any).where(eq(stakeholders.id, parsed.stakeholderBId));
      }

      res.status(201).json({ relationship: newRelationship[0] });

      // Log relationship creation
      AuditService.logAction(req, {
        action: 'create',
        module: 'stakeholders',
        entityType: 'relationship',
        entityId: newRelationship[0].id,
        newValues: newRelationship[0],
        details: `Created ${newRelationship[0].relationshipType} relationship`
      });
    } catch (error) {
      console.error("Error creating relationship:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── GET /api/stakeholder-interactions ─────────────────────────────────────
  // Refactored to pull primarily from cases as requested
  app.get("/api/stakeholder-interactions", marketingAuth, async (req, res) => {
    try {
      const pageNum = sanitizeInteger(req.query.page, 1, 1, 1000);
      const limitNum = sanitizeInteger(req.query.limit, 10, 1, 200);
      const offset = (pageNum - 1) * limitNum;
      const search = req.query.search as string;
      const status = req.query.status as string;
      const priority = req.query.priority as string;

      const conditions = [];
      if (status) conditions.push(eq(cases.status, status));
      if (priority) conditions.push(eq(cases.priority, priority));
      if (search) {
        conditions.push(or(
          ilike(cases.title, `%${search}%`),
          ilike(cases.caseNumber, `%${search}%`),
          ilike(stakeholders.firstName, `%${search}%`),
          ilike(stakeholders.lastName, `%${search}%`)
        ));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [results, totalResult] = await Promise.all([
        db.select({
          id: cases.id,
          caseId: cases.id,
          caseNumber: cases.caseNumber,
          stakeholderId: cases.stakeholderId,
          subject: cases.title,
          description: cases.description,
          status: cases.status,
          priority: cases.priority,
          createdAt: cases.createdAt,
          stakeholderName: sql<string>`${stakeholders.firstName} || ' ' || ${stakeholders.lastName}`,
          stakeholderType: stakeholders.type,
          channel: cases.channel,
        })
          .from(cases)
          .leftJoin(stakeholders, eq(cases.stakeholderId, stakeholders.id))
          .where(whereClause!)
          .orderBy(desc(cases.createdAt))
          .limit(limitNum)
          .offset(offset),
        db.select({ count: count() })
          .from(cases)
          .leftJoin(stakeholders, eq(cases.stakeholderId, stakeholders.id))
          .where(whereClause!),
      ]);

      res.json({
        interactions: results,
        total: totalResult[0]?.count || 0,
        page: pageNum,
        totalPages: Math.ceil((totalResult[0]?.count || 0) / limitNum),
      });
    } catch (error) {
      console.error("Error fetching interactions from cases:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── GET /api/stakeholder-relationships ────────────────────────────────────
  app.get("/api/stakeholder-relationships", marketingAuth, async (req, res) => {
    try {
      const page = sanitizeInteger(req.query.page, 1, 1, 1000);
      const limit = sanitizeInteger(req.query.limit, 10, 1, 100);
      const offset = (page - 1) * limit;
      const search = req.query.search as string;
      const type = req.query.type as string;

      // Alises for the same table to support joining twice
      const sa = aliasedTable(stakeholders, "sa");
      const sb = aliasedTable(stakeholders, "sb");

      const conditions = [];
      if (search) {
        conditions.push(or(
          ilike(sa.firstName, `%${search}%`),
          ilike(sa.lastName, `%${search}%`),
          ilike(sa.organization, `%${search}%`),
          ilike(sb.firstName, `%${search}%`),
          ilike(sb.lastName, `%${search}%`),
          ilike(sb.organization, `%${search}%`)
        ));
      }
      if (type && type !== "all") {
        conditions.push(eq(stakeholderRelationships.relationshipType, type));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [totalResult] = await db.select({ count: sql<number>`count(*)` })
        .from(stakeholderRelationships)
        .leftJoin(sa, eq(stakeholderRelationships.stakeholderAId, sa.id))
        .leftJoin(sb, eq(stakeholderRelationships.stakeholderBId, sb.id))
        .where(whereClause);

      const total = Number(totalResult?.count || 0);

      const results = await db
        .select({
          id: stakeholderRelationships.id,
          relationshipType: stakeholderRelationships.relationshipType,
          description: stakeholderRelationships.description,
          createdAt: stakeholderRelationships.createdAt,
          sourceStakeholderId: stakeholderRelationships.stakeholderAId,
          targetStakeholderId: stakeholderRelationships.stakeholderBId,
          sourceName: sql<string>`CASE WHEN ${sa.type} IN ('institution', 'employer', 'department') THEN ${sa.organization} ELSE CONCAT(${sa.firstName}, ' ', ${sa.lastName}) END`,
          sourceType: sa.type,
          targetName: sql<string>`CASE WHEN ${sb.type} IN ('institution', 'employer', 'department') THEN ${sb.organization} ELSE CONCAT(${sb.firstName}, ' ', ${sb.lastName}) END`,
          targetType: sb.type,
        })
        .from(stakeholderRelationships)
        .leftJoin(sa, eq(stakeholderRelationships.stakeholderAId, sa.id))
        .leftJoin(sb, eq(stakeholderRelationships.stakeholderBId, sb.id))
        .where(whereClause)
        .limit(limit)
        .offset(offset);

      res.json({
        data: results,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error("Error fetching relationships:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  // ── DELETE /api/stakeholders/:id ──────────────────────────────────────────
  app.delete("/api/stakeholders/:id", marketingAuth, checkPermission("stakeholders.delete"), async (req, res) => {
    try {
      const { id } = req.params;
      const { confirmDelete } = req.body;

      // SEC-A8: Require explicit confirmation token to prevent accidental hard-deletes
      if (confirmDelete !== `DELETE-${id.slice(0, 8)}`) {
        return res.status(400).json({
          error: "Confirmation token required.",
          message: `Provide {confirmDelete: 'DELETE-${id.slice(0, 8)}'} to confirm permanent deletion.`
        });
      }

      // Delete dependent records
      await db.delete(stakeholderInteractions).where(eq(stakeholderInteractions.stakeholderId, id as string));
      await db.delete(stakeholderRelationships).where(or(
        eq(stakeholderRelationships.stakeholderAId, id as string),
        eq(stakeholderRelationships.stakeholderBId, id as string)
      ));

      const deleted = await db
        .delete(stakeholders)
        .where(eq(stakeholders.id, id as string))
        .returning();

      if (!deleted.length) {
        return res.status(404).json({ error: "Stakeholder not found" });
      }

      res.json({ message: "Stakeholder and all related data deleted permanently" });

      AuditService.logAction(req, {
        action: 'delete',
        module: 'stakeholders',
        entityType: 'stakeholder',
        entityId: id as string,
        details: `Permanently deleted stakeholder: ${deleted[0].firstName} ${deleted[0].lastName}`
      });
    } catch (error) {
      console.error("Error deleting stakeholder:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── DELETE /api/stakeholder-relationships/:id ──────────────────────────────
  app.delete("/api/stakeholder-relationships/:id", marketingAuth, checkPermission("stakeholders.edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await db
        .delete(stakeholderRelationships)
        .where(eq(stakeholderRelationships.id, id as string))
        .returning();

      if (!deleted.length) {
        return res.status(404).json({ error: "Relationship not found" });
      }

      // Recompute scores for involved stakeholders
      if (deleted[0].stakeholderAId) await computeEngagementScore(deleted[0].stakeholderAId);
      if (deleted[0].stakeholderBId && deleted[0].stakeholderBId !== deleted[0].stakeholderAId) {
        await computeEngagementScore(deleted[0].stakeholderBId);
      }

      res.json({ message: "Relationship removed successfully" });

      AuditService.logAction(req, {
        action: 'delete',
        module: 'stakeholders',
        entityType: 'relationship',
        entityId: id as string,
        details: `Deleted relationship ID: ${id}`
      });
    } catch (error) {
      console.error("Error deleting relationship:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  // ── GET /api/stakeholders/segments ───────────────────────────────────────
  app.get("/api/stakeholders/segments", marketingAuth, async (req, res) => {
    try {
      const allStakeholders = await db.select({
        tags: stakeholders.tags
      }).from(stakeholders);

      const segmentMap: Record<string, number> = {};

      allStakeholders.forEach(s => {
        const rawTags = s.tags;
        const tags = typeof rawTags === 'string' ? JSON.parse(rawTags) : rawTags;

        if (tags && Array.isArray(tags)) {
          tags.forEach((tag: string) => {
            if (tag.startsWith("seg:")) {
              segmentMap[tag] = (segmentMap[tag] || 0) + 1;
            }
          });
        }
      });

      const segments = Object.entries(segmentMap).map(([id, count]) => ({
        id,
        name: id.replace("seg:", "").split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
        count,
        description: getSegmentDescription(id)
      }));

      res.json({ segments });
    } catch (error) {
      console.error("Error fetching segments:", error);
      res.status(500).json({ error: "Failed to fetch segments" });
    }
  });
}

function getSegmentDescription(tag: string): string {
  const descriptions: Record<string, string> = {
    "seg:promoter": "Satisfied stakeholders with high ratings and zero recorded SLA breaches.",
    "seg:detractor": "Stakeholders with low satisfaction ratings or high case escalation history.",
    "seg:churn_risk": "Dormant or suspended stakeholders with no recorded interaction in >90 days.",
    "seg:silent_satisfied": "Long-tenure stakeholders with low interaction but high historical satisfaction.",
    "seg:high_engagement": "Highly active stakeholders with engagement scores above 80.",
    "seg:inactive_90d": "Stakeholders with no recorded interaction in the last 90 days.",
    "seg:exam_ready": "Students with an upcoming exam sitting in the next 60 days.",
    "seg:certification_pending": "Active students with over 2 years of tenure in the ecosystem.",
    "seg:alumni_network": "Stakeholders who have transitioned to alumni status.",
    "seg:efficient_collaborator": "Partners or staff with a case resolution rate above 80%.",
    "seg:gen_z": "Demographic segment: Stakeholders born after 1996.",
    "seg:millennial": "Demographic segment: Stakeholders born between 1981 and 1996."
  };
  return descriptions[tag] || "Dynamically identified stakeholder grouping.";
}

