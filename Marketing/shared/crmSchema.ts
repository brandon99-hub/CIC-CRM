import { pgTable, text, integer, boolean, uuid, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const integrationConfigs = pgTable("integration_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  portalType: text("portal_type").notNull(),
  baseUrl: text("base_url"),
  apiKey: text("api_key"),
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  authType: text("auth_type").default("api_key").notNull(),
  headers: jsonb("headers").default({}).notNull(),
  settings: jsonb("settings").default({}).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastTestedAt: text("last_tested_at"),
  lastTestStatus: text("last_test_status"),
  lastSyncedAt: text("last_synced_at"),
  syncStatus: text("sync_status"),
  syncInterval: integer("sync_interval").default(15).notNull(), // Frequency in minutes
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const organizationSettings = pgTable("organization_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").default([]).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  userEmail: text("user_email"),
  userName: text("user_name"),
  action: text("action").notNull(),
  module: text("module").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
}, (table) => ({
  createdAtIdx: index("audit_log_created_at_idx").on(table.createdAt),
  moduleIdx: index("audit_log_module_idx").on(table.module),
  userIdIdx: index("audit_log_user_id_idx").on(table.userId),
}));

export const stakeholders = pgTable("stakeholders", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  alternateEmail: text("alternate_email"),
  alternatePhone: text("alternate_phone"),
  organization: text("organization"),
  designation: text("designation"),
  county: text("county"),
  region: text("region"),
  country: text("country").default("Kenya").notNull(),
  address: text("address"),
  registrationNumber: text("registration_number"),
  nationalId: text("national_id"), // Encrypted (AES-256-GCM) per DPA 2019
  gender: text("gender"),
  dateOfBirth: text("date_of_birth"),
  engagementScore: integer("engagement_score").default(0).notNull(),
  lifetimeValue: text("lifetime_value"),
  riskLevel: text("risk_level").default("low").notNull(),
  lifecycleStage: text("lifecycle_stage").default("active").notNull(),
  preferredChannel: text("preferred_channel").default("email").notNull(),
  preferredLanguage: text("preferred_language").default("English").notNull(),
  preferredCurrency: text("preferred_currency").default("KES").notNull(),
  timezone: text("timezone").default("Africa/Nairobi").notNull(),
  communicationFrequency: text("communication_frequency").default("As needed").notNull(),
  socialProfiles: jsonb("social_profiles").default({}).notNull(),
  accountId: uuid("account_id"),
  tags: jsonb("tags").default([]).notNull(),
  customFields: jsonb("custom_fields").default({}).notNull(),
  portalAccess: jsonb("portal_access").default({}).notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  consentGiven: boolean("consent_given").default(false),
  consentDate: text("consent_date"),
  consentPurpose: text("consent_purpose"),
  dataRetentionExpiry: text("data_retention_expiry"),
  qualificationPathway: text("qualification_pathway"),
  registrationHistory: jsonb("registration_history").default([]).notNull(),
  registrationExpiryDate: text("registration_expiry_date"),
  examinationHistory: jsonb("examination_history").default([]).notNull(),
  paymentHistory: jsonb("payment_history").default([]).notNull(),
  certificatesAwarded: jsonb("certificates_awarded").default([]).notNull(),
  institutionAttachedTo: text("institution_attached_to"),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  typeIdx: index("stakeholder_type_idx").on(table.type),
  emailIdx: index("stakeholder_email_idx").on(table.email),
  orgIdx: index("stakeholder_organization_idx").on(table.organization),
  regIdx: index("stakeholder_registration_idx").on(table.registrationNumber),
}));

export const stakeholderInteractions = pgTable("stakeholder_interactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  stakeholderId: uuid("stakeholder_id").notNull(),
  type: text("type").notNull(),
  channel: text("channel").notNull(),
  subject: text("subject"),
  description: text("description"),
  direction: text("direction").default("inbound").notNull(),
  caseId: uuid("case_id"),
  performedBy: uuid("performed_by"),
  metadata: jsonb("metadata").default({}).notNull(),
  date: text("date").default(sql`now()`).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
}, (table) => ({
  stakeholderIdx: index("interaction_stakeholder_idx").on(table.stakeholderId),
  typeIdx: index("interaction_type_idx").on(table.type),
}));

export const stakeholderRelationships = pgTable("stakeholder_relationships", {
  id: uuid("id").defaultRandom().primaryKey(),
  stakeholderAId: uuid("stakeholder_a_id").notNull(),
  stakeholderBId: uuid("stakeholder_b_id").notNull(),
  relationshipType: text("relationship_type").notNull(),
  description: text("description"),
  createdAt: text("created_at").default(sql`now()`).notNull(),
}, (table) => ({
  uniqueRelIdx: uniqueIndex("unique_relationship_idx").on(table.stakeholderAId, table.stakeholderBId, table.relationshipType),
  targetIdx: index("relationship_target_idx").on(table.stakeholderBId),
}));

