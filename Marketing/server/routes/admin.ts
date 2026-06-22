import type { Express } from "express";
import { db } from "../db";
import { marketingAuth, marketingAdminAuth, checkPermission } from "../middleware/marketingAuth";
import {
  systemRoles,
  systemPermissions,
  systemRolePermissions,
  departments,
  serviceCategories,
  slaRules,
  escalationChains,
  escalationSteps,
  workflowRules,
  userRoles,
  regions,
} from "../../shared/adminSchema";
import { marketingUsers } from "../../shared/schema";
import { integrationConfigs, cases } from "../../shared/crmSchema";
import { eq, and, desc, asc, sql, inArray, ne, count, not, avg } from "drizzle-orm";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import { AuditService } from "../services/audit-service";

const mailer = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === "true",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});


export function registerAdminRoutes(app: Express) {

  // ─── Roles (/api/admin/roles) ───────────────────────────────────────

  app.get("/api/admin/roles", marketingAuth, checkPermission("admin.roles.view"), async (_req, res) => {
    try {
      const roles = await db.select().from(systemRoles).where(eq(systemRoles.isActive, true)).orderBy(desc(systemRoles.createdAt));
      res.json({ roles });
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/roles", marketingAuth, marketingAdminAuth, checkPermission("admin.roles.create"), async (req, res) => {
    try {
      const { name, description, dashboards } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }
      const newRole = await db
        .insert(systemRoles)
        .values({
          name,
          description,
          dashboards: dashboards ?? []
        } as any)
        .returning();

      res.status(201).json({ role: newRole[0] });

      AuditService.logAction(req, {
        action: 'create',
        module: 'admin',
        entityType: 'role',
        entityId: newRole[0].id,
        newValues: newRole[0],
        details: `Created new role: ${name}`
      });
    } catch (error) {
      console.error("Error creating role:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/admin/roles/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.roles.edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, dashboards, isActive } = req.body;

      const updateData: any = { updatedAt: sql`now()` };
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (dashboards !== undefined) updateData.dashboards = dashboards;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updated = await db
        .update(systemRoles)
        .set(updateData)
        .where(eq(systemRoles.id, id as string))
        .returning();
      if (updated.length === 0) {
        return res.status(404).json({ error: "Role not found" });
      }

      res.json({ role: updated[0] });

      AuditService.logAction(req, {
        action: 'update',
        module: 'admin',
        entityType: 'role',
        entityId: id as string,
        newValues: updated[0],
        details: `Updated role: ${updated[0].name}`
      });
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admin/roles/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.roles.delete"), async (req, res) => {
    try {
      const { id } = req.params;

      // Protect system roles from deletion to prevent lockout
      const roleToDelete = await db.select().from(systemRoles).where(eq(systemRoles.id, id as string)).limit(1);
      if (!roleToDelete.length) {
        return res.status(404).json({ error: "Role not found" });
      }
      if (roleToDelete[0].isSystem) {
        return res.status(400).json({ error: "System roles cannot be deleted. Deactivate them instead." });
      }

      // Delete dependent records first
      await db.delete(systemRolePermissions).where(eq(systemRolePermissions.roleId, id as string));
      await db.delete(userRoles).where(eq(userRoles.roleId, id as string));

      const deleted = await db.delete(systemRoles)
        .where(eq(systemRoles.id, id as string))
        .returning();

      if (deleted.length === 0) {
        return res.status(404).json({ error: "Role not found" });
      }

      res.json({ message: "Role deleted permanently" });

      AuditService.logAction(req, {
        action: 'delete',
        module: 'admin',
        entityType: 'role',
        entityId: id as string,
        details: `Deleted role ID: ${id}`
      });
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Permissions (/api/admin/permissions) ───────────────────────────

  app.get("/api/admin/permissions", marketingAuth, checkPermission("admin.roles.view"), async (_req, res) => {
    try {
      const permissions = await db.select().from(systemPermissions).where(eq(systemPermissions.isActive, true)).orderBy(desc(systemPermissions.createdAt));
      res.json({ permissions });
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/permissions", marketingAuth, marketingAdminAuth, checkPermission("admin.roles.manage"), async (req, res) => {
    try {
      const { key, description, module } = req.body;
      if (!key || !module) {
        return res.status(400).json({ error: "Key and module are required" });
      }
      const newPermission = await db
        .insert(systemPermissions)
        .values({ key, description, module } as any)
        .returning();

      res.status(201).json({ permission: newPermission[0] });

      AuditService.logAction(req, {
        action: 'create',
        module: 'admin',
        entityType: 'permission',
        entityId: newPermission[0].id,
        newValues: newPermission[0],
        details: `Created new permission: ${key} in module ${module}`
      });
    } catch (error) {
      console.error("Error creating permission:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/admin/permissions/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.roles.manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body, updatedAt: sql`now()` };
      const updated = await db
        .update(systemPermissions)
        .set(updateData)
        .where(eq(systemPermissions.id, id as string))
        .returning();
      if (updated.length === 0) {
        return res.status(404).json({ error: "Permission not found" });
      }

      res.json({ permission: updated[0] });

      AuditService.logAction(req, {
        action: 'update',
        module: 'admin',
        entityType: 'permission',
        entityId: id as string,
        newValues: updated[0],
        details: `Updated permission: ${updated[0].key}`
      });
    } catch (error) {
      console.error("Error updating permission:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admin/permissions/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.roles.manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await db
        .update(systemPermissions)
        .set({ isActive: false, updatedAt: sql`now()` } as any)
        .where(eq(systemPermissions.id, id as string))
        .returning();
      if (updated.length === 0) {
        return res.status(404).json({ error: "Permission not found" });
      }

      res.json({ message: "Permission deactivated successfully" });

      AuditService.logAction(req, {
        action: 'delete',
        module: 'admin',
        entityType: 'permission',
        entityId: id as string,
        details: `Deactivated permission: ${updated[0].key}`
      });
    } catch (error) {
      console.error("Error deleting permission:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Role Permissions (/api/admin/role-permissions) ─────────────────

  app.get("/api/admin/role-permissions", marketingAuth, marketingAdminAuth, checkPermission("admin.roles.manage"), async (_req, res) => {
    try {
      const rolePerms = await db.select().from(systemRolePermissions).orderBy(desc(systemRolePermissions.createdAt));
      res.json({ rolePermissions: rolePerms });
    } catch (error) {
      console.error("Error fetching all role permissions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/admin/role-permissions/:roleId", marketingAuth, marketingAdminAuth, checkPermission("admin.roles.manage"), async (req, res) => {
    try {
      const { roleId } = req.params;
      const rolePerms = await db
        .select()
        .from(systemRolePermissions)
        .where(eq(systemRolePermissions.roleId, roleId as string))
        .orderBy(desc(systemRolePermissions.createdAt));
      res.json({ rolePermissions: rolePerms });
    } catch (error) {
      console.error("Error fetching role permissions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/role-permissions", marketingAuth, marketingAdminAuth, checkPermission("admin.roles.edit"), async (req, res) => {
    try {
      const { roleId, permissionId } = req.body;
      if (!roleId || !permissionId) {
        return res.status(400).json({ error: "roleId and permissionId are required" });
      }
      const newRolePerm = await db
        .insert(systemRolePermissions)
        .values({ roleId, permissionId } as any)
        .returning();

      res.status(201).json({ rolePermission: newRolePerm[0] });

      AuditService.logAction(req, {
        action: 'create',
        module: 'admin',
        entityType: 'role_permission',
        entityId: newRolePerm[0].id,
        details: `Assigned permission ID ${permissionId} to role ID ${roleId}`
      });
    } catch (error) {
      console.error("Error assigning role permission:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/role-permissions/bulk", marketingAuth, marketingAdminAuth, checkPermission("admin.roles.edit"), async (req, res) => {
    try {
      const { roleId, permissionIds, action } = req.body;
      if (!roleId || !Array.isArray(permissionIds) || !action) {
        return res.status(400).json({ error: "roleId, permissionIds (array), and action ('add'|'remove') are required" });
      }

      if (action === 'add') {
        const values = permissionIds.map(pId => ({ roleId, permissionId: pId }));
        const results = await db.insert(systemRolePermissions).values(values as any).returning();
        res.status(201).json({ rolePermissions: results });

        AuditService.logAction(req, {
          action: 'create',
          module: 'admin',
          entityType: 'role_permission',
          entityId: roleId,
          details: `Bulk added ${results.length} permissions to role ID ${roleId}`
        });
      } else {
        const results = await db.delete(systemRolePermissions)
          .where(and(
            eq(systemRolePermissions.roleId, roleId),
            inArray(systemRolePermissions.permissionId, permissionIds)
          ))
          .returning();
        res.json({ message: `Removed ${results.length} permissions` });

        AuditService.logAction(req, {
          action: 'delete',
          module: 'admin',
          entityType: 'role_permission',
          entityId: roleId,
          details: `Bulk removed ${results.length} permissions from role ID ${roleId}`
        });
      }
    } catch (error) {
      console.error("Error in bulk permission update:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admin/role-permissions/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.roles.edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await db
        .delete(systemRolePermissions)
        .where(eq(systemRolePermissions.id, id as string))
        .returning();
      if (deleted.length === 0) {
        return res.status(404).json({ error: "Role permission not found" });
      }

      res.json({ message: "Role permission removed successfully" });

      AuditService.logAction(req, {
        action: 'delete',
        module: 'admin',
        entityType: 'role_permission',
        entityId: id as string,
        details: `Removed role permission assignment ID: ${id}`
      });
    } catch (error) {
      console.error("Error removing role permission:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Departments (/api/admin/departments) ───────────────────────────

  app.get("/api/admin/departments", marketingAuth, checkPermission("admin.departments.view"), async (_req, res) => {
    try {
      const depts = await db.select().from(departments).where(eq(departments.isActive, true)).orderBy(desc(departments.createdAt));
      res.json({ departments: depts });
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/departments", marketingAuth, marketingAdminAuth, checkPermission("admin.departments.create"), async (req, res) => {
    try {
      const { name, code, description, parentDepartmentId, headUserId } = req.body;
      if (!name || !code) {
        return res.status(400).json({ error: "Name and code are required" });
      }
      const newDept = await db
        .insert(departments)
        .values({ name, code, description, parentDepartmentId, headUserId } as any)
        .returning();

      res.status(201).json({ department: newDept[0] });

      AuditService.logAction(req, {
        action: 'create',
        module: 'admin',
        entityType: 'department',
        entityId: newDept[0].id,
        newValues: newDept[0],
        details: `Created new department: ${name} (${code})`
      });
    } catch (error) {
      console.error("Error creating department:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/admin/departments/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.departments.edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await db.select().from(departments).where(eq(departments.id, id as string)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      const updateData = { ...req.body, updatedAt: sql`now()` };
      const updated = await db
        .update(departments)
        .set(updateData)
        .where(eq(departments.id, id as string))
        .returning();

      res.json({ department: updated[0] });

      AuditService.logAction(req, {
        action: 'update',
        module: 'admin',
        entityType: 'department',
        entityId: id as string,
        oldValues: existing[0],
        newValues: updated[0],
        details: `Updated department: ${updated[0].name}`
      });
    } catch (error) {
      console.error("Error updating department:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admin/departments/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.departments.delete"), async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await db
        .update(departments)
        .set({ isActive: false, updatedAt: sql`now()` } as any)
        .where(eq(departments.id, id as string))
        .returning();
      if (updated.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      res.json({ message: "Department deactivated successfully" });

      AuditService.logAction(req, {
        action: 'delete',
        module: 'admin',
        entityType: 'department',
        entityId: id as string,
        details: `Deactivated department: ${updated[0].name}`
      });
    } catch (error) {
      console.error("Error deleting department:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Service Categories (/api/admin/service-categories) ─────────────

  app.get("/api/admin/service-categories", marketingAuth, checkPermission("admin.categories.view"), async (_req, res) => {
    try {
      const categories = await db.select().from(serviceCategories).where(eq(serviceCategories.isActive, true)).orderBy(desc(serviceCategories.createdAt));
      res.json({ serviceCategories: categories });
    } catch (error) {
      console.error("Error fetching service categories:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/service-categories", marketingAuth, marketingAdminAuth, checkPermission("admin.categories.create"), async (req, res) => {
    try {
      const { name, code, description, departmentId, defaultPriority } = req.body;
      if (!name || !code) {
        return res.status(400).json({ error: "Name and code are required" });
      }
      const newCategory = await db
        .insert(serviceCategories)
        .values({ name, code, description, departmentId, defaultPriority: defaultPriority ?? "medium" } as any)
        .returning();

      res.status(201).json({ serviceCategory: newCategory[0] });

      AuditService.logAction(req, {
        action: 'create',
        module: 'admin',
        entityType: 'service_category',
        entityId: newCategory[0].id,
        newValues: newCategory[0],
        details: `Created new service category: ${name} (${code})`
      });
    } catch (error) {
      console.error("Error creating service category:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/admin/service-categories/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.categories.edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body, updatedAt: sql`now()` };
      const updated = await db
        .update(serviceCategories)
        .set(updateData)
        .where(eq(serviceCategories.id, id as string))
        .returning();
      if (updated.length === 0) {
        return res.status(404).json({ error: "Service category not found" });
      }

      res.json({ serviceCategory: updated[0] });

      AuditService.logAction(req, {
        action: 'update',
        module: 'admin',
        entityType: 'service_category',
        entityId: id as string,
        newValues: updated[0],
        details: `Updated service category: ${updated[0].name}`
      });
    } catch (error) {
      console.error("Error updating service category:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admin/service-categories/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.categories.delete"), async (req, res) => {
    try {
      const { id } = req.params;
      
      // Nullify references in cases table
      await db.update(cases)
        .set({ serviceCategoryId: null as any })
        .where(eq(cases.serviceCategoryId, id as string));
        
      // Delete associated SLAs
      await db.delete(slaRules).where(eq(slaRules.serviceCategoryId, id as string));
      
      // Delete associated escalation chains
      await db.delete(escalationChains).where(eq(escalationChains.serviceCategoryId, id as string));
      
      // Delete associated workflow rules
      await db.delete(workflowRules).where(eq(workflowRules.serviceCategoryId, id as string));

      // Finally, hard delete the category
      const deleted = await db
        .delete(serviceCategories)
        .where(eq(serviceCategories.id, id as string))
        .returning();
        
      if (deleted.length === 0) {
        return res.status(404).json({ error: "Service category not found" });
      }

      res.json({ message: "Service category deleted successfully" });

      AuditService.logAction(req, {
        action: 'delete',
        module: 'admin',
        entityType: 'service_category',
        entityId: id as string,
        details: `Deleted service category: ${deleted[0].name}`
      });
    } catch (error) {
      console.error("Error deleting service category:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── SLA Rules (/api/admin/sla-rules) ───────────────────────────────

  app.get("/api/admin/sla-rules", marketingAuth, checkPermission("admin.sla.view"), async (_req, res) => {
    try {
      const rules = await db.select().from(slaRules).where(eq(slaRules.isActive, true)).orderBy(desc(slaRules.createdAt));
      res.json({ slaRules: rules });
    } catch (error) {
      console.error("Error fetching SLA rules:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/sla-rules", marketingAuth, marketingAdminAuth, checkPermission("admin.sla.create"), async (req, res) => {
    try {
      const { name, serviceCategoryId, priority, metricType, timeline, timelineUnit, responseTimeMinutes, businessHoursOnly, businessHoursStart, businessHoursEnd } = req.body;
      if (!name || !priority || !metricType || timeline == null || !timelineUnit) {
        return res.status(400).json({ error: "Name, priority, metricType, timeline, and timelineUnit are required" });
      }
      const newRule = await db
        .insert(slaRules)
        .values({
          name,
          serviceCategoryId,
          priority,
          metricType,
          timeline,
          timelineUnit,
          responseTimeMinutes,
          businessHoursOnly: businessHoursOnly ?? false,
          businessHoursStart: businessHoursStart ?? "08:00",
          businessHoursEnd: businessHoursEnd ?? "17:00",
        } as any)
        .returning();

      res.status(201).json({ slaRule: newRule[0] });

      AuditService.logAction(req, {
        action: 'create',
        module: 'admin',
        entityType: 'sla_rule',
        entityId: newRule[0].id,
        newValues: newRule[0],
        details: `Created new SLA rule: ${name}`
      });
    } catch (error) {
      console.error("Error creating SLA rule:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/admin/sla-rules/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.sla.edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body, updatedAt: sql`now()` };
      const updated = await db
        .update(slaRules)
        .set(updateData)
        .where(eq(slaRules.id, id as string))
        .returning();
      if (updated.length === 0) {
        return res.status(404).json({ error: "SLA rule not found" });
      }

      res.json({ slaRule: updated[0] });

      AuditService.logAction(req, {
        action: 'update',
        module: 'admin',
        entityType: 'sla_rule',
        entityId: id as string,
        newValues: updated[0],
        details: `Updated SLA rule: ${updated[0].name}`
      });
    } catch (error) {
      console.error("Error updating SLA rule:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admin/sla-rules/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.sla.delete"), async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await db
        .update(slaRules)
        .set({ isActive: false, updatedAt: sql`now()` } as any)
        .where(eq(slaRules.id, id as string))
        .returning();
      if (updated.length === 0) {
        return res.status(404).json({ error: "SLA rule not found" });
      }

      res.json({ message: "SLA rule deactivated successfully" });

      AuditService.logAction(req, {
        action: 'delete',
        module: 'admin',
        entityType: 'sla_rule',
        entityId: id as string,
        details: `Deactivated SLA rule: ${updated[0].name}`
      });
    } catch (error) {
      console.error("Error deleting SLA rule:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Escalation Chains (/api/admin/escalation-chains) ───────────────

  app.get("/api/admin/escalation-chains", marketingAuth, marketingAdminAuth, checkPermission("admin.escalation.edit"), async (_req, res) => {
    try {
      const chains = await db.select().from(escalationChains).where(eq(escalationChains.isActive, true)).orderBy(desc(escalationChains.createdAt));
      
      if (chains.length === 0) {
        return res.json({ escalationChains: [] });
      }

      const allSteps = await db.select().from(escalationSteps).where(inArray(escalationSteps.chainId, chains.map(c => c.id)));
      const chainsWithSteps = chains.map(chain => ({
        ...chain,
        steps: allSteps.filter(step => step.chainId === chain.id)
      }));

      res.json({ escalationChains: chainsWithSteps });
    } catch (error) {
      console.error("Error fetching escalation chains:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/escalation-chains", marketingAuth, marketingAdminAuth, checkPermission("admin.escalation.create"), async (req, res) => {
    try {
      const { name, serviceCategoryId, slaId, priority, description, assigneeUserId, escalateAfterMinutes } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const result = await db.transaction(async (tx) => {
        const [newChain] = await tx
          .insert(escalationChains)
          .values({ name, serviceCategoryId, slaId, priority, description } as any)
          .returning();

        if (assigneeUserId && escalateAfterMinutes != null) {
          await tx
            .insert(escalationSteps)
            .values({
              chainId: newChain.id,
              stepOrder: 1,
              assigneeUserId,
              escalateAfterMinutes,
              notifyChannel: "email",
              requiresConsent: false,
              gracePeriodMinutes: 0
            } as any);
        }

        return newChain;
      });

      res.status(201).json({ escalationChain: result });

      AuditService.logAction(req, {
        action: 'create',
        module: 'admin',
        entityType: 'escalation_chain',
        entityId: result.id,
        newValues: result,
        details: `Created new escalation chain: ${name}`
      });
    } catch (error) {
      console.error("Error creating escalation chain:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/admin/escalation-chains/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.escalation.edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body, updatedAt: sql`now()` };
      const updated = await db
        .update(escalationChains)
        .set(updateData)
        .where(eq(escalationChains.id, id as string))
        .returning();
      if (updated.length === 0) {
        return res.status(404).json({ error: "Escalation chain not found" });
      }

      res.json({ escalationChain: updated[0] });

      AuditService.logAction(req, {
        action: 'update',
        module: 'admin',
        entityType: 'escalation_chain',
        entityId: id as string,
        newValues: updated[0],
        details: `Updated escalation chain: ${updated[0].name}`
      });
    } catch (error) {
      console.error("Error updating escalation chain:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admin/escalation-chains/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.escalation.delete"), async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await db
        .update(escalationChains)
        .set({ isActive: false, updatedAt: sql`now()` } as any)
        .where(eq(escalationChains.id, id as string))
        .returning();
      if (updated.length === 0) {
        return res.status(404).json({ error: "Escalation chain not found" });
      }

      res.json({ message: "Escalation chain deactivated successfully" });

      AuditService.logAction(req, {
        action: 'delete',
        module: 'admin',
        entityType: 'escalation_chain',
        entityId: id as string,
        details: `Deactivated escalation chain: ${updated[0].name}`
      });
    } catch (error) {
      console.error("Error deleting escalation chain:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Escalation Steps (/api/admin/escalation-steps) ─────────────────

  app.get("/api/admin/escalation-steps/:chainId", marketingAuth, marketingAdminAuth, checkPermission("admin.escalation.edit"), async (req, res) => {
    try {
      const { chainId } = req.params;
      const steps = await db
        .select()
        .from(escalationSteps)
        .where(eq(escalationSteps.chainId, chainId as string))
        .orderBy(asc(escalationSteps.stepOrder));
      res.json({ escalationSteps: steps });
    } catch (error) {
      console.error("Error fetching escalation steps:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/escalation-steps", marketingAuth, marketingAdminAuth, checkPermission("admin.escalation.create"), async (req, res) => {
    try {
      const { chainId, stepOrder, assigneeRoleId, assigneeUserId, assigneeDepartmentId, escalateAfterMinutes, notifyChannel, description, gracePeriodMinutes, requiresConsent } = req.body;
      if (!chainId || stepOrder == null || escalateAfterMinutes == null) {
        return res.status(400).json({ error: "chainId, stepOrder, and escalateAfterMinutes are required" });
      }
      const newStep = await db
        .insert(escalationSteps)
        .values({
          chainId,
          stepOrder,
          assigneeRoleId,
          assigneeUserId,
          assigneeDepartmentId,
          escalateAfterMinutes,
          notifyChannel: notifyChannel ?? "email",
          description,
          gracePeriodMinutes: gracePeriodMinutes ?? 0,
          requiresConsent: !!requiresConsent,
        } as any)
        .returning();
      res.status(201).json({ escalationStep: newStep[0] });
    } catch (error) {
      console.error("Error creating escalation step:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Alias for REST-style frontend calls
  app.post("/api/admin/escalation-chains/:id/steps", marketingAuth, marketingAdminAuth, checkPermission("admin.escalation.create"), async (req, res) => {
    try {
      const { id: chainId } = req.params;
      const { stepOrder, assigneeRoleId, assigneeUserId, assigneeDepartmentId, escalateAfterMinutes, notifyChannel, description, gracePeriodMinutes, requiresConsent } = req.body;

      const newStep = await db
        .insert(escalationSteps)
        .values({
          chainId,
          stepOrder,
          assigneeRoleId,
          assigneeUserId,
          assigneeDepartmentId,
          escalateAfterMinutes,
          notifyChannel: notifyChannel ?? "email",
          description,
          gracePeriodMinutes: gracePeriodMinutes ?? 0,
          requiresConsent: !!requiresConsent,
        } as any)
        .returning();
      res.status(201).json({ escalationStep: newStep[0] });
    } catch (error) {
      console.error("Error creating escalation step via chain route:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/admin/escalation-steps/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.escalation.edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const { stepOrder, assigneeRoleId, assigneeUserId, assigneeDepartmentId, escalateAfterMinutes, notifyChannel, description, gracePeriodMinutes, requiresConsent } = req.body;

      const updateData: any = {};
      if (stepOrder !== undefined) updateData.stepOrder = stepOrder;
      if (assigneeRoleId !== undefined) updateData.assigneeRoleId = assigneeRoleId;
      if (assigneeUserId !== undefined) updateData.assigneeUserId = assigneeUserId;
      if (assigneeDepartmentId !== undefined) updateData.assigneeDepartmentId = assigneeDepartmentId;
      if (escalateAfterMinutes !== undefined) updateData.escalateAfterMinutes = escalateAfterMinutes;
      if (notifyChannel !== undefined) updateData.notifyChannel = notifyChannel;
      if (description !== undefined) updateData.description = description;
      if (gracePeriodMinutes !== undefined) updateData.gracePeriodMinutes = gracePeriodMinutes;
      if (requiresConsent !== undefined) updateData.requiresConsent = !!requiresConsent;

      const updated = await db
        .update(escalationSteps)
        .set(updateData)
        .where(eq(escalationSteps.id, id as string))
        .returning();
      if (updated.length === 0) {
        return res.status(404).json({ error: "Escalation step not found" });
      }

      res.json({ escalationStep: updated[0] });

      AuditService.logAction(req, {
        action: 'update',
        module: 'admin',
        entityType: 'escalation_step',
        entityId: id as string,
        newValues: updated[0],
        details: `Updated escalation step ID: ${id}`
      });
    } catch (error) {
      console.error("Error updating escalation step:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admin/escalation-steps/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.escalation.delete"), async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await db
        .delete(escalationSteps)
        .where(eq(escalationSteps.id, id as string))
        .returning();
      if (deleted.length === 0) {
        return res.status(404).json({ error: "Escalation step not found" });
      }

      res.json({ message: "Escalation step deleted successfully" });

      AuditService.logAction(req, {
        action: 'delete',
        module: 'admin',
        entityType: 'escalation_step',
        entityId: id as string,
        details: `Deleted escalation step ID: ${id}`
      });
    } catch (error) {
      console.error("Error deleting escalation step:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Workflow Rules (/api/admin/workflow-rules) ─────────────────────

  app.get("/api/admin/workflow-rules", marketingAuth, marketingAdminAuth, checkPermission("admin.workflows.edit"), async (_req, res) => {
    try {
      const rules = await db.select().from(workflowRules).where(eq(workflowRules.isActive, true)).orderBy(desc(workflowRules.createdAt));
      res.json({ workflowRules: rules });
    } catch (error) {
      console.error("Error fetching workflow rules:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/workflow-rules", marketingAuth, marketingAdminAuth, checkPermission("admin.workflows.create"), async (req, res) => {
    try {
      const { name, description, serviceCategoryId, priority, triggerEvent, conditions, actions } = req.body;
      if (!name || !triggerEvent) {
        return res.status(400).json({ error: "Name and triggerEvent are required" });
      }
      const newRule = await db
        .insert(workflowRules)
        .values({
          name,
          description,
          serviceCategoryId,
          priority,
          triggerEvent,
          conditions: conditions ?? {},
          actions: actions ?? {},
        } as any)
        .returning();

      res.status(201).json({ workflowRule: newRule[0] });

      AuditService.logAction(req, {
        action: 'create',
        module: 'admin',
        entityType: 'workflow_rule',
        entityId: newRule[0].id,
        newValues: newRule[0],
        details: `Created new workflow rule: ${name}`
      });
    } catch (error) {
      console.error("Error creating workflow rule:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/admin/workflow-rules/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.workflows.edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body, updatedAt: sql`now()` };
      const updated = await db
        .update(workflowRules)
        .set(updateData)
        .where(eq(workflowRules.id, id as string))
        .returning();
      if (updated.length === 0) {
        return res.status(404).json({ error: "Workflow rule not found" });
      }

      res.json({ workflowRule: updated[0] });

      AuditService.logAction(req, {
        action: 'update',
        module: 'admin',
        entityType: 'workflow_rule',
        entityId: id as string,
        newValues: updated[0],
        details: `Updated workflow rule: ${updated[0].name}`
      });
    } catch (error) {
      console.error("Error updating workflow rule:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admin/workflow-rules/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.workflows.delete"), async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await db.delete(workflowRules)
        .where(eq(workflowRules.id, id as string))
        .returning();
      if (deleted.length === 0) {
        return res.status(404).json({ error: "Workflow rule not found" });
      }

      res.json({ message: "Workflow rule deleted permanently" });

      AuditService.logAction(req, {
        action: 'delete',
        module: 'admin',
        entityType: 'workflow_rule',
        entityId: id as string,
        details: `Deleted workflow rule ID: ${id}`
      });
    } catch (error) {
      console.error("Error deleting workflow rule:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Seed Defaults (/api/admin/seed-defaults) ──────────────────────

  app.post("/api/admin/seed-defaults", marketingAuth, marketingAdminAuth, async (_req, res) => {
    try {
      const modules = ["marketing", "cases", "stakeholders", "admin"];
      const permissionActions = ["view", "create", "edit", "delete", "export"];
      const defaultPermissions: { key: string; description: string; module: string }[] = [];

      for (const mod of modules) {
        for (const action of permissionActions) {
          defaultPermissions.push({
            key: `${mod}.${action}`,
            description: `${action.charAt(0).toUpperCase() + action.slice(1)} access for ${mod} module`,
            module: mod,
          });
        }
      }

      const createdPermissions = [];
      for (const perm of defaultPermissions) {
        const existing = await db.select().from(systemPermissions).where(eq(systemPermissions.key, perm.key)).limit(1);
        if (existing.length === 0) {
          const [created] = await db.insert(systemPermissions).values(perm as any).returning();
          createdPermissions.push(created);
        } else {
          createdPermissions.push(existing[0]);
        }
      }

      res.status(201).json({
        message: "System permissions seeded successfully",
        permissions: createdPermissions,
      });
    } catch (error) {
      console.error("Error seeding defaults:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Users (/api/admin/users) ────────────────────────────────────────

  // GET all users (no password)
  app.get("/api/admin/users", marketingAuth, marketingAdminAuth, checkPermission("admin.users.view_details"), async (req, res) => {
    try {
      const { departmentId } = req.query;
      
      let query = db.select({
        id: marketingUsers.id,
        email: marketingUsers.email,
        firstName: marketingUsers.firstName,
        lastName: marketingUsers.lastName,
        phoneNumber: marketingUsers.phoneNumber,
        role: marketingUsers.role,
        isActive: marketingUsers.isActive,
        mustChangePassword: marketingUsers.mustChangePassword,
        dashboardAccess: marketingUsers.dashboardAccess,
        lastLoginAt: marketingUsers.lastLoginAt,
        createdAt: marketingUsers.createdAt,
        departmentId: marketingUsers.departmentId,
        activeCaseCount: count(cases.id),
      })
        .from(marketingUsers)
        .leftJoin(cases, and(
          eq(cases.assignedTo, marketingUsers.id),
          not(inArray(cases.status, ['resolved', 'closed', 'ignored']))
        ))
        .as('user_stats');

      const conditions = [];
      if (departmentId) {
        conditions.push(eq(marketingUsers.departmentId, departmentId as string));
      }

      const users = await db.select({
        id: marketingUsers.id,
        email: marketingUsers.email,
        firstName: marketingUsers.firstName,
        lastName: marketingUsers.lastName,
        phoneNumber: marketingUsers.phoneNumber,
        role: marketingUsers.role,
        isActive: marketingUsers.isActive,
        mustChangePassword: marketingUsers.mustChangePassword,
        dashboardAccess: marketingUsers.dashboardAccess,
        lastLoginAt: marketingUsers.lastLoginAt,
        createdAt: marketingUsers.createdAt,
        departmentId: marketingUsers.departmentId,
        activeCaseCount: count(cases.id),
      })
        .from(marketingUsers)
        .leftJoin(cases, and(
          eq(cases.assignedTo, marketingUsers.id),
          not(inArray(cases.status, ['resolved', 'closed', 'ignored']))
        ))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(marketingUsers.id)
        .orderBy(desc(marketingUsers.createdAt));

      res.json({ users });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST create user + send welcome email
  app.post("/api/admin/users", marketingAuth, marketingAdminAuth, checkPermission("admin.users.create"), async (req, res) => {
    try {
      const { firstName, lastName, email, phoneNumber, roleIds, departmentId } = req.body;
      if (!firstName || !lastName || !email || !departmentId) {
        return res.status(400).json({ error: "firstName, lastName, email, and departmentId are required" });
      }
      // Check for duplicate email
      const existing = await db.select().from(marketingUsers).where(eq(marketingUsers.email, email)).limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ error: "A user with that email already exists" });
      }
      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + "X9!";
      const hash = await bcrypt.hash(tempPassword, 12);

      const [newUser] = await db.insert(marketingUsers).values({
        firstName,
        lastName,
        email,
        phoneNumber: phoneNumber || null,
        password: hash,
        role: "user",
        isActive: true,
        mustChangePassword: true,
        departmentId: departmentId,
      } as any).returning();

      AuditService.logAction(req, {
        action: 'create',
        module: 'admin',
        entityType: 'user',
        entityId: newUser.id,
        newValues: { ...newUser, password: undefined },
        details: `Created new user: ${email} with department ID ${departmentId}`
      });

      // Assign roles
      if (Array.isArray(roleIds) && roleIds.length > 0) {
        await db.insert(userRoles).values(
          roleIds.map((roleId: string) => ({ userId: newUser.id, roleId }))
        );
      }

      // Send welcome email
      try {
        await mailer.sendMail({
          from: process.env.EMAIL_FROM,
          to: email,
          subject: "Your KASNEB CRM Account",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;">
              <h2 style="color:#004E98;">Welcome to KASNEB CRM</h2>
              <p>Hi ${firstName},</p>
              <p>Your account has been created. Use the credentials below to log in:</p>
              <table style="border-collapse:collapse;width:100%;">
                <tr><td style="padding:8px;font-weight:bold;">Email</td><td style="padding:8px;">${email}</td></tr>
                <tr style="background:#f5f5f5;"><td style="padding:8px;font-weight:bold;">Password</td><td style="padding:8px;">${tempPassword}</td></tr>
              </table>
              <p style="margin-top:16px;"><a href="${process.env.APP_URL || "http://localhost:5001"}/marketing/login" style="background:#004E98;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;">Login Now</a></p>
              <p style="color:#888;font-size:12px;">You will be prompted to change your password on first login.</p>
            </div>
          `,
        });
      } catch (mailErr) {
        console.error("Failed to send welcome email:", mailErr);
        // Don't fail the request if email fails
      }

      res.status(201).json({ user: { ...newUser, password: undefined } });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PUT update user
  app.put("/api/admin/users/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.users.edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await db.select().from(marketingUsers).where(eq(marketingUsers.id, id as string)).limit(1);
      if (existing.length === 0) return res.status(404).json({ error: "User not found" });

      const { firstName, lastName, email, phoneNumber, isActive, password, departmentId } = req.body;
      const updateData: Record<string, unknown> = { updatedAt: sql`now()` };
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (departmentId !== undefined) updateData.departmentId = departmentId;
      if (password) updateData.password = await bcrypt.hash(password, 12);

      const updated = await db.update(marketingUsers).set(updateData as any).where(eq(marketingUsers.id, id as string)).returning();
      
      const { password: _pw1, ...oldSafeUser } = existing[0] as any;
      const { password: _pw2, ...safeUser } = updated[0] as any;
      res.json({ user: safeUser });

      AuditService.logAction(req, {
        action: 'update',
        module: 'admin',
        entityType: 'user',
        entityId: id as string,
        oldValues: oldSafeUser,
        newValues: safeUser,
        details: `Updated user: ${safeUser.email}`
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET user analytics
  app.get("/api/admin/users/:id/analytics", marketingAuth, marketingAdminAuth, checkPermission("admin.users.view_details"), async (req, res) => {
    try {
      const { id } = req.params;

      // Active cases
      const activeCasesRes = await db.select({ count: count(cases.id) })
        .from(cases)
        .where(and(eq(cases.assignedTo, id as string), inArray(cases.status, ["open", "pending_acceptance", "in_progress"])));
      const activeCount = Number(activeCasesRes[0].count || 0);

      // Resolved cases
      const resolvedCasesRes = await db.select({ count: count(cases.id), avgDuration: avg(cases.resolutionDurationMinutes) })
        .from(cases)
        .where(and(eq(cases.assignedTo, id as string), eq(cases.status, "resolved")));

      const resolvedCount = Number(resolvedCasesRes[0].count || 0);
      const avgDuration = Number(resolvedCasesRes[0].avgDuration || 0);

      // satisfaction
      const satisfactionRes = await db.select({ avg: avg(cases.satisfactionRating) })
        .from(cases)
        .where(and(eq(cases.assignedTo, id as string), eq(cases.status, "closed")));
      const avgSatisfaction = Number(satisfactionRes[0].avg || 0);

      res.json({
        activeCount,
        resolvedCount,
        avgDuration,
        avgSatisfaction,
        workloadPercentage: Math.min(Math.round((activeCount / 20) * 100), 100)
      });
    } catch (error) {
      console.error("Error fetching user analytics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET user performance history (paginated)
  app.get("/api/admin/users/:id/performance", marketingAuth, marketingAdminAuth, checkPermission("admin.users.view_details"), async (req, res) => {
    try {
      const { id } = req.params;
      const status = req.query.status as string || "active"; // "active" or "resolved"
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 5;
      const offset = (page - 1) * limit;

      let conditions: any[] = [eq(cases.assignedTo, id as string)];
      if (status === "resolved") {
        conditions.push(eq(cases.status, "resolved"));
      } else {
        conditions.push(inArray(cases.status, ["open", "pending_acceptance", "in_progress"]));
      }

      const results = await db.select()
        .from(cases)
        .where(and(...conditions))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(cases.updatedAt));

      const totalRes = await db.select({ count: count(cases.id) })
        .from(cases)
        .where(and(...conditions));
      const total = Number(totalRes[0].count || 0);

      res.json({
        cases: results,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error("Error fetching user performance:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE (true delete) user
  app.delete("/api/admin/users/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.users.delete"), async (req, res) => {
    try {
      const { id } = req.params;

      // Delete role assignments first
      await db.delete(userRoles).where(eq(userRoles.userId, id as string));

      const deleted = await db.delete(marketingUsers)
        .where(eq(marketingUsers.id, id as string))
        .returning();

      if (deleted.length === 0) return res.status(404).json({ error: "User not found" });
      res.json({ message: "User deleted permanently" });

      AuditService.logAction(req, {
        action: 'delete',
        module: 'admin',
        entityType: 'user',
        entityId: id as string,
        details: `Deleted user ID: ${id}`
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── User Roles (/api/admin/users/:id/roles) ────────────────────────

  // GET roles for a user
  app.get("/api/admin/users/:id/roles", marketingAuth, marketingAdminAuth, checkPermission("admin.users.view_details"), async (req, res) => {
    try {
      const { id } = req.params;
      const assignments = await db.select().from(userRoles).where(eq(userRoles.userId, id as string));
      res.json({ userRoles: assignments });
    } catch (error) {
      console.error("Error fetching user roles:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST assign a role to a user
  app.post("/api/admin/users/:id/roles", marketingAuth, marketingAdminAuth, checkPermission("admin.users.edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const { roleId } = req.body;
      if (!roleId) return res.status(400).json({ error: "roleId is required" });
      // Avoid duplicates
      const existing = await db.select().from(userRoles)
        .where(and(eq(userRoles.userId, id as string), eq(userRoles.roleId, roleId))).limit(1);
      if (existing.length > 0) return res.status(409).json({ error: "Role already assigned" });
      const [created] = await db.insert(userRoles).values({ userId: id, roleId } as any).returning();
      res.status(201).json({ userRole: created });

      AuditService.logAction(req, {
        action: 'create',
        module: 'admin',
        entityType: 'user_role',
        entityId: created.id,
        details: `Assigned role ID ${roleId} to user ID ${id}`
      });
    } catch (error) {
      console.error("Error assigning user role:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE a user-role assignment
  app.delete("/api/admin/user-roles/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.users.edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await db.delete(userRoles).where(eq(userRoles.id, id as string)).returning();
      if (deleted.length === 0) return res.status(404).json({ error: "Assignment not found" });
      res.json({ message: "Role removed successfully" });

      AuditService.logAction(req, {
        action: 'delete',
        module: 'admin',
        entityType: 'user_role',
        entityId: id as string,
        details: `Removed user role assignment ID: ${id}`
      });
    } catch (error) {
      console.error("Error removing user role:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PUT replace all roles for a user (bulk update)
  app.put("/api/admin/users/:id/roles", marketingAuth, marketingAdminAuth, checkPermission("admin.users.edit"), async (req, res) => {
    try {
      const { id } = req.params;
      const { roleIds } = req.body; // array of roleId strings
      if (!Array.isArray(roleIds)) return res.status(400).json({ error: "roleIds must be an array" });
      // Delete all existing, then insert new
      await db.delete(userRoles).where(eq(userRoles.userId, id as string));
      if (roleIds.length > 0) {
        // cast id and result to avoid drizzle type mismatches
        const values = roleIds.map((roleId: string) => ({ userId: String(id), roleId }));
        await db.insert(userRoles).values(values as any);
      }
      res.json({ message: "Roles updated successfully" });

      AuditService.logAction(req, {
        action: 'update',
        module: 'admin',
        entityType: 'user_role',
        entityId: id as string,
        details: `Bulk updated roles for user ID ${id}. New role IDs: ${roleIds.join(', ')}`
      });
    } catch (error) {
      console.error("Error updating user roles:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Overview Stats (/api/admin/overview-stats) ─────────────────────
  app.get("/api/admin/overview-stats", marketingAuth, marketingAdminAuth, checkPermission("admin.view"), async (_req, res) => {
    try {
      // Use more robust counting for different Drizzle/DB versions
      const [
        usersResult,
        allIntegrations,
        openCasesResult,
        overdueCasesResult,
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(marketingUsers),
        db.select({ id: integrationConfigs.id, lastTestStatus: integrationConfigs.lastTestStatus, isActive: integrationConfigs.isActive }).from(integrationConfigs),
        db.select({ count: sql<number>`count(*)` }).from(cases).where(and(ne(cases.status, "resolved"), ne(cases.status, "closed"))),
        db.select({ count: sql<number>`count(*)` }).from(cases).where(and(eq(cases.slaBreached, true), ne(cases.status, "resolved"), ne(cases.status, "closed"))),
      ]);

      const totalIntegrations = allIntegrations.length;
      const failingIntegrations = allIntegrations.filter(i => i.lastTestStatus === "failed").length;

      res.json({
        totalUsers: Number(usersResult[0]?.count ?? 0),
        integrations: {
          total: totalIntegrations,
          failing: failingIntegrations,
        },
        openCases: Number(openCasesResult[0]?.count ?? 0),
        overdueCases: Number(overdueCasesResult[0]?.count ?? 0),
      });
    } catch (error) {
      console.error("CRITICAL ERROR fetching overview stats:", error);
      res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // ─── Regions (/api/admin/regions) ───────────────────────────────────

  app.get("/api/admin/regions", marketingAuth, async (_req, res) => {
    try {
      let allRegions = await db.select().from(regions).orderBy(asc(regions.name));
      if (allRegions.length === 0) {
        const defaultRegions = [
          { name: 'Kenya', code: 'KE', currency: 'KES', language: 'English', timezone: 'Africa/Nairobi', isActive: true },
          { name: 'Cameroon', code: 'CM', currency: 'XAF', language: 'French', timezone: 'Africa/Douala', isActive: true },
          { name: 'Rwanda', code: 'RW', currency: 'RWF', language: 'French', timezone: 'Africa/Kigali', isActive: true },
          { name: 'Uganda', code: 'UG', currency: 'UGX', language: 'English', timezone: 'Africa/Kampala', isActive: true },
          { name: 'Tanzania', code: 'TZ', currency: 'TZS', language: 'Swahili', timezone: 'Africa/Dar_es_Salaam', isActive: true },
        ];
        allRegions = await db.insert(regions).values(defaultRegions as any).returning();
      }
      res.json({ regions: allRegions });
    } catch (error) {
      console.error("Error fetching regions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/regions", marketingAuth, marketingAdminAuth, checkPermission("admin.timezones.manage"), async (req, res) => {
    try {
      const { name, code, currency, language, supportedLanguages, timezone, isActive } = req.body;
      if (!name || !code || !currency || !language || !timezone) {
        return res.status(400).json({ error: "All fields are required" });
      }
      const newRegion = await db
        .insert(regions)
        .values({
          name, code, currency, language, supportedLanguages: supportedLanguages || [language], timezone, isActive: isActive ?? true
        } as any)
        .returning();

      res.status(201).json({ region: newRegion[0] });

      AuditService.logAction(req, {
        action: 'create',
        module: 'admin',
        entityType: 'region',
        entityId: newRegion[0].id,
        newValues: newRegion[0],
        details: `Created new region: ${name} (${code})`
      });
    } catch (error) {
      console.error("Error creating region:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/admin/regions/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.timezones.manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body, updatedAt: sql`now()` };
      const updated = await db
        .update(regions)
        .set(updateData)
        .where(eq(regions.id, id as string))
        .returning();
      
      if (updated.length === 0) {
        return res.status(404).json({ error: "Region not found" });
      }

      res.json({ region: updated[0] });

      AuditService.logAction(req, {
        action: 'update',
        module: 'admin',
        entityType: 'region',
        entityId: id as string,
        newValues: updated[0],
        details: `Updated region: ${updated[0].name}`
      });
    } catch (error) {
      console.error("Error updating region:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admin/regions/:id", marketingAuth, marketingAdminAuth, checkPermission("admin.timezones.manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await db.delete(regions).where(eq(regions.id, id as string)).returning();
      if (deleted.length === 0) {
        return res.status(404).json({ error: "Region not found" });
      }

      res.json({ message: "Region deleted successfully" });

      AuditService.logAction(req, {
        action: 'delete',
        module: 'admin',
        entityType: 'region',
        entityId: id as string,
        details: `Deleted region: ${deleted[0].name}`
      });
    } catch (error) {
      console.error("Error deleting region:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

}

