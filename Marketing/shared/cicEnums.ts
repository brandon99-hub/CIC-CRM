/**
 * CIC Insurance Group — Master Enum Definitions
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all domain enumerations used across:
 *   - cicSchema.ts (cic_leads, cic_policies, cic_claims, cic_underwriting …)
 *   - adminSchema.ts (departments, serviceCategories)
 *   - crmSchema.ts (stakeholders, cases, stakeholderInteractions, communications)
 *   - marketingSchema.ts (activity notificationType, customer types)
 *
 * IMPORTANT: These are plain TypeScript const arrays — NOT Drizzle pg enums.
 * Using text columns keeps migrations cheap while still providing compile-time
 * validation through Zod (see cicSchema.ts).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Product Lines ─────────────────────────────────────────────────────────────
export const CIC_PRODUCT_LINES = [
  "motor",
  "medical",
  "life",
  "property",
  "marine",
  "pension",
  "group_life",
  "micro_insurance",
  "personal_accident",
  "last_expense",
  "other",
] as const;
export type CicProductLine = (typeof CIC_PRODUCT_LINES)[number];

// ── Customer / Stakeholder Types ──────────────────────────────────────────────
export const CIC_CUSTOMER_TYPES = [
  "individual_policyholder", // B2C retail individual
  "sacco_cooperative",       // SACCO / Cooperative group
  "corporate_client",        // Company / Employer group
  "bancassurance_partner",   // Bank-linked distribution
  "agent",                   // Licensed intermediary agent
  "broker",                  // Licensed broker firm
  "staff",                   // Internal CIC employee
] as const;
export type CicCustomerType = (typeof CIC_CUSTOMER_TYPES)[number];

// ── Pipeline Types ────────────────────────────────────────────────────────────
export const CIC_PIPELINE_TYPES = ["b2c", "b2b", "both"] as const;
export type CicPipelineType = (typeof CIC_PIPELINE_TYPES)[number];

// ── B2C Lead / Policy Lifecycle Stages ───────────────────────────────────────
export const CIC_B2C_STAGES = [
  "lead",
  "prospect",
  "quote_underwriting",
  "policy_issued",
  "dormant",
] as const;
export type CicB2cStage = (typeof CIC_B2C_STAGES)[number];

// ── B2B Lead / Policy Lifecycle Stages ───────────────────────────────────────
export const CIC_B2B_STAGES = [
  "lead",
  "prospect",
  "proposal_underwriting",
  "policy_issued",
  "active",
] as const;
export type CicB2bStage = (typeof CIC_B2B_STAGES)[number];

// ── Policy Status ─────────────────────────────────────────────────────────────
export const CIC_POLICY_STATUSES = [
  "active",
  "lapsed",
  "cancelled",
  "suspended",
  "under_review",
  "renewal_due",
  "expired",
] as const;
export type CicPolicyStatus = (typeof CIC_POLICY_STATUSES)[number];

// ── Claim Status ──────────────────────────────────────────────────────────────
export const CIC_CLAIM_STATUSES = [
  "submitted",
  "under_review",
  "additional_info_required",
  "approved",
  "partially_approved",
  "rejected",
  "paid",
  "withdrawn",
] as const;
export type CicClaimStatus = (typeof CIC_CLAIM_STATUSES)[number];

// ── Underwriting Status ───────────────────────────────────────────────────────
export const CIC_UNDERWRITING_STATUSES = [
  "pending_documents",
  "risk_assessment",
  "approved",
  "rated_up",
  "excluded",
  "declined",
] as const;
export type CicUnderwritingStatus = (typeof CIC_UNDERWRITING_STATUSES)[number];

// ── Source / Acquisition Channels (EXISTING channels in the system) ───────────
// These MUST match the channel values used in:
//   - stakeholderInteractions.channel
//   - communications.channel
//   - cases.channel
//   - campaigns (digital)
//   - stakeholders.preferredChannel
export const CIC_SOURCE_CHANNELS = [
  "email",           // Email marketing / inbound email
  "phone",           // Outbound / inbound call
  "sms",             // SMS blast / inbound SMS
  "whatsapp",        // WhatsApp outreach
  "portal",          // Client self-service portal
  "walk_in",         // Branch / walk-in
  "referral",        // Agent / broker referral
  "event",           // CIC-sponsored event / exhibition
  "direct",          // Direct sales visit
  "social_media",    // Facebook, Instagram, LinkedIn
  "bancassurance",   // Bank partner channel
] as const;
export type CicSourceChannel = (typeof CIC_SOURCE_CHANNELS)[number];

// ── Premium Payment Methods ───────────────────────────────────────────────────
export const CIC_PAYMENT_METHODS = [
  "mpesa",
  "bank_transfer",
  "cheque",
  "cash",
  "standing_order",
  "deduction",       // Payroll / SACCO deduction
  "card",
] as const;
export type CicPaymentMethod = (typeof CIC_PAYMENT_METHODS)[number];

// ── CIC Kenya Regions ─────────────────────────────────────────────────────────
export const CIC_KENYA_REGIONS = [
  "nairobi",
  "central",
  "coast",
  "eastern",
  "north_eastern",
  "nyanza",
  "rift_valley",
  "western",
] as const;
export type CicKenyaRegion = (typeof CIC_KENYA_REGIONS)[number];

// ── Risk Level ────────────────────────────────────────────────────────────────
export const CIC_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type CicRiskLevel = (typeof CIC_RISK_LEVELS)[number];

// ── Stakeholder Lifecycle Stages (CIC-aligned) ────────────────────────────────
export const CIC_LIFECYCLE_STAGES = [
  "lead",
  "prospect",
  "active",
  "renewal",
  "lapsed",
  "cancelled",
  "suspended",
] as const;
export type CicLifecycleStage = (typeof CIC_LIFECYCLE_STAGES)[number];

// ── Communication Frequency ───────────────────────────────────────────────────
export const CIC_COMM_FREQUENCIES = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "as_needed",
] as const;
export type CicCommFrequency = (typeof CIC_COMM_FREQUENCIES)[number];

// ── B2B Organisation Subtypes ─────────────────────────────────────────────────
export const CIC_B2B_ORG_TYPES = [
  "sacco",
  "corporate",
  "ngo",
  "school",
  "government",
  "microfinance",
  "chama",
] as const;
export type CicB2bOrgType = (typeof CIC_B2B_ORG_TYPES)[number];

// ── Document Categories ───────────────────────────────────────────────────────
export const CIC_DOCUMENT_CATEGORIES = [
  "proposal_form",
  "id_copy",
  "kra_pin",
  "valuation_report",
  "logbook",
  "medical_report",
  "claim_form",
  "police_abstract",
  "bank_statement",
  "group_schedule",    // B2B — list of group members
  "renewal_notice",
  "policy_document",
  "endorsement",
  "other",
] as const;
export type CicDocumentCategory = (typeof CIC_DOCUMENT_CATEGORIES)[number];
