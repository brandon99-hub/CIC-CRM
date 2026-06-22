import { pgTable, text, integer, boolean, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const marketingUsers = pgTable("marketing_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phoneNumber: text("phone_number"),
  role: text("role").default("marketer").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  mustChangePassword: boolean("must_change_password").default(true).notNull(),
  resetToken: text("reset_token"),
  resetTokenExpiry: text("reset_token_expiry"),
  lastLoginAt: text("last_login_at"),
  target: text("target"),
  departmentId: uuid("department_id"),
  dashboardAccess: text("dashboard_access").default('["marketing","stakeholders","cases","executive"]').notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
  bdType: text("bd_type").default("b2b").notNull(),
});

export const marketingSectors = pgTable("marketing_sectors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const marketingProjects = pgTable("marketing_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  sectorId: uuid("sector_id").notNull(),
  institution: text("institution").notNull(),
  leadMarketer: uuid("lead_marketer"),
  contactPerson: text("contact_person"),
  contactNumber: text("contact_number"),
  remarks: text("remarks"),
  status: text("status").default("active").notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const marketingLeads = pgTable("marketing_leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: text("date").notNull(),
  client: text("client").notNull(),
  contactPerson: text("contact_person").notNull(),
  contactNumber: text("contact_number").notNull(),
  contactEmail: text("contact_email").notNull(),
  // customerType drives the pipeline path:
  // B2C Path (Students): lead → prospect_registration → prospect_booking → converted
  // B2B Path (Institutions/Employers): lead → prospect_engagement → expected_order → sales_won
  customerType: text("customer_type"), // student | institution | employer | government
  remarks: text("remarks"),
  revenue: text("revenue"),
  stage: text("stage").default("lead").notNull(),
  marketerId: uuid("marketer_id"),
  sectorId: uuid("sector_id"),
  sharedWithMarketerId: uuid("shared_with_marketer_id"),
  revenueSplit: text("revenue_split"),
  sourceCampaignId: uuid("source_campaign_id"),
  stakeholderId: uuid("stakeholder_id"), // FK to core stakeholders if matched
  // Ambassador/event capture fields
  institution: text("institution"),                          // School/university for student leads
  qualificationOfInterest: text("qualification_of_interest"), // CPA, CS, CIFA, ATD — drives dept routing
  issuesReported: text("issues_reported"),                   // Qualitative feedback captured at event
  isBooking: boolean("is_booking").default(false).notNull(), // true = paid exam entry (KPI); false = new registration (commission)
  isEscalatedToCase: boolean("is_escalated_to_case").default(false).notNull(), // true if issues triggered a formal case
  escalatedCaseId: uuid("escalated_case_id"),               // FK to the escalated Case record
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});


