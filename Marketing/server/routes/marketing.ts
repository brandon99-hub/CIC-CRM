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
        const lost = getStat('lost');
        const dormant = getStat('dormant');
        
        const activeProspectsCount = prospect.count;
        const activeProspectsRevenue = prospect.total;
        const targetAchievement = target > 0 ? (policy.total / target * 100) : 0;

        res.json({
          year: currentYear,
          prospectsCount: prospect.count,
          leadsCount: lead.count,
          expectedOrdersCount: quote.count,
          salesWonCount: policy.count,
          totalRevenue: policy.total,
          expectedOrdersRevenue: quote.total,
          registeredCount: activeProspectsCount, // kept for backward compatibility if needed by old components briefly
          registeredRevenue: activeProspectsRevenue, // kept for backward compat
          target: target,
          revisedTarget: revisedTarget,
          expectedTarget: expectedTarget,
          bookingTarget: bookingTarget,
          commissionPercentage,
          targetAchievement: Math.round(targetAchievement * 100) / 100,
          isB2C: true,
          b2cStats: {
            leads: { count: lead.count },
            registered: { count: activeProspectsCount, value: activeProspectsRevenue },
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
        
        const activeProspectsCount = prospect.count + proposal.count + active.count;
        const targetAchievement = target > 0 ? (policy.total / target * 100) : 0;

        res.json({
          year: currentYear,
          prospectsCount: activeProspectsCount + policy.count,
          leadsCount: lead.count,
          expectedOrdersCount: proposal.count + active.count,
          salesWonCount: policy.count,
          totalRevenue: policy.total,
          expectedOrdersRevenue: proposal.total + active.total,
          target: target,
          revisedTarget: revisedTarget,
          expectedTarget: expectedTarget,
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

  // Full record update for CIC Pipeline
  app.patch("/api/marketing/pipeline/:id", marketingAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      
      const updated = await db.update(cicLeads)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(cicLeads.id, id as string))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ error: "Lead not found" });
      }

      res.json({ success: true, lead: updated[0] });
    } catch (error) {
      console.error("Lead update error:", error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  // Delete for CIC Pipeline
  app.delete("/api/marketing/pipeline/:id", marketingAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const deleted = await db.delete(cicLeads)
        .where(eq(cicLeads.id, id as string))
        .returning();

      if (deleted.length === 0) {
        return res.status(404).json({ error: "Lead not found" });
      }

      res.json({ success: true, message: "Lead deleted successfully" });
    } catch (error) {
      console.error("Lead deletion error:", error);
      res.status(500).json({ error: "Failed to delete lead" });
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
          prospect: [],
          quote_underwriting: [],
          proposal_underwriting: [],
          active: [],
          policy_issued: [],
          lost: [],
          dormant: [],
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
        quote_underwriting: isB2C ? leads.filter(l => l.stage === 'quote_underwriting') : [],
        proposal_underwriting: !isB2C ? leads.filter(l => l.stage === 'proposal_underwriting') : [],
        active: !isB2C ? leads.filter(l => l.stage === 'active') : [],
        policy_issued: leads.filter(l => l.stage === 'policy_issued'),
        lost: leads.filter(l => l.stage === 'lost'),
        dormant: leads.filter(l => l.stage === 'dormant'),
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
        { stage: 'Prospect', actual: oppRev, weighted: Math.round(oppRev * 0.35), prob: 35 },
        { stage: 'Underwriting', actual: engRev, weighted: Math.round(engRev * 0.65), prob: 65 },
        { stage: 'Active / Pending', actual: expRev, weighted: Math.round(expRev * 0.85), prob: 85 },
        { stage: 'Policy Issued', actual: wonRev, weighted: wonRev, prob: 100 },
      ];

      // Simplified targets
      const quarterlyTarget = 500000;
      const bookingTarget = 100;

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
      const { id, newStatus } = z.object({
        id: z.string(),
        newStatus: z.string(),
        currentStatus: z.string().optional()
      }).parse(req.body);

      // Fetch the item
      const items = await db.select().from(cicLeads).where(eq(cicLeads.id, id)).limit(1);
      if (items.length === 0) return res.status(404).json({ error: "Item not found" });
      const item = items[0];

      // Check permissions
      if (req.marketingUser?.role !== 'admin' && 
          !req.marketingUser?.permissions?.includes('marketing.view_all') && 
          item.assignedToUserId !== req.marketingUser?.id) {
        return res.status(403).json({ error: "Insufficient permissions to move this item" });
      }

      await db.update(cicLeads).set({ stage: newStatus, updatedAt: new Date().toISOString() }).where(eq(cicLeads.id, id));

      res.json({ success: true, message: `Moved to ${newStatus}` });
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

      // Find the designated marketing department
      const marketingDept = await db.select().from(departments).where(eq(departments.isMarketingDepartment, true)).limit(1);
      const marketingDeptId = marketingDept.length > 0 ? marketingDept[0].id : null;

      // Filter by pipeline type
      const pipelineFilter = isB2C ? eq(cicLeads.pipelineType, "b2c") : eq(cicLeads.pipelineType, "b2b");
      
      const baseConditions = [
        marketingDeptId ? eq(cicLeads.departmentId, marketingDeptId) : sql`1=1`,
        pipelineFilter,
        sql`EXTRACT(YEAR FROM CAST(${cicLeads.createdAt} AS DATE)) = ${currentYear}`
      ];
      
      if (filteredMarketerId) {
        baseConditions.push(eq(cicLeads.assignedToUserId, filteredMarketerId));
      }

      const stageStats = await db
        .select({
          stage: cicLeads.stage,
          count: count(),
          total: sql<number>`COALESCE(SUM(CAST(REGEXP_REPLACE(COALESCE(${cicLeads.estimatedAnnualPremium}, '0'), '[^0-9.]', '', 'g') AS DECIMAL)), 0)`
        })
        .from(cicLeads)
        .where(and(...baseConditions))
        .groupBy(cicLeads.stage);

      const statsMap = stageStats.reduce((acc, curr) => {
        acc[curr.stage] = { count: Number(curr.count), total: Number(curr.total) };
        return acc;
      }, {} as Record<string, { count: number, total: number }>);

      const getStat = (stage: string) => statsMap[stage] || { count: 0, total: 0 };

      // User performance
      const bdStatsQuery = await db
        .select({
          marketerId: marketingUsers.id,
          bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
          leadsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM cic_leads WHERE assigned_to_user_id = ${marketingUsers.id} AND stage = 'lead' AND pipeline_type = ${isB2C ? "'b2c'" : "'b2b'"} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
          prospectsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM cic_leads WHERE assigned_to_user_id = ${marketingUsers.id} AND stage IN (${isB2C ? "'prospect', 'quote_underwriting'" : "'prospect', 'proposal_underwriting'"}) AND pipeline_type = ${isB2C ? "'b2c'" : "'b2b'"} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
          expectedOrdersCount: sql<number>`COALESCE((SELECT COUNT(*) FROM cic_leads WHERE assigned_to_user_id = ${marketingUsers.id} AND stage = ${isB2C ? "'policy_issued'" : "'active'"} AND pipeline_type = ${isB2C ? "'b2c'" : "'b2b'"} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
          salesWonCount: sql<number>`COALESCE((SELECT COUNT(*) FROM cic_leads WHERE assigned_to_user_id = ${marketingUsers.id} AND stage = 'policy_issued' AND pipeline_type = ${isB2C ? "'b2c'" : "'b2b'"} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
          totalRevenue: sql<number>`COALESCE((SELECT SUM(CAST(REGEXP_REPLACE(COALESCE(estimated_annual_premium, '0'), '[^0-9.]', '', 'g') AS DECIMAL)) FROM cic_leads WHERE assigned_to_user_id = ${marketingUsers.id} AND stage = 'policy_issued' AND pipeline_type = ${isB2C ? "'b2c'" : "'b2b'"} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
          target: sql<number>`COALESCE((SELECT CAST(target AS DECIMAL) FROM marketing_annual_summary WHERE marketer_id = ${marketingUsers.id} AND year = ${currentYear} LIMIT 1), 0)`,
        })
        .from(marketingUsers)
        .where(eq(marketingUsers.isActive, true))
        .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName);

      if (isB2C) {
        const lead = getStat('lead');
        const prospect = getStat('prospect');
        const quote = getStat('quote_underwriting');
        const policy = getStat('policy_issued');
        
        const registeredCount = prospect.count;
        const registeredRevenue = prospect.total;

        res.json({
          year: currentYear,
          totalProspectsCount: prospect.count,
          totalLeadsCount: lead.count,
          totalExpectedOrdersCount: quote.count,
          totalSalesWonCount: policy.count,
          totalRevenue: policy.total,
          totalExpectedOrdersRevenue: quote.total,
          bdStats: bdStatsQuery.map(stat => ({
            ...stat,
            prospectsCount: Number(stat.prospectsCount),
            leadsCount: Number(stat.leadsCount),
            expectedOrdersCount: Number(stat.expectedOrdersCount),
            salesWonCount: Number(stat.salesWonCount),
            totalRevenue: Number(stat.totalRevenue),
          })),
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

        res.json({
          year: currentYear,
          totalProspectsCount: prospectsCount,
          totalLeadsCount: lead.count,
          totalExpectedOrdersCount: active.count,
          totalSalesWonCount: policy.count + active.count,
          totalRevenue: actualRevenue,
          totalExpectedOrdersRevenue: active.total,
          bdStats: bdStatsQuery.map(stat => ({
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
      console.error("Admin stats error:", error);
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
      const isB2C = pipeline === 'B2C';

      // Implement data filtering for non-admin marketers
      const canViewAll = req.marketingUser?.role === 'admin' || 
                         req.marketingUser?.permissions?.includes('marketing.view_all') ||
                         req.marketingUser?.permissions?.includes('admin.view');
      const filteredMarketerId = canViewAll ? undefined : req.marketingUser?.id;

      // Find Marketing Department
      const marketingDept = await db.select().from(departments).where(eq(departments.isMarketingDepartment, true)).limit(1);
      const marketingDeptId = marketingDept.length > 0 ? marketingDept[0].id : null;

      const pipelineFilter = isB2C ? eq(cicLeads.pipelineType, "b2c") : eq(cicLeads.pipelineType, "b2b");
      
      let baseConditions = [
        marketingDeptId ? eq(cicLeads.departmentId, marketingDeptId) : sql`1=1`,
        pipelineFilter,
        sql`EXTRACT(YEAR FROM CAST(${cicLeads.createdAt} AS DATE)) = ${currentYear}`
      ];
      if (filteredMarketerId) baseConditions.push(eq(cicLeads.assignedToUserId, filteredMarketerId));
      if (month) baseConditions.push(sql`EXTRACT(MONTH FROM CAST(${cicLeads.createdAt} AS DATE)) = ${month}`);

      let whereUsersBase: any = eq(marketingUsers.isActive, true);
      if (filteredMarketerId) {
        whereUsersBase = and(eq(marketingUsers.isActive, true), eq(marketingUsers.id, filteredMarketerId));
      } else if (marketingDeptId) {
        whereUsersBase = and(eq(marketingUsers.isActive, true), eq(marketingUsers.departmentId, marketingDeptId));
      }

      const hasTopPerformersAccess = req.marketingUser?.permissions?.includes('marketing.view_top_performers') || canViewAll;
      const hasSalesWonAccess = req.marketingUser?.permissions?.includes('marketing.view_sales_won_vs_target') || canViewAll;
      const hasAnnualSummaryAccess = req.marketingUser?.permissions?.includes('marketing.view_annual_summary') || canViewAll;

      const [conversionRates, quarterlyStats, topPerformers, salesWonPerMarketer, expectedOrdersShare, monthlyTrends, bdStats] = await Promise.all([
        // 1. Conversion rates
        (async () => {
          const stageCounts = await db.select({
            stage: cicLeads.stage,
            count: count()
          }).from(cicLeads).where(and(...baseConditions)).groupBy(cicLeads.stage);

          const total = stageCounts.reduce((acc, curr) => acc + Number(curr.count), 0);
          
          if (isB2C) {
            const lCount = Number(stageCounts.find(s => s.stage === 'lead')?.count || 0);
            const rCount = Number(stageCounts.find(s => s.stage === 'prospect')?.count || 0);
            const bCount = Number(stageCounts.find(s => s.stage === 'quote_underwriting')?.count || 0);
            const cCount = Number(stageCounts.find(s => s.stage === 'policy_issued')?.count || 0);
            return [
              { stage: 'lead', count: lCount, percentage: total ? Number(((lCount * 100) / total).toFixed(2)) : 0 },
              { stage: 'prospect_registration', count: rCount, percentage: total ? Number(((rCount * 100) / total).toFixed(2)) : 0 },
              { stage: 'prospect_booking', count: bCount, percentage: total ? Number(((bCount * 100) / total).toFixed(2)) : 0 },
              { stage: 'converted', count: cCount, percentage: total ? Number(((cCount * 100) / total).toFixed(2)) : 0 },
            ];
          } else {
            return stageCounts.map(p => ({
              stage: p.stage,
              count: Number(p.count),
              percentage: total ? Number(((Number(p.count) * 100) / total).toFixed(2)) : 0
            }));
          }
        })(),

        // 2. Quarterly performance
        (async () => {
          const leads = await db.select({ count: count() }).from(cicLeads).where(and(...baseConditions, eq(cicLeads.stage, 'lead')));
          const salesWon = await db.select({ 
            count: count(), 
            total: sql<number>`SUM(CAST(REGEXP_REPLACE(COALESCE(${cicLeads.estimatedAnnualPremium}, '0'), '[^0-9.]', '', 'g') AS DECIMAL))` 
          }).from(cicLeads).where(and(...baseConditions, inArray(cicLeads.stage, ['policy_issued', 'active'])));
          
          return [{
            quarter: 'Current',
            leadsCount: Number(leads[0].count),
            salesWonTotal: isB2C ? (Number(salesWon[0].count) || 0) : (Number(salesWon[0].total) || 0),
          }];
        })(),

        // 3. Top performers
        (async () => {
          if (!hasTopPerformersAccess) return [];
          const topPerformersQuery = await db.select({
            marketerId: marketingUsers.id,
            marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
            salesWonAmount: sql<number>`COALESCE((SELECT SUM(CAST(REGEXP_REPLACE(COALESCE(estimated_annual_premium, '0'), '[^0-9.]', '', 'g') AS DECIMAL)) FROM cic_leads WHERE assigned_to_user_id = ${marketingUsers.id} AND stage IN ('policy_issued', 'active') AND pipeline_type = ${isB2C ? "'b2c'" : "'b2b'"} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
            expectedOrdersAmount: sql<number>`COALESCE((SELECT SUM(CAST(REGEXP_REPLACE(COALESCE(estimated_annual_premium, '0'), '[^0-9.]', '', 'g') AS DECIMAL)) FROM cic_leads WHERE assigned_to_user_id = ${marketingUsers.id} AND stage = ${isB2C ? "'policy_issued'" : "'active'"} AND pipeline_type = ${isB2C ? "'b2c'" : "'b2b'"} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
            leadsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM cic_leads WHERE assigned_to_user_id = ${marketingUsers.id} AND stage = 'lead' AND pipeline_type = ${isB2C ? "'b2c'" : "'b2b'"} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
            totalProspectsHandled: sql<number>`COALESCE((SELECT COUNT(*) FROM cic_leads WHERE assigned_to_user_id = ${marketingUsers.id} AND pipeline_type = ${isB2C ? "'b2c'" : "'b2b'"} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
            target: sql<number>`COALESCE(CAST(${marketingAnnualSummary.target} AS DECIMAL), 0)`,
          })
          .from(marketingUsers)
          .leftJoin(marketingAnnualSummary, and(
            eq(marketingAnnualSummary.marketerId, marketingUsers.id),
            eq(marketingAnnualSummary.year, currentYear)
          ))
          .where(whereUsersBase)
          .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName, marketingAnnualSummary.target)
          .limit(10);
          
          return topPerformersQuery.map(p => {
             const salesWonAmount = Number(p.salesWonAmount);
             const expectedOrdersAmount = Number(p.expectedOrdersAmount);
             const leadsCount = Number(p.leadsCount);
             const totalProspectsHandled = Number(p.totalProspectsHandled);
             const target = Number(p.target);

             const conversionRate = target > 0 ? ((salesWonAmount / target) * 100) :
               (totalProspectsHandled > 0 ? (salesWonAmount > 0 ? 100 : 0) : 0);

             const maxSalesWon = Math.max(...topPerformersQuery.map(tp => Number(tp.salesWonAmount)), 1);
             const maxExpectedOrders = Math.max(...topPerformersQuery.map(tp => Number(tp.expectedOrdersAmount)), 1);
             const maxLeads = Math.max(...topPerformersQuery.map(tp => Number(tp.leadsCount)), 1);
             const maxConversion = Math.max(...topPerformersQuery.map(tp => {
               const tgt = Number(tp.target);
               const sw = Number(tp.salesWonAmount);
               const prspcts = Number(tp.totalProspectsHandled);
               return tgt > 0 ? ((sw / tgt) * 100) : (prspcts > 0 ? (sw > 0 ? 100 : 0) : 0);
             }), 1);

             const salesWonScore = (salesWonAmount / maxSalesWon) * 40;
             const expectedOrdersScore = (expectedOrdersAmount / maxExpectedOrders) * 25;
             const leadsScore = (leadsCount / maxLeads) * 20;
             const conversionScore = (conversionRate / maxConversion) * 15;

             const weightedScore = salesWonScore + expectedOrdersScore + leadsScore + conversionScore;

             return {
               ...p,
               salesWonAmount,
               expectedOrdersAmount,
               leadsCount,
               totalProspectsHandled,
               target,
               conversionRate: Math.round(conversionRate * 100) / 100,
               weightedScore: Math.round(weightedScore * 100) / 100,
               totalRevenue: salesWonAmount
             };
          }).sort((a, b) => b.weightedScore - a.weightedScore);
        })(),

        // 4. Sales Won Per Marketer
        (async () => {
          if (!hasSalesWonAccess) return [];
          const q = await db.select({
            marketerId: marketingUsers.id,
            marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
            salesWon: sql<number>`COALESCE((SELECT SUM(CAST(REGEXP_REPLACE(COALESCE(estimated_annual_premium, '0'), '[^0-9.]', '', 'g') AS DECIMAL)) FROM cic_leads WHERE assigned_to_user_id = ${marketingUsers.id} AND stage IN ('policy_issued', 'active') AND pipeline_type = ${isB2C ? "'b2c'" : "'b2b'"} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
            target: sql<number>`COALESCE(CAST(${marketingAnnualSummary.target} AS DECIMAL), 0)`,
          })
          .from(marketingUsers)
          .leftJoin(marketingAnnualSummary, and(
            eq(marketingAnnualSummary.marketerId, marketingUsers.id),
            eq(marketingAnnualSummary.year, currentYear)
          ))
          .where(whereUsersBase)
          .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName, marketingAnnualSummary.target);
          return q;
        })(),

        // 5. Expected Orders Share
        (async () => {
          if (isB2C) return [];
          const q = await db.select({
            marketerId: marketingUsers.id,
            marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
            expectedOrders: sql<number>`COALESCE((SELECT SUM(CAST(REGEXP_REPLACE(COALESCE(estimated_annual_premium, '0'), '[^0-9.]', '', 'g') AS DECIMAL)) FROM cic_leads WHERE assigned_to_user_id = ${marketingUsers.id} AND stage = 'active' AND pipeline_type = 'b2b' AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
          })
          .from(marketingUsers)
          .where(whereUsersBase);
          return q;
        })(),

        // 6. Monthly Trends (Dummy data or simply return empty array with structured months)
        (async () => {
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

        // 7. BD Stats for Annual Summary Table
        (async () => {
          if (!hasAnnualSummaryAccess) return [];
          return db.select({
            marketerId: marketingUsers.id,
            bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
            prospectsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM cic_leads WHERE assigned_to_user_id = ${marketingUsers.id} AND stage IN ('prospect', 'quote_underwriting', 'proposal_underwriting') AND pipeline_type = ${isB2C ? "'b2c'" : "'b2b'"} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
            leadsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM cic_leads WHERE assigned_to_user_id = ${marketingUsers.id} AND stage = 'lead' AND pipeline_type = ${isB2C ? "'b2c'" : "'b2b'"} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
            salesWonAmount: sql<number>`COALESCE((SELECT SUM(CAST(REGEXP_REPLACE(COALESCE(estimated_annual_premium, '0'), '[^0-9.]', '', 'g') AS DECIMAL)) FROM cic_leads WHERE assigned_to_user_id = ${marketingUsers.id} AND stage IN ('policy_issued', 'active') AND pipeline_type = ${isB2C ? "'b2c'" : "'b2b'"} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
            expectedOrdersAmount: sql<number>`COALESCE((SELECT SUM(CAST(REGEXP_REPLACE(COALESCE(estimated_annual_premium, '0'), '[^0-9.]', '', 'g') AS DECIMAL)) FROM cic_leads WHERE assigned_to_user_id = ${marketingUsers.id} AND stage = ${isB2C ? "'policy_issued'" : "'active'"} AND pipeline_type = ${isB2C ? "'b2c'" : "'b2b'"} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
            totalRevenue: sql<number>`COALESCE((SELECT SUM(CAST(REGEXP_REPLACE(COALESCE(estimated_annual_premium, '0'), '[^0-9.]', '', 'g') AS DECIMAL)) FROM cic_leads WHERE assigned_to_user_id = ${marketingUsers.id} AND stage IN ('policy_issued', 'active') AND pipeline_type = ${isB2C ? "'b2c'" : "'b2b'"} AND EXTRACT(YEAR FROM CAST(created_at AS DATE)) = ${currentYear}), 0)`,
            target: sql<number>`COALESCE(CAST(${marketingAnnualSummary.target} AS DECIMAL), 0)`,
          })
          .from(marketingUsers)
          .leftJoin(marketingAnnualSummary, and(
            eq(marketingAnnualSummary.marketerId, marketingUsers.id),
            eq(marketingAnnualSummary.year, currentYear)
          ))
          .where(whereUsersBase)
          .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName, marketingAnnualSummary.target);
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
        topPerformers,
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
        monthlyTrends,
        bdStats: bdStats.map(stat => {
          return {
            ...stat,
            totalRevenue: Number(stat.totalRevenue),
            target: Number(stat.target),
            salesWonAmount: Number(stat.salesWonAmount),
            expectedOrdersAmount: Number(stat.expectedOrdersAmount),
          };
        })
      });

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
      const bdType = req.marketingUser?.role === 'admin' ? 'both' : (req.marketingUser?.bdType || "both");
      let effectivePipelineType = pipeline_type;

      if (bdType === "b2b" && pipeline_type !== "all") effectivePipelineType = "b2b";
      else if (bdType === "b2c" && pipeline_type !== "all") effectivePipelineType = "b2c";
      else if (pipeline_type === "all" || !pipeline_type) effectivePipelineType = undefined; // fetch both

      let query: any = db.select({ 
        lead: cicLeads,
        assignedAgentName: sql<string>`${marketingUsers.firstName} || ' ' || ${marketingUsers.lastName}`
      })
      .from(cicLeads)
      .leftJoin(marketingUsers, eq(cicLeads.assignedToUserId, marketingUsers.id));

      const conditions: any[] = [];
      const baseConditions: any[] = [];
      if (effectivePipelineType) {
        conditions.push(eq(cicLeads.pipelineType, String(effectivePipelineType) as any));
        baseConditions.push(eq(cicLeads.pipelineType, String(effectivePipelineType) as any));
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
        const searchCondition = or(
          ilike(cicLeads.firstName, `%${search}%`),
          ilike(cicLeads.lastName, `%${search}%`),
          ilike(cicLeads.organisationName, `%${search}%`),
          ilike(cicLeads.leadRef, `%${search}%`)
        );
        conditions.push(searchCondition);
        baseConditions.push(searchCondition);
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
      const paginatedResults = allResults.slice((p - 1) * l, p * l);

      // Mapping to B2C/B2B cards with full schema fields
      const leads = paginatedResults.map((r: any) => {
        const lead = r.lead || r; // Fix object wrapping
        const daysInStage = Math.round((Date.now() - new Date(lead.updatedAt || lead.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
        if (lead.pipelineType === 'b2c') {
          return {
            ...lead,
            leadId: lead.id,
            contactName: [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '',
            phone: lead.phone || '',
            productLine: lead.productLine,
            sumInsuredEstimateKes: lead.estimatedAnnualPremium ? Number(lead.estimatedAnnualPremium) : null,
            assignedAgentName: r.assignedAgentName || null,
            sourceChannel: lead.sourceChannel,
            daysInCurrentStage: daysInStage,
            pipelineStage: lead.stage,
            quotedPremiumKes: lead.quotedPremiumKes ? Number(lead.quotedPremiumKes) : null,
            policyStartDate: lead.policyStartDateProposed, // pre-policy
          };
        } else {
          return {
            ...lead,
            leadId: lead.id,
            organisationName: lead.organisationName || [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '',
            primaryContactName: lead.primaryContactName || [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '',
            schemeType: lead.productLine,
            totalLives: lead.totalMemberCount || lead.groupSize || 0,
            groupPremiumEstimateKes: lead.estimatedAnnualPremium ? Number(lead.estimatedAnnualPremium) : null,
            relationshipOfficerName: r.assignedAgentName || lead.relationshipOfficerAssigned || null,
            assignedAgentName: r.assignedAgentName || null,
            daysInCurrentStage: daysInStage,
            pipelineStage: lead.stage,
            lastPremiumReceivedDate: lead.updatedAt, // Mocked for now since policies table is separate
            outstandingPremiumKes: null,
            renewalDueDate: lead.policyEndDateProposed,
          };
        }
      });

      // Calculate Pipeline Valuation
      let totalPremium = 0;
      let wonCount = 0;
      let totalCount = allResults.length;

      for (const r of allResults as any[]) {
        if (r.lead.estimatedAnnualPremium) totalPremium += Number(r.lead.estimatedAnnualPremium);
        if (r.lead.stage === 'policy_issued') wonCount++;
      }

      // Calculate Summary using base conditions (ignoring active stage filter)
      const stageCountsQuery = db.select({
        stage: cicLeads.stage,
        count: count()
      })
      .from(cicLeads);

      if (baseConditions.length > 0) {
        stageCountsQuery.where(and(...baseConditions));
      }

      const stageCountsResult = await stageCountsQuery.groupBy(cicLeads.stage);
      
      const leadsByStage: Record<string, number> = {};
      for (const row of stageCountsResult) {
        let uStage = "lead";
        if (row.stage === "lead") uStage = "lead";
        else if (row.stage === "prospect") uStage = "prospect";
        else if (row.stage === "quote_underwriting" || row.stage === "proposal_underwriting") uStage = "underwriting";
        else if (row.stage === "policy_issued") uStage = "policy_issued";
        else if (row.stage === "active" || row.stage === "dormant") uStage = "post_sale";
        leadsByStage[uStage] = (leadsByStage[uStage] || 0) + Number(row.count);
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
