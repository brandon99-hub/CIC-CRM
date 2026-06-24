import { z } from "zod";

// Marketing User Schemas
export const marketingUserRoleSchema = z.string().min(1, "Role is required");
export const salesStageSchema = z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost', 'prospect', 'expected_order', 'sales_won', 'lost', 'opportunity', 'engagement']);
export const quarterSchema = z.enum(['Q1', 'Q2', 'Q3', 'Q4']);
export const needAvailabilitySchema = z.enum(['upgrade', 'under_implementation', 'none']);
export const leadStageSchema = z.enum(['lead', 'prospect', 'opportunity', 'engagement', 'prospect_registration', 'prospect_booking', 'converted']);
export const prospectStageSchema = z.enum(['opportunity', 'engagement', 'prospect', 'lead', 'expected_order', 'sales_won', 'lost', 'prospect_registration', 'prospect_booking', 'converted']);
export const customerTypeSchema = z.enum(['student', 'institution', 'organization', 'employer']);

// Marketing User Schemas
export const marketingUserLoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const marketingUserRegisterSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().optional(),
  role: marketingUserRoleSchema.default('marketer'),
  bdType: z.enum(['b2b', 'b2c', 'both']).default('b2b'),
});

export const stakeholderWriteSchema = z.object({
  type: z.string().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  organization: z.string().max(200).optional(),
  county: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  nationalId: z.string().max(20).optional(),
  kraPin: z.string().max(20).optional(),
  registrationNumber: z.string().max(50).optional(),
  designation: z.string().max(100).optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  lifecycleStage: z.string().optional(),
  preferredChannel: z.union([z.string(), z.array(z.string())]).optional(),
  preferredLanguage: z.string().optional(),
  communicationFrequency: z.string().optional(),
  socialProfiles: z.record(z.string()).optional(),
  productLine: z.string().optional(),
  policyNumber: z.string().optional(),
  policyRenewalDate: z.string().optional(),
  consentGiven: z.boolean().optional(),
  consentDate: z.string().optional(),
  consentPurpose: z.string().optional(),
  riskLevel: z.string().optional(),
  parentOrganization: z.string().optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const marketingUserUpdateSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  phoneNumber: z.string().optional(),
  role: marketingUserRoleSchema.optional(),
  isActive: z.boolean().optional(),
  target: z.number().positive("Target must be positive").optional(),
  bdType: z.enum(['b2b', 'b2c', 'both']).optional(),
});

// Sector Schemas
export const marketingSectorCreateSchema = z.object({
  name: z.string().min(1, "Sector name is required").max(200, "Sector name too long"),
  description: z.string().optional(),
});

export const marketingSectorUpdateSchema = marketingSectorCreateSchema.partial();

// Project Schemas (Cleaning up systemInPlace here too)
export const marketingProjectCreateSchema = z.object({
  sectorId: z.string().min(1, "Sector is required"),
  institution: z.string().min(1, "Institution name is required").max(200, "Institution name too long"),
  leadMarketer: z.string().optional(),
  contactPerson: z.string().max(200, "Contact person name too long").optional(),
  contactNumber: z.string().max(20, "Contact number too long").optional(),
  needAvailability: needAvailabilitySchema.optional(),
  currentVendor: z.string().max(200, "Current vendor name too long").optional(),
  remarks: z.string().optional(),
  status: z.enum(['active', 'completed', 'paused']).default('active'),
});

export const marketingProjectUpdateSchema = z.object({
  institution: z.string().min(1, "Institution name is required").max(200, "Institution name too long").optional(),
  leadMarketer: z.string().nullable().optional(),
  contactPerson: z.string().max(200, "Contact person name too long").optional(),
  contactNumber: z.string().max(20, "Contact number too long").optional(),
  needAvailability: needAvailabilitySchema.optional(),
  currentVendor: z.string().max(200, "Current vendor name too long").optional(),
  remarks: z.string().optional(),
  status: z.enum(['active', 'completed', 'paused']).optional(),
  sectorId: z.string().optional(),
}).transform((data) => {
  return {
    ...data,
    leadMarketer: data.leadMarketer === "" ? undefined : data.leadMarketer,
    contactPerson: data.contactPerson === "" ? undefined : data.contactPerson,
    contactNumber: data.contactNumber === "" ? undefined : data.contactNumber,
    currentVendor: data.currentVendor === "" ? undefined : data.currentVendor,
    remarks: data.remarks === "" ? undefined : data.remarks,
  };
});

