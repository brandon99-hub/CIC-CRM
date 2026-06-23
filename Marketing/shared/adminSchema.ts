import { pgTable, text, integer, boolean, uuid, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const systemRoles = pgTable("system_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").unique().notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  dashboards: jsonb("dashboards").default([]).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const systemPermissions = pgTable("system_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").unique().notNull(),
  description: text("description"),
  module: text("module").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const systemRolePermissions = pgTable("system_role_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  roleId: uuid("role_id").notNull(),
  permissionId: uuid("permission_id").notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
}, (table) => ({
  roleIdx: index("role_perm_role_idx").on(table.roleId),
}));

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").unique().notNull(),
  code: text("code").unique().notNull(),
  description: text("description"),
  parentDepartmentId: uuid("parent_department_id"),
  headUserId: uuid("head_user_id"),
  isActive: boolean("is_active").default(true).notNull(),
  // ── CIC Pipeline Flags ─────────────────────────────────────────────
  // Only one department may have isMarketingDepartment = true at a time.
  // Enforced by a partial unique index:
  //   CREATE UNIQUE INDEX dept_marketing_flag_idx ON departments(is_marketing_department)
  //   WHERE is_marketing_department = true;
  isMarketingDepartment: boolean("is_marketing_department").default(false).notNull(),
  handlesLeads: boolean("handles_leads").default(false).notNull(),     // dept receives new leads
  handlesB2c: boolean("handles_b2c").default(false).notNull(),         // B2C pipeline enabled
  handlesB2b: boolean("handles_b2b").default(false).notNull(),         // B2B pipeline enabled
  // ───────────────────────────────────────────────────────────────────
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const serviceCategories = pgTable("service_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: text("code").unique().notNull(),
  description: text("description"),
  departmentId: uuid("department_id"),
  defaultPriority: text("default_priority").default("medium").notNull(),
  keywords: jsonb("keywords").default([]).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  // ── CIC Pipeline Flags ─────────────────────────────────────────────
  // Specifies which CIC pipeline types this service category covers.
  // Values: 'b2c', 'b2b', or 'both'
  pipelineTypesHandled: text("pipeline_types_handled").default("both").notNull(),
  // Align to CIC product lines: motor | life | medical | property | marine | pension | group_life | micro_insurance
  productLines: jsonb("product_lines").default([]).notNull(),
  // ───────────────────────────────────────────────────────────────────
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  deptIdx: index("category_department_idx").on(table.departmentId),
}));

export const slaRules = pgTable("sla_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  serviceCategoryId: uuid("service_category_id"),
  priority: text("priority").notNull(),
  metricType: text("metric_type").default("resolution_time").notNull(),
  timeline: integer("timeline").default(1).notNull(),
  timelineUnit: text("timeline_unit").default("working days").notNull(),
  responseTimeMinutes: integer("response_time_minutes"), // Optional
  businessHoursOnly: boolean("business_hours_only").default(false).notNull(),
  businessHoursStart: text("business_hours_start").default("08:00").notNull(),
  businessHoursEnd: text("business_hours_end").default("17:00").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  categoryIdx: index("sla_category_idx").on(table.serviceCategoryId),
}));

export const escalationChains = pgTable("escalation_chains", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  serviceCategoryId: uuid("service_category_id"),
  slaId: uuid("sla_id"),
  priority: text("priority"),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  categoryIdx: index("chain_category_idx").on(table.serviceCategoryId),
}));

export const escalationSteps = pgTable("escalation_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  chainId: uuid("chain_id").notNull(),
  stepOrder: integer("step_order").notNull(),
  assigneeRoleId: uuid("assignee_role_id"),
  assigneeUserId: uuid("assignee_user_id"),
  assigneeDepartmentId: uuid("assignee_department_id"), // Current Department
  targetDepartmentId: uuid("target_department_id"),     // New: Department to escalate to
  escalateAfterMinutes: integer("escalate_after_minutes").notNull(),
  requiresConsent: boolean("requires_consent").default(false).notNull(),
  gracePeriodMinutes: integer("grace_period_minutes").default(0).notNull(),
  notifyChannel: text("notify_channel").default("email").notNull(),
  description: text("description"),
  createdAt: text("created_at").default(sql`now()`).notNull(),
}, (table) => ({
  chainIdx: index("step_chain_idx").on(table.chainId),
}));

export const workflowRules = pgTable("workflow_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  serviceCategoryId: uuid("service_category_id"),
  priority: text("priority"),
  triggerEvent: text("trigger_event").notNull(),
  conditions: jsonb("conditions").default([]).notNull(),
  actions: jsonb("actions").default([]).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  categoryIdx: index("workflow_category_idx").on(table.serviceCategoryId),
  triggerIdx: index("workflow_trigger_idx").on(table.triggerEvent),
}));

// Join table: maps marketing_users → system_roles (many-to-many)
export const userRoles = pgTable("user_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),   // references marketing_users.id
  roleId: uuid("role_id").notNull(),   // references system_roles.id
  createdAt: text("created_at").default(sql`now()`).notNull(),
}, (table) => ({
  user_idx: index("user_role_user_idx").on(table.userId),
  role_idx: index("user_role_role_idx").on(table.roleId),
}));

export const regions = pgTable("regions", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").unique().notNull(),
  code: text("code").unique().notNull(),
  currency: text("currency").notNull(),
  language: text("language").notNull(),
  supportedLanguages: jsonb("supported_languages").default(["English"]).notNull(),
  timezone: text("timezone").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const shifts = pgTable("shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  departmentId: uuid("department_id").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  daysOfWeek: jsonb("days_of_week").default([]).notNull(),
  requiredCapacity: integer("required_capacity").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const userShifts = pgTable("user_shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  shiftId: uuid("shift_id").notNull(),
  date: text("date").notNull(),
  status: text("status").default("scheduled").notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const queues = pgTable("queues", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  departmentId: uuid("department_id").notNull(),
  serviceCategoryId: uuid("service_category_id"),
  priorityOrder: integer("priority_order").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const userQueues = pgTable("user_queues", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  queueId: uuid("queue_id").notNull(),
  skillLevel: integer("skill_level").default(1).notNull(),
  maxConcurrentCases: integer("max_concurrent_cases").default(5).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});
