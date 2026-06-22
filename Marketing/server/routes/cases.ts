import type { Express } from "express";
import { db } from "../db";
import fs from "fs";
import path from "path";
import { marketingAuth } from "../middleware/marketingAuth";
import {
  cases, caseComments, caseAttachments, caseHistory, stakeholders,
  knowledgeBase, intakeSignals, integrationConfigs, stakeholderInteractions,
  caseUserNotes
} from "../../shared/crmSchema";
import {
  escalationChains, escalationSteps, serviceCategories, departments, slaRules,
  userRoles, systemRoles, systemRolePermissions, systemPermissions
} from "../../shared/adminSchema";
import { conversations } from "../../shared/commsSchema";
import { marketingUsers, marketingProspects, marketingLeads } from "../../shared/schema";
import { eq, ne, desc, sql, ilike, or, and, count, between, asc, inArray, gte, lte, isNull } from "drizzle-orm";
import { sanitizeSearchInput, sanitizeInteger } from "../utils/sanitize";
import { AssignmentService } from "../services/assignment-service";
import { checkPermission } from "../middleware/marketingAuth";
import { NotificationService } from "../services/notification-service";
import { StakeholderMatchingService } from "../services/stakeholder-matching-service";
import { AuditService } from "../services/audit-service";
import { emailService } from "../services/emailService";

const rbacCache = new Map<string, { conditions: any[]; expiresAt: number }>();
const RBAC_CACHE_TTL = 60_000; // 60 seconds

async function getCaseRbacConditions(userId: string) {
  const cached = rbacCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.conditions;
  }

  // 1. Get all roles for the user
  const userRoleIds = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  if (userRoleIds.length === 0) {
    const defaultConditions = [eq(cases.assignedTo, userId)];
    rbacCache.set(userId, { conditions: defaultConditions, expiresAt: Date.now() + RBAC_CACHE_TTL });
    return defaultConditions;
  }

  const roleIds = userRoleIds.map(r => r.roleId);

  // 2. Check for specific permissions
  const perms = await db
    .select({ key: systemPermissions.key })
    .from(systemPermissions)
    .innerJoin(systemRolePermissions, eq(systemRolePermissions.permissionId, systemPermissions.id))
    .where(and(inArray(systemRolePermissions.roleId, roleIds), eq(systemPermissions.isActive, true)));

  const permKeys = perms.map(p => p.key);

  const baseConditions = [eq(cases.assignedTo, userId)];

  if (permKeys.includes("cases.view_all")) {
    rbacCache.set(userId, { conditions: [], expiresAt: Date.now() + RBAC_CACHE_TTL });
    return [];
  }

  if (permKeys.includes("cases.view_department")) {
    const user = await db.select({ departmentId: marketingUsers.departmentId }).from(marketingUsers).where(eq(marketingUsers.id, userId)).limit(1);
    if (user[0]?.departmentId) baseConditions.push(eq(cases.assignedDepartment, user[0].departmentId));
  }

  // Support for tag-based access (collaborators)
  // This allows users to see cases they are tagged in even if they aren't the primary assignee
  const tagCondition = sql`${cases.tags} @> ${JSON.stringify([{ id: userId }])}::jsonb OR ${cases.tags} @> ${JSON.stringify([userId])}::jsonb`;

  const finalConditions = [or(...baseConditions, tagCondition)];
  rbacCache.set(userId, { conditions: finalConditions, expiresAt: Date.now() + RBAC_CACHE_TTL });
  return finalConditions;
}

