// Shared types/constants for CIC Insurance stakeholder dashboard components
export const STAKEHOLDER_TYPES = ["individual_policyholder", "sacco_cooperative", "corporate_client", "agent", "broker", "bancassurance_partner", "staff"] as const;
export type StakeholderType = (typeof STAKEHOLDER_TYPES)[number];

export interface Stakeholder {
    id: string;
    firstName: string;
    lastName: string;
    /** Computed convenience field — use `${firstName} ${lastName}` where needed */
    name?: string;
    type: StakeholderType;
    email: string;
    phone: string;
    alternateEmail?: string;
    alternatePhone?: string;
    organization: string;
    designation?: string;
    county?: string;
    region?: string;
    country?: string;
    policyNumber?: string;              // e.g. CIC/MOTOR/2025/00123
    engagementScore: number;
    riskLevel: string;
    lifecycleStage: string;
    preferredChannel?: string;
    preferredLanguage?: string;
    communicationFrequency?: string;
    socialProfiles?: Record<string, string>;
    accountId?: string;
    isActive?: boolean;
    address?: string;
    notes?: string;
    portalAccess?: any;
    metadata?: any;
    tags?: string[];
    createdAt?: string;
    updatedAt?: string;
    // CIC Insurance-specific fields
    productLine?: string;               // motor | life | medical | property | marine | pension | group_life | micro_insurance
    policyRenewalDate?: string;         // ISO date — triggers renewal automation
    claimsHistory?: any[];              // [{ claimId, type, status, amount, date }]
    policyHistory?: any[];              // [{ policyNumber, product, startDate, endDate, status }]
    premiumPaymentHistory?: any[];      // [{ amount, date, method, reference }]
    parentOrganization?: string;        // For agents/brokers: brokerage/agency name
}

export interface Interaction {
    id: string; stakeholderId: string; stakeholderName?: string;
    caseId?: string; caseNumber?: string;
    type: string; channel?: string; subject: string; description: string;
    notes?: string;
    date: string; createdBy?: string; createdAt?: string;
    status?: string; priority?: string; stakeholderType?: string;
}

export interface Relationship {
    id: string;
    stakeholderAId?: string; stakeholderBId?: string;
    sourceStakeholderId: string; targetStakeholderId: string;
    sourceName?: string; targetName?: string;
    sourceType?: string; targetType?: string;
    relationshipType: string;
    relationshipLabel?: string;
    description?: string; createdAt?: string;
}

export interface StakeholderStats {
    total: number;
    byType: Record<string, number>;
    avgEngagementByType?: Record<string, number>;
    avgEngagement: number;
    riskDistribution: Record<string, number>;
    activeCount: number;
    inactiveCount: number;
    regionalDistribution?: Record<string, number>;
    mostEngagedTypeLastWeek?: { type: string; count: number } | null;
}
