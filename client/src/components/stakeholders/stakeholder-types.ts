// Shared types/constants for stakeholder dashboard components
export const STAKEHOLDER_TYPES = ["student", "alumni", "institution", "employer", "corporate_partner", "government_agency", "media", "sponsor", "international_student", "vendor", "staff", "department", "other"] as const;
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
    registrationNumber?: string;
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
    qualificationPathway?: string;
    registrationExpiryDate?: string;
    registrationHistory?: any[];
    examinationHistory?: any[];
    paymentHistory?: any[];
    certificatesAwarded?: any[];
    institutionAttachedTo?: string;
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