export const cases = pgTable("cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseNumber: text("case_number").unique().notNull(),
  title: text("title").notNull(),
  description: text("description"),
  stakeholderId: uuid("stakeholder_id"),
  serviceCategoryId: uuid("service_category_id"),
  priority: text("priority").default("medium").notNull(),
  status: text("status").default("open").notNull(),
  channel: text("channel").default("email").notNull(),
  assignedTo: uuid("assigned_to"),
  assignedDepartment: uuid("assigned_department"),
  escalationLevel: integer("escalation_level").default(0).notNull(),
  slaDeadline: text("sla_deadline"),
  slaResponseDeadline: text("sla_response_deadline"),
  acceptanceDeadline: text("acceptance_deadline"),
  assignedAt: text("assigned_at"),
  slaBreached: boolean("sla_breached").default(false).notNull(),
  firstResponseAt: text("first_response_at"),
  resolvedAt: text("resolved_at"),
  closedAt: text("closed_at"),
  resolution: text("resolution"),
  initialResponse: text("initial_response"),
  sopSteps: jsonb("sop_steps").default([]).notNull(),
  satisfactionRating: integer("satisfaction_rating"),
  satisfactionFeedback: text("satisfaction_feedback"),
  resolutionDurationMinutes: integer("resolution_duration_minutes"),
  personalNotes: text("personal_notes"),
  tags: jsonb("tags").default([]).notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  rootCause: text("root_cause"),
  createdBy: uuid("created_by"),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  caseNumIdx: index("case_number_idx").on(table.caseNumber),
  statusIdx: index("case_status_idx").on(table.status),
  priorityIdx: index("case_priority_idx").on(table.priority),
  assignedToIdx: index("case_assigned_to_idx").on(table.assignedTo),
  assignedDeptIdx: index("case_assigned_department_idx").on(table.assignedDepartment),
  stakeholderIdx: index("case_stakeholder_idx").on(table.stakeholderId),
  tagsGinIdx: index("case_tags_gin_idx").using("gin", table.tags),
}));

export const caseComments = pgTable("case_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id").notNull(),
  userId: uuid("user_id"),
  content: text("content").notNull(),
  isInternal: boolean("is_internal").default(false).notNull(),
  attachments: jsonb("attachments").default([]).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
});

export const caseAttachments = pgTable("case_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  documentType: text("document_type").default("General").notNull(),
  fileSize: integer("file_size"),
  fileUrl: text("file_url").notNull(),
  uploadedBy: uuid("uploaded_by"),
  createdAt: text("created_at").default(sql`now()`).notNull(),
});

export const caseHistory = pgTable("case_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id").notNull(),
  action: text("action").notNull(),
  fieldChanged: text("field_changed"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedBy: uuid("changed_by"),
  createdAt: text("created_at").default(sql`now()`).notNull(),
});

export const knowledgeBase = pgTable("knowledge_base", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(), // This will be the main article content/resolution
  category: text("category"),
  tags: jsonb("tags").default([]).notNull(),
  serviceCategoryId: uuid("service_category_id"),
  isPublished: boolean("is_published").default(false).notNull(),
  isTemplate: boolean("is_template").default(false).notNull(),
  sourceCaseId: uuid("source_case_id"),
  
  // New columns for structured templates
  originalDescription: text("original_description"),
  channel: text("channel"),
  initialResponse: text("initial_response"),
  resolutionSummary: text("resolution_summary"),
  sopSteps: jsonb("sop_steps").default([]).notNull(), // Array of strings/ordered steps
  rootCause: text("root_cause"),

  viewCount: integer("view_count").default(0).notNull(),
  helpfulCount: integer("helpful_count").default(0).notNull(),
  createdBy: uuid("created_by"),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

// Per-user personal notes on a case (one record per user per case)
export const caseUserNotes = pgTable("case_user_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id").notNull(),
  userId: uuid("user_id").notNull(),
  notes: text("notes").default("").notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  caseUserIdx: index("case_user_notes_case_user_idx").on(table.caseId, table.userId),
}));