export const marketingProspects = pgTable("marketing_prospects", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: text("date").notNull(),
  client: text("client").notNull(),
  contactPerson: text("contact_person").notNull(),
  contactNumber: text("contact_number").notNull(),
  contactEmail: text("contact_email").notNull(),
  needAvailability: text("need_availability"),
  currentVendor: text("current_vendor"),
  remarks: text("remarks"),
  revenue: text("revenue"),
  stage: text("stage").default("opportunity").notNull(), // opportunity, engagement
  marketerId: uuid("marketer_id"),
  sectorId: uuid("sector_id"),
  sharedWithMarketerId: uuid("shared_with_marketer_id"),
  revenueSplit: text("revenue_split"),
  sourceCampaignId: uuid("source_campaign_id"),
  customerType: text("customer_type"), // student | institution | employer | organization
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const marketingSalesWon = pgTable("marketing_sales_won", {
  id: uuid("id").defaultRandom().primaryKey(),
  organisationName: text("organisation_name").notNull(),
  sector: text("sector").notNull(),
  product: text("product").notNull(),
  contractAmount: text("contract_amount").notNull(),
  expectedQuarter: text("expected_quarter").notNull(),
  comments: text("comments"),
  marketerId: uuid("marketer_id"),
  contactPerson: text("contact_person"),
  contactNumber: text("contact_number"),
  contactEmail: text("contact_email"),
  sourceCampaignId: uuid("source_campaign_id"),
  customerType: text("customer_type"), // student | institution | employer | organization
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const marketingExpectedOrders = pgTable("marketing_expected_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  organisationName: text("organisation_name").notNull(),
  sector: text("sector").notNull(),
  product: text("product").notNull(),
  revenue: text("revenue").notNull(),
  expectedQuarter: text("expected_quarter").notNull(),
  comments: text("comments"),
  marketerId: uuid("marketer_id"),
  contactPerson: text("contact_person"),
  contactNumber: text("contact_number"),
  contactEmail: text("contact_email"),
  sourceCampaignId: uuid("source_campaign_id"),
  customerType: text("customer_type"), // student | institution | employer | organization
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const marketingAnnualSummary = pgTable("marketing_annual_summary", {
  id: uuid("id").defaultRandom().primaryKey(),
  year: integer("year").notNull(),
  salesExecutive: text("sales_executive"),
  won: text("won"),
  target: text("target"),
  revisedTarget: text("revised_target"),
  targetAchieved: text("target_achieved"),
  expectedOrders: text("expected_orders"),
  statusQuo: text("status_quo"),
  deviationFromTarget: text("deviation_from_target"),
  sumSalesExpected: text("sum_sales_expected"),
  expectedTarget: text("expected_target"),
  marketerId: uuid("marketer_id"),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
  bookingTarget: integer("booking_target").default(0),
  registrationTarget: integer("registration_target").default(0),
  commissionPercentage: integer("commission_percentage").default(5),
});

export const marketingLostProjects = pgTable("marketing_lost_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  organisationName: text("organisation_name").notNull(),
  sector: text("sector").notNull(),
  product: text("product").notNull(),
  revenue: text("revenue"),
  expectedQuarter: text("expected_quarter"),
  comments: text("comments"),
  marketerId: uuid("marketer_id"),
  contactPerson: text("contact_person"),
  contactNumber: text("contact_number"),
  contactEmail: text("contact_email"),
  lostReason: text("lost_reason"),
  lostDate: text("lost_date"),
  sourceCampaignId: uuid("source_campaign_id"),
  status: text("status").default("lost").notNull(),
  canRevive: boolean("can_revive").default(false).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const marketingDocuments = pgTable("marketing_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  url: text("url").notNull(),
  category: text("category").notNull(), // e.g., 'proposal', 'contract', 'attachment'
  leadId: uuid("lead_id"),
  prospectId: uuid("prospect_id"),
  expectedOrderId: uuid("expected_order_id"),
  salesWonId: uuid("sales_won_id"),
  marketerId: uuid("marketer_id").notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const marketingActivities = pgTable("marketing_activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(), // call, meeting, task, reminder
  subject: text("subject").notNull(),
  description: text("description"),
  dueDate: text("due_date"),
  status: text("status").default('pending').notNull(), // pending, completed
  leadId: uuid("lead_id"),
  prospectId: uuid("prospect_id"),
  expectedOrderId: uuid("expected_order_id"),
  salesWonId: uuid("sales_won_id"),
  marketerId: uuid("marketer_id").notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
  reminderDate: text("reminder_date"),
  notificationType: text("notification_type"), // email, sms, in-app
  startTime: text("start_time"),
  endTime: text("end_time"),
  isRecurring: boolean("is_recurring").default(false).notNull(),
  recurrence: text("recurrence"), // daily, weekly, monthly, none
});

export const marketingInteractions = pgTable("marketing_interactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id").notNull(),
  stakeholderId: uuid("stakeholder_id"),
  interactionType: text("interaction_type").default('click').notNull(), // click, open, conversion
  metadata: jsonb("metadata").default({}).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").default(sql`now()`).notNull(),
});