// Lead Schemas
export const marketingLeadCreateSchema = z.object({
  date: z.string().min(1, "Date is required"),
  client: z.string().min(1, "Client name is required").max(200, "Client name too long"),
  contactPerson: z.string().min(1, "Contact person is required").max(200, "Contact person name too long"),
  contactNumber: z.string().min(1, "Contact number is required").max(50, "Contact number too long"),
  contactEmail: z.string().min(1, "Contact email is required").max(255, "Email too long"),
  customerType: customerTypeSchema.optional(),
  needAvailability: needAvailabilitySchema.optional(),
  currentVendor: z.string().max(200, "Current vendor name too long").optional(),
  remarks: z.string().optional(),
  revenue: z.number().min(0, "Revenue cannot be negative").optional(),
  stage: leadStageSchema.default('lead'),
  sectorId: z.string().optional(),
  sourceCampaignId: z.string().uuid().optional().nullable(),
});

export const marketingLeadUpdateSchema = marketingLeadCreateSchema.partial().extend({
  marketerId: z.string().optional(),
  bdId: z.string().optional(),
});

// Prospect Schemas
export const marketingProspectCreateSchema = z.object({
  date: z.string().min(1, "Date is required"),
  client: z.string().min(1, "Client name is required").max(200, "Client name too long"),
  contactPerson: z.string().min(1, "Contact person is required").max(200, "Contact person name too long"),
  contactNumber: z.string().min(1, "Contact number is required").max(50, "Contact number too long"),
  contactEmail: z.string().min(1, "Contact email is required").max(255, "Email too long"),
  needAvailability: needAvailabilitySchema.optional(),
  currentVendor: z.string().max(200, "Current vendor name too long").optional(),
  remarks: z.string().optional(),
  revenue: z.number().min(0, "Revenue cannot be negative").optional(),
  stage: prospectStageSchema.default('opportunity'),
  sectorId: z.string().optional(),
  sourceCampaignId: z.string().uuid().optional().nullable(),
});

export const marketingProspectUpdateSchema = marketingProspectCreateSchema.partial().extend({
  marketerId: z.string().optional(),
  bdId: z.string().optional(),
});

// Shared Account Schemas
export const marketingSharedAccountSchema = z.object({
  originalId: z.string().min(1, "Original ID is required"),
  sharedWithMarketerId: z.string().min(1, "Marketer member to share with is required"),
  revenueSplit: z.number().min(0, "Revenue split must be positive").max(100, "Revenue split cannot exceed 100%"),
});

// Sales Won Schemas
export const marketingSalesWonCreateSchema = z.object({
  organisationName: z.string().min(1, "Organisation name is required").max(200, "Organisation name too long"),
  sector: z.string().min(1, "Sector is required").max(100, "Sector name too long"),
  product: z.string().min(1, "Product is required").max(200, "Product name too long"),
  contractAmount: z.number().min(0, "Contract amount cannot be negative"),
  expectedQuarter: quarterSchema,
  comments: z.string().optional(),
  customerType: customerTypeSchema.optional(),
  sourceCampaignId: z.string().uuid().optional().nullable(),
});

export const marketingSalesWonUpdateSchema = marketingSalesWonCreateSchema.partial().extend({
  marketerId: z.string().optional(),
});

// Expected Orders Schemas
export const marketingExpectedOrdersCreateSchema = z.object({
  organisationName: z.string().min(1, "Organisation name is required").max(200, "Organisation name too long"),
  sector: z.string().min(1, "Sector is required").max(100, "Sector name too long"),
  product: z.string().min(1, "Product is required").max(200, "Product name too long"),
  revenue: z.number().min(0, "Revenue cannot be negative"),
  expectedQuarter: quarterSchema,
  comments: z.string().optional(),
  customerType: customerTypeSchema.optional(),
  sourceCampaignId: z.string().uuid().optional().nullable(),
});

export const marketingExpectedOrdersUpdateSchema = marketingExpectedOrdersCreateSchema.partial().extend({
  marketerId: z.string().optional(),
});