function generateCaseNumber(): string {
  const prefix = "KASNEB";
  const yearShort = new Date().getFullYear().toString().slice(-2); // "26" for 2026
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${prefix}-${yearShort}-${random}`;
}

/**
 * Automatically triages a case into the marketing pipeline as a Lead if it belongs
 * to the Marketing (MRK) department.
 */
async function triageLeadFromCase(caseId: string) {
  try {
    const [caseData] = await db.select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      title: cases.title,
      description: cases.description,
      serviceCategoryId: cases.serviceCategoryId,
      stakeholderId: cases.stakeholderId,
      assignedTo: cases.assignedTo
    })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1);

    if (!caseData?.serviceCategoryId) return;

    // Fetch the category details
    const [category] = await db.select({
      departmentId: serviceCategories.departmentId,
      name: serviceCategories.name
    }).from(serviceCategories).where(eq(serviceCategories.id, caseData.serviceCategoryId)).limit(1);

    if (category?.departmentId) {
      const [dept] = await db.select({
        name: departments.name,
        code: departments.code
      }).from(departments).where(eq(departments.id, category.departmentId)).limit(1);

      // Triage if it's the Marketing department OR if the category name suggests a lead
      const isMarketingDept = dept?.code === 'MRK' || dept?.name === 'Marketing';
      const isLeadCategory = category?.name?.toLowerCase().includes('marketing lead');

      if (isMarketingDept || isLeadCategory) {
        // Check if we already created a lead for this case (idempotency)
        const existingLead = await db.select().from(marketingLeads)
          .where(ilike(marketingLeads.remarks, `%${caseData.caseNumber}%`))
          .limit(1);

        if (existingLead.length === 0) {
          // Fetch stakeholder details for better lead info
          const [stakeholder] = await db.select().from(stakeholders).where(eq(stakeholders.id, caseData.stakeholderId || "")).limit(1);

          // Dynamic Mapping based on Stakeholder Type
          // Students: Direct inquiries. Client = Brandon, Contact = Brandon.
          // Institutions/Employers: Client = Organization, Contact = Person.
          let clientName = "";
          let contactName = "TBD";

          if (stakeholder) {
            contactName = `${stakeholder.firstName} ${stakeholder.lastName}`;
            if (stakeholder.type === 'student') {
              clientName = contactName;
            } else {
              clientName = stakeholder.organization || contactName;
            }
          } else {
            clientName = caseData.title;
          }

          await db.insert(marketingLeads).values({
            date: new Date().toISOString(),
            client: clientName,
            contactPerson: contactName,
            contactNumber: stakeholder?.phone || "TBD",
            contactEmail: stakeholder?.email || "TBD",
            marketerId: caseData.assignedTo,
            remarks: `Source: Case ${caseData.caseNumber}\nDescription: ${caseData.description || caseData.title}`
          } as any);

          console.log(`[Lead Triage] Automatically created lead for case ${caseData.caseNumber} (Dept: ${dept.name})`);
        }
      }
    }
  } catch (error) {
    console.error(`[Lead Triage] Failed to triage case ${caseId}:`, error);
  }
}

export function registerCaseRoutes(app: Express) {

  app.get("/api/cases", marketingAuth, async (req, res) => {
    try {
      const { status, priority, channel, search, assignedTo } = req.query;
      const pageNum = sanitizeInteger(req.query.page, 1, 1, 1000);
      const limitNum = 10; // Forced 10 per page as per request
      const offset = (pageNum - 1) * limitNum;
      const conditions: any[] = [];

      // --- RBAC Scoping ---
      const currentUser = (req as any).marketingUser;
      const rbacConditions = await getCaseRbacConditions(currentUser.id);
      conditions.push(...rbacConditions);

      if (status && status !== "all") conditions.push(ilike(cases.status, status as string));
      if (priority && priority !== "all") conditions.push(ilike(cases.priority, priority as string));
      if (channel && channel !== "all") conditions.push(ilike(cases.channel, channel as string));
      if (assignedTo) conditions.push(eq(cases.assignedTo, assignedTo as string));

      if (search) {
        const s = sanitizeSearchInput(search as string);
        conditions.push(
          or(
            ilike(cases.caseNumber, `%${s}%`),
            ilike(cases.title, `%${s}%`),
            ilike(cases.description, `%${s}%`)
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [results, totalResult] = await Promise.all([
        db.select({
          id: cases.id,
          caseNumber: cases.caseNumber,
          title: cases.title,
          priority: cases.priority,
          status: cases.status,
          channel: cases.channel,
          createdAt: cases.createdAt,
          assignedTo: cases.assignedTo,
          assignedToName: sql<string>`${marketingUsers.firstName} || ' ' || ${marketingUsers.lastName}`,
          assignedToEmail: marketingUsers.email,
          assignedToActiveCases: sql<number>`(SELECT COUNT(*) FROM cases AS c WHERE c.assigned_to = ${marketingUsers.id} AND c.status IN ('open', 'in_progress', 'escalated'))::integer`,
          departmentName: departments.name,
          assignedDepartment: cases.assignedDepartment,
          categoryName: serviceCategories.name,
          slaDeadline: cases.slaDeadline,
          slaResponseDeadline: cases.slaResponseDeadline,
          slaBreached: cases.slaBreached,
          serviceCategoryId: cases.serviceCategoryId,
          slaMetricType: slaRules.metricType,
          slaResponseMinutes: slaRules.responseTimeMinutes,
          slaTimeline: slaRules.timeline,
          slaTimelineUnit: slaRules.timelineUnit,
          assignedAt: cases.assignedAt,
          firstResponseAt: cases.firstResponseAt,
          resolvedAt: cases.resolvedAt,
          tags: cases.tags,
          description: cases.description,
          stakeholderId: cases.stakeholderId,
          stakeholderName: sql<string>`${stakeholders.firstName} || ' ' || ${stakeholders.lastName}`,
          registrationNumber: stakeholders.registrationNumber
        })
          .from(cases)
          .leftJoin(marketingUsers, eq(cases.assignedTo, marketingUsers.id))
          .leftJoin(departments, eq(cases.assignedDepartment, departments.id))
          .leftJoin(serviceCategories, eq(cases.serviceCategoryId, serviceCategories.id))
          .leftJoin(stakeholders, eq(cases.stakeholderId, stakeholders.id))
          .leftJoin(slaRules, and(
            eq(cases.serviceCategoryId, slaRules.serviceCategoryId),
            eq(cases.priority, slaRules.priority),
            eq(slaRules.isActive, true)
          ))
          .where(whereClause)
          .orderBy(desc(cases.createdAt))
          .limit(limitNum)
          .offset(offset),
        db.select({ count: count() }).from(cases).where(whereClause),
      ]);

      // --- Fallback SLA Rules Mapping ---
      // If a case was mapped to a fallback rule (ignoring priority) during creation,
      // the strict leftJoin above will leave SLA fields null. We resolve them here.
      const casesNeedingSla = results.filter(c => !c.slaTimeline && c.serviceCategoryId);
      if (casesNeedingSla.length > 0) {
        const categoryIds = [...new Set(casesNeedingSla.map(c => c.serviceCategoryId))];
        const fallbackRules = await db.select()
            .from(slaRules)
            .where(and(
                inArray(slaRules.serviceCategoryId, categoryIds as string[]),
                eq(slaRules.isActive, true)
            ));
        
        // Group fallback rules by category, preferring 'medium' or the first available
        const rulesByCat = fallbackRules.reduce((acc, rule) => {
            if (!acc[rule.serviceCategoryId as string]) {
                acc[rule.serviceCategoryId as string] = rule;
            } else if (rule.priority === "medium") {
                acc[rule.serviceCategoryId as string] = rule;
            }
            return acc;
        }, {} as Record<string, any>);

        for (const c of results) {
            if (!c.slaTimeline && c.serviceCategoryId && rulesByCat[c.serviceCategoryId]) {
                const rule = rulesByCat[c.serviceCategoryId];
                c.slaMetricType = rule.metricType;
                c.slaResponseMinutes = rule.responseTimeMinutes;
                c.slaTimeline = rule.timeline;
                c.slaTimelineUnit = rule.timelineUnit;
            }
        }
      }

      res.json({
        cases: results,
        total: totalResult[0]?.count || 0,
        page: pageNum,
        totalPages: Math.ceil((totalResult[0]?.count || 0) / limitNum),
      });
    } catch (error) {
      console.error("Error fetching cases:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // NEW: Case Workspace Endpoint
  app.get("/api/cases/:id/workspace", marketingAuth, async (req, res) => {
    try {
      const { id } = req.params;
      // --- RBAC Scoping ---
      const currentUser = (req as any).marketingUser;
      const rbacConditions = await getCaseRbacConditions(currentUser.id);

      const caseData = await db.select({
        case: cases,
        assignee: {
          firstName: marketingUsers.firstName,
          lastName: marketingUsers.lastName,
          email: marketingUsers.email,
        },
        department: departments,
        category: serviceCategories,
        stakeholder: stakeholders,
        slaRule: {
          responseTimeMinutes: slaRules.responseTimeMinutes,
          timeline: slaRules.timeline,
          timelineUnit: slaRules.timelineUnit,
          metricType: slaRules.metricType,
        }
      })
        .from(cases)
        .leftJoin(marketingUsers, eq(cases.assignedTo, marketingUsers.id))
        .leftJoin(departments, eq(cases.assignedDepartment, departments.id))
        .leftJoin(serviceCategories, eq(cases.serviceCategoryId, serviceCategories.id))
        .leftJoin(stakeholders, eq(cases.stakeholderId, stakeholders.id))
        .leftJoin(slaRules, and(
          eq(cases.serviceCategoryId, slaRules.serviceCategoryId),
          eq(cases.priority, slaRules.priority),
          eq(slaRules.isActive, true)
        ))
        .where(and(eq(cases.id, id as string), ...rbacConditions))
        .limit(1);

      if (!caseData.length) return res.status(404).json({ error: "Case not found" });

      // Fetch all independent data in parallel
      const interactionConditions = [eq(stakeholderInteractions.caseId, id as string)];
      if (caseData[0].case.stakeholderId) {
        interactionConditions.push(eq(stakeholderInteractions.stakeholderId, caseData[0].case.stakeholderId));
      }

      const [collaboration, history, interactions, templatesList, userNotes, linkedConversation] = await Promise.all([
        // 1. Comments
        db.select({
          id: caseComments.id,
          content: caseComments.content,
          createdAt: caseComments.createdAt,
          isInternal: caseComments.isInternal,
          userName: sql<string>`${marketingUsers.firstName} || ' ' || ${marketingUsers.lastName}`,
          userId: caseComments.userId
        })
          .from(caseComments)
          .leftJoin(marketingUsers, eq(caseComments.userId, marketingUsers.id))
          .where(and(eq(caseComments.caseId, id as string), eq(caseComments.isInternal, true)))
          .orderBy(asc(caseComments.createdAt)),

        // 2. History
        db.select()
          .from(caseHistory)
          .where(eq(caseHistory.caseId, id as string))
          .orderBy(desc(caseHistory.createdAt))
          .limit(10),

        // 3. Interactions
        db.select()
          .from(stakeholderInteractions)
          .where(or(...interactionConditions))
          .orderBy(desc(stakeholderInteractions.createdAt))
          .limit(10),

        // 4. Templates
        db.select()
          .from(knowledgeBase)
          .where(eq(knowledgeBase.isTemplate, true))
          .orderBy(desc(knowledgeBase.createdAt)),

        // 5. Personal Notes
        db.select({ notes: caseUserNotes.notes })
          .from(caseUserNotes)
          .where(and(eq(caseUserNotes.caseId, id as string), eq(caseUserNotes.userId, currentUser.id)))
          .limit(1),

        // 6. Linked Conversation
        db.select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.caseId, id as string))
          .limit(1)
      ]);

      // Fetch longitudinal stakeholder case history with enhanced forensic data
      let stakeholderCases: any[] = [];
      if (caseData[0].case.stakeholderId) {
        stakeholderCases = await db.select({
          id: cases.id,
          caseNumber: cases.caseNumber,
          title: cases.title,
          status: cases.status,
          createdAt: cases.createdAt,
          priority: cases.priority,
          description: cases.description,
          assignedUserName: sql<string>`${marketingUsers.firstName} || ' ' || ${marketingUsers.lastName}`,
          departmentName: departments.name,
          registrationNumber: stakeholders.registrationNumber,
          stakeholderFirstName: stakeholders.firstName,
          stakeholderLastName: stakeholders.lastName
        })
          .from(cases)
          .leftJoin(marketingUsers, eq(cases.assignedTo, marketingUsers.id))
          .leftJoin(departments, eq(cases.assignedDepartment, departments.id))
          .leftJoin(stakeholders, eq(cases.stakeholderId, stakeholders.id))
          .where(and(
            eq(cases.stakeholderId, caseData[0].case.stakeholderId),
            ne(cases.id, id as string)
          ))
          .orderBy(desc(cases.createdAt))
          .limit(10);
      }

      const responseData = {
        ...caseData[0],
        collaboration,
        history,
        interactions,
        stakeholderCases,
        templates: templatesList,
        case: {
          ...caseData[0].case,
          personalNotes: userNotes[0]?.notes || ""
        },
        conversationId: linkedConversation[0]?.id || null
      };

      res.json(responseData);
    } catch (error) {
      console.error("Error fetching workspace data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // NEW: Get full internal comment history for a case
  app.get("/api/cases/:id/comments", marketingAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = (req as any).marketingUser;
      const rbacConditions = await getCaseRbacConditions(currentUser.id);

      // Verify access to the case first
      const idStr = String(id);
      const caseResult = await db.select().from(cases).where(and(eq(cases.id, idStr), ...rbacConditions)).limit(1);
      if (!caseResult.length) return res.status(404).json({ error: "Case not found" });

      const comments = await db.select({
        id: caseComments.id,
        content: caseComments.content,
        createdAt: caseComments.createdAt,
        isInternal: caseComments.isInternal,
        userName: sql<string>`${marketingUsers.firstName} || ' ' || ${marketingUsers.lastName}`,
        userId: caseComments.userId
      })
        .from(caseComments)
        .leftJoin(marketingUsers, eq(caseComments.userId, marketingUsers.id))
        .where(and(eq(caseComments.caseId, idStr), eq(caseComments.isInternal, true)))
        .orderBy(asc(caseComments.createdAt));

      res.json({ comments });
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });


  app.get("/api/cases/stats", marketingAuth, async (req, res) => {
    try {
      const currentUser = (req as any).marketingUser;
      const rbacConditions = await getCaseRbacConditions(currentUser.id);

      const isPowerUser = rbacConditions.length === 0;
      const assignedWhere = isPowerUser ? undefined : and(...rbacConditions);

      // Tagged stats are specifically for cases where the user is NOT the primary assignee but is in the tags JSONB array
      // For Power Users (Admin), we might want to still show "collaboration" cases or just set it to 0 as they see "all" anyway.
      // Current implementation shows cases where they are tagged but not assigned.
      // Tagged stats are for cases where the user is a collaborator (tagged) but not the primary assignee
      const taggedCondition = or(
        sql`${cases.tags} @> ${JSON.stringify([{ id: currentUser.id }])}::jsonb`,
        sql`${cases.tags} @> ${JSON.stringify([currentUser.id])}::jsonb`
      );

      const taggedWhere = and(
        taggedCondition,
        or(ne(cases.assignedTo, currentUser.id), isNull(cases.assignedTo)),
        inArray(cases.status, ['open', 'in_progress']),
        ...(isPowerUser ? [] : rbacConditions)
      );

      // --- Weekly scoping logic ---
      const now = new Date();
      const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const nairobiDayStr = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Nairobi", weekday: "short" }).format(now);
      const dayOfWeek = dayMap[nairobiDayStr] ?? 1;
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(now.getTime() - diffToMonday * 24 * 60 * 60 * 1000);
      const nairobiDateStr = weekStart.toLocaleString("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" });
      const weekStartISO = `${nairobiDateStr}T00:00:00+03:00`;

      // Single consolidated query for performance
      const [allStats] = await db.select({
        total: count(),
        open: count(sql`CASE WHEN ${cases.status} = 'open' THEN 1 END`),
        pending: count(sql`CASE WHEN ${cases.status} = 'pending_acceptance' THEN 1 END`),
        inProgress: count(sql`CASE WHEN ${cases.status} = 'in_progress' THEN 1 END`),
        escalated: count(sql`CASE WHEN ${cases.status} = 'escalated' THEN 1 END`),
        resolved: count(sql`CASE WHEN ${cases.status} = 'resolved' THEN 1 END`),
        closed: count(sql`CASE WHEN ${cases.status} = 'closed' THEN 1 END`),
        slaBreached: count(sql`CASE WHEN
          (${cases.slaDeadline} IS NOT NULL AND ${cases.slaDeadline}::timestamptz < NOW() AND ${cases.status} NOT IN ('resolved', 'closed'))
          OR (${cases.slaResponseDeadline} IS NOT NULL AND ${cases.slaResponseDeadline}::timestamptz < NOW() AND ${cases.firstResponseAt} IS NULL)
        THEN 1 END`),
        resolutionRate: sql<number>`ROUND(COALESCE(
          (COUNT(CASE WHEN ${cases.status} IN ('resolved', 'closed') AND ${cases.slaBreached} = false THEN 1 END)::numeric / 
          NULLIF(COUNT(CASE WHEN ${cases.status} IN ('resolved', 'closed') THEN 1 END), 0)) * 100
        , 0))`,
        // Weekly insights
        weeklyActive: count(sql`CASE WHEN ${cases.createdAt} >= ${weekStartISO} AND ${cases.status} IN ('open', 'pending_acceptance', 'in_progress') THEN 1 END`),
        weeklyResolved: count(sql`CASE WHEN ${cases.createdAt} >= ${weekStartISO} AND ${cases.status} = 'resolved' THEN 1 END`),
        weeklyBreached: count(sql`CASE WHEN ${cases.createdAt} >= ${weekStartISO} AND (
          (${cases.slaDeadline} IS NOT NULL AND ${cases.slaDeadline}::timestamptz < NOW() AND ${cases.status} NOT IN ('resolved', 'closed'))
          OR (${cases.slaResponseDeadline} IS NOT NULL AND ${cases.slaResponseDeadline}::timestamptz < NOW() AND ${cases.firstResponseAt} IS NULL)
        ) THEN 1 END`),
        weeklyResolutionRate: sql<number>`ROUND(COALESCE(
          (COUNT(CASE WHEN ${cases.createdAt} >= ${weekStartISO} AND ${cases.status} IN ('resolved', 'closed') AND ${cases.slaBreached} = false THEN 1 END)::numeric / 
          NULLIF(COUNT(CASE WHEN ${cases.createdAt} >= ${weekStartISO} AND ${cases.status} IN ('resolved', 'closed') THEN 1 END), 0)) * 100
        , 0))`
      })
        .from(cases)
        .where(assignedWhere);

      // Separate query for tagged count
      const taggedStats = await db.select({ count: count() }).from(cases).where(taggedWhere);

      const [statusGroups, priorityGroups, channelGroups] = await Promise.all([
        db.select({ label: cases.status, count: count() }).from(cases).where(assignedWhere).groupBy(cases.status),
        db.select({ label: cases.priority, count: count() }).from(cases).where(assignedWhere).groupBy(cases.priority),
        db.select({ label: cases.channel, count: count() }).from(cases).where(assignedWhere).groupBy(cases.channel),
      ]);

      const byStatus: Record<string, number> = {};
      statusGroups.forEach(g => byStatus[g.label] = Number(g.count));

      const byPriority: Record<string, number> = {};
      priorityGroups.forEach(g => byPriority[g.label] = Number(g.count));

      const byChannel: Record<string, number> = {};
      channelGroups.forEach(g => byChannel[g.label] = Number(g.count));

      // Separate query for tagged SLA breached count
      const taggedSlaBreached = await db.select({ count: count() }).from(cases).where(
        and(
          taggedWhere,
          or(
            sql`${cases.slaDeadline} IS NOT NULL AND ${cases.slaDeadline}::timestamptz < NOW() AND ${cases.status} NOT IN ('resolved', 'closed')`,
            sql`${cases.slaResponseDeadline} IS NOT NULL AND ${cases.slaResponseDeadline}::timestamptz < NOW() AND ${cases.firstResponseAt} IS NULL`
          )
        )
      );

      res.json({
        ...allStats,
        total: Number(allStats.total),
        taggedCount: Number(taggedStats[0]?.count || 0),
        taggedSlaBreached: Number(taggedSlaBreached[0]?.count || 0),
        resolutionRate: Number(allStats.resolutionRate),
        byStatus,
        byPriority,
        byChannel,
        weekly: {
          activeWorkload: Number(allStats.weeklyActive),
          slaBreached: Number(allStats.slaBreached), // Changed from weeklyBreached to total breached to match stat block
          resolved: Number(allStats.weeklyResolved),
          resolutionRate: Number(allStats.weeklyResolutionRate),
        },
      });
    } catch (error) {
      console.error("Error fetching case stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // NEW: Get current user permissions
  app.get("/api/auth/permissions", marketingAuth, async (req, res) => {
    try {
      const currentUser = (req as any).marketingUser;

      const userRoleIds = await db
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .where(eq(userRoles.userId, currentUser.id));

      if (userRoleIds.length === 0) return res.json({ permissions: [] });

      const roleIds = userRoleIds.map(r => r.roleId);

      const perms = await db
        .select({ key: systemPermissions.key })
        .from(systemPermissions)
        .innerJoin(systemRolePermissions, eq(systemRolePermissions.permissionId, systemPermissions.id))
        .where(and(inArray(systemRolePermissions.roleId, roleIds), eq(systemPermissions.isActive, true)));

      res.json({
        permissions: perms.map(p => p.key)
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  // NEW: Cases Analytical Distribution
  app.get("/api/cases/analytics/distribution", marketingAuth, checkPermission("cases.view_channel_dist"), async (req, res) => {
    try {
      const currentUser = (req as any).marketingUser;
      const rbacConditions = await getCaseRbacConditions(currentUser.id);

      // Analytics should ONLY show the user's assigned cases, unless they are a manager/admin
      // This matches user request: "The charts/tables below the 4 stat cards should not diplay tagged cases data"
      const isPowerUser = rbacConditions.length === 0; // has cases.view_all
      const analyticsWhere = isPowerUser ? undefined : eq(cases.assignedTo, currentUser.id);

      const [byChannel, byPriority, byStatus] = await Promise.all([
        db.select({ label: cases.channel, count: count() }).from(cases).where(analyticsWhere).groupBy(cases.channel),
        db.select({ label: cases.priority, count: count() }).from(cases).where(analyticsWhere).groupBy(cases.priority),
        db.select({ label: cases.status, count: count() }).from(cases).where(analyticsWhere).groupBy(cases.status),
      ]);

      res.json({ byChannel, byPriority, byStatus });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch distribution" });
    }
  });

  // NEW: Case Volume Trends (30 Days)
  app.get("/api/cases/analytics/trends", marketingAuth, checkPermission("cases.view_volume_trends"), async (req, res) => {
    try {
      const currentUser = (req as any).marketingUser;
      const rbacConditions = await getCaseRbacConditions(currentUser.id);
      const isPowerUser = rbacConditions.length === 0;
      const analyticsWhere = isPowerUser ? undefined : eq(cases.assignedTo, currentUser.id);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

      const trendData = await db.select({
        date: sql<string>`DATE(created_at)`,
        pending: count(sql`CASE WHEN status NOT IN('resolved', 'closed') THEN 1 END`),
        resolved: count(sql`CASE WHEN status IN('resolved', 'closed') THEN 1 END`)
      })
        .from(cases)
        .where(and(
          sql`created_at >= ${dateStr} `,
          analyticsWhere
        ))
        .groupBy(sql`DATE(created_at)`)
        .orderBy(asc(sql`DATE(created_at)`));

      res.json({ trends: trendData });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trends" });
    }
  });

  // NEW: Issue Hotspots (Categories by Department)
  app.get("/api/cases/analytics/hotspots", marketingAuth, checkPermission("cases.view_hotspots"), async (req, res) => {
    try {
      const currentUser = (req as any).marketingUser;
      const rbacConditions = await getCaseRbacConditions(currentUser.id);
      const rbacWhere = rbacConditions.length > 0 ? and(...rbacConditions) : undefined;

      const hotspots = await db.select({
        department: departments.name,
        category: serviceCategories.name,
        count: count()
      })
        .from(cases)
        .innerJoin(serviceCategories, eq(cases.serviceCategoryId, serviceCategories.id))
        .innerJoin(departments, eq(cases.assignedDepartment, departments.id))
        .where(rbacWhere)
        .groupBy(departments.name, serviceCategories.name)
        .orderBy(desc(count()))
        .limit(20);

      res.json({ hotspots });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch hotspots" });
    }
  });

  // NEW: Recent Activity Feed
  app.get("/api/cases/analytics/activity", marketingAuth, async (req, res) => {
    try {
      const currentUser = (req as any).marketingUser;
      const rbacConditions = await getCaseRbacConditions(currentUser.id);
      const whereClause = rbacConditions.length > 0 ? and(...rbacConditions) : undefined;

      const activity = await db.select({
        id: caseHistory.id,
        caseId: caseHistory.caseId,
        caseNumber: cases.caseNumber,
        action: caseHistory.action,
        newValue: caseHistory.newValue,
        createdAt: caseHistory.createdAt,
        user: sql<string>`${marketingUsers.firstName} || ' ' || ${marketingUsers.lastName} `
      })
        .from(caseHistory)
        .innerJoin(cases, eq(caseHistory.caseId, cases.id))
        .leftJoin(marketingUsers, eq(caseHistory.changedBy, marketingUsers.id))
        .where(whereClause)
        .orderBy(desc(caseHistory.createdAt))
        .limit(15);

      res.json({ activity });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  // SLA Breached Cases (for overview dashboard table)
  app.get("/api/cases/analytics/sla-breached", marketingAuth, async (req, res) => {
    try {
      const currentUser = (req as any).marketingUser;
      const rbacConditions = await getCaseRbacConditions(currentUser.id);

      // Get cases where SLA is breached OR deadline has passed
      const now = new Date().toISOString();
      const breachedCases = await db.select({
        id: cases.id,
        title: cases.title,
        caseNumber: cases.caseNumber,
        status: cases.status,
        slaResponseDeadline: cases.slaResponseDeadline,
        slaDeadline: cases.slaDeadline,
        firstResponseAt: cases.firstResponseAt,
        resolvedAt: cases.resolvedAt,
        createdAt: cases.createdAt,
        slaBreached: cases.slaBreached,
        slaResponseMinutes: slaRules.responseTimeMinutes,
        slaTimeline: slaRules.timeline,
        slaTimelineUnit: slaRules.timelineUnit,
        assignedToName: sql<string>`${marketingUsers.firstName} || ' ' || ${marketingUsers.lastName}`,
      })
        .from(cases)
        .leftJoin(slaRules, and(
          eq(cases.serviceCategoryId, slaRules.serviceCategoryId),
          eq(slaRules.isActive, true)
        ))
        .leftJoin(marketingUsers, eq(cases.assignedTo, marketingUsers.id))
        .where(and(
          or(
            eq(cases.slaBreached, true),
            sql`${cases.slaDeadline} IS NOT NULL AND ${cases.slaDeadline}:: timestamptz < ${now}::timestamptz AND ${cases.status} NOT IN('resolved', 'closed')`,
            sql`${cases.slaResponseDeadline} IS NOT NULL AND ${cases.slaResponseDeadline}:: timestamptz < ${now}::timestamptz AND ${cases.firstResponseAt} IS NULL`
          ),
          ...(rbacConditions.length > 0 ? rbacConditions : [])
        ))
        .orderBy(desc(cases.createdAt))
        .limit(20);

      res.json({ breachedCases });
    } catch (error) {
      console.error("Error fetching SLA breached cases:", error);
      res.status(500).json({ error: "Failed to fetch SLA breached cases" });
    }
  });

  // Resolved Cases (for Knowledge Base tab) - Refactored for Data Integrity
  app.get("/api/cases/resolved", marketingAuth, async (req, res) => {
    try {
      const currentUser = (req as any).marketingUser;
      const rbacConditions = await getCaseRbacConditions(currentUser.id);
      const pageNum = sanitizeInteger(req.query.page, 1, 1, 1000);
      const limitNum = 10;
      const offset = (pageNum - 1) * limitNum;
      
      const { search, assignedTo, category, stakeholderType, startDate, endDate } = req.query;

      const conditions: any[] = [
        or(eq(cases.status, 'resolved'), eq(cases.status, 'closed')),
        ...rbacConditions
      ];

      if (search) {
        const s = sanitizeSearchInput(search as string);
        conditions.push(or(
          ilike(cases.title, `%${s}%`),
          ilike(cases.caseNumber, `%${s}%`),
          ilike(cases.resolution, `%${s}%`),
          ilike(cases.description, `%${s}%`)
        ));
      }

      if (assignedTo && assignedTo !== "all") {
        conditions.push(eq(cases.assignedTo, assignedTo as string));
      }

      if (category && category !== "all") {
        conditions.push(eq(cases.serviceCategoryId, category as string));
      }

      if (stakeholderType && stakeholderType !== "all") {
        conditions.push(eq(stakeholders.type, stakeholderType as string));
      }

      if (startDate) {
        conditions.push(gte(cases.resolvedAt, startDate as string));
      }

      if (endDate) {
        conditions.push(lte(cases.resolvedAt, endDate as string));
      }

      const whereClause = and(...conditions);

      const [totalResult] = await db.select({ total: count() })
        .from(cases)
        .leftJoin(stakeholders, eq(cases.stakeholderId, stakeholders.id))
        .where(whereClause);
        
      const total = Number(totalResult?.total || 0);

      const resolvedCases = await db.select({
        id: cases.id,
        caseNumber: cases.caseNumber,
        title: cases.title,
        status: cases.status,
        resolution: cases.resolution,
        resolvedAt: cases.resolvedAt,
        createdAt: cases.createdAt,
        categoryName: serviceCategories.name,
        departmentName: departments.name,
        description: cases.description,
        initialResponse: cases.initialResponse,
        sopSteps: cases.sopSteps,
        assignedToName: sql<string>`${marketingUsers.firstName} || ' ' || ${marketingUsers.lastName}`,
      })
        .from(cases)
        .leftJoin(serviceCategories, eq(cases.serviceCategoryId, serviceCategories.id))
        .leftJoin(departments, eq(cases.assignedDepartment, departments.id))
        .leftJoin(marketingUsers, eq(cases.assignedTo, marketingUsers.id))
        .leftJoin(stakeholders, eq(cases.stakeholderId, stakeholders.id))
        .where(whereClause)
        .orderBy(desc(cases.resolvedAt))
        .limit(limitNum)
        .offset(offset);

      res.json({ cases: resolvedCases, total, totalPages: Math.ceil(total / limitNum) });
    } catch (error) {
      console.error("Error fetching resolved cases:", error);
      res.status(500).json({ error: "Failed to fetch resolved cases" });
    }
  });

  app.get("/api/cases/:id", marketingAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const currentUser = (req as any).marketingUser;
      const rbacConditions = await getCaseRbacConditions(currentUser.id);

      const caseResult = await db.select().from(cases).where(and(eq(cases.id, id), ...rbacConditions));
      if (!caseResult.length) {
        return res.status(404).json({ error: "Case not found" });
      }

      const [comments, attachments, history] = await Promise.all([
        db.select().from(caseComments).where(eq(caseComments.caseId, id)).orderBy(desc(caseComments.createdAt)),
        db.select().from(caseAttachments).where(eq(caseAttachments.caseId, id)).orderBy(desc(caseAttachments.createdAt)),
        db.select().from(caseHistory).where(eq(caseHistory.caseId, id)).orderBy(desc(caseHistory.createdAt)),
      ]);

      res.json({
        case: {
          ...caseResult[0],
          personalNotes: null, // personal notes are now per-user; fetch via GET /api/cases/:id/personal-notes
        },
        comments,
        attachments,
        history,
      });
    } catch (error) {
      console.error("Error fetching case:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Personal Notes (per-user, per-case) ──────────────────────────────────

  app.get("/api/cases/:id/personal-notes", marketingAuth, async (req, res) => {
    try {
      const caseId = req.params.id as string;
      const currentUser = (req as any).marketingUser;

      // Verify the user has access to this case at all
      const rbacConditions = await getCaseRbacConditions(currentUser.id);
      const caseCheck = await db.select({ id: cases.id }).from(cases)
        .where(and(eq(cases.id, caseId), ...rbacConditions)).limit(1);
      if (!caseCheck.length) return res.status(404).json({ error: "Case not found" });

      const [row] = await db.select()
        .from(caseUserNotes)
        .where(and(eq(caseUserNotes.caseId, caseId), eq(caseUserNotes.userId, currentUser.id)))
        .limit(1);

      res.json({ notes: row?.notes || "" });
    } catch (error) {
      console.error("Error fetching personal notes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/cases/:id/personal-notes", marketingAuth, async (req, res) => {
    try {
      const caseId = req.params.id as string;
      const currentUser = (req as any).marketingUser;
      const { personalNotes, notes } = req.body;
      const notesValue = personalNotes ?? notes ?? "";

      // Verify the user has access to this case
      const rbacConditions = await getCaseRbacConditions(currentUser.id);
      const caseCheck = await db.select({ id: cases.id }).from(cases)
        .where(and(eq(cases.id, caseId), ...rbacConditions)).limit(1);
      if (!caseCheck.length) return res.status(404).json({ error: "Case not found" });

      // Check if a row already exists
      const [existing] = await db.select({ id: caseUserNotes.id })
        .from(caseUserNotes)
        .where(and(eq(caseUserNotes.caseId, caseId), eq(caseUserNotes.userId, currentUser.id)))
        .limit(1);

      if (existing) {
        await db.update(caseUserNotes)
          .set({ notes: notesValue, updatedAt: new Date().toISOString() })
          .where(eq(caseUserNotes.id, existing.id));
      } else {
        await db.insert(caseUserNotes).values({
          caseId,
          userId: currentUser.id,
          notes: notesValue,
          updatedAt: new Date().toISOString(),
        } as any);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving personal notes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/cases", marketingAuth, checkPermission("cases.create"), async (req, res) => {
    try {
      const data = req.body;
      const caseNumber = generateCaseNumber();

      // --- AI Routing Logic (Feature 2b & 4) ---
      if (!data.serviceCategoryId && data.title && data.description) {
        const { determineCaseCategory } = await import("./ai");
        const aiResult = await determineCaseCategory(data.title, data.description);
        
        const cat = await db.select().from(serviceCategories).where(ilike(serviceCategories.name, aiResult.categoryName)).limit(1);
        if (cat.length > 0) {
          data.serviceCategoryId = cat[0].id;
          data.metadata = { ...data.metadata, aiRouted: true, aiConfidence: aiResult.confidenceScore, isAi: aiResult.isAi };

          // Accreditation Workflow
          if (aiResult.categoryName.toLowerCase().includes("accreditation")) {
            data.status = "open";
            
            // Start the 90-day SLA
            const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
            data.slaDeadline = ninetyDaysFromNow;

            // Trigger email acknowledgment via metadata if email exists
            const email = data.metadata?.contactEmail || data.metadata?.email;
            if (email) {
              emailService.sendEmail({
                to: email,
                subject: `KASNEB Accreditation Application Acknowledged - ${caseNumber}`,
                text: "Your application for KASNEB accreditation has been successfully received and an Accreditation Review Officer will be assigned shortly.",
                html: "<p>Your application for KASNEB accreditation has been successfully received and an Accreditation Review Officer will be assigned shortly.</p>"
              }).catch(e => console.error("Failed to send ack email", e));
            }

            data.metadata.isAccreditationAutoRoute = true;
          }
        }
      }

      // Balanced Assignment logic
      let assignedTo = data.assignedTo;
      let status = data.status || "open";
      let departmentId = null;

      if (data.serviceCategoryId) {
        const serviceCategory = await db.select().from(serviceCategories).where(eq(serviceCategories.id, data.serviceCategoryId)).limit(1);
        departmentId = serviceCategory.length > 0 ? serviceCategory[0].departmentId : null;
      }

      if (!assignedTo && data.serviceCategoryId) {
        const chain = await db.select()
          .from(escalationChains)
          .where(and(eq(escalationChains.serviceCategoryId, data.serviceCategoryId), eq(escalationChains.isActive, true)))
          .limit(1);

        if (chain.length > 0) {
          const step = await db.select()
            .from(escalationSteps)
            .where(and(eq(escalationSteps.chainId, chain[0].id), eq(escalationSteps.stepOrder, 1)))
            .limit(1);

          if (step.length > 0 && step[0].assigneeRoleId) {
            assignedTo = await AssignmentService.getOptimalAssignee(step[0].assigneeRoleId, departmentId || undefined);
            if (step[0].requiresConsent) {
              status = "pending_acceptance";
              if (step[0].gracePeriodMinutes > 0) {
                const now = new Date();
                const deadline = new Date(now.getTime() + step[0].gracePeriodMinutes * 60000);
                (data as any).acceptanceDeadline = deadline.toISOString();
              }
            }
          }
        }
      }

      let slaDeadline = data.slaDeadline;
      let slaResponseDeadline = data.slaResponseDeadline;
      let assignedAt = assignedTo ? new Date().toISOString() : null;

      if (data.serviceCategoryId) {
        const slaRuleResult = await db.select()
          .from(slaRules)
          .where(and(
            eq(slaRules.serviceCategoryId, data.serviceCategoryId),
            eq(slaRules.priority, data.priority),
            eq(slaRules.isActive, true)
          ))
          .limit(1);

        // Fallback to any active SLA rule for the category if priority match fails
        if (slaRuleResult.length === 0) {
          const fallbackRule = await db.select()
            .from(slaRules)
            .where(and(
              eq(slaRules.serviceCategoryId, data.serviceCategoryId),
              eq(slaRules.isActive, true)
            ))
            .limit(1);
          if (fallbackRule.length > 0) slaRuleResult.push(fallbackRule[0]);
        }

        if (slaRuleResult.length > 0) {
          const rule = slaRuleResult[0];
          const now = new Date();

          if (!slaDeadline && rule.timeline) {
            let minutes = rule.timeline;
            if (rule.timelineUnit === 'hours') minutes *= 60;
            else if (rule.timelineUnit === 'working days') minutes *= 8 * 60;
            else if (rule.timelineUnit === 'days') minutes *= 24 * 60;
            else if (rule.timelineUnit !== 'minutes') minutes *= 60; // fallback

            const deadlineDate = new Date(now.getTime() + minutes * 60000);
            slaDeadline = deadlineDate.toISOString();
          }
          if (!slaResponseDeadline && rule.responseTimeMinutes) {
            const responseDate = new Date(now.getTime() + rule.responseTimeMinutes * 60000);
            slaResponseDeadline = responseDate.toISOString();
          }
        }
      }

      // Auto-match stakeholder if not provided
      let stakeholderId = data.stakeholderId || null;
      if (!stakeholderId && data.metadata) {
        stakeholderId = await StakeholderMatchingService.matchFromMetadata(data.metadata);
      }

      const newCase = await db
        .insert(cases)
        .values({
          ...data,
          caseNumber,
          stakeholderId,
          assignedTo,
          status,
          assignedDepartment: departmentId,
          slaDeadline,
          slaResponseDeadline,
          assignedAt
        } as any)
        .returning();

      // Trigger automatic lead triaging
      if (newCase[0]) {
        triageLeadFromCase(newCase[0].id).catch(e => console.error("Lead triage failed:", e));
        
        // Create Accreditation Process if routed
        if ((newCase[0].metadata as any)?.isAccreditationAutoRoute && newCase[0].stakeholderId) {
          const { accreditationProcesses } = await import("../../shared/crmSchema");
          await db.insert(accreditationProcesses).values({
            stakeholderId: newCase[0].stakeholderId,
            stage: "application_submitted",
            status: "pending",
            applicationDate: new Date().toISOString(),
            slaDeadline: newCase[0].slaDeadline,
            assignedOfficerId: newCase[0].assignedTo
          } as any).catch(e => console.error("Failed to create accreditation process:", e));
        }
      }

      await db.insert(caseHistory).values({
        caseId: newCase[0].id,
        action: "created",
        newValue: `Case created and assigned to ${assignedTo || 'Unassigned'}. SLA Rule applied.`,
        changedBy: data.createdBy,
        createdAt: new Date().toISOString()
      } as any);

      if (assignedTo) {
        const [category] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, data.serviceCategoryId)).limit(1);
        await NotificationService.createNotification(
          assignedTo,
          "assignment",
          `[NEW CASE] ${newCase[0].caseNumber} `,
          `${category?.name || 'General'}: ${newCase[0].title}.Priority: ${newCase[0].priority}.`,
          `/ cases / workspace / ${newCase[0].id} `
        );
      }

      res.status(201).json({ case: newCase[0] });

      // Log case creation
      AuditService.logAction(req, {
        action: 'create',
        module: 'cases',
        entityType: 'case',
        entityId: newCase[0].id,
        newValues: newCase[0],
        details: `Created new case: ${newCase[0].caseNumber}`
      });
    } catch (error) {
      console.error("Error creating case:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/cases/:id", marketingAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const data = req.body;
      const currentUser = (req as any).marketingUser;
      
      const rbacConditions = await getCaseRbacConditions(currentUser.id);
      const existingCase = await db.select().from(cases).where(and(eq(cases.id, id), ...rbacConditions)).limit(1);
      
      if (!existingCase.length) {
        return res.status(404).json({ error: "Case not found" });
      }

      // --- Granular Permission Checks ---
      const userRoleIds = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, currentUser.id));
      const roleIds = userRoleIds.map(r => r.roleId);
      const permissions = await db.select({ key: systemPermissions.key })
        .from(systemPermissions)
        .innerJoin(systemRolePermissions, eq(systemRolePermissions.permissionId, systemPermissions.id))
        .where(and(inArray(systemRolePermissions.roleId, roleIds), eq(systemPermissions.isActive, true)));
      const permKeys = permissions.map(p => p.key);

      // Check for assignment permission if assignedTo is being changed
      if (data.assignedTo !== undefined && data.assignedTo !== existingCase[0].assignedTo) {
        if (!permKeys.includes("cases.assign") && !permKeys.includes("admin.view")) {
          return res.status(403).json({ error: "Insufficient permissions to reassign cases" });
        }
      }

      // Check for status change permission if status is being changed
      if (data.status !== undefined && data.status !== existingCase[0].status) {
        if (!permKeys.includes("cases.change_status") && !permKeys.includes("admin.view")) {
          return res.status(403).json({ error: "Insufficient permissions to change case status" });
        }
      }

      const updateData: any = { ...data, updatedAt: sql`now()` };

      if (data.assignedTo && !existingCase[0].assignedAt) {
        updateData.assignedAt = new Date().toISOString();
      }

      if (data.status === "resolved" && !existingCase[0].resolvedAt) {
        updateData.resolvedAt = sql`now()`;
        const createdAt = new Date(existingCase[0].createdAt).getTime();
        const now = Date.now();
        const durationMinutes = Math.round((now - createdAt) / (1000 * 60));
        updateData.resolutionDurationMinutes = durationMinutes;

        if (existingCase[0].slaDeadline) {
          updateData.slaBreached = new Date(existingCase[0].slaDeadline).getTime() < now;
        } else if (existingCase[0].slaResponseDeadline && !existingCase[0].firstResponseAt) {
          updateData.slaBreached = new Date(existingCase[0].slaResponseDeadline).getTime() < now;
        } else {
          updateData.slaBreached = false;
        }
      }
      if (data.status === "closed" && !existingCase[0].closedAt) {
        updateData.closedAt = sql`now()`;
      }

      // Auto-send satisfaction email on resolution or closure
      if ((data.status === "resolved" || data.status === "closed") && existingCase[0].status !== data.status) {
        const stakeholderId = existingCase[0].stakeholderId;
        if (stakeholderId) {
          const [stakeholder] = await db.select({ email: stakeholders.email, firstName: stakeholders.firstName, lastName: stakeholders.lastName })
            .from(stakeholders).where(eq(stakeholders.id, stakeholderId)).limit(1);
          if (stakeholder?.email) {
            emailService.sendSatisfactionEmail({
              to: stakeholder.email,
              stakeholderName: `${stakeholder.firstName} ${stakeholder.lastName}`.trim(),
              caseNumber: existingCase[0].caseNumber,
              caseTitle: existingCase[0].title,
              caseId: existingCase[0].id,
              stakeholderId,
            }).catch(e => console.error("[Satisfaction] Email failed:", e));
          }
        }
      }

      const updated = await db
        .update(cases)
        .set(updateData)
        .where(eq(cases.id, id))
        .returning();

      // Trigger/Refresh lead triaging if category changed
      if (updated[0]) {
        triageLeadFromCase(updated[0].id).catch(e => console.error("Lead triage failed:", e));
      }

      if (data.assignedTo && data.assignedTo !== existingCase[0].assignedTo) {
        await NotificationService.createNotification(
          data.assignedTo,
          "assignment",
          `[REASSIGNED] ${updated[0].caseNumber} `,
          `${updated[0].title}.Status: ${updated[0].status.replace('_', ' ')}.`,
          `/ cases / workspace / ${updated[0].id} `
        );
      }

      for (const key of Object.keys(data)) {
        if ((existingCase[0] as any)[key] !== data[key]) {
          await db.insert(caseHistory).values({
            caseId: id,
            action: "updated",
            fieldChanged: key,
            oldValue: String((existingCase[0] as any)[key] ?? ""),
            newValue: String(data[key] ?? ""),
            changedBy: data.updatedBy || currentUser.id,
            createdAt: new Date().toISOString()
          } as any);
        }
      }

      res.json({ case: updated[0] });

      // Log case update
      AuditService.logAction(req, {
        action: 'update',
        module: 'cases',
        entityType: 'case',
        entityId: id,
        oldValues: existingCase[0],
        newValues: updated[0],
        details: `Updated case: ${updated[0].caseNumber}`
      });
    } catch (error) {
      console.error("Error updating case:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/cases/:id/comments", marketingAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const user = (req as any).marketingUser;
      const { content, isInternal } = req.body;
      const data = { ...req.body, caseId: id, userId: user.id };

      const [targetCase] = await db.select().from(cases).where(eq(cases.id, id));
      if (!targetCase) return res.status(404).json({ error: "Case not found" });

      const [newComment] = await db
        .insert(caseComments)
        .values(data as any)
        .returning();

      if (!data.isInternal) {
        await db
          .update(cases)
          .set({ 
            firstResponseAt: sql`COALESCE(first_response_at, now()::text)`, 
            updatedAt: sql`now()::text` 
          } as any)
          .where(eq(cases.id, id));
      }

      // Handle @mentions
      const mentionRegex = /@(\w+)/g;
      const mentions = content?.match(mentionRegex);

      if (mentions) {
        for (const mention of mentions) {
          const username = mention.slice(1);
          // Standard check: is it an email or firstName?
          const taggedUser = await db.select().from(marketingUsers)
            .where(or(eq(marketingUsers.email, username), eq(marketingUsers.firstName, username)))
            .limit(1);

          if (taggedUser.length > 0) {
            const userId = taggedUser[0].id;

            // 1. Grant access if not already present in tags
            // We use the JSONB 'tags' column to store collaborator access
            const currentTags = (targetCase.tags as any[]) || [];
            const alreadyTagged = currentTags.some(t => t.id === userId);

            if (!alreadyTagged) {
              const updatedTags = [...currentTags, { id: userId, type: "collaborator", taggedAt: new Date().toISOString() }];
              await db.update(cases).set({ tags: updatedTags }).where(eq(cases.id, id));
            }

            // 2. Create notification
            await NotificationService.createNotification(
              userId,
              "mention",
              `[MENTION] ${targetCase.caseNumber} `,
              `${user.firstName} tagged you in a comment: "${content.substring(0, 50)}..."`,
              `/ cases / workspace / ${targetCase.id} `
            );

            // 3. Log history
            await db.insert(caseHistory).values({
              caseId: id,
              action: "tagged",
              newValue: `User ${taggedUser[0].firstName} was tagged in a comment by ${user.firstName}.`,
              changedBy: user.id,
              createdAt: new Date().toISOString()
            } as any);
          }
        }
      }

      res.status(201).json({ comment: newComment });

      // Log comment creation
      AuditService.logAction(req, {
        action: 'create',
        module: 'cases',
        entityType: 'comment',
        entityId: newComment.id,
        details: `Added ${isInternal ? 'internal' : 'external'} comment to case ${targetCase.caseNumber}`
      });
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/cases/:id/attachments - Share documents in workspace
  app.post("/api/cases/:id/attachments", marketingAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = (req as any).marketingUser;
      const { fileName, fileType, fileSize, fileUrl } = req.body;

      if (!fileName || !fileUrl) {
        return res.status(400).json({ error: "File name and URL are required" });
      }

      const [newAttachment] = await db
        .insert(caseAttachments)
        .values({
          caseId: id,
          fileName,
          fileType,
          fileSize,
          fileUrl,
          uploadedBy: user.id,
          createdAt: new Date().toISOString()
        } as any)
        .returning();

      res.status(201).json(newAttachment);
    } catch (error) {
      console.error("Error uploading attachment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // NEW: POST /api/cases/:id/upload-attachment - Handles Base64 file upload for documents
  app.post("/api/cases/:id/upload-attachment", marketingAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = (req as any).marketingUser;
      const { fileName, fileType, fileSize, fileData } = req.body;

      if (!fileName || !fileData) {
        return res.status(400).json({ error: "File name and data are required" });
      }

      // Convert Base64 to buffer
      // Data might come as "data:image/png;base64,iVBOR..." or just the raw base64 string
      const base64Content = fileData.includes(",") ? fileData.split(",")[1] : fileData;
      const buffer = Buffer.from(base64Content, "base64");

      // Generate a unique filename to prevent collisions
      const timestamp = Date.now();
      const safeName = fileName.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
      const uniqueName = `${timestamp}_${safeName}`;
      const assetsDir = path.resolve(import.meta.dirname, "../../../attached_assets");
      
      // Ensure directory exists (redundant but safe)
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      const filePath = path.join(assetsDir, uniqueName);
      fs.writeFileSync(filePath, buffer);

      const fileUrl = `/attached_assets/${uniqueName}`;

      // Insert record into database
      const [newAttachment] = await db
        .insert(caseAttachments)
        .values({
          caseId: id,
          fileName,
          fileType,
          fileSize,
          fileUrl,
          uploadedBy: user.id,
          createdAt: new Date().toISOString()
        } as any)
        .returning();

      res.status(201).json(newAttachment);
    } catch (error) {
      console.error("Error in file upload:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  app.post("/api/cases/:id/escalate", marketingAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { reason, targetUserId, targetDeptId } = req.body;

      const existingCase = await db.select().from(cases).where(eq(cases.id, id));
      if (!existingCase.length) {
        return res.status(404).json({ error: "Case not found" });
      }

      const currentLevel = existingCase[0].escalationLevel || 0;
      const nextLevel = currentLevel + 1;

      let assignedTo = targetUserId || existingCase[0].assignedTo;
      let status = "in_progress"; // Default to in_progress for manual/receipt
      let assignedDepartment = targetDeptId || existingCase[0].assignedDepartment;

      // Only perform auto-logic if overrides aren't provided
      if (!targetUserId && !targetDeptId && existingCase[0].serviceCategoryId) {
        const serviceCategory = await db.select().from(serviceCategories).where(eq(serviceCategories.id, existingCase[0].serviceCategoryId)).limit(1);
        const departmentId = serviceCategory.length > 0 ? serviceCategory[0].departmentId : null;

        const chain = await db.select()
          .from(escalationChains)
          .where(and(eq(escalationChains.serviceCategoryId, existingCase[0].serviceCategoryId), eq(escalationChains.isActive, true)))
          .limit(1);

        if (chain.length > 0) {
          const step = await db.select()
            .from(escalationSteps)
            .where(and(eq(escalationSteps.chainId, chain[0].id), eq(escalationSteps.stepOrder, nextLevel)))
            .limit(1);

          if (step.length > 0) {
            if (step[0].assigneeRoleId) {
              assignedTo = await AssignmentService.getOptimalAssignee(step[0].assigneeRoleId, departmentId || undefined);
              assignedDepartment = departmentId;
            } else if ((step[0] as any).assigneeDepartmentId) {
              assignedTo = null;
              assignedDepartment = (step[0] as any).assigneeDepartmentId;
            }

            if (step[0].requiresConsent) {
              status = "pending_acceptance";
            } else {
              status = "in_progress"; // Changed from "open" to "in_progress" per requirement
            }
          }
        }
      }

      const updated = await db
        .update(cases)
        .set({
          escalationLevel: nextLevel,
          assignedTo,
          assignedDepartment,
          status,
          priority: nextLevel >= 3 ? "critical" : nextLevel >= 2 ? "high" : existingCase[0].priority,
          updatedAt: sql`now()`,
        } as any)
        .where(eq(cases.id, id))
        .returning();

      if (reason) {
        await db.insert(caseComments).values({
          caseId: id,
          content: `ESCALATION REASON: ${reason} `,
          isInternal: true,
          userId: (req as any).marketingUser.id,
          createdAt: new Date().toISOString()
        } as any);
      }

      await db.insert(caseHistory).values({
        caseId: id,
        action: "escalated",
        fieldChanged: "escalation_level",
        oldValue: String(existingCase[0].escalationLevel),
        newValue: String(nextLevel),
        changedBy: (req as any).marketingUser.id,
        createdAt: new Date().toISOString()
      } as any);

      res.json({ case: updated[0] });

      // Log escalation
      AuditService.logAction(req, {
        action: 'update',
        module: 'cases',
        entityType: 'case',
        entityId: id,
        details: `Escalated case ${updated[0].caseNumber} to level ${updated[0].escalationLevel}`
      });
    } catch (error) {
      console.error("Error escalating case:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/cases/:id/refer", marketingAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { departmentId, reason } = req.body;

      if (!departmentId) return res.status(400).json({ error: "Department is required" });

      const updated = await db
        .update(cases)
        .set({
          assignedTo: null,
          assignedDepartment: departmentId,
          status: "open",
          updatedAt: sql`now()`
        } as any)
        .where(eq(cases.id, id))
        .returning();

      if (reason) {
        await db.insert(caseComments).values({
          caseId: id,
          content: `REFERRAL REASON: ${reason} `,
          isInternal: true,
          userId: (req as any).marketingUser.id,
          createdAt: new Date().toISOString()
        } as any);
      }

      await db.insert(caseHistory).values({
        caseId: id,
        action: "referred",
        fieldChanged: "assigned_department",
        newValue: departmentId,
        changedBy: (req as any).marketingUser.id,
        createdAt: new Date().toISOString()
      } as any);

      res.json({ case: updated[0] });

      // Log referral
      AuditService.logAction(req, {
        action: 'update',
        module: 'cases',
        entityType: 'case',
        entityId: id,
        details: `Referred case ${updated[0].caseNumber} to department ${departmentId}`
      });
    } catch (error) {
      console.error("Error referring case:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Knowledge Base
  app.get("/api/knowledge-base", marketingAuth, async (req, res) => {
    try {
      const { search, category, isTemplate } = req.query;
      const conditions: any[] = [];
      if (category === 'template') {
        conditions.push(or(eq(knowledgeBase.category, 'template'), eq(knowledgeBase.isTemplate, true)));
      } else if (category) {
        conditions.push(eq(knowledgeBase.category, category as string));
      }
      if (isTemplate !== undefined) conditions.push(eq(knowledgeBase.isTemplate, isTemplate === 'true'));
      if (search) {
        conditions.push(
          or(
            ilike(knowledgeBase.title, `% ${search}% `),
            ilike(knowledgeBase.content, `% ${search}% `)
          )
        );
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const results = await db
        .select({
          id: knowledgeBase.id,
          title: knowledgeBase.title,
          content: knowledgeBase.content,
          category: knowledgeBase.category,
          tags: knowledgeBase.tags,
          serviceCategoryId: knowledgeBase.serviceCategoryId,
          isPublished: knowledgeBase.isPublished,
          isTemplate: knowledgeBase.isTemplate,
          sourceCaseId: knowledgeBase.sourceCaseId,
          originalDescription: knowledgeBase.originalDescription,
          channel: knowledgeBase.channel,
          initialResponse: knowledgeBase.initialResponse,
          resolutionSummary: knowledgeBase.resolutionSummary,
          sopSteps: knowledgeBase.sopSteps,
          viewCount: knowledgeBase.viewCount,
          helpfulCount: knowledgeBase.helpfulCount,
          createdBy: knowledgeBase.createdBy,
          createdAt: knowledgeBase.createdAt,
          updatedAt: knowledgeBase.updatedAt,
          categoryName: serviceCategories.name,
          departmentName: departments.name,
          stakeholderName: sql<string>`${stakeholders.firstName} || ' ' || ${stakeholders.lastName}`,
          registrationNumber: stakeholders.registrationNumber,
          caseNumber: cases.caseNumber
        })
        .from(knowledgeBase)
        .leftJoin(serviceCategories, eq(knowledgeBase.serviceCategoryId, serviceCategories.id))
        .leftJoin(departments, eq(serviceCategories.departmentId, departments.id))
        .leftJoin(cases, eq(knowledgeBase.sourceCaseId, cases.id))
        .leftJoin(stakeholders, eq(cases.stakeholderId, stakeholders.id))
        .where(whereClause || sql`true`)
        .orderBy(desc(knowledgeBase.createdAt));

      res.json({ articles: results });
    } catch (error) {
      console.error("Error fetching knowledge base:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/knowledge-base", marketingAuth, checkPermission("cases.kb.manage"), async (req, res) => {
    try {
      const data = req.body;
      const newArticle = await db
        .insert(knowledgeBase)
        .values(data as any)
        .returning();
      res.status(201).json({ article: newArticle[0] });

      // Log article creation
      AuditService.logAction(req, {
        action: 'create',
        module: 'cases',
        entityType: 'article',
        entityId: newArticle[0].id,
        newValues: newArticle[0],
        details: `Created new knowledge article: ${newArticle[0].title}`
      });
    } catch (error) {
      console.error("Error creating article:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/knowledge-base/:id", marketingAuth, checkPermission("cases.kb.manage"), async (req, res) => {
    try {
      const id = req.params.id as string;
      const data = req.body;
      const updated = await db
        .update(knowledgeBase)
        .set({ ...data, updatedAt: sql`now()` } as any)
        .where(eq(knowledgeBase.id, id))
        .returning();
      res.json({ article: updated[0] });

      // Log article update
      AuditService.logAction(req, {
        action: 'update',
        module: 'cases',
        entityType: 'article',
        entityId: id,
        newValues: updated[0],
        details: `Updated knowledge article: ${updated[0].title}`
      });
    } catch (error) {
      console.error("Error updating article:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/knowledge-base/:id", marketingAuth, checkPermission("cases.kb.manage"), async (req, res) => {
    try {
      const id = req.params.id as string;
      await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
      res.json({ success: true });

      // Log article deletion
      AuditService.logAction(req, {
        action: 'delete',
        module: 'cases',
        entityType: 'article',
        entityId: id,
        details: `Deleted knowledge article ID: ${id}`
      });
    } catch (error) {
      console.error("Error deleting article:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // [REMOVED DUPLICATE RESOLVED ROUTE]


  // NEW: Update structured Knowledge Base template by Case ID
  app.patch("/api/knowledge-base/case/:id", marketingAuth, checkPermission("cases.kb.manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const { title, resolution, sopSteps, rootCause } = req.body;
      const user = (req as any).marketingUser;

      if (!user) return res.status(401).json({ error: "Unauthorized" });

      // Check if a template already exists
      const [existing] = await db.select()
        .from(knowledgeBase)
        .where(and(
          eq(knowledgeBase.sourceCaseId, String(id)),
          eq(knowledgeBase.isTemplate, true)
        ))
        .limit(1);

      let updatedRecord;
      if (existing) {
        const results = await db.update(knowledgeBase)
          .set({
            title,
            resolutionSummary: resolution,
            sopSteps: sopSteps || [],
            rootCause,
            updatedAt: sql`now()`
          } as any)
          .where(eq(knowledgeBase.id, existing.id))
          .returning();
        updatedRecord = results[0];
      } else {
        // Create it if it doesn't exist (Upsert)
        const [targetCase] = await db.select().from(cases).where(eq(cases.id, String(id))).limit(1);
        if (targetCase) {
          const results = await db.insert(knowledgeBase).values({
            title: title || targetCase.title,
            content: resolution || targetCase.resolution || "",
            isPublished: true,
            isTemplate: true,
            sourceCaseId: String(id),
            originalDescription: targetCase.description,
            channel: targetCase.channel,
            initialResponse: targetCase.initialResponse,
            resolutionSummary: resolution || targetCase.resolution,
            sopSteps: sopSteps || targetCase.sopSteps || [],
            rootCause: rootCause || targetCase.rootCause,
            serviceCategoryId: targetCase.serviceCategoryId,
            createdBy: user.id
          } as any).returning();
          updatedRecord = results[0];
        }
      }

      res.json({ success: true, article: updatedRecord });

      if (updatedRecord) {
        // Log template update/creation
        AuditService.logAction(req, {
          action: existing ? 'update' : 'create',
          module: 'cases',
          entityType: 'article',
          entityId: updatedRecord.id,
          newValues: updatedRecord,
          details: `${existing ? 'Updated' : 'Created'} resolution blueprint for case: ${id}`
        });
      }
    } catch (error) {
      console.error("Error updating KB template:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Triage Routes
  app.get("/api/triage/signals", marketingAuth, async (req, res) => {
    try {
      const { status } = req.query;
      const conditions = [];
      if (status) conditions.push(eq(intakeSignals.status, status as string));

      const results = await db.select({
        id: intakeSignals.id,
        source: intakeSignals.source,
        rawText: intakeSignals.rawText,
        confidenceScore: intakeSignals.confidenceScore,
        status: intakeSignals.status,
        createdAt: intakeSignals.createdAt,
        suggestedCategoryId: intakeSignals.suggestedCategoryId,
        mappedCaseId: intakeSignals.mappedCaseId,
        departmentName: departments.name,
        assignedUserName: sql<string>`${marketingUsers.firstName} || ' ' || ${marketingUsers.lastName} `,
      })
        .from(intakeSignals)
        .leftJoin(serviceCategories, eq(intakeSignals.suggestedCategoryId, serviceCategories.id))
        .leftJoin(departments, eq(serviceCategories.departmentId, departments.id))
        .leftJoin(cases, eq(intakeSignals.mappedCaseId, cases.id))
        .leftJoin(marketingUsers, eq(cases.assignedTo, marketingUsers.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(intakeSignals.createdAt));

      res.json(results);
    } catch (error) {
      console.error("Error fetching signals:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/triage/signals/:id/map", marketingAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { categoryId, assignedTo } = req.body;
      const user = (req as any).marketingUser;

      const signal = await db.select().from(intakeSignals).where(eq(intakeSignals.id, id)).limit(1);
      if (!signal.length) return res.status(404).json({ error: "Signal not found" });

      const [category] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, categoryId)).limit(1);
      if (!category) return res.status(400).json({ error: "Invalid category" });

      let [slaRule] = await db.select().from(slaRules).where(and(eq(slaRules.serviceCategoryId, categoryId), eq(slaRules.priority, 'medium'))).limit(1);
      if (!slaRule) {
         // Fallback to any SLA rule for category if priority doesn't match
         const fallback = await db.select().from(slaRules).where(eq(slaRules.serviceCategoryId, categoryId)).limit(1);
         if (fallback.length > 0) slaRule = fallback[0];
      }

      const now = new Date();
      let slaDeadline = null;
      let slaResponseDeadline = null;
      if (slaRule) {
        slaResponseDeadline = new Date(now.getTime() + (slaRule.responseTimeMinutes || 0) * 60000).toISOString();
        let minutes = slaRule.timeline;
        if (slaRule.timelineUnit === 'hours') minutes *= 60;
        else if (slaRule.timelineUnit === 'working days') minutes *= 8 * 60;
        else if (slaRule.timelineUnit === 'days') minutes *= 24 * 60;
        else if (slaRule.timelineUnit !== 'minutes') minutes *= 60; // fallback
        slaDeadline = new Date(now.getTime() + minutes * 60000).toISOString();
      }

      const caseNumber = generateCaseNumber();

      // Carry over the stakeholderId from the signal if it exists.
      // If not, try one last time to match it from metadata.
      const stakeholderId = signal[0].stakeholderId || await StakeholderMatchingService.matchFromMetadata(signal[0].metadata || {});

      const [newCase] = await db.insert(cases).values({
        caseNumber,
        title: signal[0].rawText.substring(0, 50),
        description: signal[0].rawText,
        stakeholderId,
        serviceCategoryId: categoryId,
        assignedDepartment: category.departmentId,
        assignedTo: assignedTo || null,
        status: assignedTo ? "open" : "unassigned",
        channel: signal[0].source as any,
        slaDeadline,
        slaResponseDeadline,
        assignedAt: assignedTo ? new Date().toISOString() : null,
        metadata: { ...(signal[0].metadata as any), triaged: true }
      } as any).returning();

      await db.update(intakeSignals).set({
        status: "mapped",
        mappedCaseId: newCase.id,
        suggestedCategoryId: categoryId,
        processedBy: user.id,
        processedAt: sql`now()`
      }).where(eq(intakeSignals.id, id));

      await db.insert(caseHistory).values({
        caseId: newCase.id,
        action: "created",
        newValue: `Case created via Triage by ${user.email} `,
        changedBy: user.id,
        createdAt: new Date().toISOString()
      } as any);

      if (assignedTo) {
        await NotificationService.createNotification(
          assignedTo,
          "assignment",
          `[NEW CASE] ${newCase.caseNumber} `,
          `${category.name}: ${newCase.title}.Priority: ${newCase.priority}.`,
          `/ cases / workspace / ${newCase.id} `
        );
      }

      // --- Marketing Pipeline Integration ---
      try {
        if (!category.departmentId) throw new Error("Category has no department ID");
        const [marketingDept] = await db.select().from(departments).where(eq(departments.id, category.departmentId)).limit(1);

        const isMarketing = marketingDept && (marketingDept.code === 'MRK' || marketingDept.name.toLowerCase().includes('marketing'));

        if (isMarketing) {
          let stakeholder: any = null;
          if (stakeholderId) {
            [stakeholder] = await db.select().from(stakeholders).where(eq(stakeholders.id, stakeholderId)).limit(1);
          }

          const sType = stakeholder?.type || 'student';
          const isOrg = ['institution', 'employer'].includes(sType);

          await db.insert(marketingLeads).values({
            date: new Date().toISOString().split('T')[0],
            client: isOrg
              ? (stakeholder?.organization || "Unknown Organization")
              : (stakeholder ? `${stakeholder.firstName} ${stakeholder.lastName}` : "Untitled Student Lead"),
            contactPerson: stakeholder ? `${stakeholder.firstName} ${stakeholder.lastName}` : "Triage Lead",
            contactNumber: stakeholder?.phone || "N/A",
            contactEmail: stakeholder?.email || "N/A",
            customerType: sType as any,
            remarks: `Triaged from signal: ${signal[0].rawText}`,
            stage: 'lead',
            marketerId: assignedTo || null,
          } as any);
        }
      } catch (innerError) {
        console.error("Failed to link to marketing pipeline:", innerError);
        // Don't fail the whole request if marketing linking fails
      }

      res.status(201).json({ case: newCase, signalId: id });

      // Log signal mapping
      AuditService.logAction(req, {
        action: 'update',
        module: 'cases',
        entityType: 'signal',
        entityId: id,
        details: `Mapped signal to case ${newCase.caseNumber}`
      });
    } catch (error) {
      console.error("Error mapping signal:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/triage/signals/:id/ignore", marketingAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const user = (req as any).marketingUser;

      await db.update(intakeSignals).set({
        status: "ignored",
        processedBy: user.id,
        processedAt: sql`now()`
      }).where(eq(intakeSignals.id, id));

      res.json({ success: true });

      // Log signal ignore
      AuditService.logAction(req, {
        action: 'update',
        module: 'cases',
        entityType: 'signal',
        entityId: id,
        details: `Ignored signal ID: ${id}`
      });
    } catch (error) {
      console.error("Error ignoring signal:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User search for @mentions
  app.get("/api/users/search", marketingAuth, async (req, res) => {
    try {
      const { query } = req.query;
      const searchPattern = query ? `%${query}%` : "%";
      const results = await db
        .select({
          id: marketingUsers.id,
          firstName: marketingUsers.firstName,
          lastName: marketingUsers.lastName,
          email: marketingUsers.email,
        })
        .from(marketingUsers)
        .where(
          and(
            eq(marketingUsers.isActive, true),
            or(
              ilike(marketingUsers.firstName, searchPattern),
              ilike(marketingUsers.lastName, searchPattern),
              ilike(marketingUsers.email, searchPattern)
            )
          )
        )
        .limit(10);
      res.json({ users: results });
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all cases with internal collaboration (comments or mentions)
  app.get("/api/cases/collaboration/all", marketingAuth, async (req, res) => {
    try {
      const currentUser = (req as any).marketingUser;
      const rbacConditions = await getCaseRbacConditions(currentUser.id);

      const results = await db
        .select({
          id: cases.id,
          caseNumber: cases.caseNumber,
          title: sql<string>`'[' || ${stakeholders.registrationNumber} || '] ' || ${stakeholders.firstName} || ' ' || ${stakeholders.lastName} `,
          status: cases.status,
          updatedAt: cases.updatedAt,
          assignedTo: cases.assignedTo,
          tags: cases.tags,
        })
        .from(cases)
        .innerJoin(caseComments, eq(caseComments.caseId, cases.id))
        .leftJoin(stakeholders, eq(cases.stakeholderId, stakeholders.id))
        .where(and(eq(caseComments.isInternal, true), ...rbacConditions))
        .groupBy(cases.id, stakeholders.registrationNumber, stakeholders.firstName, stakeholders.lastName)
        .orderBy(desc(sql`MAX(${caseComments.createdAt})`));

      const discussions = await Promise.all(results.map(async (c) => {
        const lastCommentData = await db
          .select({
            content: caseComments.content,
            createdAt: caseComments.createdAt,
            userId: caseComments.userId,
            userName: sql<string>`${marketingUsers.firstName} || ' ' || ${marketingUsers.lastName} `,
          })
          .from(caseComments)
          .leftJoin(marketingUsers, eq(caseComments.userId, marketingUsers.id))
          .where(and(eq(caseComments.caseId, c.id), eq(caseComments.isInternal, true)))
          .orderBy(desc(caseComments.createdAt))
          .limit(1);

        const lastComment = lastCommentData[0];

        return {
          ...c,
          lastMessage: lastComment?.content || "No internal discussion yet",
          lastMessageUser: lastComment?.userName || "System",
          time: lastComment?.createdAt || c.updatedAt,
          unread: false,
        };
      }));

      res.json({ discussions });
    } catch (error) {
      console.error("Error fetching collaborations:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update case status and handle acknowledgment
  app.patch("/api/cases/:id/status", marketingAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, acknowledged, message } = req.body;
      const user = req.marketingUser;

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const rbacConditions = await getCaseRbacConditions(user.id);
      
      // Check for granular permission
      const userRoleIds = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, user.id));
      const roleIds = userRoleIds.map(r => r.roleId);
      const permissions = await db.select({ key: systemPermissions.key })
        .from(systemPermissions)
        .innerJoin(systemRolePermissions, eq(systemRolePermissions.permissionId, systemPermissions.id))
        .where(and(inArray(systemRolePermissions.roleId, roleIds), eq(systemPermissions.isActive, true)));
      const permKeys = permissions.map(p => p.key);

      if (!permKeys.includes("cases.change_status") && !permKeys.includes("admin.view")) {
        return res.status(403).json({ error: "Insufficient permissions to change case status" });
      }

      const caseResult = await db.select().from(cases).where(and(eq(cases.id, id as string), ...rbacConditions)).limit(1);

      if (caseResult.length === 0) {
        return res.status(404).json({ error: "Case not found" });
      }

      const targetCase = caseResult[0];
      const { resolutionNotes, saveToKb, sopSteps, rootCause } = req.body;
      const updates: any = {
        updatedAt: new Date().toISOString()
      };

      if (rootCause) {
        updates.rootCause = rootCause;
      }

      // 1. Handle Acknowledgement (DNA Capture)
      if (acknowledged) {
        if (message) {
          updates.initialResponse = message; // Save natively to Case
        }
        if (!targetCase.firstResponseAt) {
          updates.firstResponseAt = new Date().toISOString();
        }
        if (targetCase.status === 'open') {
          updates.status = 'in_progress';
        }
      }

      if (status) {
        updates.status = status;
        if (status === 'resolved' && (targetCase.status !== 'resolved')) {
          updates.resolvedAt = new Date().toISOString();
          // Calculate resolution duration
          const startTime = updates.firstResponseAt || targetCase.firstResponseAt || targetCase.createdAt;
          const start = new Date(startTime).getTime();
          const end = new Date(updates.resolvedAt).getTime();
          updates.resolutionDurationMinutes = Math.round((end - start) / (1000 * 60));
          
          if (resolutionNotes) {
            updates.resolution = resolutionNotes;
          }
          if (sopSteps) {
            updates.sopSteps = sopSteps; // Save natively to Case
          }

          // 3. Optional Structured Template Capture (Blueprint)
          if (saveToKb && (resolutionNotes || targetCase.resolution)) {
            try {
              let finalCategory = "General";
              if (targetCase.serviceCategoryId) {
                const [svcCat] = await db.select({ name: serviceCategories.name })
                  .from(serviceCategories)
                  .where(eq(serviceCategories.id, targetCase.serviceCategoryId))
                  .limit(1);
                if (svcCat?.name) {
                  finalCategory = svcCat.name;
                }
              }

              const resContent = resolutionNotes || targetCase.resolution;
              const steps = sopSteps || targetCase.sopSteps || [];
              const ack = updates.initialResponse || targetCase.initialResponse || "No record found";

              await db.insert(knowledgeBase).values({
                title: targetCase.title,
                content: resContent,
                category: finalCategory,
                isPublished: true,
                isTemplate: true,
                sourceCaseId: id as string,
                serviceCategoryId: targetCase.serviceCategoryId,
                createdBy: user.id,

                // New Structured Fields - Pulled directly from Case Source of Truth
                originalDescription: targetCase.description,
                channel: targetCase.channel,
                initialResponse: ack,
                resolutionSummary: resContent,
                sopSteps: steps,
                rootCause: rootCause || targetCase.rootCause,
                tags: [],
              } as any);
              
              console.log(`Knowledge blueprint created for case ${id}`);
            } catch (kbError: any) {
              console.error("Failed to create knowledge blueprint:", kbError.message);
            }
          }
        }
      }

      if (acknowledged && !targetCase.firstResponseAt) {
        updates.firstResponseAt = new Date().toISOString();
        if (updates.status === 'open') {
          updates.status = 'in_progress';
        }
      }

      await db.update(cases).set(updates).where(eq(cases.id, id as string));

      if (acknowledged && message) {
        await db.insert(caseComments).values({
          caseId: id as string,
          userId: user.id,
          content: message,
          isInternal: false,
          createdAt: new Date().toISOString(),
          attachments: []
        } as any);
      }

      if (status && status !== targetCase.status) {
        await db.insert(caseHistory).values({
          caseId: id as string,
          action: "STATUS_CHANGE",
          fieldChanged: "status",
          oldValue: targetCase.status,
          newValue: status,
          changedBy: user.id || "",
          createdAt: new Date().toISOString()
        });
      }

      if (acknowledged && !targetCase.firstResponseAt) {
        await db.insert(caseHistory).values({
          caseId: id as string,
          action: "ACKNOWLEDGED",
          fieldChanged: "first_response_at",
          oldValue: null,
          newValue: updates.firstResponseAt,
          changedBy: user.id || "",
          createdAt: new Date().toISOString()
        });
      }

      if (status && status !== targetCase.status && targetCase.assignedTo) {
        await NotificationService.createNotification(
          targetCase.assignedTo,
          "status_change",
          `[STATUS CHANGE] ${targetCase.caseNumber} `,
          `${targetCase.title} is now ${status.replace('_', ' ')}.`,
          `/ cases / workspace / ${targetCase.id} `
        );
      }

      res.json({ success: true, case: { ...targetCase, ...updates } });

      // Log status/acknowledgment change
      AuditService.logAction(req, {
        action: 'update',
        module: 'cases',
        entityType: 'case',
        entityId: id as string,
        newValues: updates,
        details: `Updated case status: ${updates.status || targetCase.status} (Acknowledged: ${acknowledged ? 'Yes' : 'No'})`
      });
    } catch (error) {
      console.error("Error updating case status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/cases/:id/personal-notes - Fetch per-user notes
  app.get("/api/cases/:id/personal-notes", marketingAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = (req as any).marketingUser;

      if (!currentUser) return res.status(401).json({ error: "Unauthorized" });

      const notes = await db.select({ notes: caseUserNotes.notes })
        .from(caseUserNotes)
        .where(and(eq(caseUserNotes.caseId, String(id)), eq(caseUserNotes.userId, currentUser.id)))
        .limit(1);

      res.json({ notes: notes[0]?.notes || "" });
    } catch (error) {
      console.error("Error fetching personal notes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /api/cases/:id/personal-notes - Auto-save persistent notebook per user
  app.patch("/api/cases/:id/personal-notes", marketingAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const idStr = String(id);
      const personalNotes = req.body.personalNotes;
      const currentUser = (req as any).marketingUser;

      if (!currentUser) return res.status(401).json({ error: "Unauthorized" });

      // Verify access to the case (RBAC)
      const rbacConditions = await getCaseRbacConditions(currentUser.id);
      const caseResult = await db.select().from(cases).where(and(eq(cases.id, idStr), ...rbacConditions)).limit(1);

      if (!caseResult.length) return res.status(404).json({ error: "Case not found" });

      // Use upsert-like logic: check if exists, then update or insert
      const existing = await db.select()
        .from(caseUserNotes)
        .where(and(eq(caseUserNotes.caseId, idStr), eq(caseUserNotes.userId, currentUser.id)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(caseUserNotes)
          .set({ notes: personalNotes, updatedAt: new Date().toISOString() })
          .where(eq(caseUserNotes.id, existing[0].id));
      } else {
        await db.insert(caseUserNotes)
          .values({
            caseId: idStr,
            userId: currentUser.id,
            notes: personalNotes,
            updatedAt: new Date().toISOString()
          });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving personal notes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
