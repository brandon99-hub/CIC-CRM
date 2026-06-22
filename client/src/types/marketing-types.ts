export interface DashboardStats {
    year: number;
    prospectsCount: number;
    leadsCount: number;
    expectedOrdersCount: number;
    salesWonCount: number;
    totalRevenue: number;
    target: number;
    revisedTarget: number;
    expectedTarget: number;
    targetAchievement: number;
    annualSummary: any;
    b2cStats?: any;
}

export interface AdminDashboardStats {
    year: number;
    totalProspectsCount: number;
    totalLeadsCount: number;
    totalExpectedOrdersCount: number;
    totalSalesWonCount: number;
    totalRevenue: number;
    totalExpectedOrdersRevenue: number;
    bdStats: Array<{
        bdId: string;
        bdName: string;
        prospectsCount: number;
        leadsCount: number;
        expectedOrdersCount: number;
        salesWonCount: number;
        totalRevenue: number;
    }>;
    b2cStats?: any;
}

export interface AnalyticsData {
    year: number;
    conversionRates: any[];
    quarterlyStats: any[];
    bdStats: Array<{
        bdId: string;
        bdName: string;
        salesWonAmount?: number;
        expectedOrdersAmount?: number;
        target?: number;
        totalRevenue?: number;
    }>;
    topPerformers: Array<{
        marketerId: string;
        marketerName: string;
        salesWonAmount: number;
        expectedOrdersAmount: number;
        leadsCount: number;
        totalProspectsHandled: number;
        target: number;
        conversionRate: number;
        weightedScore: number;
        totalRevenue: number;
    }>;
    salesWonPerMarketer: Array<{
        marketerId: string;
        marketerName: string;
        salesWon: number;
        target: number;
        achievementRate: number;
    }>;
    expectedOrdersShare: Array<{
        marketerId: string;
        marketerName: string;
        expectedOrders: number;
        percentage: number;
        color: string;
    }>;
    monthlyTrends: Array<{
        month: string;
        leads: number;
        salesWon: number;
        expectedOrders: number;
    }>;
}

export interface MarketingUser {
    id: string;
    role: string;
    permissions?: string[];
    name?: string;
    email: string;
    firstName: string;
    lastName: string;
    mustChangePassword?: boolean;
    dashboardAccess?: string[];
    bdType?: 'b2c' | 'b2b' | 'both';
}