// Annual Summary Schemas
export const marketingAnnualSummaryCreateSchema = z.object({
  year: z.number().int().min(2020, "Year must be 2020 or later").max(2030, "Year must be 2030 or earlier"),
  salesExecutive: z.string().min(1, "Sales executive name is required").max(200, "Sales executive name too long"),
  won: z.number().min(0, "Won amount cannot be negative").default(0),
  target: z.number().positive("Target must be positive"),
  targetAchieved: z.number().min(0, "Target achieved cannot be negative").max(100, "Target achieved cannot exceed 100%").default(0),
  expectedOrders: z.number().min(0, "Expected orders cannot be negative").default(0),
  statusQuo: z.number().min(0, "Status quo cannot be negative").default(0),
  deviationFromTarget: z.number().default(0),
  sumSalesExpected: z.number().min(0, "Sum sales expected cannot be negative").default(0),
  expectedTarget: z.number().min(0, "Expected target cannot be negative").default(0),
  bookingTarget: z.number().int().min(0).default(0).optional(),
  registrationTarget: z.number().int().min(0).default(0).optional(),
  commissionPercentage: z.number().int().min(0).max(100).default(5).optional(),
});

export const marketingAnnualSummaryUpdateSchema = marketingAnnualSummaryCreateSchema.partial();

// Query Schemas
export const marketingQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default("1"),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default("10"),
  search: z.string().optional(),
  year: z.string().transform(Number).pipe(z.number().int()).optional(),
  quarter: quarterSchema.optional(),
  sector: z.string().optional(),
  marketerId: z.string().optional(),
  bdId: z.string().optional(),
  sectorId: z.string().optional(),
  stage: z.string().optional(),
  customerType: z.string().optional(),
  month: z.string().transform(Number).pipe(z.number().int().min(1).max(12)).optional(),
  pipeline: z.string().optional(),
});

// Export Schemas
export const marketingExportSchema = z.object({
  type: z.enum(['leads', 'sales-won', 'expected-orders', 'prospects', 'annual-summary', 'documents']),
  format: z.enum(['csv', 'excel']).default('excel'),
  year: z.string().transform(Number).pipe(z.number().int()).optional(),
  quarter: quarterSchema.optional(),
  marketerId: z.string().optional(),
});

// Document Schemas
export const marketingDocumentCreateSchema = z.object({
  name: z.string().min(1, "Document name is required").max(200, "Document name too long"),
  category: z.enum(['proposal', 'contract', 'attachment']).default('attachment'),
  leadId: z.string().uuid().optional(),
  prospectId: z.string().uuid().optional(),
  expectedOrderId: z.string().uuid().optional(),
  salesWonId: z.string().uuid().optional(),
});

export const marketingDocumentUpdateSchema = marketingDocumentCreateSchema.partial();

// Activity Schemas
export const marketingActivityCreateSchema = z.object({
  type: z.enum(['call', 'meeting', 'task', 'reminder']).default('task'),
  subject: z.string().min(1, "Subject is required").max(200, "Subject too long"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  reminderDate: z.string().optional(),
  status: z.enum(['pending', 'completed']).default('pending'),
  leadId: z.string().uuid().optional(),
  prospectId: z.string().uuid().optional(),
  expectedOrderId: z.string().uuid().optional(),
  salesWonId: z.string().uuid().optional(),
  notificationType: z.enum(['email', 'sms', 'in-app']).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  isRecurring: z.boolean().default(false).optional(),
  recurrence: z.enum(['daily', 'weekly', 'monthly', 'none']).optional(),
});

export const marketingActivityUpdateSchema = marketingActivityCreateSchema.partial();

// Campaign Schemas
export const marketingCampaignCreateSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  type: z.string().min(1, "Type is required"),
  channel: z.string().min(1, "Channel is required"),
  status: z.enum(['draft', 'scheduled', 'sent']).default('draft'),
  subject: z.string().optional(),
  content: z.string().optional(),
  scheduledAt: z.string().optional(),
  targetAudience: z.any().optional(),
  budget: z.string().optional(),
  actualCost: z.string().optional(),
  ctaUrl: z.string().url("Invalid CTA URL").optional().or(z.literal("")),
});

export const marketingCampaignUpdateSchema = marketingCampaignCreateSchema.partial();

// Interaction Schemas
export const marketingInteractionCreateSchema = z.object({
  campaignId: z.string().uuid(),
  stakeholderId: z.string().uuid().optional().nullable(),
  interactionType: z.enum(['click', 'open', 'conversion']).default('click'),
  metadata: z.record(z.any()).optional().default({}),
});
