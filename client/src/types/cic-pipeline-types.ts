import { CicProductLine, CicSourceChannel, CicB2bOrgType, CicKenyaRegion, CicB2cStage, CicB2bStage } from "../../../Marketing/shared/cicEnums";

export type PipelineStage = CicB2cStage | CicB2bStage | string;
export interface PipelineSummaryMetrics {
  totalLeadsThisMonth: number;
  leadsByStage: Record<PipelineStage, number>;  // for sparkline
  conversionRateLeadToPolicy: number;           // percentage
  totalPremiumInPipelineKes: number;
}

export interface B2CPipelineCard {
  leadId: string;
  contactName: string;
  phone: string;
  productLine: CicProductLine | null;
  sumInsuredEstimateKes: number | null;
  assignedAgentName: string | null;
  sourceChannel: CicSourceChannel;
  daysInCurrentStage: number;           // calculated: now - last stage transition
  pipelineStage: PipelineStage;
  nationalIdNumber?: string;            // masked: XXX-XXXX-X
  county?: CicKenyaRegion;
  coverType?: string;
  quotedPremiumKes?: number | null;
  underwritingDecision?: string;
  dateOfUnderwritingDecision?: string;
  lapseReason?: string;
  dormantSinceDate?: string;
  renewalCampaignStatus?: string;
  policyStartDate?: string;
  paymentMethod?: string;
}

export interface B2BPipelineCard {
  leadId: string;
  organisationName: string;
  schemeType: CicB2bOrgType | string | null;
  totalLives: number | null;
  groupPremiumEstimateKes: number | null;
  relationshipOfficerName: string | null;
  daysInCurrentStage: number;
  pipelineStage: PipelineStage;
  county?: CicKenyaRegion;
  sectorIndustry?: string;
  priorLossRatio?: string;
  underwritingDecision?: string;
  dateOfUnderwritingDecision?: string;
  premiumCollectionMethod?: string;
  lastPremiumReceivedDate?: string;
  outstandingPremiumKes?: number | null;
  renewalDueDate?: string;
}

export interface PipelineFilterParams {
  pipelineType: 'b2c' | 'b2b' | 'all';
  stage?: PipelineStage;
  search?: string;
  sortBy?: 'newest' | 'oldest' | 'days_in_stage' | 'premium_high' | 'lives_high';
  page: number;
  limit: number;
}
