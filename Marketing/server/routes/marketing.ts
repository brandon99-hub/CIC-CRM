import type { Express } from "express";
import { db } from "../db";
import { logProjectAction } from "../middleware/comprehensiveAudit";
import {
  marketingUsers,
  marketingSectors,
  marketingProjects,
  marketingLeads,
  marketingProspects,
  marketingSalesWon,
  marketingExpectedOrders,
  marketingAnnualSummary,
  marketingLostProjects,
  marketingDocuments,
  marketingActivities,
} from "../../shared/schema";
import { intakeSignals } from "../../shared/crmSchema";
import { departments, serviceCategories } from "../../shared/adminSchema";
import { cicLeads } from "../../shared/cicSchema";
import {
  marketingUserLoginSchema,
  marketingUserRegisterSchema,
  marketingUserUpdateSchema,
  marketingSectorCreateSchema,
  marketingSectorUpdateSchema,
  marketingProjectCreateSchema,
  marketingProjectUpdateSchema,
  marketingLeadCreateSchema,
  marketingLeadUpdateSchema,
  marketingProspectCreateSchema,
  marketingProspectUpdateSchema,
  marketingSharedAccountSchema,
  marketingSalesWonCreateSchema,
  marketingSalesWonUpdateSchema,
  marketingExpectedOrdersCreateSchema,
  marketingExpectedOrdersUpdateSchema,
  marketingAnnualSummaryCreateSchema,
  marketingAnnualSummaryUpdateSchema,
  marketingQuerySchema,
  marketingExportSchema,
  marketingDocumentCreateSchema,
  marketingDocumentUpdateSchema,
  marketingActivityCreateSchema,
  marketingActivityUpdateSchema,
} from "../../shared/marketingSchema";
import {
  marketingAuth,
  marketingAdminAuth,
  marketingUserAuth,
  generateMarketingToken,
  hashMarketingPassword,
  verifyMarketingPassword,
} from "../middleware/marketingAuth";

export {
  marketingAuth,
  marketingAdminAuth,
  marketingUserAuth,
  generateMarketingToken,
  hashMarketingPassword,
  verifyMarketingPassword,
};
import { eq, and, desc, asc, like, ilike, sql, count, lt, or, inArray, isNotNull } from "drizzle-orm";
import { generateExcelBuffer } from "../utils/excelExport";
import { z } from "zod";
import { emailService } from "../services/emailService";
import { AuditService } from "../services/audit-service";
import { registerAuthRoutes } from "./auth.routes";
import { registerExpectedOrdersRoutes } from "./expectedOrders.routes";
import { registerLeadsRoutes } from "./leads.routes";
import { registerProjectsRoutes } from "./projects.routes";
import { registerProspectsRoutes } from "./prospects.routes";
import { registerSalesWonRoutes } from "./salesWon.routes";
import { registerSectorsRoutes } from "./sectors.routes";
import { registerUsersRoutes } from "./users.routes";

