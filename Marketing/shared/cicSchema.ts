/**
 * CIC Insurance Group — CIC-Specific Pipeline Schema
 * ─────────────────────────────────────────────────────────────────────────────
 * Design principles applied here:
 *
 * 1. NO DUPLICATION of existing tables. The following tables already exist
 *    and are used as-is (they have CIC fields added in their own files):
 *      - stakeholders       (crmSchema.ts)  — policyholders, agents, SACCOs
 *      - stakeholderInteractions (crmSchema.ts)  — all touchpoints
 *      - communications     (crmSchema.ts)  — outbound/inbound comms
 *      - campaigns          (crmSchema.ts)  — marketing campaigns
 *      - cases              (crmSchema.ts)  — service & claims tickets
 *      - marketingLeads     (schema.ts)     — top-of-funnel leads
 *      - marketingProspects (schema.ts)     — qualified prospects
 *      - departments        (adminSchema.ts) — with isMarketingDepartment flags
 *
 * 2. source_channel MUST use values from CIC_SOURCE_CHANNELS (cicEnums.ts)
 *    which align to the channels already used in stakeholderInteractions.channel,
 *    communications.channel and cases.channel.
 *
 * 3. All monetary amounts are KES (stored as text to avoid float precision
 *    issues; numeric coercion happens at the application layer).
 *
 * 4. snake_case for all database column names.
 *
 * 5. Tables in this file either:
 *    a) Add CIC-specific data that has NO home in existing tables, OR
 *    b) Extend the underwriting/claims domain which is entirely new.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { pgTable, text, integer, boolean, uuid, jsonb, index, uniqueIndex, numeric } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CIC LEADS (B2C / B2B pipeline front-door)
// ─────────────────────────────────────────────────────────────────────────────
// Extends the core marketing pipeline lead concept with CIC-domain fields.
// Linked to marketingLeads.id when a lead comes through the marketing pipeline,
// OR created directly from a walk-in / referral intake.
export const cicLeads = pgTable("cic_leads", {
  id: uuid("id").defaultRandom().primaryKey(),

  // ── Entity 1: Lead (Shared) ──────────────────────────────────────────────────
  leadRef: text("lead_ref").unique().notNull(), 
  pipelineType: text("pipeline_type").default("b2c").notNull(), 
  productLine: text("product_line").notNull(),  
  sourceChannel: text("source_channel").notNull(), 
  firstName: text("first_name"),
  lastName: text("last_name"),
  organisationName: text("organisation_name"), 
  phone: text("phone").notNull(),
  email: text("email"),
  county: text("county"),
  assignedToUserId: uuid("assigned_to_user_id"), 
  stage: text("stage").default("lead").notNull(),
  referredByStakeholderId: uuid("referred_by_stakeholder_id"), 
  conversionStatus: text("conversion_status"),

  // ── Entity 2: B2C Prospect (Stage 2) ─────────────────────────────────────────
  nationalIdNumber: text("national_id_number"),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender"),
  kraPin: text("kra_pin"),
  physicalAddress: text("physical_address"),
  occupation: text("occupation"),
  employerName: text("employer_name"),
  nextOfKinName: text("next_of_kin_name"),
  nextOfKinRelationship: text("next_of_kin_relationship"),
  nextOfKinPhone: text("next_of_kin_phone"),
  coverType: text("cover_type"),
  dependantsCount: integer("dependants_count"),
  medicalHistoryFlag: boolean("medical_history_flag").default(false),
  beneficiaryName: text("beneficiary_name"),
  beneficiaryRelationship: text("beneficiary_relationship"),
  beneficiaryIdNumber: text("beneficiary_id_number"),
  vehicleRegistration: text("vehicle_registration"),
  vehicleMakeModelYear: text("vehicle_make_model_year"),
  logbookUploadUrl: text("logbook_upload_url"),
  idDocumentUploadUrl: text("id_document_upload_url"),
  passportPhotoUploadUrl: text("passport_photo_upload_url"),

  // ── Entity 3: B2B Prospect (Stage 2) ─────────────────────────────────────────
  orgType: text("org_type"),                   
  registrationNumber: text("registration_number"),
  kraPinOrg: text("kra_pin_org"),
  physicalAddressOrg: text("physical_address_org"),
  sectorIndustry: text("sector_industry"),
  sasraStatus: text("sasra_status"),
  totalMemberCount: integer("total_member_count"),
  primaryContactName: text("primary_contact_name"),
  primaryContactTitle: text("primary_contact_title"),
  primaryContactPhone: text("primary_contact_phone"),
  primaryContactEmail: text("primary_contact_email"),
  secondaryContactDetails: text("secondary_contact_details"),
  existingInsurer: text("existing_insurer"),
  existingPremiumKes: text("existing_premium_kes"),
  censusFileUploadUrl: text("census_file_upload_url"),
  relationshipOfficerAssigned: text("relationship_officer_assigned"),
  saccoAgmDate: text("sacco_agm_date"),

  // ── Entity 4: B2C Quote & Underwriting (Stage 3) ─────────────────────────────
  quotedPremiumKes: text("quoted_premium_kes"),
  riskClass: text("risk_class"),
  loadingPercentage: text("loading_percentage"),
  exclusionsApplied: text("exclusions_applied"),
  underwritingDecision: text("underwriting_decision"),
  referralReason: text("referral_reason"),
  underwriterId: uuid("underwriter_id"),
  fclApplicable: boolean("fcl_applicable").default(false),
  sumInsuredConfirmedKes: text("sum_insured_confirmed_kes"),
  policyStartDateProposed: text("policy_start_date_proposed"),
  policyEndDateProposed: text("policy_end_date_proposed"),
  paymentFrequency: text("payment_frequency"),
  paymentMethod: text("payment_method"),
  underwritingNotes: text("underwriting_notes"),
  dateOfUnderwritingDecision: text("date_of_underwriting_decision"),

  // ── Entity 5: B2B Proposal & Underwriting (Stage 3) ──────────────────────────
  ageBandDistribution: jsonb("age_band_distribution"),
  genderSplit: jsonb("gender_split"),
  occupationClass: text("occupation_class"),
  industryRiskRating: text("industry_risk_rating"),
  priorLossRatio: text("prior_loss_ratio"),
  priorClaimsCount: integer("prior_claims_count"),
  priorClaimsAmountKes: text("prior_claims_amount_kes"),
  yearsOfClaimsHistory: integer("years_of_claims_history"),
  benefitStructure: jsonb("benefit_structure"),
  fclPerMemberKes: text("fcl_per_member_kes"),
  groupQuotedPremiumKes: text("group_quoted_premium_kes"),
  perMemberQuotedPremiumKes: text("per_member_quoted_premium_kes"),
  coPayPercentage: text("co_pay_percentage"),
  counterOfferTerms: text("counter_offer_terms"),
  slaTerms: text("sla_terms"),
  proposalDocumentUploadUrl: text("proposal_document_upload_url"),
  schemeRulesDocumentUploadUrl: text("scheme_rules_document_upload_url"),

  // ── Original Fields preserved ──────────────────────────────────────────────────
  region: text("region"),
  sourceCampaignId: uuid("source_campaign_id"),
  estimatedAnnualPremium: text("estimated_annual_premium"), 
  sumAssured: text("sum_assured"),
  stakeholderId: uuid("stakeholder_id"),     
  marketingLeadId: uuid("marketing_lead_id"), 
  departmentId: uuid("department_id"),           
  notes: text("notes"),
  lostReason: text("lost_reason"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  pipelineTypeIdx: index("cic_lead_pipeline_type_idx").on(table.pipelineType),
  stageIdx: index("cic_lead_stage_idx").on(table.stage),
  productLineIdx: index("cic_lead_product_line_idx").on(table.productLine),
  stakeholderIdx: index("cic_lead_stakeholder_idx").on(table.stakeholderId),
  deptIdx: index("cic_lead_dept_idx").on(table.departmentId),
}));

// ─────────────────────────────────────────────────────────────────────────────
// 2. CIC POLICIES (policy spine — links across all insurance lines)
// ─────────────────────────────────────────────────────────────────────────────
export const cicPolicies = pgTable("cic_policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  // ── Entity 6: Policy (Shared B2C + B2B, Stage 4) ─────────────────────────────
  policyNumber: text("policy_number").unique().notNull(), 
  pipelineType: text("pipeline_type").default("b2c").notNull(),
  linkedLeadId: uuid("linked_lead_id"), 
  policyholderName: text("policyholder_name").notNull(),
  policyType: text("policy_type").notNull(), 
  sumInsuredKes: text("sum_insured_kes"),
  annualPremiumKes: text("annual_premium_kes").notNull(),
  policyStartDate: text("policy_start_date").notNull(),
  policyEndDate: text("policy_end_date").notNull(),
  renewalDate: text("renewal_date"),
  coverStatus: text("cover_status").default("active").notNull(), 
  paymentStatus: text("payment_status").default("unpaid").notNull(), 
  intermediaryCode: text("intermediary_code"),
  intermediaryName: text("intermediary_name"),
  intermediaryType: text("intermediary_type"), 
  commissionRate: text("commission_rate"), 
  commissionAmountKes: text("commission_amount_kes"),
  debitNoteNumber: text("debit_note_number"),
  debitNoteDate: text("debit_note_date"),
  debitNoteAmountKes: text("debit_note_amount_kes"),
  underwritingReference: text("underwriting_reference"),
  policyDocumentUploadUrl: text("policy_document_upload_url"),
  scheduleOfCoverUploadUrl: text("schedule_of_cover_upload_url"),
  issuanceDate: text("issuance_date"),
  issuedById: uuid("issued_by_id"),

  // ── Entity 7: B2B Active Scheme (Stage 5 B2B) ────────────────────────────────
  masterPolicyNumber: text("master_policy_number"),
  memberScheduleVersion: text("member_schedule_version"),
  currentActiveMemberCount: integer("current_active_member_count"),
  premiumCollectionMethod: text("premium_collection_method"),
  collectionDate: text("collection_date"), 
  lastPremiumReceivedDate: text("last_premium_received_date"),
  lastPremiumAmountKes: text("last_premium_amount_kes"),
  outstandingPremiumKes: text("outstanding_premium_kes"),
  lastMemberScheduleUpdateDate: text("last_member_schedule_update_date"),
  renewalDueDate: text("renewal_due_date"),
  accountManagerAssigned: text("account_manager_assigned"),
  nextReviewDate: text("next_review_date"),
  schemePerformanceNotes: text("scheme_performance_notes"),

  // ── Entity 8: B2C Dormant (Stage 5 B2C) ──────────────────────────────────────
  dormantSinceDate: text("dormant_since_date"),
  lastPremiumPaidDate: text("last_premium_paid_date"),
  renewalCampaignStatus: text("renewal_campaign_status"), 
  renewalCampaignTriggerDate: text("renewal_campaign_trigger_date"),
  renewalQuoteAmountKes: text("renewal_quote_amount_kes"),
  renewalContactAttemptsCount: integer("renewal_contact_attempts_count").default(0),
  preferredRenewalChannel: text("preferred_renewal_channel"),
  winBackFlag: boolean("win_back_flag").default(false),
  lapseReason: text("lapse_reason"),

  // ── Original Fields preserved ────────────────────────────────────────────────
  stakeholderId: uuid("stakeholder_id").notNull(), 
  premiumFrequency: text("premium_frequency").default("annual").notNull(),
  nextPremiumDueDate: text("next_premium_due_date"),
  groupPremium: text("group_premium"),
  underwritingStatus: text("underwriting_status"), 
  underwritingNotes: text("underwriting_notes"),
  riskRating: text("risk_rating"),                 
  exclusions: jsonb("exclusions").default([]).notNull(), 
  issuingChannel: text("issuing_channel"),         
  agentId: uuid("agent_id"),                       
  branchCode: text("branch_code"),
  documents: jsonb("documents").default([]).notNull(), 
  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  stakeholderIdx: index("policy_stakeholder_idx").on(table.stakeholderId),
  statusIdx: index("policy_status_idx").on(table.coverStatus),
  renewalDateIdx: index("policy_renewal_date_idx").on(table.renewalDate),
  productLineIdx: index("policy_product_line_idx").on(table.policyType),
}));

// ─────────────────────────────────────────────────────────────────────────────
// 3. CIC PREMIUM PAYMENTS (payment ledger per policy)
// ─────────────────────────────────────────────────────────────────────────────
export const cicPremiumPayments = pgTable("cic_premium_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  policyId: uuid("policy_id").notNull(),          // FK → cic_policies.id
  stakeholderId: uuid("stakeholder_id").notNull(), // FK → stakeholders.id
  amount: text("amount").notNull(),               // KES
  paymentDate: text("payment_date").notNull(),
  method: text("method").notNull(),               // from CIC_PAYMENT_METHODS
  reference: text("reference"),                   // MPesa code / bank ref
  receiptNumber: text("receipt_number"),
  periodFrom: text("period_from"),
  periodTo: text("period_to"),
  isPartial: boolean("is_partial").default(false).notNull(),
  remarks: text("remarks"),
  recordedBy: uuid("recorded_by"),               // FK → marketing_users.id
  createdAt: text("created_at").default(sql`now()`).notNull(),
}, (table) => ({
  policyIdx: index("premium_payment_policy_idx").on(table.policyId),
  stakeholderIdx: index("premium_payment_stakeholder_idx").on(table.stakeholderId),
  dateIdx: index("premium_payment_date_idx").on(table.paymentDate),
}));

// ─────────────────────────────────────────────────────────────────────────────
// 4. CIC CLAIMS
// ─────────────────────────────────────────────────────────────────────────────
// Claims are also handled as `cases` in the core CRM for tracking and SLA.
// This table is the insurance-domain specific record that sits alongside the
// case. Linked via claimCaseId → cases.id.
export const cicClaims = pgTable("cic_claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  claimNumber: text("claim_number").unique().notNull(), // CIC/CLM/MOTOR/2025/00001
  policyId: uuid("policy_id").notNull(),               // FK → cic_policies.id
  stakeholderId: uuid("stakeholder_id").notNull(),      // FK → stakeholders.id
  claimCaseId: uuid("claim_case_id"),                  // FK → cases.id (for SLA tracking)

  productLine: text("product_line").notNull(),
  incidentDate: text("incident_date").notNull(),
  reportedDate: text("reported_date").notNull(),
  incidentDescription: text("incident_description").notNull(),

  // ── Financials ────────────────────────────────────────────────────────────────
  claimedAmount: text("claimed_amount").notNull(),      // KES requested
  approvedAmount: text("approved_amount"),              // KES approved (null until assessed)
  paidAmount: text("paid_amount"),                      // KES actually disbursed
  excessAmount: text("excess_amount"),                  // KES policyholder bears
  paymentDate: text("payment_date"),

  // ── Status / Workflow ─────────────────────────────────────────────────────────
  status: text("status").default("submitted").notNull(), // from CIC_CLAIM_STATUSES

  // ── Assessment ────────────────────────────────────────────────────────────────
  assessorId: uuid("assessor_id"),                     // FK → marketing_users.id
  assessmentNotes: text("assessment_notes"),
  rejectionReason: text("rejection_reason"),

  // ── Supporting Documents ──────────────────────────────────────────────────────
  documents: jsonb("documents").default([]).notNull(), // [{ category, fileUrl, uploadedAt }]

  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  policyIdx: index("claim_policy_idx").on(table.policyId),
  stakeholderIdx: index("claim_stakeholder_idx").on(table.stakeholderId),
  statusIdx: index("claim_status_idx").on(table.status),
  productLineIdx: index("claim_product_line_idx").on(table.productLine),
}));

// ─────────────────────────────────────────────────────────────────────────────
// 5. CIC UNDERWRITING RECORDS
// ─────────────────────────────────────────────────────────────────────────────
// Tracks the underwriting workflow for each policy application.
// Aligned with the underwriting fields already in cic_policies — this table
// holds the FULL audit trail of the underwriting process.
export const cicUnderwriting = pgTable("cic_underwriting", {
  id: uuid("id").defaultRandom().primaryKey(),
  policyId: uuid("policy_id"),              // FK → cic_policies.id (null until policy created)
  cicLeadId: uuid("cic_lead_id").notNull(), // FK → cic_leads.id (starts at lead stage)
  stakeholderId: uuid("stakeholder_id").notNull(), // FK → stakeholders.id

  productLine: text("product_line").notNull(),
  status: text("status").default("pending_documents").notNull(), // from CIC_UNDERWRITING_STATUSES
  underwriterId: uuid("underwriter_id"),    // FK → marketing_users.id (assigned underwriter)

  // ── Risk Assessment ────────────────────────────────────────────────────────────
  riskScore: integer("risk_score"),         // 0-100
  riskNotes: text("risk_notes"),
  loadingPercentage: text("loading_percentage"), // KES loading on base premium
  exclusions: jsonb("exclusions").default([]).notNull(),
  conditions: jsonb("conditions").default([]).notNull(), // special conditions imposed

  // ── Document Checklist ────────────────────────────────────────────────────────
  requiredDocuments: jsonb("required_documents").default([]).notNull(),
  // [{ category: CicDocumentCategory, required: boolean, received: boolean, fileUrl?: string }]
  receivedDocuments: jsonb("received_documents").default([]).notNull(),

  // ── Decisions ─────────────────────────────────────────────────────────────────
  decisionDate: text("decision_date"),
  decisionNotes: text("decision_notes"),
  approvedPremium: text("approved_premium"), // KES final premium after loading

  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  leadIdx: index("underwriting_lead_idx").on(table.cicLeadId),
  policyIdx: index("underwriting_policy_idx").on(table.policyId),
  statusIdx: index("underwriting_status_idx").on(table.status),
}));

// ─────────────────────────────────────────────────────────────────────────────
// 6. CIC RENEWAL PIPELINE
// ─────────────────────────────────────────────────────────────────────────────
// Tracks the renewal workflow for expiring policies, feeding back into the
// B2C/B2B pipeline at the 'renewal' lifecycle stage.
export const cicRenewals = pgTable("cic_renewals", {
  id: uuid("id").defaultRandom().primaryKey(),
  policyId: uuid("policy_id").notNull(),          // FK → cic_policies.id
  stakeholderId: uuid("stakeholder_id").notNull(), // FK → stakeholders.id
  assignedToUserId: uuid("assigned_to_user_id"),  // FK → marketing_users.id

  renewalDate: text("renewal_date").notNull(),
  reminderSentAt: text("reminder_sent_at"),
  reminderChannel: text("reminder_channel"),       // from CIC_SOURCE_CHANNELS

  status: text("status").default("pending").notNull(),
  // pending | contacted | quote_sent | renewed | lapsed | cancelled

  previousPremium: text("previous_premium"),       // KES
  newPremium: text("new_premium"),                 // KES
  changeReason: text("change_reason"),

  notes: text("notes"),
  convertedAt: text("converted_at"),               // timestamp when renewal confirmed

  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  policyIdx: index("renewal_policy_idx").on(table.policyId),
  stakeholderIdx: index("renewal_stakeholder_idx").on(table.stakeholderId),
  renewalDateIdx: index("renewal_date_idx").on(table.renewalDate),
  statusIdx: index("renewal_status_idx").on(table.status),
}));

// ─────────────────────────────────────────────────────────────────────────────
// 7. CIC AGENT / BROKER COMMISSIONS
// ─────────────────────────────────────────────────────────────────────────────
export const cicCommissions = pgTable("cic_commissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").notNull(),             // FK → stakeholders.id (agent/broker)
  policyId: uuid("policy_id").notNull(),           // FK → cic_policies.id
  paymentId: uuid("payment_id"),                   // FK → cic_premium_payments.id

  productLine: text("product_line").notNull(),
  premiumAmount: text("premium_amount").notNull(), // KES premium the commission is on
  commissionRate: text("commission_rate").notNull(), // % e.g. "12.5"
  commissionAmount: text("commission_amount").notNull(), // KES computed amount
  vatAmount: text("vat_amount"),                   // KES VAT on commission
  netAmount: text("net_amount"),                   // KES after VAT

  period: text("period").notNull(),                // YYYY-MM (monthly period)
  status: text("status").default("pending").notNull(), // pending | approved | paid | withheld

  paidDate: text("paid_date"),
  remarks: text("remarks"),

  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  agentIdx: index("commission_agent_idx").on(table.agentId),
  policyIdx: index("commission_policy_idx").on(table.policyId),
  periodIdx: index("commission_period_idx").on(table.period),
  statusIdx: index("commission_status_idx").on(table.status),
}));

// ─────────────────────────────────────────────────────────────────────────────
// 8. CIC B2B GROUP MEMBERS (lives on a group policy)
// ─────────────────────────────────────────────────────────────────────────────
// For SACCOs, corporates, NGOs — tracks each insured member / life.
// Each member may also have a stakeholders record (linked via stakeholderId).
export const cicGroupMembers = pgTable("cic_group_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  policyId: uuid("policy_id").notNull(),            // FK → cic_policies.id (the group policy)
  stakeholderId: uuid("stakeholder_id"),             // FK → stakeholders.id if exists

  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  nationalId: text("national_id"),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender"),
  phone: text("phone"),
  email: text("email"),
  employeeNumber: text("employee_number"),          // internal ID from employer/SACCO
  relationship: text("relationship"),               // self | spouse | child | parent
  coverType: text("cover_type"),                    // principal | dependent
  sumAssured: text("sum_assured"),                  // KES individual cover
  startDate: text("start_date"),
  endDate: text("end_date"),
  isActive: boolean("is_active").default(true).notNull(),

  createdAt: text("created_at").default(sql`now()`).notNull(),
  updatedAt: text("updated_at").default(sql`now()`).notNull(),
}, (table) => ({
  policyIdx: index("group_member_policy_idx").on(table.policyId),
  nationalIdIdx: index("group_member_national_id_idx").on(table.nationalId),
}));

// ─────────────────────────────────────────────────────────────────────────────
// 9. CIC MARKETING SIMULATION LEADS
// ─────────────────────────────────────────────────────────────────────────────
// Staging table for leads generated by the Simulate Scenarios feature.
// Rows here are synthetic and do NOT affect real policy/claims counts.
// They can be promoted to real cic_leads / marketing_leads by the admin.
export const cicSimulationLeads = pgTable("cic_simulation_leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  batchId: uuid("batch_id").notNull(),              // groups a single simulation run
  pipelineType: text("pipeline_type").notNull(),    // b2c | b2b
  productLine: text("product_line").notNull(),
  stage: text("stage").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  organisationName: text("organisation_name"),
  orgType: text("org_type"),
  phone: text("phone"),
  email: text("email"),
  county: text("county"),
  estimatedAnnualPremium: text("estimated_annual_premium"),
  sourceChannel: text("source_channel"),            // from CIC_SOURCE_CHANNELS
  groupSize: integer("group_size"),
  isPromoted: boolean("is_promoted").default(false).notNull(), // true = moved to real pipeline
  promotedToLeadId: uuid("promoted_to_lead_id"),   // FK → cic_leads.id
  createdAt: text("created_at").default(sql`now()`).notNull(),
}, (table) => ({
  batchIdx: index("sim_lead_batch_idx").on(table.batchId),
  pipelineTypeIdx: index("sim_lead_pipeline_type_idx").on(table.pipelineType),
}));