export const accreditationProcesses = pgTable("accreditation_processes", {
  id: uuid("id").defaultRandom().primaryKey(),
  stakeholderId: uuid("stakeholder_id").notNull(),
  stage: text("stage").default("inquiry").notNull(), // inquiry, application_submitted, assessment_visit, under_review, active_partner, renewal, lapsed
  status: text("status").default("pending").notNull(),
  assignedOfficerId: uuid("assigned_officer_id"),
  applicationDate: text("application_date"),
  assessmentDate: text("assessment_date"),
  decisionDate: text("decision_date"),
  renewalDate: text("renewal_date"),
  slaDeadline: text("sla_deadline"), // 90-day clock
  notes: text("notes"),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  stakeholderIdx: index("accreditation_stakeholder_idx").on(table.stakeholderId),
  stageIdx: index("accreditation_stage_idx").on(table.stage),
}));



export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  // Types: promotional | informational | newsletter | event
  type: text("type").notNull(),
  // Digital campaigns only (null for events)
  channel: text("channel"),
  status: text("status").default("draft").notNull(),
  subject: text("subject"),
  content: text("content"),
  targetAudience: jsonb("target_audience").default({}).notNull(),
  scheduledAt: text("scheduled_at"),
  sentAt: text("sent_at"),
  totalRecipients: integer("total_recipients").default(0).notNull(),
  delivered: integer("delivered").default(0).notNull(),
  opened: integer("opened").default(0).notNull(),
  clicked: integer("clicked").default(0).notNull(),
  bounced: integer("bounced").default(0).notNull(),
  // Shared financial fields
  budget: text("budget"),
  actualCost: text("actual_cost"),
  // Event-only financial field: funds requisitioned before approval
  requestedAmount: text("requested_amount"),
  // Event-only logistics fields
  venue: text("venue"),
  eventDate: text("event_date"),
  expectedCapacity: integer("expected_capacity"),
  // Public registration link generated for events (set on creation)
  registrationSlug: text("registration_slug"),
  // Ambassador who owns this event (for commission tracking)
  ambassadorId: uuid("ambassador_id"),
  createdBy: uuid("created_by"),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const feedbackSurveys = pgTable("feedback_surveys", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  questions: jsonb("questions").default([]).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  googleFormLink: text("google_form_link"),
  targetAudience: jsonb("target_audience").default({ segment: "all", stakeholderType: "all" }).notNull(),
  totalResponses: integer("total_responses").default(0).notNull(),
  createdBy: uuid("created_by"),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
});

export const feedbackResponses = pgTable("feedback_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  surveyId: uuid("survey_id").notNull(),
  stakeholderId: uuid("stakeholder_id"),
  caseId: uuid("case_id"),
  answers: jsonb("answers").default({}).notNull(),
  rating: integer("rating"),
  comments: text("comments"),
  createdAt: text("created_at").default(sql`now()`).notNull(),
});


export const communications = pgTable("communications", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(),
  channel: text("channel").notNull(),
  direction: text("direction").default("outbound").notNull(),
  stakeholderId: uuid("stakeholder_id"),
  caseId: uuid("case_id"),
  campaignId: uuid("campaign_id"),
  subject: text("subject"),
  content: text("content"),
  status: text("status").default("pending").notNull(),
  sentAt: text("sent_at"),
  deliveredAt: text("delivered_at"),
  readAt: text("read_at"),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  metadata: jsonb("metadata").default({}).notNull(),
  createdBy: uuid("created_by"),
  createdAt: text("created_at").default(sql`now()`).notNull(),
});

export const intakeSignals = pgTable("intake_signals", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: text("source").notNull(),
  rawText: text("raw_text").notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  stakeholderId: uuid("stakeholder_id"),
  suggestedCategoryId: uuid("suggested_category_id"),
  confidenceScore: integer("confidence_score").default(0), // 0-100
  status: text("status").default("pending").notNull(), // pending, mapped, ignored
  mappedCaseId: uuid("mapped_case_id"),
  processedBy: uuid("processed_by"),
  processedAt: text("processed_at"),
  createdAt: text("created_at").default(sql`now()`).notNull(),
});

export const userNotifications = pgTable("user_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").default("info").notNull(), // info, success, warning, error
  module: text("module"), // cases, stakeholders, marketing
  link: text("link"),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
}, (table) => ({
  userIdIdx: index("notification_user_idx").on(table.userId),
  isReadIdx: index("notification_read_idx").on(table.isRead),
}));

export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").unique().notNull(),
  // Case Notifications
  notifyOnAssignment: boolean("notify_on_assignment").default(true).notNull(),
  notifyOnSlaWarning: boolean("notify_on_sla_warning").default(true).notNull(),
  notifyOnComment: boolean("notify_on_comment").default(true).notNull(),
  // Channel Preferences
  emailNotifications: boolean("email_notifications").default(true).notNull(),
  inAppNotifications: boolean("in_app_notifications").default(true).notNull(),
  // Metadata
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  userIdIdx: index("preference_user_idx").on(table.userId),
}));