export function registerMarketingRoutes(app: Express) {
  // Mount modular split route files
  registerAuthRoutes(app);
  registerUsersRoutes(app);
  registerSectorsRoutes(app);
  registerProjectsRoutes(app);
  registerLeadsRoutes(app);
  registerProspectsRoutes(app);
  registerSalesWonRoutes(app);
  registerExpectedOrdersRoutes(app);

  // Marketing Authentication Routes

  // Marketing Sectors CRUD


  // Marketing Projects CRUD

  // Marketing Prospects CRUD

  // Marketing Leads Routes

  // Marketing Leads CRUD - Removed duplicate routes

  // Marketing Prospects CRUD - Removed duplicate routes

  // Marketing Prospects CRUD - Handlers removed

  // Won Prospect - Handover to Case Management
  // Marketing Prospects CRUD - Stage handlers removed

  // Marketing Prospects Stage Progression - Handlers removed

  // Sales Won Routes
  // Marketing Sales Won list handler removed

  // Marketing Sales Won CRUD - Handlers removed

  // Expected Orders Routes
  // Marketing Expected Orders Routes - List, Create, Update removed

  // Marketing Expected Orders Stage and deletion handlers removed

  // Duplicate routes removed - using the first set above

  // Annual Summary Routes
  // Marketing Annual Summary list and target setting handlers removed

  // Marketing Annual Summary CRUD - Handlers removed

  // Export Routes
  // Marketing Export Routes - Handlers removed

  // Dashboard Stats Route
  app.get("/api/marketing/dashboard/stats", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { year, marketerId, bdId, pipeline } = marketingQuerySchema.parse(req.query);
      const currentYear = year || new Date().getFullYear();
      const isB2C = pipeline === 'B2C';

      const isAdmin = req.marketingUser?.role === 'admin' || req.marketingUser?.permissions?.includes('marketing.view_all');
      // If admin and no specific marketerId/bdId provided, we show global organization stats
      const targetmarketerId = marketerId || bdId || (isAdmin && !req.query.marketerId && !req.query.bdId ? undefined : req.marketingUser?.id);

      // Fetch Marketing Dept
      const marketingDept = await db.select().from(departments).where(eq(departments.isMarketingDepartment, true)).limit(1);
      const marketingDeptId = marketingDept.length > 0 ? marketingDept[0].id : null;

      if (!marketingDeptId) {
        return res.json({
          year: currentYear,
          prospectsCount: 0, leadsCount: 0, expectedOrdersCount: 0, salesWonCount: 0,
          totalRevenue: 0, expectedOrdersRevenue: 0, target: 0, revisedTarget: 0,
          expectedTarget: 0, bookingTarget: 0, commissionPercentage: 5, targetAchievement: 0,
          isB2C,
          ...(isB2C ? {
            registeredCount: 0, registeredRevenue: 0,
            b2cStats: {
              leads: { count: 0 }, registered: { count: 0, value: 0 },
              bookings: { count: 0, value: 0 }, converted: { count: 0, value: 0 }
            }
          } : {})
        });
      }

      // Filter by pipeline type
      const pipelineFilter = isB2C ? eq(cicLeads.pipelineType, "b2c") : eq(cicLeads.pipelineType, "b2b");
      
      const conditions = [
        eq(cicLeads.departmentId, marketingDeptId),
        pipelineFilter,
        sql`EXTRACT(YEAR FROM CAST(${cicLeads.createdAt} AS DATE)) = ${currentYear}`
      ];
      
      if (targetmarketerId) {
        conditions.push(eq(cicLeads.assignedToUserId, targetmarketerId));
      }

      // Aggregate by stage
      const stageStats = await db
        .select({
          stage: cicLeads.stage,
          count: count(),
          total: sql<number>`COALESCE(SUM(CAST(REGEXP_REPLACE(COALESCE(${cicLeads.estimatedAnnualPremium}, '0'), '[^0-9.]', '', 'g') AS DECIMAL)), 0)`
        })
        .from(cicLeads)
        .where(and(...conditions))
        .groupBy(cicLeads.stage);

      const statsMap = stageStats.reduce((acc, curr) => {
        acc[curr.stage] = { count: Number(curr.count), total: Number(curr.total) };
        return acc;
      }, {} as Record<string, { count: number, total: number }>);

      const getStat = (stage: string) => statsMap[stage] || { count: 0, total: 0 };

      // Target data from annual summary
      const targetData = targetmarketerId
            ? await db.select({
                target: marketingAnnualSummary.target,
                revisedTarget: marketingAnnualSummary.revisedTarget,
                expectedTarget: marketingAnnualSummary.expectedTarget,
                bookingTarget: marketingAnnualSummary.bookingTarget,
                registrationTarget: marketingAnnualSummary.registrationTarget,
                commissionPercentage: marketingAnnualSummary.commissionPercentage
              }).from(marketingAnnualSummary).where(and(eq(marketingAnnualSummary.marketerId, targetmarketerId), eq(marketingAnnualSummary.year, currentYear))).limit(1)
            : await db.select({
                target: sql<number>`COALESCE(SUM(CAST(${marketingAnnualSummary.target} AS DECIMAL)), 0)`,
                revisedTarget: sql<number>`COALESCE(SUM(CAST(${marketingAnnualSummary.revisedTarget} AS DECIMAL)), 0)`,
                expectedTarget: sql<number>`COALESCE(SUM(CAST(${marketingAnnualSummary.expectedTarget} AS DECIMAL)), 0)`,
                bookingTarget: sql<number>`COALESCE(SUM(CAST(${marketingAnnualSummary.bookingTarget} AS DECIMAL)), 0)`,
                registrationTarget: sql<number>`COALESCE(SUM(CAST(${marketingAnnualSummary.registrationTarget} AS DECIMAL)), 0)`,
                commissionPercentage: sql<number>`COALESCE(MAX(${marketingAnnualSummary.commissionPercentage}), 5)`
              }).from(marketingAnnualSummary).where(eq(marketingAnnualSummary.year, currentYear));

      const target = targetData[0] ? Number(targetData[0].target) : 0;
      const revisedTarget = targetData[0] ? Number((targetData[0] as any).revisedTarget || 0) : 0;
      const expectedTarget = targetData[0] ? Number(targetData[0].expectedTarget) : 0;
      const bookingTarget = targetData[0] ? Number((targetData[0] as any).bookingTarget || 0) : 0;
      const commissionPercentage = targetData[0] ? Number((targetData[0] as any).commissionPercentage || 5) : 5;

      if (isB2C) {
        const lead = getStat('lead');
        const prospect = getStat('prospect');
        const quote = getStat('quote_underwriting');
        const policy = getStat('policy_issued');
        
        const registeredCount = prospect.count + quote.count;
        const registeredRevenue = prospect.total + quote.total;
        const totalB2CTarget = bookingTarget + (targetData[0] ? Number((targetData[0] as any).registrationTarget || 0) : 0);
        const targetAchievement = totalB2CTarget > 0 ? ((registeredRevenue + policy.total) / totalB2CTarget * 100) : 0;

        res.json({
          year: currentYear,
          prospectsCount: registeredCount + policy.count,
          leadsCount: lead.count,
          expectedOrdersCount: policy.count,
          salesWonCount: policy.count,
          totalRevenue: policy.total,
          expectedOrdersRevenue: policy.total,
          registeredCount,
          registeredRevenue,
          target: totalB2CTarget,
          revisedTarget: 0,
          expectedTarget: 0,
          bookingTarget,
          commissionPercentage,
          targetAchievement: Math.round(targetAchievement * 100) / 100,
          isB2C: true,
          b2cStats: {
            leads: { count: lead.count },
            registered: { count: registeredCount, value: registeredRevenue },
            bookings: { count: policy.count, value: policy.total },
            converted: { count: policy.count, value: policy.total }
          }
        });
      } else {
        const lead = getStat('lead');
        const prospect = getStat('prospect');
        const proposal = getStat('proposal_underwriting');
        const active = getStat('active');
        const policy = getStat('policy_issued');

        const prospectsCount = prospect.count + proposal.count;
        const actualRevenue = policy.total + active.total;

        const targetForCalculation = expectedTarget > 0 ? expectedTarget : (revisedTarget > 0 ? revisedTarget : target);
        const targetAchievement = targetForCalculation > 0 ? ((actualRevenue / targetForCalculation) * 100) : 0;

        res.json({
          year: currentYear,
          prospectsCount,
          leadsCount: lead.count,
          expectedOrdersCount: active.count,
          salesWonCount: policy.count + active.count,
          totalRevenue: actualRevenue,
          expectedOrdersRevenue: active.total,
          target,
          revisedTarget,
          expectedTarget,
          bookingTarget,
          commissionPercentage,
          targetAchievement: Math.round(targetAchievement * 100) / 100,
          isB2C: false
        });
      }
    } catch (error) {
      console.error("Fetch dashboard stats error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Inline stage update for CIC Pipeline
  app.patch("/api/marketing/pipeline/:id/stage", marketingAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { stage } = req.body;
      
      const updated = await db.update(cicLeads)
        .set({ stage, updatedAt: new Date().toISOString() })
        .where(eq(cicLeads.id, id as string))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ error: "Lead not found" });
      }

      res.json({ success: true, lead: updated[0] });
    } catch (error) {
      console.error("Stage update error:", error);
      res.status(500).json({ error: "Failed to update stage" });
    }
  });

  // Kanban Data Route
  app.get("/api/marketing/kanban", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { pipeline } = marketingQuerySchema.parse(req.query);
      const isB2C = pipeline === 'B2C' || pipeline === 'b2c';

      // Find the designated marketing department
      const marketingDept = await db.select().from(departments).where(eq(departments.isMarketingDepartment, true)).limit(1);
      const marketingDeptId = marketingDept.length > 0 ? marketingDept[0].id : null;

      if (!marketingDeptId) {
        // Graceful empty state when marketing dept is not configured
        return res.json({
          lead: [],
          prospect_registration: [],
          prospect_booking: [],
          prospect_opportunity: [],
          prospect_engagement: [],
          expected_order: [],
          sales_won: [],
          converted: [],
          _meta: { configured: false, message: "Marketing department not configured. No leads will be displayed." }
        });
      }

      const canViewAll = req.marketingUser?.role === 'admin' || req.marketingUser?.permissions?.includes('marketing.view_all');
      const filteredMarketerId = canViewAll ? undefined : req.marketingUser?.id;

      // Filter by pipeline type
      const pipelineFilter = isB2C ? eq(cicLeads.pipelineType, "b2c") : eq(cicLeads.pipelineType, "b2b");
      
      const conditions = [
        eq(cicLeads.departmentId, marketingDeptId),
        pipelineFilter
      ];
      
      if (filteredMarketerId) {
        conditions.push(eq(cicLeads.assignedToUserId, filteredMarketerId));
      }

      // Fetch from cic_leads
      const leads = await db
        .select({
          id: cicLeads.id,
          client: sql<string>`COALESCE(${cicLeads.firstName} || ' ' || ${cicLeads.lastName}, ${cicLeads.organisationName}, 'Unknown Client')`,
          revenue: cicLeads.estimatedAnnualPremium,
          stage: cicLeads.stage,
          marketerId: cicLeads.assignedToUserId,
          updatedAt: cicLeads.updatedAt,
          bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
          remarks: cicLeads.notes,
          customerType: cicLeads.pipelineType,
          productLine: cicLeads.productLine,
          sourceChannel: cicLeads.sourceChannel
        })
        .from(cicLeads)
        .leftJoin(marketingUsers, eq(cicLeads.assignedToUserId, marketingUsers.id))
        .where(and(...conditions));

      // Map to bifurcated Kanban columns
      const kanbanData = {
        lead: leads.filter(l => l.stage === 'lead'),
        prospect: leads.filter(l => l.stage === 'prospect'),
        prospect_registration: isB2C ? leads.filter(l => l.stage === 'quote_underwriting') : [],
        prospect_booking: isB2C ? leads.filter(l => l.stage === 'policy_issued') : [],
        prospect_opportunity: !isB2C ? leads.filter(l => l.stage === 'proposal_underwriting') : [],
        prospect_engagement: !isB2C ? leads.filter(l => l.stage === 'policy_issued') : [],
        expected_order: leads.filter(l => l.stage === 'active' || l.stage === 'dormant'),
        sales_won: leads.filter(l => l.stage === 'policy_issued' || l.stage === 'active'),
        converted: isB2C ? leads.filter(l => l.stage === 'policy_issued') : [],
        _meta: { configured: true }
      };

      res.json(kanbanData);
    } catch (error) {
      console.error("Fetch kanban data error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Forecasting Data Route
  app.get("/api/marketing/forecast", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { year, pipeline } = marketingQuerySchema.parse(req.query);
      const currentYear = year || new Date().getFullYear();
      const isB2C = pipeline === 'B2C';

      const canViewAll = req.marketingUser?.role === 'admin' || req.marketingUser?.permissions?.includes('marketing.view_all');
      const filteredMarketerId = canViewAll ? undefined : req.marketingUser?.id;

      // Fetch Marketing Dept
      const marketingDept = await db.select().from(departments).where(eq(departments.isMarketingDepartment, true)).limit(1);
      const marketingDeptId = marketingDept.length > 0 ? marketingDept[0].id : null;

      if (!marketingDeptId) {
        return res.json({
          forecast: [],
          historicalData: { lead_entered: 0, opportunity_entered: 0, engagement_entered: 0, expected_order_entered: 0, sales_won: 0 },
          studentData: { lead: 0, leadRevenue: 0, registration: 0, registrationRevenue: 0, booking: 0, bookingRevenue: 0, converted: 0, convertedRevenue: 0 },
          studentBookingRate: 0,
          studentRebookingRate: 0,
          dormantStudentCount: 0,
          expectedOrderDeals: [],
          quarterlyTarget: 0,
          bookingTarget: 0,
          b2bStaleCount: { lead: 0, opportunity: 0, engagement: 0, expected_order: 0 },
          totalStaleCount: 0
        });
      }

      // Filter by pipeline type
      const pipelineFilter = isB2C ? eq(cicLeads.pipelineType, "b2c") : eq(cicLeads.pipelineType, "b2b");
      
      const conditions = [
        eq(cicLeads.departmentId, marketingDeptId),
        pipelineFilter,
        sql`EXTRACT(YEAR FROM CAST(${cicLeads.createdAt} AS DATE)) = ${currentYear}`
      ];
      
      if (filteredMarketerId) {
        conditions.push(eq(cicLeads.assignedToUserId, filteredMarketerId));
      }

      const stageStats = await db
        .select({
          stage: cicLeads.stage,
          count: count(),
          total: sql<number>`COALESCE(SUM(CAST(REGEXP_REPLACE(COALESCE(${cicLeads.estimatedAnnualPremium}, '0'), '[^0-9.]', '', 'g') AS DECIMAL)), 0)`
        })
        .from(cicLeads)
        .where(and(...conditions))
        .groupBy(cicLeads.stage);

      const statsMap = stageStats.reduce((acc, curr) => {
        acc[curr.stage] = { count: Number(curr.count), total: Number(curr.total) };
        return acc;
      }, {} as Record<string, { count: number, total: number }>);

      const getStat = (stage: string) => statsMap[stage] || { count: 0, total: 0 };

      const lCount = getStat('lead').count;
      const pCount = getStat('prospect').count;
      const oCount = isB2C ? getStat('quote_underwriting').count : getStat('proposal_underwriting').count;
      const exCount = getStat('active').count;
      const wCount = getStat('policy_issued').count;

      const historicalData = {
        lead_entered: lCount,
        opportunity_entered: pCount,
        engagement_entered: oCount,
        expected_order_entered: exCount,
        sales_won: wCount
      };

      const getStageProb = (stage: string): number => {
        switch (stage.toLowerCase()) {
          case 'lead': return 0.15;
          case 'opportunity': return 0.35;
          case 'engagement': return 0.65;
          case 'expected order':
          case 'expected_order': return 0.85;
          case 'sales won':
          case 'sales_won': return 1.0;
          default: return 0.15;
        }
      };

      const leadRev = getStat('lead').total;
      const oppRev = getStat('prospect').total;
      const engRev = isB2C ? getStat('quote_underwriting').total : getStat('proposal_underwriting').total;
      const expRev = getStat('active').total;
      const wonRev = getStat('policy_issued').total;

      const forecast = [
        { stage: 'Lead', actual: leadRev, weighted: Math.round(leadRev * 0.15), prob: 15 },
        { stage: 'Opportunity', actual: oppRev, weighted: Math.round(oppRev * 0.35), prob: 35 },
        { stage: 'Engagement', actual: engRev, weighted: Math.round(engRev * 0.65), prob: 65 },
        { stage: 'Expected Order', actual: expRev, weighted: Math.round(expRev * 0.85), prob: 85 },
        { stage: 'Sales Won', actual: wonRev, weighted: wonRev, prob: 100 },
      ];

      // Simplified targets
      const quarterlyTarget = 500000;
      const bookingTarget = 100;
      const studentRebookingRate = 85;

      const studentData = {
        lead: lCount,
        leadRevenue: leadRev,
        registration: pCount,
        registrationRevenue: oppRev,
        booking: wCount,
        bookingRevenue: wonRev,
        converted: wCount,
        convertedRevenue: wonRev
      };

      const isProbabilityEstimated = wCount < 5;

      const avgSalesCycleLength = 60; // Simplified for now since cic_leads handles history differently
      
      const activeDealsCount = pCount + oCount + exCount;
      const activeDealsTotal = oppRev + engRev + expRev;
      
      const avgDealValue = activeDealsCount > 0 
        ? Math.round(activeDealsTotal / activeDealsCount)
        : 0;

      const winRateVal = wCount > 0 && oCount > 0 ? (wCount / oCount) : 0.35; 
      const pipelineVelocity = avgSalesCycleLength > 0 
        ? Math.round((activeDealsCount * avgDealValue * winRateVal) / avgSalesCycleLength)
        : 0;

      res.json({
        forecast,
        historicalData,
        studentData,
        studentHistoricalData: { lead_entered: lCount, converted: wCount },
        studentBookingRate: 0.15,
        studentRebookingRate,
        dormantStudentCount: getStat('dormant').count,
        expectedOrderDeals: [],
        quarterlyTarget,
        bookingTarget,
        b2bStaleCount: { lead: 0, opportunity: 0, engagement: 0, expected_order: 0 },
        totalStaleCount: 0,
        isProbabilityEstimated,
        pipelineVelocity,
        avgSalesCycleLength
      });
    } catch (error) {
      console.error("Fetch forecast data error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Kanban Update Stage Route
  app.patch("/api/marketing/kanban/update-stage", marketingAuth, async (req, res) => {
    try {
      const { id, newStatus, currentStatus } = z.object({
        id: z.string(),
        newStatus: z.string(),
        currentStatus: z.string()
      }).parse(req.body);

      // 1. Determine source table
      let sourceTable: any;
      const isLostProject = await db.select({ id: marketingLostProjects.id }).from(marketingLostProjects).where(eq(marketingLostProjects.id, id)).limit(1);
      if (isLostProject.length > 0) sourceTable = marketingLostProjects;
      else if (currentStatus === 'lead') sourceTable = marketingLeads;
      else if (['prospect', 'opportunity', 'engagement', 'registration', 'booking', 'prospect_registration', 'prospect_booking', 'prospect_opportunity', 'prospect_engagement', 'dormant'].includes(currentStatus)) sourceTable = marketingProspects;
      else if (currentStatus === 'expected_order') sourceTable = marketingExpectedOrders;
      else if (currentStatus === 'sales_won' || currentStatus === 'converted') sourceTable = marketingSalesWon;
      else return res.status(400).json({ error: "Invalid current status" });

      // 2. Fetch the item
      const items = await db.select().from(sourceTable).where(eq(sourceTable.id, id)).limit(1);
      if (items.length === 0) return res.status(404).json({ error: "Item not found" });
      const item = items[0] as any;

      // Check permissions
      if (req.marketingUser?.role !== 'admin' && 
          !req.marketingUser?.permissions?.includes('marketing.view_all') && 
          item.marketerId !== req.marketingUser?.id) {
        return res.status(403).json({ error: "Insufficient permissions to move this item" });
      }

      // 3. Handle Transitions
      const now = new Date().toISOString();

      // CASE A: Internal update (within same table)
      const prospectStages = ['opportunity', 'engagement', 'registration', 'booking', 'prospect_opportunity', 'prospect_engagement', 'prospect_registration', 'prospect_booking'];
      if (
        (prospectStages.includes(newStatus) && prospectStages.includes(currentStatus)) ||
        (newStatus === currentStatus)
      ) {
        // Map UI stage to DB stage
        let dbStage = newStatus;
        if (newStatus === 'prospect_opportunity') dbStage = 'opportunity';
        if (newStatus === 'prospect_engagement') dbStage = 'engagement';

        await db.update(sourceTable).set({ stage: dbStage as any, updatedAt: now }).where(eq(sourceTable.id, id));
        return res.json({ success: true, message: "Stage updated internally" });
      }

      // CASE B: Cross-table migration
      // Define destination logic
      if (prospectStages.includes(newStatus)) {
        // Map UI stage to DB stage
        let dbStage = newStatus;
        if (newStatus === 'prospect_opportunity') dbStage = 'opportunity';
        if (newStatus === 'prospect_engagement') dbStage = 'engagement';

        await db.insert(marketingProspects).values({
          date: item.date || now,
          client: item.client || item.organisationName,
          contactPerson: item.contactPerson || "",
          contactNumber: item.contactNumber || "",
          contactEmail: item.contactEmail || "",
          remarks: item.remarks || item.comments || "",
          revenue: item.revenue || item.contractAmount || "0",
          stage: dbStage as any,
          customerType: item.customerType,
          marketerId: item.marketerId,
          sectorId: item.sectorId,
          createdAt: item.createdAt || now,
          updatedAt: now,
        });
      } else if (newStatus === 'expected_order') {
        await db.insert(marketingExpectedOrders).values({
          organisationName: item.client || item.organisationName,
          sector: "General", // Placeholder if sector name not available
          product: "General",
          revenue: item.revenue || item.contractAmount || "0",
          expectedQuarter: `Q${Math.floor(new Date().getMonth() / 3) + 1}`,
          comments: item.remarks || item.comments || "",
          customerType: item.customerType,
          marketerId: item.marketerId,
          contactPerson: item.contactPerson,
          contactNumber: item.contactNumber,
          contactEmail: item.contactEmail,
          createdAt: item.createdAt || now,
          updatedAt: now,
        });
      } else if (newStatus === 'sales_won' || newStatus === 'converted') {
        await db.insert(marketingSalesWon).values({
          organisationName: item.client || item.organisationName,
          sector: "General",
          product: "General",
          contractAmount: item.revenue || item.contractAmount || "0",
          expectedQuarter: `Q${Math.floor(new Date().getMonth() / 3) + 1}`,
          comments: item.remarks || item.comments || "",
          customerType: item.customerType,
          marketerId: item.marketerId,
          contactPerson: item.contactPerson,
          contactNumber: item.contactNumber,
          contactEmail: item.contactEmail,
          createdAt: item.createdAt || now,
          updatedAt: now,
        });
      } else if (newStatus === 'lost') {
        await db.insert(marketingLostProjects).values({
          organisationName: item.client || item.organisationName,
          sector: "General",
          product: "General",
          revenue: item.revenue || item.contractAmount || "0",
          comments: item.remarks || item.comments || "",
          marketerId: item.marketerId,
          lostDate: now,
          lostReason: "Moved to lost via Kanban",
          status: "lost",
          createdAt: item.createdAt || now,
          updatedAt: now,
        });
      } else if (newStatus === 'dormant') {
        await db.insert(marketingLostProjects).values({
          organisationName: item.client || item.organisationName,
          sector: "Student",
          product: currentStatus === "prospect_booking" ? "Student Booking" : "Student Registration",
          revenue: item.revenue || item.contractAmount || "0",
          comments: item.remarks || item.comments || "",
          marketerId: item.marketerId,
          lostDate: now,
          lostReason: "Moved to dormant via Kanban",
          status: "dormant",
          canRevive: true,
          createdAt: item.createdAt || now,
          updatedAt: now,
        });
      } else if (newStatus === 'lead') {
        await db.insert(marketingLeads).values({
          date: item.date || now,
          client: item.client || item.organisationName,
          contactPerson: item.contactPerson || "",
          contactNumber: item.contactNumber || "",
          contactEmail: item.contactEmail || "",
          remarks: item.remarks || item.comments || "",
          revenue: item.revenue || item.contractAmount || "0",
          stage: 'lead',
          marketerId: item.marketerId,
          createdAt: item.createdAt || now,
          updatedAt: now,
        });
      }

      // Delete from source table after successful insert
      await db.delete(sourceTable).where(eq(sourceTable.id, id));

      res.json({ success: true, message: `Moved from ${currentStatus} to ${newStatus}` });
    } catch (error) {
      console.error("Update kanban stage error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // --- Document Management Routes ---
  app.get("/api/marketing/documents", marketingAuth, async (req, res) => {
    try {
      const canViewAll = req.marketingUser?.role === 'admin' || req.marketingUser?.permissions?.includes('marketing.view_all');
      const filteredMarketerId = canViewAll ? undefined : req.marketingUser?.id;

      let query = db.select({
        id: marketingDocuments.id,
        name: marketingDocuments.name,
        fileName: marketingDocuments.fileName,
        fileType: marketingDocuments.fileType,
        fileSize: marketingDocuments.fileSize,
        url: marketingDocuments.url,
        category: marketingDocuments.category,
        leadId: marketingDocuments.leadId,
        prospectId: marketingDocuments.prospectId,
        expectedOrderId: marketingDocuments.expectedOrderId,
        salesWonId: marketingDocuments.salesWonId,
        marketerId: marketingDocuments.marketerId,
        createdAt: marketingDocuments.createdAt,
        bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
      }).from(marketingDocuments)
      .leftJoin(marketingUsers, eq(marketingDocuments.marketerId, marketingUsers.id));

      if (filteredMarketerId) {
        query = query.where(eq(marketingDocuments.marketerId, filteredMarketerId)) as any;
      }

      const documents = await query;
      res.json(documents);
    } catch (error) {
      console.error("Fetch documents error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/marketing/documents", marketingAuth, async (req, res) => {
    try {
      const data = marketingDocumentCreateSchema.parse(req.body);
      
      // Mocked file details for now - in real app, these would come from an upload middleware
      const newDoc = await db.insert(marketingDocuments).values({
        ...data,
        fileName: req.body.fileName || "unknown_file",
        fileType: req.body.fileType || "application/octet-stream",
        fileSize: req.body.fileSize || 0,
        url: req.body.url || "/attached_assets/placeholder.pdf",
        marketerId: req.marketingUser!.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any).returning();

      res.status(201).json(newDoc[0]);
    } catch (error) {
      console.error("Create document error:", error);
      res.status(400).json({ error: "Invalid data" });
    }
  });

  app.delete("/api/marketing/documents/:id", marketingAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if document exists and user has permission
      const docs = await db.select().from(marketingDocuments).where(eq(marketingDocuments.id, id as string)).limit(1);
      if (docs.length === 0) return res.status(404).json({ error: "Document not found" });
      
      const doc = docs[0];
      if (req.marketingUser?.role !== 'admin' && 
          !req.marketingUser?.permissions?.includes('marketing.view_all') && 
          doc.marketerId !== req.marketingUser?.id) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      await db.delete(marketingDocuments).where(eq(marketingDocuments.id, id as string));
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // --- Activity Management Routes ---
  app.get("/api/marketing/activities", marketingAuth, async (req, res) => {
    try {
      const canViewAll = req.marketingUser?.role === 'admin' || req.marketingUser?.permissions?.includes('marketing.view_all');
      const filteredMarketerId = canViewAll ? undefined : req.marketingUser?.id;

      let query = db.select({
        id: marketingActivities.id,
        type: marketingActivities.type,
        subject: marketingActivities.subject,
        description: marketingActivities.description,
        dueDate: marketingActivities.dueDate,
        status: marketingActivities.status,
        leadId: marketingActivities.leadId,
        prospectId: marketingActivities.prospectId,
        expectedOrderId: marketingActivities.expectedOrderId,
        salesWonId: marketingActivities.salesWonId,
        marketerId: marketingActivities.marketerId,
        createdAt: marketingActivities.createdAt,
        reminderDate: marketingActivities.reminderDate,
        notificationType: marketingActivities.notificationType,
        startTime: marketingActivities.startTime,
        endTime: marketingActivities.endTime,
        isRecurring: marketingActivities.isRecurring,
        recurrence: marketingActivities.recurrence,
        bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
      }).from(marketingActivities)
      .leftJoin(marketingUsers, eq(marketingActivities.marketerId, marketingUsers.id));

      if (filteredMarketerId) {
        query = query.where(eq(marketingActivities.marketerId, filteredMarketerId)) as any;
      }

      const activities = await query;
      res.json(activities);
    } catch (error) {
      console.error("Fetch activities error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/marketing/activities", marketingAuth, async (req, res) => {
    try {
      const data = marketingActivityCreateSchema.parse(req.body);
      const newActivity = await db.insert(marketingActivities).values({
        ...data,
        marketerId: req.marketingUser!.id,
      } as any).returning();

      if (data.notificationType === 'email' && req.marketingUser?.email) {
        try {
          await emailService.sendActivityNotification({
            to: req.marketingUser.email,
            activity: newActivity[0]
          });
        } catch (emailError) {
          console.error("Failed to send activity email:", emailError);
        }
      }

      res.status(201).json(newActivity[0]);
    } catch (error) {
      console.error("Create activity error:", error);
      res.status(400).json({ error: "Invalid data" });
    }
  });

  app.patch("/api/marketing/activities/:id", marketingAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const data = marketingActivityUpdateSchema.parse(req.body);
      
      const updated = await db.update(marketingActivities)
        .set({ ...data, updatedAt: new Date().toISOString() } as any)
        .where(eq(marketingActivities.id, id as string))
        .returning();
      
      if (updated.length === 0) return res.status(404).json({ error: "Activity not found" });
      res.json(updated[0]);
    } catch (error) {
      console.error("Update activity error:", error);
      res.status(400).json({ error: "Invalid data" });
    }
  });

  app.delete("/api/marketing/activities/:id", marketingAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(marketingActivities).where(eq(marketingActivities.id, id as string));
      res.json({ message: "Activity deleted successfully" });
    } catch (error) {
      console.error("Delete activity error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin Dashboard Stats - Aggregated across all BD members
  app.get("/api/marketing/admin/dashboard/stats", marketingAuth, async (req: any, res: any) => {
    try {
      const hasAccess = req.marketingUser?.role === 'admin' || 
                       req.marketingUser?.permissions?.includes('marketing.view_all') ||
                       req.marketingUser?.permissions?.includes('marketing.view_analytics');
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const { year, pipeline } = marketingQuerySchema.parse(req.query);
      const currentYear = year || new Date().getFullYear();
      const isB2C = pipeline === 'B2C';

      // Implement data filtering for non-admin marketers
      const canViewAll = req.marketingUser?.role === 'admin' || req.marketingUser?.permissions?.includes('marketing.view_all');
      const filteredMarketerId = canViewAll ? undefined : req.marketingUser?.id;

      // Helper to build where clauses with optional marketer filtering
      const buildWhere = (table: any, dateField: any, extraCond?: any) => {
        const conditions = [
          sql`EXTRACT(YEAR FROM CAST(${dateField} AS DATE)) = ${currentYear}`
        ];
        if (filteredMarketerId) {
          conditions.push(eq(table.marketerId, filteredMarketerId));
        }
        if (extraCond) {
          conditions.push(extraCond);
        }
        return and(...conditions);
      };

      if (isB2C) {
        const [leadsCountData, registeredData, bookingsData, convertedData, bdStats] = await Promise.all([
          db
            .select({ count: count() })
            .from(marketingLeads)
            .where(buildWhere(marketingLeads, marketingLeads.date, and(eq(marketingLeads.customerType, 'student'), eq(marketingLeads.stage, 'lead')))),
          db
            .select({ count: count(), total: sql<number>`COALESCE(SUM(CAST(${marketingProspects.revenue} AS DECIMAL)), 0)` })
            .from(marketingProspects)
            .where(buildWhere(marketingProspects, marketingProspects.date, and(eq(marketingProspects.customerType, 'student'), eq(marketingProspects.stage, 'prospect_registration')))),
          db
            .select({ count: count(), total: sql<number>`COALESCE(SUM(CAST(${marketingProspects.revenue} AS DECIMAL)), 0)` })
            .from(marketingProspects)
            .where(buildWhere(marketingProspects, marketingProspects.date, and(eq(marketingProspects.customerType, 'student'), eq(marketingProspects.stage, 'prospect_booking')))),
          db
            .select({ count: count(), total: sql<number>`COALESCE(SUM(CAST(${marketingSalesWon.contractAmount} AS DECIMAL)), 0)` })
            .from(marketingSalesWon)
            .where(buildWhere(marketingSalesWon, marketingSalesWon.createdAt, eq(marketingSalesWon.customerType, 'student'))),
          db
            .select({
              marketerId: marketingUsers.id,
              bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
              prospectsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_prospects WHERE marketer_id = ${marketingUsers.id} AND stage IN ('prospect_registration', 'prospect_booking') AND customer_type = 'student' AND EXTRACT(YEAR FROM CAST(date AS DATE)) = ${currentYear}), 0)`,
              leadsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_leads WHERE marketer_id = ${marketingUsers.id} AND customer_type = 'student' AND EXTRACT(YEAR FROM CAST(date AS DATE)) = ${currentYear}), 0)`,
              expectedOrdersCount: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_prospects WHERE marketer_id = ${marketingUsers.id} AND stage = 'prospect_booking' AND customer_type = 'student' AND EXTRACT(YEAR FROM CAST(date AS DATE)) = ${currentYear}), 0)`,
              salesWonCount: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_sales_won WHERE marketer_id = ${marketingUsers.id} AND customer_type = 'student' AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
              totalRevenue: sql<number>`COALESCE((SELECT SUM(CAST(contract_amount AS DECIMAL)) FROM marketing_sales_won WHERE marketer_id = ${marketingUsers.id} AND customer_type = 'student' AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
              target: sql<number>`COALESCE((SELECT CAST(COALESCE(registration_target, 0) + COALESCE(booking_target, 0) AS DECIMAL) FROM marketing_annual_summary WHERE marketer_id = ${marketingUsers.id} AND year = ${currentYear} LIMIT 1), 0)`,
            })
            .from(marketingUsers)
            .where(eq(marketingUsers.isActive, true))
            .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName)
            .orderBy(desc(sql`COALESCE((SELECT SUM(CAST(revenue AS DECIMAL)) FROM marketing_prospects WHERE marketer_id = ${marketingUsers.id} AND stage IN ('prospect_registration', 'prospect_booking') AND customer_type = 'student' AND EXTRACT(YEAR FROM CAST(date AS DATE)) = ${currentYear}), 0)`)),
        ]);

        const leadsCount = Number(leadsCountData[0].count);
        const regCount = Number(registeredData[0].count);
        const regRev = Number(registeredData[0].total);
        const bookCount = Number(bookingsData[0].count);
        const bookRev = Number(bookingsData[0].total);
        const convertedCount = Number(convertedData[0].count);
        const convertedRevenue = Number(convertedData[0].total);

        res.json({
          year: currentYear,
          totalProspectsCount: regCount + bookCount,
          totalLeadsCount: leadsCount,
          totalExpectedOrdersCount: bookCount,
          totalSalesWonCount: convertedCount,
          totalRevenue: convertedRevenue,
          totalExpectedOrdersRevenue: bookRev,
          bdStats: bdStats.map(stat => ({
            ...stat,
            prospectsCount: Number(stat.prospectsCount),
            leadsCount: Number(stat.leadsCount),
            expectedOrdersCount: Number(stat.expectedOrdersCount),
            salesWonCount: Number(stat.salesWonCount),
            totalRevenue: Number(stat.totalRevenue),
          })),
          isB2C: true,
          b2cStats: {
            leads: { count: leadsCount },
            registered: { count: regCount, value: regRev },
            bookings: { count: bookCount, value: bookRev },
            converted: { count: convertedCount, value: convertedRevenue }
          }
        });
      } else {
        const customerCond = inArray(marketingProspects.customerType, ['institution', 'organization', 'employer']);
        const leadsCustomerCond = inArray(marketingLeads.customerType, ['institution', 'organization', 'employer']);
        const expectedCustomerCond = inArray(marketingExpectedOrders.customerType, ['institution', 'organization', 'employer']);
        const salesCustomerCond = inArray(marketingSalesWon.customerType, ['institution', 'organization', 'employer']);

        const [prospectsCount, leadsCount, expectedOrdersCount, salesWonCount, totalRevenue, totalExpectedOrdersRevenue, bdStats] = await Promise.all([
          // Total prospects count - include all active pipeline stages
          db
            .select({ count: count() })
            .from(marketingProspects)
            .where(buildWhere(marketingProspects, marketingProspects.date, and(inArray(marketingProspects.stage, ['prospect', 'opportunity', 'engagement']), customerCond))),
          // Total leads count - from actual leads table
          db
            .select({ count: count() })
            .from(marketingLeads)
            .where(buildWhere(marketingLeads, marketingLeads.date, leadsCustomerCond)),
          // Total expected orders count - from actual expected orders table
          db
            .select({ count: count() })
            .from(marketingExpectedOrders)
            .where(buildWhere(marketingExpectedOrders, marketingExpectedOrders.createdAt, expectedCustomerCond)),
          // Total sales won count - from actual sales won table
          db
            .select({ count: count() })
            .from(marketingSalesWon)
            .where(buildWhere(marketingSalesWon, marketingSalesWon.createdAt, salesCustomerCond)),
          // Total revenue - from sales won table (actual contract values)
          db
            .select({ total: sql<number>`COALESCE(SUM(CAST(${marketingSalesWon.contractAmount} AS DECIMAL)), 0)` })
            .from(marketingSalesWon)
            .where(buildWhere(marketingSalesWon, marketingSalesWon.createdAt, salesCustomerCond)),
          // Total expected orders revenue - from expected orders table
          db
            .select({ total: sql<number>`COALESCE(SUM(CAST(${marketingExpectedOrders.revenue} AS DECIMAL)), 0)` })
            .from(marketingExpectedOrders)
            .where(buildWhere(marketingExpectedOrders, marketingExpectedOrders.createdAt, expectedCustomerCond)),
          // Get individual BD member performance (simplified without targets for now)
          db
            .select({
              marketerId: marketingUsers.id,
              bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
              prospectsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_prospects WHERE marketer_id = ${marketingUsers.id} AND stage IN ('prospect', 'opportunity', 'engagement') AND customer_type IN ('institution', 'organization', 'employer') AND EXTRACT(YEAR FROM CAST(date AS DATE)) = ${currentYear}), 0)`,
              leadsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_leads WHERE marketer_id = ${marketingUsers.id} AND customer_type IN ('institution', 'organization', 'employer') AND EXTRACT(YEAR FROM CAST(date AS DATE)) = ${currentYear}), 0)`,
              expectedOrdersCount: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_expected_orders WHERE marketer_id = ${marketingUsers.id} AND customer_type IN ('institution', 'organization', 'employer') AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
              salesWonCount: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_sales_won WHERE marketer_id = ${marketingUsers.id} AND customer_type IN ('institution', 'organization', 'employer') AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
              totalRevenue: sql<number>`COALESCE((SELECT SUM(CAST(contract_amount AS DECIMAL)) FROM marketing_sales_won WHERE marketer_id = ${marketingUsers.id} AND customer_type IN ('institution', 'organization', 'employer') AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
              target: sql<number>`COALESCE((SELECT CAST(target AS DECIMAL) FROM marketing_annual_summary WHERE marketer_id = ${marketingUsers.id} AND year = ${currentYear} LIMIT 1), 0)`,
            })
            .from(marketingUsers)
            .where(eq(marketingUsers.isActive, true))
            .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName)
            .orderBy(desc(sql`COALESCE((SELECT SUM(CAST(revenue AS DECIMAL)) FROM marketing_prospects WHERE marketer_id = ${marketingUsers.id} AND stage IN ('prospect', 'opportunity', 'engagement') AND customer_type IN ('institution', 'organization', 'employer') AND EXTRACT(YEAR FROM CAST(date AS DATE)) = ${currentYear}), 0)`)),
        ]);

        res.json({
          year: currentYear,
          totalProspectsCount: Number(prospectsCount[0].count),
          totalLeadsCount: Number(leadsCount[0].count),
          totalExpectedOrdersCount: Number(expectedOrdersCount[0].count),
          totalSalesWonCount: Number(salesWonCount[0].count),
          totalRevenue: Number(totalRevenue[0].total),
          totalExpectedOrdersRevenue: Number(totalExpectedOrdersRevenue[0].total),
          bdStats: bdStats.map(stat => ({
            ...stat,
            prospectsCount: Number(stat.prospectsCount),
            leadsCount: Number(stat.leadsCount),
            expectedOrdersCount: Number(stat.expectedOrdersCount),
            salesWonCount: Number(stat.salesWonCount),
            totalRevenue: Number(stat.totalRevenue),
          })),
          isB2C: false
        });
      }
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin User Management - Delete user
  app.delete("/api/marketing/users/:id", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const id = req.params.id as string;

      // Soft delete by setting isActive to false
      const updatedUser = await db
        .update(marketingUsers)
        .set({
          isActive: false,
          updatedAt: new Date().toISOString()
        } as any)
        .where(eq(marketingUsers.id, id))
        .returning();

      if (updatedUser.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ message: "User deactivated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin Bulk Operations - Delete multiple records
  app.post("/api/marketing/admin/bulk-delete", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { type, ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Invalid IDs provided" });
      }

      let deletedCount = 0;
      const idPlaceholders = ids.map(() => '?').join(',');

      switch (type) {
        case 'leads':
          await db.delete(marketingProspects).where(sql`id IN (${idPlaceholders})`);
          deletedCount = ids.length;
          break;
        case 'sales-won':
          await db.delete(marketingSalesWon).where(sql`id IN (${idPlaceholders})`);
          deletedCount = ids.length;
          break;
        case 'expected-orders':
          await db.delete(marketingExpectedOrders).where(sql`id IN (${idPlaceholders})`);
          deletedCount = ids.length;
          break;
        case 'prospects':
          await db.delete(marketingProspects).where(sql`id IN (${idPlaceholders})`);
          deletedCount = ids.length;
          break;
        case 'annual-summary':
          await db.delete(marketingAnnualSummary).where(sql`id IN (${idPlaceholders})`);
          deletedCount = ids.length;
          break;
        default:
          return res.status(400).json({ error: "Invalid type specified" });
      }

      res.json({
        message: `${deletedCount} ${type} records deleted successfully`,
        deletedCount
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin Analytics - Get detailed analytics
  app.get("/api/marketing/admin/analytics", marketingAuth, (req, res, next) => {
    const hasAccess = req.marketingUser?.role === 'admin' || 
                     req.marketingUser?.permissions?.includes('marketing.view_all') ||
                     req.marketingUser?.permissions?.includes('marketing.view_analytics');
    
    if (hasAccess) {
      next();
    } else {
      res.status(403).json({ error: "Insufficient permissions" });
    }
  }, async (req, res) => {
    try {
      const { year, quarter, month } = marketingQuerySchema.parse(req.query);
      const currentYear = year || new Date().getFullYear();
      const pipeline = (req.query.pipeline as string) || "B2B";

      // Implement data filtering for non-admin marketers
      const canViewAll = req.marketingUser?.role === 'admin' || 
                         req.marketingUser?.permissions?.includes('marketing.view_all') ||
                         req.marketingUser?.permissions?.includes('admin.view');
      const filteredMarketerId = canViewAll ? undefined : req.marketingUser?.id;

      // Build date filter conditions
      let dateFilterProspects = sql`EXTRACT(YEAR FROM CAST(${marketingProspects.date} AS DATE)) = ${currentYear}`;
      let dateFilterLeads = sql`EXTRACT(YEAR FROM CAST(${marketingLeads.date} AS DATE)) = ${currentYear}`;
      let dateFilterSalesWon = sql`EXTRACT(YEAR FROM CAST(${marketingSalesWon.createdAt} AS DATE)) = ${currentYear}`;
      let dateFilterExpectedOrders = sql`EXTRACT(YEAR FROM CAST(${marketingExpectedOrders.createdAt} AS DATE)) = ${currentYear}`;

      if (month) {
        dateFilterProspects = sql`EXTRACT(YEAR FROM CAST(${marketingProspects.date} AS DATE)) = ${currentYear} AND EXTRACT(MONTH FROM CAST(${marketingProspects.date} AS DATE)) = ${month}`;
        dateFilterLeads = sql`EXTRACT(YEAR FROM CAST(${marketingLeads.date} AS DATE)) = ${currentYear} AND EXTRACT(MONTH FROM CAST(${marketingLeads.date} AS DATE)) = ${month}`;
        dateFilterSalesWon = sql`EXTRACT(YEAR FROM CAST(${marketingSalesWon.createdAt} AS DATE)) = ${currentYear} AND EXTRACT(MONTH FROM CAST(${marketingSalesWon.createdAt} AS DATE)) = ${month}`;
        dateFilterExpectedOrders = sql`EXTRACT(YEAR FROM CAST(${marketingExpectedOrders.createdAt} AS DATE)) = ${currentYear} AND EXTRACT(MONTH FROM CAST(${marketingExpectedOrders.createdAt} AS DATE)) = ${month}`;
      }

      // Add marketer filter if applicable
      if (filteredMarketerId) {
        dateFilterProspects = and(dateFilterProspects, eq(marketingProspects.marketerId, filteredMarketerId))!;
        dateFilterLeads = and(dateFilterLeads, eq(marketingLeads.marketerId, filteredMarketerId))!;
        dateFilterSalesWon = and(dateFilterSalesWon, eq(marketingSalesWon.marketerId, filteredMarketerId))!;
        dateFilterExpectedOrders = and(dateFilterExpectedOrders, eq(marketingExpectedOrders.marketerId, filteredMarketerId))!;
      }

      // Find Marketing Department
      const mktDept = await db.select({ id: departments.id })
        .from(departments)
        .where(
          or(
            eq(departments.code, 'MRK'),
            sql`LOWER(${departments.name}) LIKE '%marketing%'`
          )
        )
        .limit(1);
      const mktDeptId = mktDept[0]?.id;

      let whereUsersBase: any = eq(marketingUsers.isActive, true);
      if (filteredMarketerId) {
        whereUsersBase = and(eq(marketingUsers.isActive, true), eq(marketingUsers.id, filteredMarketerId));
      } else if (mktDeptId) {
        whereUsersBase = and(eq(marketingUsers.isActive, true), eq(marketingUsers.departmentId, mktDeptId));
      }

      // Check granular permission checks
      const hasTopPerformersAccess = req.marketingUser?.permissions?.includes('marketing.view_top_performers') || canViewAll;
      const hasSalesWonAccess = req.marketingUser?.permissions?.includes('marketing.view_sales_won_vs_target') || canViewAll;
      const hasAnnualSummaryAccess = req.marketingUser?.permissions?.includes('marketing.view_annual_summary') || canViewAll;

      // Get conversion rates and pipeline health
      const [conversionRates, quarterlyStats, topPerformers, salesWonPerMarketer, expectedOrdersShare, monthlyTrends, bdStats] = await Promise.all([
        // 1. Conversion rates across pipeline
        (async () => {
          if (pipeline === 'B2C') {
            const [leads, registrations, bookings, converted] = await Promise.all([
              db.select({ count: count() }).from(marketingLeads).where(
                and(
                  dateFilterLeads,
                  eq(marketingLeads.customerType, 'student'),
                  eq(marketingLeads.stage, 'lead')
                )
              ),
              db.select({ count: count() }).from(marketingProspects).where(
                and(
                  dateFilterProspects,
                  eq(marketingProspects.customerType, 'student'),
                  eq(marketingProspects.stage, 'registration')
                )
              ),
              db.select({ count: count() }).from(marketingProspects).where(
                and(
                  dateFilterProspects,
                  eq(marketingProspects.customerType, 'student'),
                  eq(marketingProspects.stage, 'booking')
                )
              ),
              db.select({ count: count() }).from(marketingSalesWon).where(
                and(
                  dateFilterSalesWon,
                  eq(marketingSalesWon.customerType, 'student')
                )
              ),
            ]);

            const lCount = Number(leads[0]?.count) || 0;
            const rCount = Number(registrations[0]?.count) || 0;
            const bCount = Number(bookings[0]?.count) || 0;
            const cCount = Number(converted[0]?.count) || 0;
            const total = lCount + rCount + bCount + cCount;

            return [
              { stage: 'lead', count: lCount, percentage: total ? Number(((lCount * 100) / total).toFixed(2)) : 0 },
              { stage: 'prospect_registration', count: rCount, percentage: total ? Number(((rCount * 100) / total).toFixed(2)) : 0 },
              { stage: 'prospect_booking', count: bCount, percentage: total ? Number(((bCount * 100) / total).toFixed(2)) : 0 },
              { stage: 'converted', count: cCount, percentage: total ? Number(((cCount * 100) / total).toFixed(2)) : 0 },
            ];
          } else {
            const [leads, prospects] = await Promise.all([
              db.select({ count: count() }).from(marketingLeads).where(dateFilterLeads),
              db.select({ stage: marketingProspects.stage, count: count() })
                .from(marketingProspects)
                .where(and(
                  dateFilterProspects,
                  inArray(marketingProspects.stage, ['prospect', 'opportunity', 'engagement'])
                ))
                .groupBy(marketingProspects.stage)
            ]);

            const total = (Number(leads[0].count) || 0) + prospects.reduce((acc, p) => acc + Number(p.count), 0);

            return [
              { stage: 'lead', count: Number(leads[0].count), percentage: total ? Number(((Number(leads[0].count) * 100) / total).toFixed(2)) : 0 },
              ...prospects.map(p => ({
                stage: p.stage,
                count: Number(p.count),
                percentage: total ? Number(((Number(p.count) * 100) / total).toFixed(2)) : 0
              }))
            ];
          }
        })(),

        // 2. Quarterly performance
        (async () => {
          if (pipeline === 'B2C') {
            const leads = await db.select({ count: count() }).from(marketingLeads).where(
              and(dateFilterLeads, eq(marketingLeads.customerType, 'student'))
            );
            const salesWon = await db.select({ count: count() }).from(marketingSalesWon).where(
              and(dateFilterSalesWon, eq(marketingSalesWon.customerType, 'student'))
            );
            return [{
              quarter: 'Current',
              leadsCount: Number(leads[0].count),
              salesWonTotal: Number(salesWon[0].count) || 0,
            }];
          } else {
            const leads = await db.select({ count: count() }).from(marketingLeads).where(dateFilterLeads);
            const salesWon = await db.select({ total: sql<number>`SUM(CAST(${marketingSalesWon.contractAmount} AS DECIMAL))` }).from(marketingSalesWon).where(dateFilterSalesWon);
            return [{
              quarter: 'Current',
              leadsCount: Number(leads[0].count),
              salesWonTotal: Number(salesWon[0].total) || 0,
            }];
          }
        })(),

        // 3. Top performers - Weighted scoring system
        (async () => {
          if (!hasTopPerformersAccess) return [];

          if (pipeline === 'B2C') {
            return db
              .select({
                marketerId: marketingUsers.id,
                marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
                salesWonAmount: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_prospects WHERE marketer_id = ${marketingUsers.id} AND customer_type = 'student' AND stage = 'prospect_registration' AND EXTRACT(YEAR FROM CAST(date AS DATE)) = ${currentYear}), 0)`,
                expectedOrdersAmount: sql<number>`0`,
                leadsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_leads WHERE marketer_id = ${marketingUsers.id} AND customer_type = 'student' AND stage = 'lead' AND EXTRACT(YEAR FROM CAST(date AS DATE)) = ${currentYear}), 0)`,
                totalProspectsHandled: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_prospects WHERE marketer_id = ${marketingUsers.id} AND customer_type = 'student' AND EXTRACT(YEAR FROM CAST(date AS DATE)) = ${currentYear}), 0)`,
                target: sql<number>`COALESCE(${marketingAnnualSummary.bookingTarget}, 0)`,
                commissionPercentage: sql<number>`COALESCE(${marketingAnnualSummary.commissionPercentage}, 5)`,
                bookingTarget: sql<number>`COALESCE(${marketingAnnualSummary.bookingTarget}, 0)`,
                registrationsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_prospects WHERE marketer_id = ${marketingUsers.id} AND customer_type = 'student' AND stage = 'prospect_registration' AND EXTRACT(YEAR FROM CAST(date AS DATE)) = ${currentYear}), 0)`,
                bookingsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_prospects WHERE marketer_id = ${marketingUsers.id} AND customer_type = 'student' AND stage = 'prospect_booking' AND EXTRACT(YEAR FROM CAST(date AS DATE)) = ${currentYear}), 0)`,
              })
              .from(marketingUsers)
              .leftJoin(marketingAnnualSummary, and(
                eq(marketingAnnualSummary.marketerId, marketingUsers.id),
                eq(marketingAnnualSummary.year, currentYear)
              ))
              .where(whereUsersBase)
              .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName, marketingAnnualSummary.bookingTarget, marketingAnnualSummary.commissionPercentage)
              .limit(10);
          } else {
            return db
              .select({
                marketerId: marketingUsers.id,
                marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
                salesWonAmount: sql<number>`COALESCE((SELECT SUM(CAST(${marketingSalesWon.contractAmount} AS DECIMAL)) FROM marketing_sales_won WHERE marketer_id = ${marketingUsers.id} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
                expectedOrdersAmount: sql<number>`COALESCE((SELECT SUM(CAST(${marketingExpectedOrders.revenue} AS DECIMAL)) FROM marketing_expected_orders WHERE marketer_id = ${marketingUsers.id} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
                leadsCount: sql<number>`COALESCE(COUNT(CASE WHEN ${marketingProspects.stage} = 'lead' THEN 1 END), 0)`,
                totalProspectsHandled: sql<number>`COALESCE(COUNT(${marketingProspects.id}), 0)`,
                target: sql<number>`COALESCE(CAST(${marketingAnnualSummary.expectedTarget} AS DECIMAL), CAST(${marketingAnnualSummary.revisedTarget} AS DECIMAL), CAST(${marketingAnnualSummary.target} AS DECIMAL), 0)`,
                registrationTarget: sql<number>`0`,
                bookingTarget: sql<number>`0`,
                registrationsCount: sql<number>`0`,
                bookingsCount: sql<number>`0`,
              })
              .from(marketingUsers)
              .leftJoin(marketingProspects, and(
                eq(marketingProspects.marketerId, marketingUsers.id),
                sql`EXTRACT(YEAR FROM CAST(${marketingProspects.date} AS DATE)) = ${currentYear}`
              ))
              .leftJoin(marketingAnnualSummary, and(
                eq(marketingAnnualSummary.marketerId, marketingUsers.id),
                eq(marketingAnnualSummary.year, currentYear)
              ))
              .where(whereUsersBase)
              .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName, marketingAnnualSummary.expectedTarget, marketingAnnualSummary.revisedTarget, marketingAnnualSummary.target)
              .limit(10);
          }
        })(),

        // 4. Sales Won Per Marketer - Real data with actual targets
        (async () => {
          if (!hasSalesWonAccess) return [];

          if (pipeline === 'B2C') {
            return db
              .select({
                marketerId: marketingUsers.id,
                marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
                salesWon: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_prospects WHERE marketer_id = ${marketingUsers.id} AND customer_type = 'student' AND stage = 'prospect_booking' AND EXTRACT(YEAR FROM CAST(date AS DATE)) = ${currentYear}), 0)`,
                target: sql<number>`COALESCE(${marketingAnnualSummary.bookingTarget}, 0)`,
              })
              .from(marketingUsers)
              .leftJoin(marketingAnnualSummary, and(
                eq(marketingAnnualSummary.marketerId, marketingUsers.id),
                eq(marketingAnnualSummary.year, currentYear)
              ))
              .where(whereUsersBase)
              .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName, marketingAnnualSummary.bookingTarget);
          } else {
            return db
              .select({
                marketerId: marketingUsers.id,
                marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
                salesWon: sql<number>`COALESCE(SUM(CAST(${marketingSalesWon.contractAmount} AS DECIMAL)), 0)`,
                target: sql<number>`COALESCE(CAST(${marketingAnnualSummary.expectedTarget} AS DECIMAL), CAST(${marketingAnnualSummary.revisedTarget} AS DECIMAL), CAST(${marketingAnnualSummary.target} AS DECIMAL), 0)`,
              })
              .from(marketingUsers)
              .leftJoin(marketingSalesWon, and(
                eq(marketingSalesWon.marketerId, marketingUsers.id),
                month ? sql`EXTRACT(YEAR FROM CAST(${marketingSalesWon.createdAt} AS DATE)) = ${currentYear} AND EXTRACT(MONTH FROM CAST(${marketingSalesWon.createdAt} AS DATE)) = ${month}` : sql`EXTRACT(YEAR FROM CAST(${marketingSalesWon.createdAt} AS DATE)) = ${currentYear}`
              ))
              .leftJoin(marketingAnnualSummary, and(
                eq(marketingAnnualSummary.marketerId, marketingUsers.id),
                eq(marketingAnnualSummary.year, currentYear)
              ))
              .where(whereUsersBase)
              .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName, marketingAnnualSummary.expectedTarget, marketingAnnualSummary.revisedTarget, marketingAnnualSummary.target)
              .orderBy(desc(sql`COALESCE(SUM(CAST(${marketingSalesWon.contractAmount} AS DECIMAL)), 0)`));
          }
        })(),

        // 5. Expected Orders Share
        (async () => {
          if (pipeline === 'B2C') {
            return []; // Completely removed from B2C
          } else {
            return db
              .select({
                marketerId: marketingUsers.id,
                marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
                expectedOrders: sql<number>`COALESCE(SUM(CAST(${marketingExpectedOrders.revenue} AS DECIMAL)), 0)`,
              })
              .from(marketingUsers)
              .leftJoin(marketingExpectedOrders, and(
                eq(marketingExpectedOrders.marketerId, marketingUsers.id),
                month ? sql`EXTRACT(YEAR FROM CAST(${marketingExpectedOrders.createdAt} AS DATE)) = ${currentYear} AND EXTRACT(MONTH FROM CAST(${marketingExpectedOrders.createdAt} AS DATE)) = ${month}` : sql`EXTRACT(YEAR FROM CAST(${marketingExpectedOrders.createdAt} AS DATE)) = ${currentYear}`
              ))
              .where(whereUsersBase)
              .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName)
              .orderBy(desc(sql`COALESCE(SUM(CAST(${marketingExpectedOrders.revenue} AS DECIMAL)), 0)`));
          }
        })(),

        // 6. Monthly Trends
        (async () => {
          if (pipeline === 'B2C') {
            return db
              .select({
                month: sql<string>`month_label`,
                leads: sql<number>`COALESCE(leads_count, 0)`,
                salesWon: sql<number>`COALESCE(registrations_count, 0)`,
                expectedOrders: sql<number>`COALESCE(bookings_count, 0)`,
              })
              .from(sql`(
                WITH monthly_counts AS (
                  SELECT 
                    TO_CHAR(CAST(date AS DATE), 'Mon YYYY') as month_label,
                    COUNT(*) as leads_count,
                    0 as registrations_count,
                    0 as bookings_count
                  FROM marketing_leads 
                  WHERE customer_type = 'student' AND stage = 'lead'
                    AND EXTRACT(YEAR FROM CAST(date AS DATE)) >= ${currentYear - 1}
                    ${filteredMarketerId ? sql`AND marketer_id = ${filteredMarketerId}` : sql``}
                  GROUP BY TO_CHAR(CAST(date AS DATE), 'Mon YYYY')
                  
                  UNION ALL
                  
                  SELECT 
                    TO_CHAR(CAST(date AS DATE), 'Mon YYYY') as month_label,
                    0 as leads_count,
                    COUNT(*) as registrations_count,
                    0 as bookings_count
                  FROM marketing_prospects 
                  WHERE customer_type = 'student' AND stage = 'prospect_registration'
                    AND EXTRACT(YEAR FROM CAST(date AS DATE)) >= ${currentYear - 1}
                    ${filteredMarketerId ? sql`AND marketer_id = ${filteredMarketerId}` : sql``}
                  GROUP BY TO_CHAR(CAST(date AS DATE), 'Mon YYYY')
                  
                  UNION ALL
                  
                  SELECT 
                    TO_CHAR(CAST(date AS DATE), 'Mon YYYY') as month_label,
                    0 as leads_count,
                    0 as registrations_count,
                    COUNT(*) as bookings_count
                  FROM marketing_prospects 
                  WHERE customer_type = 'student' AND stage = 'prospect_booking'
                    AND EXTRACT(YEAR FROM CAST(date AS DATE)) >= ${currentYear - 1}
                    ${filteredMarketerId ? sql`AND marketer_id = ${filteredMarketerId}` : sql``}
                  GROUP BY TO_CHAR(CAST(date AS DATE), 'Mon YYYY')
                )
                SELECT 
                  month_label,
                  SUM(leads_count) as leads_count,
                  SUM(registrations_count) as registrations_count,
                  SUM(bookings_count) as bookings_count
                FROM monthly_counts
                GROUP BY month_label
                ORDER BY month_label
              ) as combined_data`);
          } else {
            return db
              .select({
                month: sql<string>`month_label`,
                leads: sql<number>`COALESCE(leads_amount, 0)`,
                salesWon: sql<number>`COALESCE(sales_won_amount, 0)`,
                expectedOrders: sql<number>`COALESCE(expected_orders_amount, 0)`,
              })
              .from(sql`(
                WITH monthly_data AS (
                  SELECT 
                    TO_CHAR(CAST(date AS DATE), 'Mon YYYY') as month_label,
                    COALESCE(SUM(CAST(revenue AS DECIMAL)), 0) as leads_amount,
                    0 as sales_won_amount,
                    0 as expected_orders_amount
                  FROM marketing_prospects 
                  WHERE stage IN ('prospect', 'opportunity', 'engagement', 'lead') 
                    AND EXTRACT(YEAR FROM CAST(date AS DATE)) >= ${currentYear - 1}
                    ${filteredMarketerId ? sql`AND marketer_id = ${filteredMarketerId}` : sql``}
                  GROUP BY TO_CHAR(CAST(date AS DATE), 'Mon YYYY')
                  
                  UNION ALL
                  
                  SELECT 
                    TO_CHAR(CAST(created_at AS DATE), 'Mon YYYY') as month_label,
                    0 as leads_amount,
                    COALESCE(SUM(CAST(contract_amount AS DECIMAL)), 0) as sales_won_amount,
                    0 as expected_orders_amount
                  FROM marketing_sales_won 
                  WHERE EXTRACT(YEAR FROM CAST(created_at AS DATE)) >= ${currentYear - 1}
                    ${filteredMarketerId ? sql`AND marketer_id = ${filteredMarketerId}` : sql``}
                  GROUP BY TO_CHAR(CAST(created_at AS DATE), 'Mon YYYY')
                  
                  UNION ALL
                  
                  SELECT 
                    TO_CHAR(CAST(created_at AS DATE), 'Mon YYYY') as month_label,
                    0 as leads_amount,
                    0 as sales_won_amount,
                    COALESCE(SUM(CAST(revenue AS DECIMAL)), 0) as expected_orders_amount
                  FROM marketing_expected_orders 
                  WHERE EXTRACT(YEAR FROM CAST(created_at AS DATE)) >= ${currentYear - 1}
                    ${filteredMarketerId ? sql`AND marketer_id = ${filteredMarketerId}` : sql``}
                  GROUP BY TO_CHAR(CAST(created_at AS DATE), 'Mon YYYY')
                )
                SELECT 
                  month_label,
                  SUM(leads_amount) as leads_amount,
                  SUM(sales_won_amount) as sales_won_amount,
                  SUM(expected_orders_amount) as expected_orders_amount
                FROM monthly_data
                GROUP BY month_label
                ORDER BY month_label
              ) as combined_data`);
          }
        })(),

        // 7. BD Stats for Annual Summary Table
        (async () => {
          if (!hasAnnualSummaryAccess) return [];

          if (pipeline === 'B2C') {
            return db
              .select({
                marketerId: marketingUsers.id,
                bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
                prospectsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_prospects WHERE marketer_id = ${marketingUsers.id} AND customer_type = 'student' AND stage = 'prospect_booking' AND EXTRACT(YEAR FROM CAST(date AS DATE)) = ${currentYear}), 0)`,
                leadsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_prospects WHERE marketer_id = ${marketingUsers.id} AND customer_type = 'student' AND stage = 'prospect_registration' AND EXTRACT(YEAR FROM CAST(date AS DATE)) = ${currentYear}), 0)`,
                salesWonAmount: sql<number>`COALESCE((SELECT SUM(CAST(revenue AS DECIMAL)) FROM marketing_prospects WHERE marketer_id = ${marketingUsers.id} AND customer_type = 'student' AND stage = 'prospect_registration' AND EXTRACT(YEAR FROM CAST(date AS DATE)) = ${currentYear}), 0)`,
                expectedOrdersAmount: sql<number>`COALESCE((SELECT COUNT(*) FROM marketing_sales_won WHERE marketer_id = ${marketingUsers.id} AND customer_type = 'student' AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
                totalRevenue: sql<number>`0`,
                target: sql<number>`COALESCE(${marketingAnnualSummary.bookingTarget}, 0)`,
                bookingTarget: sql<number>`COALESCE(${marketingAnnualSummary.bookingTarget}, 0)`,
                commissionPercentage: sql<number>`COALESCE(${marketingAnnualSummary.commissionPercentage}, 5)`,
              })
              .from(marketingUsers)
              .leftJoin(marketingAnnualSummary, and(
                eq(marketingAnnualSummary.marketerId, marketingUsers.id),
                eq(marketingAnnualSummary.year, currentYear)
              ))
              .where(whereUsersBase)
              .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName, marketingAnnualSummary.bookingTarget, marketingAnnualSummary.commissionPercentage);
          } else {
            return db
              .select({
                marketerId: marketingUsers.id,
                bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
                prospectsCount: sql<number>`COALESCE(COUNT(CASE WHEN ${marketingProspects.stage} IN ('prospect', 'opportunity', 'engagement') THEN 1 END), 0)`,
                leadsCount: sql<number>`COALESCE(COUNT(CASE WHEN ${marketingProspects.stage} = 'lead' THEN 1 END), 0)`,
                salesWonAmount: sql<number>`COALESCE((SELECT SUM(CAST(${marketingSalesWon.contractAmount} AS DECIMAL)) FROM marketing_sales_won WHERE marketer_id = ${marketingUsers.id} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
                expectedOrdersAmount: sql<number>`COALESCE((SELECT SUM(CAST(${marketingExpectedOrders.revenue} AS DECIMAL)) FROM marketing_expected_orders WHERE marketer_id = ${marketingUsers.id} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
                totalRevenue: sql<number>`COALESCE((SELECT SUM(CAST(${marketingSalesWon.contractAmount} AS DECIMAL)) FROM marketing_sales_won WHERE marketer_id = ${marketingUsers.id} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
                target: sql<number>`COALESCE(CAST(${marketingAnnualSummary.expectedTarget} AS DECIMAL), CAST(${marketingAnnualSummary.revisedTarget} AS DECIMAL), CAST(${marketingAnnualSummary.target} AS DECIMAL), 0)`,
                bookingTarget: sql<number>`0`,
              })
              .from(marketingUsers)
              .leftJoin(marketingProspects, and(
                eq(marketingProspects.marketerId, marketingUsers.id),
                sql`EXTRACT(YEAR FROM CAST(${marketingProspects.date} AS DATE)) = ${currentYear}`
              ))
              .leftJoin(marketingAnnualSummary, and(
                eq(marketingAnnualSummary.marketerId, marketingUsers.id),
                eq(marketingAnnualSummary.year, currentYear)
              ))
              .where(whereUsersBase)
              .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName, marketingAnnualSummary.expectedTarget, marketingAnnualSummary.revisedTarget, marketingAnnualSummary.target)
              .orderBy(desc(sql`COALESCE(SUM(CAST(${marketingProspects.revenue} AS DECIMAL)), 0)`));
          }
        })()
      ]);


      res.json({
        year: currentYear,
        conversionRates: conversionRates.map(rate => ({
          ...rate,
          count: Number(rate.count),
          percentage: Number(rate.percentage)
        })),
        quarterlyStats: quarterlyStats.map(stat => ({
          ...stat,
          leadsCount: Number(stat.leadsCount),
          salesWonTotal: Number(stat.salesWonTotal)
        })),
        topPerformers: topPerformers.map(performer => {
          if (pipeline === 'B2C') {
            const salesWonAmount = Number(performer.salesWonAmount) || 0; // Converted Students count
            const bookingsCount = Number((performer as any).bookingsCount) || 0; // Exam Bookings count
            const leadsCount = Number(performer.leadsCount) || 0; // Student Leads count
            const bookingTarget = Number((performer as any).bookingTarget) || 0;
            
            const target = bookingTarget;
            const achievementRate = target > 0 ? ((bookingsCount / target) * 100) : 0;
            
            // Weighted score: Converted 40%, Bookings 25%, Leads 20%, Achievement Rate 15%
            const maxSalesWon = Math.max(...topPerformers.map(p => Number(p.salesWonAmount) || 0), 1);
            const maxBooking = Math.max(...topPerformers.map(p => Number((p as any).bookingsCount) || 0), 1);
            const maxLeads = Math.max(...topPerformers.map(p => Number(p.leadsCount) || 0), 1);
            const maxConversion = Math.max(...topPerformers.map(p => {
              const target = Number((p as any).bookingTarget) || 0;
              const bookings = Number((p as any).bookingsCount) || 0;
              return target > 0 ? ((bookings / target) * 100) : 0;
            }), 1);
            
            const salesWonScore = (salesWonAmount / maxSalesWon) * 40;
            const bookingScore = (bookingsCount / maxBooking) * 25;
            const leadsScore = (leadsCount / maxLeads) * 20;
            const conversionScore = (achievementRate / maxConversion) * 15;
            const weightedScore = salesWonScore + bookingScore + leadsScore + conversionScore;
            
            return {
              ...performer,
              salesWonAmount,
              expectedOrdersAmount: bookingsCount,
              leadsCount,
              target,
              conversionRate: Math.round(achievementRate * 100) / 100,
              weightedScore: Math.round(weightedScore * 100) / 100,
              totalRevenue: salesWonAmount
            };
          } else {
            const salesWonAmount = Number(performer.salesWonAmount);
            const expectedOrdersAmount = Number(performer.expectedOrdersAmount);
            const leadsCount = Number(performer.leadsCount);
            const totalProspectsHandled = Number(performer.totalProspectsHandled);
            const target = Number(performer.target);

            const conversionRate = target > 0 ? ((salesWonAmount / target) * 100) :
              (totalProspectsHandled > 0 ? (salesWonAmount > 0 ? 100 : 0) : 0);

            const maxSalesWon = Math.max(...topPerformers.map(p => Number(p.salesWonAmount)), 1);
            const maxExpectedOrders = Math.max(...topPerformers.map(p => Number(p.expectedOrdersAmount)), 1);
            const maxLeads = Math.max(...topPerformers.map(p => Number(p.leadsCount)), 1);
            const maxConversion = Math.max(...topPerformers.map(p => {
              const target = Number(p.target);
              const salesWon = Number(p.salesWonAmount);
              const prospects = Number(p.totalProspectsHandled);
              return target > 0 ? ((salesWon / target) * 100) : (prospects > 0 ? (salesWon > 0 ? 100 : 0) : 0);
            }), 1);

            const salesWonScore = (salesWonAmount / maxSalesWon) * 40;
            const expectedOrdersScore = (expectedOrdersAmount / maxExpectedOrders) * 25;
            const leadsScore = (leadsCount / maxLeads) * 20;
            const conversionScore = (conversionRate / maxConversion) * 15;

            const weightedScore = salesWonScore + expectedOrdersScore + leadsScore + conversionScore;

            return {
              ...performer,
              salesWonAmount,
              expectedOrdersAmount,
              leadsCount,
              totalProspectsHandled,
              target,
              conversionRate: Math.round(conversionRate * 100) / 100,
              weightedScore: Math.round(weightedScore * 100) / 100,
              totalRevenue: salesWonAmount
            };
          }
        }).sort((a, b) => b.weightedScore - a.weightedScore),
        salesWonPerMarketer: salesWonPerMarketer.length > 0 ? salesWonPerMarketer.map(marketer => {
          const salesWon = Number(marketer.salesWon);
          const target = Number(marketer.target);
          return {
            marketerId: marketer.marketerId,
            marketerName: marketer.marketerName,
            salesWon,
            target,
            achievementRate: target > 0 ? Math.round((salesWon / target) * 100) : 0
          };
        }) : [],
        expectedOrdersShare: (() => {
          if (expectedOrdersShare.length === 0) return [];
          const totalOrders = expectedOrdersShare.reduce((sum, marketer) => sum + Number(marketer.expectedOrders), 0);
          const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];
          return expectedOrdersShare.map((marketer, index) => {
            const expectedOrders = Number(marketer.expectedOrders);
            return {
              ...marketer,
              expectedOrders,
              percentage: totalOrders > 0 ? Math.round((expectedOrders / totalOrders) * 100) : 0,
              color: colors[index % colors.length]
            };
          });
        })(),
        monthlyTrends: monthlyTrends.length > 0 ? monthlyTrends.map(trend => ({
          ...trend,
          leads: Number(trend.leads),
          salesWon: Number(trend.salesWon),
          expectedOrders: Number(trend.expectedOrders)
        })) : (() => {
          const months = [];
          const currentDate = new Date();
          for (let i = 5; i >= 0; i--) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            months.push({
              month: date.toLocaleString('default', { month: 'short' }) + ' ' + date.getFullYear(),
              leads: 0,
              salesWon: 0,
              expectedOrders: 0
            });
          }
          return months;
        })(),
        bdStats: bdStats.map(stat => {
          if (pipeline === 'B2C') {
            const registrations = Number(stat.leadsCount);
            const bookings = Number(stat.prospectsCount);
            const regRevenue = Number(stat.salesWonAmount);
            const regTarget = Number(stat.target);
            const bookingTarget = Number((stat as any).bookingTarget) || 0;
            const commissionPercentage = Number((stat as any).commissionPercentage || 5);
            const commissionEarned = regRevenue * (commissionPercentage / 100);

            return {
              marketerId: stat.marketerId,
              bdName: stat.bdName,
              registrations,
              bookings,
              regRevenue,
              regTarget,
              bookingTarget,
              commissionPercentage,
              commissionEarned,
              achievementRate: regTarget > 0 ? Math.round((registrations / regTarget) * 100) : 0,
              
              // Frontend Compatibility Keys
              leadsCount: registrations,
              prospectsCount: bookings,
              salesWonAmount: regRevenue,
              expectedOrdersAmount: Number(stat.expectedOrdersAmount) || 0
            };
          } else {
            return {
              ...stat,
              totalRevenue: Number(stat.totalRevenue),
              target: Number(stat.target),
              salesWonAmount: Number(stat.salesWonAmount),
              expectedOrdersAmount: Number(stat.expectedOrdersAmount),
            };
          }
        })
      });

      // Analytics data processed successfully
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Lost Projects Routes
  app.get("/api/marketing/lost-projects", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { page = 1, limit = 50, year, marketerId, search, quarter, sectorId } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;
      const currentYear = year ? parseInt(year as string) : new Date().getFullYear();

      let whereCondition: any = sql`1=1`;

      // Filter by year
      whereCondition = sql`EXTRACT(YEAR FROM CAST(${marketingLostProjects.lostDate} AS DATE)) = ${currentYear}`;

      const canViewAll = req.marketingUser?.role === 'admin' || req.marketingUser?.permissions?.includes('marketing.view_all');
      // Filter by marketer if provided (those with view_all can filter, regular users see only their own)
      if (marketerId) {
        whereCondition = sql`${whereCondition} AND ${marketingLostProjects.marketerId} = ${marketerId}`;
      } else if (!canViewAll) {
        whereCondition = sql`${whereCondition} AND ${marketingLostProjects.marketerId} = ${req.marketingUser!.id}`;
      }

      // Filter by search term
      if (search) {
        whereCondition = sql`${whereCondition} AND (
          ${marketingLostProjects.organisationName} ILIKE ${'%' + search + '%'} OR
          ${marketingLostProjects.lostReason} ILIKE ${'%' + search + '%'}
        )`;
      }

      // Filter by quarter
      if (quarter) {
        const quarterMap: { [key: string]: string } = {
          'Q1': '01,02,03',
          'Q2': '04,05,06',
          'Q3': '07,08,09',
          'Q4': '10,11,12'
        };
        const months = quarterMap[quarter as string];
        if (months) {
          whereCondition = sql`${whereCondition} AND EXTRACT(MONTH FROM CAST(${marketingLostProjects.lostDate} AS DATE)) IN (${months})`;
        }
      }

      // Filter by sector
      if (sectorId) {
        whereCondition = sql`${whereCondition} AND ${marketingLostProjects.sector} = ${sectorId}`;
      }

      const [lostProjects, totalCount] = await Promise.all([
        db
          .select({
            id: marketingLostProjects.id,
            organisationName: marketingLostProjects.organisationName,
            sector: sql<string>`COALESCE(${marketingSectors.name}, ${marketingLostProjects.sector})`,
            product: marketingLostProjects.product,
            revenue: marketingLostProjects.revenue,
            expectedQuarter: marketingLostProjects.expectedQuarter,
            comments: marketingLostProjects.comments,
            marketerId: marketingLostProjects.marketerId,
            contactPerson: marketingLostProjects.contactPerson,
            contactNumber: marketingLostProjects.contactNumber,
            contactEmail: marketingLostProjects.contactEmail,
            lostReason: marketingLostProjects.lostReason,
            lostDate: marketingLostProjects.lostDate,
            sourceCampaignId: marketingLostProjects.sourceCampaignId,
            canRevive: marketingLostProjects.canRevive,
            createdAt: marketingLostProjects.createdAt,
            updatedAt: marketingLostProjects.updatedAt,
            marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
            marketerEmail: marketingUsers.email,
          })
          .from(marketingLostProjects)
          .leftJoin(marketingUsers, eq(marketingLostProjects.marketerId, marketingUsers.id))
          .leftJoin(marketingSectors, sql`${marketingLostProjects.sector}::text = ${marketingSectors.id}::text`)
          .where(whereCondition)
          .orderBy(desc(marketingLostProjects.lostDate))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ count: count() })
          .from(marketingLostProjects)
          .where(whereCondition)
      ]);

      res.json({
        lostProjects,
        totalCount: totalCount[0].count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount[0].count / limitNum)
      });
    } catch (error) {
      console.error("Error fetching lost projects:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Revive lost project (move back to prospects)
  app.put("/api/marketing/lost-projects/:id/revive", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { stage = 'prospect' } = req.body;

      // Get the lost project
      const lostProject = await db
        .select()
        .from(marketingLostProjects)
        .where(eq(marketingLostProjects.id, id as string))
        .limit(1);

      if (lostProject.length === 0) {
        return res.status(404).json({ error: "Lost project not found" });
      }

      const project = lostProject[0];

      // Check permissions (admin or project owner)
      if (req.marketingUser?.role !== 'admin' && project.marketerId !== req.marketingUser?.id) {
        return res.status(403).json({ error: "Unauthorized to revive this project" });
      }

      // Create new prospect entry
      const newProspect = await db
        .insert(marketingProspects)
        .values({
          date: project.lostDate,
          client: project.organisationName,
          contactPerson: project.contactPerson || 'Contact Person',
          contactNumber: project.contactNumber || 'N/A',
          contactEmail: project.contactEmail || 'contact@example.com',
          currentVendor: '',
          remarks: project.comments || `Revived from lost projects. Original lost reason: ${project.lostReason}`,
          revenue: project.revenue || '0',
          stage: stage as any,
          marketerId: project.marketerId,
          sectorId: project.sector,
        } as any)
        .returning();

      // Delete from lost projects
      await db
        .delete(marketingLostProjects)
        .where(eq(marketingLostProjects.id, id as string));

      res.json({
        message: "Project revived successfully",
        prospect: newProspect[0]
      });
    } catch (error) {
      console.error("Error reviving lost project:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update lost project reason
  app.put("/api/marketing/lost-projects/:id", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { lostReason } = req.body;

      if (!lostReason || lostReason.trim().length < 10) {
        return res.status(400).json({ error: "Lost reason must be at least 10 characters long" });
      }

      // Check if project exists and user has permission
      const existingProject = await db
        .select()
        .from(marketingLostProjects)
        .where(eq(marketingLostProjects.id, id))
        .limit(1);

      if (existingProject.length === 0) {
        return res.status(404).json({ error: "Lost project not found" });
      }

      // Check permissions (admin or project owner)
      if (req.marketingUser?.role !== 'admin' && existingProject[0].marketerId !== req.marketingUser?.id) {
        return res.status(403).json({ error: "Unauthorized to update this project" });
      }

      const updatedProject = await db
        .update(marketingLostProjects)
        .set({
          lostReason,
          updatedAt: new Date().toISOString()
        })
        .where(eq(marketingLostProjects.id, id))
        .returning();

      res.json({
        message: "Lost reason updated successfully",
        lostProject: updatedProject[0]
      });
    } catch (error) {
      console.error("Error updating lost project:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Phase 2: Public Event Registration ────────────────────────────────────
  // Unauthenticated: Students register at events via a public URL (/register/:slug)
  app.post("/api/events/register", async (req, res) => {
    try {
      const {
        firstName, lastName, email, phone,
        institution, qualificationOfInterest, issuesReported,
        eventSlug, ambassadorId,
      } = req.body;

      if (!firstName || !lastName || !email || !institution || !qualificationOfInterest || !eventSlug) {
        return res.status(400).json({ error: "Required fields: firstName, lastName, email, institution, qualificationOfInterest, eventSlug" });
      }

      // Resolve the event campaign by slug
      const { campaigns } = await import("../../shared/crmSchema");
      const eventRows = await db
        .select()
        .from(campaigns)
        .where(eq((campaigns as any).registrationSlug, eventSlug))
        .limit(1);

      if (eventRows.length === 0) {
        return res.status(404).json({ error: "Event not found" });
      }

      const event = eventRows[0] as any;

      // Auto-route: map qualification → department
      const QUALIFICATION_DEPT_MAP: Record<string, string> = {
        "CFFE": "Forensic Investigations",
        "CPA":  "Accountancy",
        "CS":   "Corporate Secretarial",
        "CIFA": "Finance",
        "CCP":  "Credit Management",
        "CISSE": "Information Systems",
        "CQP":  "Quality Management",
        "ATD":  "Accounting Technicians",
        "DDMA": "Data Management",
        "DCNSA": "Computer Networks",
        "CAMS": "Accounting and Management",
      };

      const deptName = QUALIFICATION_DEPT_MAP[qualificationOfInterest] || "General";
      const deptRows = await db
        .select({ id: departments.id })
        .from(departments)
        .where(sql`LOWER(${departments.name}) LIKE LOWER(${`%${deptName}%`})`)
        .limit(1);

      const resolvedDeptId = deptRows[0]?.id ?? null;

      // Insert as a new marketing lead (B2C student pipeline)
      const now = new Date().toISOString();
      const newLead = await db
        .insert(marketingLeads)
        .values({
          date: now.split("T")[0],
          client: `${firstName} ${lastName}`,
          contactPerson: `${firstName} ${lastName}`,
          contactNumber: phone || "",
          contactEmail: email,
          customerType: "student",
          stage: "lead",
          institution,
          qualificationOfInterest,
          issuesReported: issuesReported || null,
          isBooking: false,
          isEscalatedToCase: false,
          sourceCampaignId: event.id,
          marketerId: ambassadorId || event.ambassadorId || null,
          createdAt: now,
          updatedAt: now,
        } as any)
        .returning();

      return res.status(201).json({
        message: "Registration successful",
        lead: { id: newLead[0].id, routedToDepartment: deptName },
      });
    } catch (error) {
      console.error("Event registration error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Phase 3: Forensic Issues Feed (BD Dashboard) ────────────────────────
  app.get("/api/marketing/events/:id/forensic-feed", marketingAuth, async (req, res) => {
    try {
      const eventId = req.params.id;

      // Get all leads for this event that reported issues
      const leads = await db
        .select()
        .from(marketingLeads)
        .where(
          and(
            sql`${marketingLeads.sourceCampaignId} = ${eventId}`,
            isNotNull(marketingLeads.issuesReported)
          )
        )
        .orderBy(desc(marketingLeads.createdAt));

      // Group by institution
      const grouped: Record<string, any[]> = {};
      for (const lead of leads) {
        const inst = lead.institution || "Independent / Unknown";
        if (!grouped[inst]) grouped[inst] = [];
        grouped[inst].push(lead);
      }

      // Convert to array format for easy frontend mapping
      const result = Object.entries(grouped).map(([institution, issues]) => ({
        institution,
        issues,
      }));

      // Sort alphabetically by institution
      result.sort((a, b) => a.institution.localeCompare(b.institution));

      return res.json({ feed: result });
    } catch (error) {
      console.error("Forensic feed fetch error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Phase 4: Forensic Escalation (Convert Issue to Case) ──────────────────
  app.post("/api/marketing/leads/:id/escalate-to-case", marketingAuth, async (req, res) => {
    try {
      const leadId = String(req.params.id);
      const { cases, auditLogs } = await import("../../shared/crmSchema");

      // 1. Fetch the lead
      const leadRows = await db.select().from(marketingLeads).where(eq(marketingLeads.id, leadId)).limit(1);
      if (leadRows.length === 0) return res.status(404).json({ error: "Lead not found" });
      const lead = leadRows[0];

      if (lead.isEscalatedToCase) {
        return res.status(400).json({ error: "Lead is already escalated to a case" });
      }

      // 2. Generate case number
      const prefix = "KASNEB";
      const yearShort = new Date().getFullYear().toString().slice(-2);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
      const caseNumber = `${prefix}-${yearShort}-${random}`;

      // 3. Create the case
      const [newCase] = await db.insert(cases).values({
        caseNumber,
        title: `Forensic Issue: ${lead.client} (${lead.institution || "Unknown Institution"})`,
        description: `Escalated from Marketing Event Forensic Feed.\n\nReported Issue:\n${lead.issuesReported || "No qualitative feedback provided."}\n\nClient Details:\nEmail: ${lead.contactEmail}\nPhone: ${lead.contactNumber}`,
        stakeholderId: (lead as any)["stakeholderId"] || null,
        status: "open",
        priority: "high",
        channel: "marketing_forensic",
        createdBy: req.marketingUser?.id,
        metadata: {
          sourceLeadId: lead.id,
          sourceCampaignId: lead.sourceCampaignId,
          qualification: lead.qualificationOfInterest
        }
      } as any).returning();

      // 4. Update the lead
      await db.update(marketingLeads).set({
        isEscalatedToCase: true,
        escalatedCaseId: newCase.id,
        updatedAt: new Date().toISOString()
      }).where(eq(marketingLeads.id, leadId));

      // 5. Audit log
      await db.insert(auditLogs).values({
        userId: req.marketingUser?.id,
        userEmail: req.marketingUser?.email,
        action: "ESCALATE_LEAD_TO_CASE",
        module: "Marketing",
        entityType: "Lead",
        entityId: lead.id,
        newValues: { caseId: newCase.id, caseNumber: newCase.caseNumber },
        createdAt: new Date().toISOString()
      } as any);

      res.json({ message: "Escalated successfully", caseId: newCase.id, caseNumber: newCase.caseNumber });
    } catch (error) {
      console.error("Escalation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Phase 2: Real-Time Ambassador Evaluation Report (PDF) ─────────────────
  // Admin-only endpoint. Returns a branded PDF with per-ambassador metrics.
  app.get("/api/marketing/ambassador-report", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { from, to, marketerId: filterMarketerId } = req.query as Record<string, string>;

      // Build date filter
      const conditions: any[] = [];
      if (from)              conditions.push(sql`${marketingLeads.createdAt} >= ${from}`);
      if (to)                conditions.push(sql`${marketingLeads.createdAt} <= ${to}`);
      if (filterMarketerId)  conditions.push(eq(marketingLeads.marketerId, filterMarketerId));
      conditions.push(eq(marketingLeads.customerType, "student"));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Aggregate leads per marketer
      const rows = await db
        .select({
          marketerId:       marketingLeads.marketerId,
          totalLeads:       count(),
          newRegistrations: sql<number>`SUM(CASE WHEN ${marketingLeads.isBooking} = false AND ${marketingLeads.stage} = 'converted' THEN 1 ELSE 0 END)`,
          bookings:         sql<number>`SUM(CASE WHEN ${marketingLeads.isBooking} = true THEN 1 ELSE 0 END)`,
        })
        .from(marketingLeads)
        .where(whereClause as any)
        .groupBy(marketingLeads.marketerId);

      // Enrich with marketer names
      const marketerIds = rows.map(r => r.marketerId).filter(Boolean) as string[];
      let marketerMap: Record<string, string> = {};
      if (marketerIds.length > 0) {
        const mktrs = await db
          .select({ id: marketingUsers.id, firstName: marketingUsers.firstName, lastName: marketingUsers.lastName })
          .from(marketingUsers)
          .where(inArray(marketingUsers.id, marketerIds));
        marketerMap = Object.fromEntries(mktrs.map(m => [m.id, `${m.firstName} ${m.lastName}`]));
      }

      // Assume a fixed commission rate (configurable in future)
      const COMMISSION_PER_REGISTRATION = 500; // KES

      const reportData = rows.map(r => ({
        ambassadorName:   marketerMap[r.marketerId!] || "Unknown",
        totalLeads:       Number(r.totalLeads),
        newRegistrations: Number(r.newRegistrations),
        bookings:         Number(r.bookings),
        commissionEarned: Number(r.newRegistrations) * COMMISSION_PER_REGISTRATION,
      }));

      // Generate PDF using pdfkit
      const PDFDocument = (await import("pdfkit")).default;
      const path = await import("path");
      const fs   = await import("fs");

      const doc  = new PDFDocument({ margin: 50 });
      const logoPath = path.resolve(process.cwd(), "client/public/logo.webp");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="ambassador-report-${Date.now()}.pdf"`);
      doc.pipe(res);

      // ── PDF Header ──────────────────────────────────────────────────────────
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 40, { width: 60 });
      }
      doc.fontSize(18).fillColor("#004E98").text("KASNEB CRM", 120, 48);
      doc.fontSize(10).fillColor("#64748b").text("Marketing Intelligence — Ambassador Evaluation Report", 120, 70);
      doc.moveDown(0.5);
      doc.fontSize(8).fillColor("#94a3b8").text(
        `Report Period: ${from || "All time"} → ${to || "Present"}  |  Generated: ${new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}`,
        50
      );
      doc.moveTo(50, doc.y + 8).lineTo(550, doc.y + 8).strokeColor("#e2e8f0").stroke();
      doc.moveDown(1.5);

      // ── Table Header ────────────────────────────────────────────────────────
      const cols = [180, 80, 100, 80, 100];
      const headers = ["Ambassador", "Leads", "Registrations", "Bookings", "Commission (KES)"];
      let xPos = 50;
      doc.fontSize(8).fillColor("#1e293b");
      headers.forEach((h, i) => {
        doc.text(h, xPos, doc.y, { width: cols[i], align: i === 0 ? "left" : "right" });
        xPos += cols[i];
      });
      doc.moveDown(0.4);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#e2e8f0").stroke();
      doc.moveDown(0.4);

      // ── Table Rows ──────────────────────────────────────────────────────────
      let totalReg = 0, totalBook = 0, totalComm = 0;
      reportData.forEach(row => {
        xPos = 50;
        const rowY = doc.y;
        const vals = [
          row.ambassadorName,
          String(row.totalLeads),
          String(row.newRegistrations),
          String(row.bookings),
          `KES ${row.commissionEarned.toLocaleString()}`,
        ];
        doc.fontSize(8).fillColor("#475569");
        vals.forEach((v, i) => {
          doc.text(v, xPos, rowY, { width: cols[i], align: i === 0 ? "left" : "right" });
          xPos += cols[i];
        });
        doc.moveDown(0.6);
        totalReg  += row.newRegistrations;
        totalBook += row.bookings;
        totalComm += row.commissionEarned;
      });

      // ── Totals Row ──────────────────────────────────────────────────────────
      doc.moveDown(0.4);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#004E98").lineWidth(1).stroke();
      doc.moveDown(0.4);
      xPos = 50;
      const totals = ["TOTALS", "", String(totalReg), String(totalBook), `KES ${totalComm.toLocaleString()}`];
      doc.fontSize(8).fillColor("#004E98").font("Helvetica-Bold");
      totals.forEach((v, i) => {
        doc.text(v, xPos, doc.y, { width: cols[i], align: i === 0 ? "left" : "right" });
        xPos += cols[i];
      });

      // ── Footer ──────────────────────────────────────────────────────────────
      doc.moveDown(3);
      doc.fontSize(7).fillColor("#94a3b8").font("Helvetica")
        .text("This report is generated in real-time from the KASNEB CRM system. Commission figures are based on confirmed new student registrations only.", 50, undefined, { align: "center", width: 500 });

      doc.end();
    } catch (error) {
      console.error("Ambassador report error:", error);
      return res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // CIC Pipeline Endpoint
  app.get("/api/cic/pipeline", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { stage, search, sort, page = "1", limit = "20" } = req.query;
      let pipeline_type = req.query.pipeline_type as string | undefined;
      if (pipeline_type === "undefined") pipeline_type = undefined;

      // Ensure user has access and enforce bdType rules
      const bdType = req.marketingUser?.bdType || "both";
      let effectivePipelineType = pipeline_type;

      if (bdType === "b2b" && pipeline_type !== "all") effectivePipelineType = "b2b";
      else if (bdType === "b2c" && pipeline_type !== "all") effectivePipelineType = "b2c";
      else if (pipeline_type === "all" || !pipeline_type) effectivePipelineType = undefined; // fetch both

      let query: any = db.select({ lead: cicLeads }).from(cicLeads);

      const conditions: any[] = [];
      if (effectivePipelineType) {
        conditions.push(eq(cicLeads.pipelineType, String(effectivePipelineType) as any));
      }
      
      if (stage) {
        // Handle unified stages if passed
        if (stage === "underwriting") {
          conditions.push(inArray(cicLeads.stage, ["quote_underwriting", "proposal_underwriting"]));
        } else if (stage === "post_sale") {
          conditions.push(inArray(cicLeads.stage, ["active", "dormant"]));
        } else {
          conditions.push(eq(cicLeads.stage, String(stage) as any));
        }
      }

      if (search) {
        conditions.push(or(
          ilike(cicLeads.firstName, `%${search}%`),
          ilike(cicLeads.lastName, `%${search}%`),
          ilike(cicLeads.organisationName, `%${search}%`),
          ilike(cicLeads.leadRef, `%${search}%`)
        ));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Quick implementation of sorting
      if (sort === 'newest') query = query.orderBy(desc(cicLeads.createdAt));
      else if (sort === 'oldest') query = query.orderBy(asc(cicLeads.createdAt));
      else query = query.orderBy(desc(cicLeads.createdAt));

      const allResults = await query;
      const total = allResults.length;
      
      const p = parseInt(String(page)) || 1;
      const l = parseInt(String(limit)) || 20;
      const paginatedResults = allResults.slice((p - 1) * l, p * l).map((r: any) => r.lead);

      // Mapping to B2C/B2B cards with full schema fields
      const leads = paginatedResults.map((r: any) => {
        const lead = r.lead || r; // Fix object wrapping
        const daysInStage = Math.round((Date.now() - new Date(lead.updatedAt || lead.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
        if (lead.pipelineType === 'b2c') {
          return {
            leadId: lead.id,
            contactName: [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '',
            phone: lead.phone || '',
            productLine: lead.productLine,
            sumInsuredEstimateKes: lead.estimatedAnnualPremium ? Number(lead.estimatedAnnualPremium) : null,
            assignedAgentName: null,
            sourceChannel: lead.sourceChannel,
            daysInCurrentStage: daysInStage,
            pipelineStage: lead.stage,
            nationalIdNumber: lead.nationalIdNumber,
            county: lead.county,
            coverType: lead.coverType,
            quotedPremiumKes: lead.quotedPremiumKes ? Number(lead.quotedPremiumKes) : null,
            underwritingDecision: lead.underwritingDecision,
            dateOfUnderwritingDecision: lead.dateOfUnderwritingDecision,
            lapseReason: lead.lapseReason,
            dormantSinceDate: lead.dormantSinceDate,
            renewalCampaignStatus: lead.renewalCampaignStatus,
            policyStartDate: lead.policyStartDateProposed, // pre-policy
            paymentMethod: lead.paymentMethod,
          };
        } else {
          return {
            leadId: lead.id,
            organisationName: lead.organisationName || [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '',
            schemeType: lead.productLine,
            totalLives: lead.totalMemberCount || lead.groupSize || 0,
            groupPremiumEstimateKes: lead.estimatedAnnualPremium ? Number(lead.estimatedAnnualPremium) : null,
            relationshipOfficerName: lead.relationshipOfficerAssigned || null,
            daysInCurrentStage: daysInStage,
            pipelineStage: lead.stage,
            county: lead.county,
            sectorIndustry: lead.sectorIndustry,
            priorLossRatio: lead.priorLossRatio,
            underwritingDecision: lead.underwritingDecision,
            dateOfUnderwritingDecision: lead.dateOfUnderwritingDecision,
            premiumCollectionMethod: lead.paymentMethod,
            lastPremiumReceivedDate: lead.updatedAt, // Mocked for now since policies table is separate
            outstandingPremiumKes: null,
            renewalDueDate: lead.policyEndDateProposed,
          };
        }
      });

      // Calculate Summary
      let totalPremium = 0;
      let wonCount = 0;
      let totalCount = allResults.length;
      const leadsByStage: Record<string, number> = {};

      for (const r of allResults as any[]) {
        if (r.lead.estimatedAnnualPremium) totalPremium += Number(r.lead.estimatedAnnualPremium);
        if (r.lead.stage === 'policy_issued') wonCount++;
        leadsByStage[r.lead.stage as string] = (leadsByStage[r.lead.stage as string] || 0) + 1;
      }

      res.json({
        leads,
        total,
        page: p,
        pages: Math.ceil(total / l),
        marketingDeptConfigured: true,
        summary: {
          totalLeadsThisMonth: total,
          leadsByStage,
          conversionRateLeadToPolicy: totalCount > 0 ? Math.round((wonCount / totalCount) * 100) : 0,
          totalPremiumInPipelineKes: totalPremium
        }
      });
    } catch (error) {
      console.error("Fetch CIC pipeline error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

}

// Helper function to convert data to CSV
function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(','))
  ].join('\n');

  return csvContent;
}
