import { Fragment, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Users, TrendingUp, DollarSign, Target, Plus, FileDown, BarChart3,
    Filter, Table as TableIcon, Activity, PieChart, Megaphone, Zap,
    Trophy, Medal, Award, Star, GraduationCap, Building2
} from "lucide-react";
import { StatsCarousel } from "@/components/shared/stats-carousel";
import { SalesWonChart } from "@/components/marketing/sales-won-chart";
import { MonthlyTrendsChart } from "@/components/marketing/monthly-trends-chart";
import {
    SalesWonChartSkeleton, LineChartSkeleton, TableSkeleton,
} from "@/components/marketing/chart-skeletons";
import { cn } from "@/lib/utils";

import { DashboardStats, AdminDashboardStats, AnalyticsData, MarketingUser } from "@/types/marketing-types";
import { MarketingKanban, KanbanItem } from "@/components/marketing/marketing-kanban";
import { ForecastingChart } from "@/components/marketing/forecasting-chart";

interface ForecastData {
    stage: string;
    actual: number;
    weighted: number;
    prob: number;
}

interface MarketingOverviewProps {
    user: MarketingUser;
    stats: DashboardStats | null;
    adminStats: AdminDashboardStats | null;
    analytics: AnalyticsData | null;
    analyticsLoading: boolean;
    viewMode: "chart" | "table";
    selectedYear: string;
    selectedMonth: string;
    onViewModeChange: (mode: "chart" | "table") => void;
    onYearChange: (year: string) => void;
    onMonthChange: (month: string) => void;
    onRetryAnalytics: () => void;
    onAddProspect: () => void;
    onExport: (type: string) => void;
    kanbanData: {
        lead: KanbanItem[];
        prospect: KanbanItem[];
        expected_order: KanbanItem[];
        sales_won: KanbanItem[];
    } | null;
    kanbanLoading: boolean;
    onKanbanStatusChange: (id: string, newStatus: string, currentStatus: string) => void;
    forecastData: any | null;
    forecastLoading: boolean;
    pipelineMode: "B2C" | "B2B";
    setPipelineMode: (mode: "B2C" | "B2B") => void;
    selectedCycle: string;
    setSelectedCycle: (cycle: string) => void;
    selectedCycleYear: string;
    setSelectedCycleYear: (year: string) => void;
}

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const MarketingOverviewHeader = ({
    userName,
    stats,
    isAdmin,
    adminStats,
    pipelineMode,
    setPipelineMode,
    user
}: {
    userName?: string,
    stats: DashboardStats | null,
    isAdmin: boolean,
    adminStats: AdminDashboardStats | null,
    pipelineMode: "B2C" | "B2B",
    setPipelineMode: (mode: "B2C" | "B2B") => void,
    user: MarketingUser
}) => {
    const prospects = pipelineMode === "B2C"
        ? (((isAdmin ? adminStats?.b2cStats : stats?.b2cStats) as any)?.registered?.count ?? 0) + (((isAdmin ? adminStats?.b2cStats : stats?.b2cStats) as any)?.bookings?.count ?? 0)
        : (isAdmin ? (adminStats?.totalProspectsCount || 0) : (stats?.prospectsCount || 0));
    const leads = pipelineMode === "B2C"
        ? (((isAdmin ? adminStats?.b2cStats : stats?.b2cStats) as any)?.leads?.count ?? 0)
        : (isAdmin ? (adminStats?.totalLeadsCount || 0) : (stats?.leadsCount || 0));
    const salesWon = pipelineMode === "B2C"
        ? (((isAdmin ? adminStats?.b2cStats : stats?.b2cStats) as any)?.converted?.count ?? 0)
        : (isAdmin ? (adminStats?.totalSalesWonCount || 0) : (stats?.salesWonCount || 0));

    const marketingStats = [
        {
            label: pipelineMode === "B2C" ? "Pipeline (Students)" : "Pipeline (Business)",
            value: pipelineMode === "B2C" ? `${prospects} Enrolled` : `${prospects} Prospects`,
            description: isAdmin
                ? `${prospects} total items across the entire team's active pipeline.`
                : `${prospects} items currently in your active follow-up queue.`,
            color: "text-blue-600"
        },
        {
            label: "Leads Generated",
            value: `${leads} Leads`,
            description: isAdmin
                ? `${leads} qualified leads being managed across the full team.`
                : `${leads} qualified leads currently in your active follow-up queue.`,
            color: "text-[#01a64e]"
        },
        {
            label: "Sales Won",
            value: `${salesWon} Closed`,
            description: isAdmin
                ? `${salesWon} total successful sales closed by the full marketing team this year.`
                : `${salesWon} successful sales you have closed and confirmed this year.`,
            color: "text-[#004E98]"
        }
    ];

    const [greeting, setGreeting] = useState("Hello");
    useEffect(() => {
        const nairobiTime = new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi", hour: "numeric", hour12: false });
        const hour = parseInt(nairobiTime, 10);
        if (hour >= 5 && hour < 12) setGreeting("Good Morning");
        else if (hour >= 12 && hour < 17) setGreeting("Good Afternoon");
        else if (hour >= 17 && hour < 21) setGreeting("Good Evening");
        else setGreeting("Welcome");
    }, []);

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-8">
            <div className="p-4 md:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-4 md:gap-8 relative">
                <div className="space-y-3 relative z-10 pl-2 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-2.5 w-2.5 rounded-full bg-[#01a64e] animate-pulse" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                            {new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Africa/Nairobi" })}
                        </span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight leading-tight">
                                {greeting}, <span className="text-[#01a64e]">{userName || "Marketer"}</span>
                            </h1>
                        </div>
                    </div>
                </div>

                <div className="w-full xl:w-[420px] relative z-10">
                    <StatsCarousel stats={marketingStats} />
                </div>
            </div>
        </div>
    );
};

export function MarketingOverview({
    user,
    stats,
    adminStats,
    analytics,
    analyticsLoading,
    viewMode,
    selectedYear,
    selectedMonth,
    onViewModeChange,
    onYearChange,
    onMonthChange,
    onRetryAnalytics,
    onAddProspect,
    onExport,
    kanbanData,
    kanbanLoading,
    onKanbanStatusChange,
    forecastData,
    forecastLoading,
    pipelineMode,
    setPipelineMode,
    selectedCycle,
    setSelectedCycle,
    selectedCycleYear,
    setSelectedCycleYear
}: MarketingOverviewProps) {
    const isAdmin = user.permissions?.includes("marketing.view_all") || user.permissions?.includes("admin.view");
    const canViewAnalytics = user.permissions?.includes("marketing.view_analytics") || isAdmin;
    const hasSalesWonChartPermission = isAdmin || user.permissions?.includes("marketing.view_sales_won_vs_target");
    const hasAnnualSummaryPermission = isAdmin || user.permissions?.includes("marketing.view_annual_summary");
    const hasTopPerformersPermission = isAdmin || user.permissions?.includes("marketing.view_top_performers");

    const currentB2cStats = isAdmin ? (adminStats as any)?.b2cStats : (stats as any)?.b2cStats;

    return (
        <div className="space-y-6">
            <MarketingOverviewHeader
                userName={user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user.email}
                stats={stats}
                isAdmin={!!isAdmin}
                adminStats={adminStats}
                pipelineMode={pipelineMode}
                setPipelineMode={setPipelineMode}
                user={user}
            />

            {/* Centered Underline Switcher Toggle */}
            {((user.bdType === 'both' || !user.bdType) || isAdmin) && (
                <div className="flex justify-center w-full pt-4 pb-2">
                    <div className="flex items-center gap-8 border-b border-gray-200/50 px-8">
                        <button
                            type="button"
                            onClick={() => setPipelineMode("B2C")}
                            className={cn(
                                "relative pb-3 flex items-center justify-center gap-2 text-[12px] font-black tracking-widest uppercase transition-all duration-300 border-b-[3px]",
                                pipelineMode === "B2C" 
                                    ? "text-[#004E98] border-[#004E98]" 
                                    : "text-gray-400 hover:text-gray-600 border-transparent"
                            )}
                        >
                            <GraduationCap className="h-4 w-4" />
                            Student Pipeline
                        </button>
                        <button
                            type="button"
                            onClick={() => setPipelineMode("B2B")}
                            className={cn(
                                "relative pb-3 flex items-center justify-center gap-2 text-[12px] font-black tracking-widest uppercase transition-all duration-300 border-b-[3px]",
                                pipelineMode === "B2B" 
                                    ? "text-[#004E98] border-[#004E98]" 
                                    : "text-gray-400 hover:text-gray-600 border-transparent"
                            )}
                        >
                            <Building2 className="h-4 w-4" />
                            Partner Pipeline
                        </button>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {pipelineMode === "B2C" ? (
                    // B2C Student Track Stats Row
                    <Fragment>
                        <Card className="hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">Active Student Leads</CardTitle>
                                <div className="p-2 bg-[#004E98]/10 rounded-lg"><Users className="h-4 w-4 text-[#004E98]" /></div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-gray-900">
                                    {currentB2cStats?.leads?.count ?? 0}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Total leads generated</p>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">Registered Students</CardTitle>
                                <div className="p-2 bg-[#01a64e]/10 rounded-lg"><Award className="h-4 w-4 text-[#01a64e]" /></div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-gray-900">
                                    {currentB2cStats?.registered?.count ?? 0}
                                </div>
                                <p className="text-xs text-[#01a64e] font-medium mt-1">
                                    Value: {formatCurrency(currentB2cStats?.registered?.value ?? 0)}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">Exam Bookings</CardTitle>
                                <div className="p-2 bg-[#D0AC01]/10 rounded-lg"><TrendingUp className="h-4 w-4 text-[#D0AC01]" /></div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-gray-900">
                                    {formatCurrency(currentB2cStats?.bookings?.value ?? 0)}
                                </div>
                                <p className="text-xs text-[#D0AC01] font-medium mt-1">
                                    {currentB2cStats?.bookings?.count ?? 0} sits (sitting fees value)
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">Converted (Rebookings)</CardTitle>
                                <div className="p-2 bg-[#004E98]/10 rounded-lg"><Medal className="h-4 w-4 text-[#004E98]" /></div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-gray-900">
                                    {formatCurrency(currentB2cStats?.converted?.value ?? 0)}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {currentB2cStats?.converted?.count ?? 0} recurring student sits
                                </p>
                            </CardContent>
                        </Card>
                    </Fragment>
                ) : (
                    // B2B Partner Track Stats Row
                    <Fragment>
                        {isAdmin ? (
                            <Card className="hover:shadow-md transition-shadow">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-600">Total Prospects (All)</CardTitle>
                                    <div className="p-2 bg-[#004E98]/10 rounded-lg"><Users className="h-4 w-4 text-[#004E98]" /></div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-gray-900">{adminStats?.totalProspectsCount || 0}</div>
                                    <p className="text-xs text-gray-500 mt-1">All marketers combined</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="hover:shadow-md transition-shadow">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-600">Target Achievement</CardTitle>
                                    <div className="p-2 bg-[#e55f00]/10 rounded-lg"><Target className="h-4 w-4 text-[#e55f00]" /></div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-gray-900">{formatCurrency(stats?.totalRevenue || 0)}</div>
                                    <p className="text-xs text-[#01a64e] font-medium mt-1">
                                        {stats && (stats.revisedTarget > 0 || stats.target > 0) ? (
                                            <>of {formatCurrency(stats.revisedTarget > 0 ? stats.revisedTarget : stats.target)} {stats.revisedTarget > 0 ? "revised " : ""}target</>
                                        ) : "No target set for this year"}
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        <Card className="hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">{isAdmin ? "Total Sales Won (All)" : "Sales Won"}</CardTitle>
                                <div className="p-2 bg-[#01a64e]/10 rounded-lg"><DollarSign className="h-4 w-4 text-[#01a64e]" /></div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-gray-900">
                                    {formatCurrency(isAdmin ? adminStats?.totalRevenue || 0 : stats?.totalRevenue || 0)}
                                </div>
                                <p className="text-xs text-[#01a64e] font-medium mt-1">
                                    <span>{isAdmin ? adminStats?.totalSalesWonCount || 0 : stats?.salesWonCount || 0} contracts</span>
                                    {" "}• {isAdmin ? "All marketers combined" : "Contract value secured"}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">{isAdmin ? "Total Expected Orders (All)" : "Expected Orders"}</CardTitle>
                                <div className="p-2 bg-[#D0AC01]/10 rounded-lg"><TrendingUp className="h-4 w-4 text-[#D0AC01]" /></div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-gray-900">
                                    {formatCurrency(isAdmin ? adminStats?.totalExpectedOrdersRevenue || 0 : stats?.expectedTarget || 0)}
                                </div>
                                <p className="text-xs text-[#D0AC01] font-medium mt-1">
                                    <span>{isAdmin ? adminStats?.totalExpectedOrdersCount || 0 : stats?.expectedOrdersCount || 0} orders</span>
                                    {" "}• {isAdmin ? "All marketers combined" : "Expected revenue"}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">Target Achievement Rate</CardTitle>
                                <div className="p-2 bg-[#004E98]/10 rounded-lg"><Target className="h-4 w-4 text-[#004E98]" /></div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-gray-900">
                                    {isAdmin ? (adminStats as any)?.targetAchievement ?? 0 : stats?.targetAchievement ?? 0}%
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{isAdmin ? "All marketers combined" : "Annual monetary target"}</p>
                            </CardContent>
                        </Card>
                    </Fragment>
                )}
            </div>
            
            {/* Pipeline Kanban Board */}
            <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Pipeline Kanban</h3>
                        <p className="text-xs text-gray-500 font-medium">Visualize and manage your deals across pipeline stages</p>
                    </div>
                </div>
                <MarketingKanban 
                    data={kanbanData || { lead: [], prospect_registration: [], prospect_booking: [], converted: [], prospect_engagement: [], expected_order: [], sales_won: [] }} 
                    pipelineType={pipelineMode}
                    isLoading={kanbanLoading}
                    onStatusChange={onKanbanStatusChange}
                />
            </div>

            {/* Forecasting Chart */}
            <div className="grid grid-cols-1 gap-6 pt-4">
                <ForecastingChart 
                    data={forecastData?.forecast || []} 
                    isLoading={forecastLoading}
                    historicalData={forecastData?.historicalData}
                    quarterlyTarget={forecastData?.quarterlyTarget}
                    expectedOrderDeals={forecastData?.expectedOrderDeals}
                    studentData={forecastData?.studentData}
                    studentHistoricalData={forecastData?.studentHistoricalData}
                    studentReturningRebookers={forecastData?.studentReturningRebookers}
                    studentRebookingRate={forecastData?.studentRebookingRate}
                    dormantStudentCount={forecastData?.dormantStudentCount}
                    pipelineMode={pipelineMode}
                    bookingTarget={forecastData?.bookingTarget}
                    isProbabilityEstimated={forecastData?.isProbabilityEstimated}
                    staleCounts={forecastData?.staleCounts}
                    pipelineVelocity={forecastData?.pipelineVelocity}
                    avgSalesCycleLength={forecastData?.avgSalesCycleLength}
                    selectedCycle={selectedCycle}
                    setSelectedCycle={setSelectedCycle}
                    selectedCycleYear={selectedCycleYear}
                    setSelectedCycleYear={setSelectedCycleYear}
                />
            </div>

            {/* Admin Analytics */}
            {canViewAnalytics && (
                <div className="space-y-6">
                    {/* View Toggle and Filters */}
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Analytics Dashboard</h3>
                            <p className="text-sm text-gray-600">
                                Performance insights and visualizations
                                <span className="ml-2 text-[#004E98] font-medium">
                                    • {selectedMonth !== "all" ? new Date(0, parseInt(selectedMonth) - 1).toLocaleString("default", { month: "long" }) + " " : ""}{selectedYear}
                                </span>
                            </p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center space-x-2">
                                <Filter className="h-4 w-4 text-gray-500" />
                                <Select value={selectedYear} onValueChange={onYearChange}>
                                    <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Array.from({ length: 5 }, (_, i) => {
                                            const year = new Date().getFullYear() - i;
                                            return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                                        })}
                                    </SelectContent>
                                </Select>
                                <Select value={selectedMonth} onValueChange={onMonthChange}>
                                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Months</SelectItem>
                                        {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                                            <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {(selectedYear !== new Date().getFullYear().toString() || selectedMonth !== "all") && (
                                    <Button variant="outline" size="sm" onClick={() => { onYearChange(new Date().getFullYear().toString()); onMonthChange("all"); }} className="h-8 text-xs">Clear</Button>
                                )}
                            </div>
                            <div className="flex items-center space-x-2">
                                <Button variant={viewMode === "chart" ? "default" : "outline"} size="sm" onClick={() => onViewModeChange("chart")} className="h-8">
                                    <BarChart3 className="h-4 w-4 mr-1" />Charts
                                </Button>
                                <Button variant={viewMode === "table" ? "default" : "outline"} size="sm" onClick={() => onViewModeChange("table")} className="h-8">
                                    <TableIcon className="h-4 w-4 mr-1" />Tables
                                </Button>
                            </div>
                        </div>
                    </div>

                    {viewMode === "chart" ? (
                        <div className="space-y-6">
                            {analyticsLoading ? (
                                <Fragment>
                                    <div>
                                        {hasSalesWonChartPermission && <SalesWonChartSkeleton />}

                                    </div>
                                    <LineChartSkeleton />
                                </Fragment>
                            ) : analytics ? (
                                <Fragment>
                                    <div>
                                        {hasSalesWonChartPermission && (
                                            <SalesWonChart 
                                                data={analytics.salesWonPerMarketer} 
                                                pipelineMode={pipelineMode}
                                                title={pipelineMode === "B2C" ? "Bookings vs Target" : "Sales Won vs Target"} 
                                                description={pipelineMode === "B2C" ? "Individual ambassador performance against booking targets" : "Individual marketer performance against targets"} 
                                            />
                                        )}

                                    </div>
                                    <MonthlyTrendsChart data={analytics.monthlyTrends} title="Monthly Performance Trends" description="Performance trends over the past months" pipelineMode={pipelineMode} />
                                </Fragment>
                            ) : (
                                <div className="text-center py-12">
                                    <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                                    <p className="text-lg font-medium text-gray-500">No Analytics Data Available</p>
                                    <p className="text-sm text-gray-400">Analytics data could not be loaded. Please try refreshing.</p>
                                    <Button onClick={onRetryAnalytics} variant="outline" className="mt-4">Retry Loading</Button>
                                </div>
                            )}

                            {/* Annual Summary Table */}
                            {hasAnnualSummaryPermission && (
                                <Card className="border-0 shadow-sm">
                                    <CardHeader className="pb-4">
                                        <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
                                            <BarChart3 className="h-5 w-5 text-[#01a64e] mr-2" />Annual Summary
                                        </CardTitle>
                                        <CardDescription className="text-gray-600">Business development performance overview</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {analyticsLoading ? <TableSkeleton /> : (
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        {pipelineMode === "B2C" ? (
                                                            <TableRow>
                                                                <TableHead>Brand Ambassador</TableHead>
                                                                <TableHead className="text-right">Converted Students</TableHead>
                                                                <TableHead className="text-right">New Registrations</TableHead>
                                                                <TableHead className="text-right">Registrations Value</TableHead>
                                                                <TableHead className="text-right">Commission Rate</TableHead>
                                                                <TableHead className="text-right">Commission Payout</TableHead>
                                                                <TableHead className="text-right">Exam Bookings</TableHead>
                                                                <TableHead className="text-right">Bookings Target</TableHead>
                                                                <TableHead className="text-right">Target Achieved</TableHead>
                                                            </TableRow>
                                                        ) : (
                                                            <TableRow>
                                                                <TableHead>Sales Executive</TableHead>
                                                                <TableHead className="text-right">Won</TableHead>
                                                                <TableHead className="text-right">Target</TableHead>
                                                                <TableHead className="text-right">Target Achieved</TableHead>
                                                                <TableHead className="text-right">Expected Orders</TableHead>
                                                                <TableHead className="text-right">Deviation from Target</TableHead>
                                                                <TableHead className="text-right">Sum Sales + Expected</TableHead>
                                                            </TableRow>
                                                        )}
                                                    </TableHeader>
                                                    <TableBody>
                                                        {analytics?.bdStats && analytics.bdStats.length > 0 ? analytics.bdStats.map((bd, index) => {
                                                            if (pipelineMode === "B2C") {
                                                                const convertedCount = bd.expectedOrdersAmount || 0;
                                                                const registrationsCount = (bd as any).leadsCount || 0;
                                                                const registrationsValue = bd.salesWonAmount || 0;
                                                                const bookingsCount = (bd as any).prospectsCount || 0;
                                                                const bookingTarget = (bd as any).bookingTarget || 0;
                                                                const commissionPercentage = (bd as any).commissionPercentage || 5;
                                                                const commissionPayout = registrationsValue * (commissionPercentage / 100);
                                                                const targetAchieved = bookingTarget > 0 ? ((bookingsCount / bookingTarget) * 100).toFixed(2) : "0.00";
                                                                return (
                                                                    <TableRow key={bd.bdId || index}>
                                                                        <TableCell className="font-medium">{bd.bdName || "Unknown"}</TableCell>
                                                                        <TableCell className="text-right font-mono font-bold text-[#004E98]">{convertedCount}</TableCell>
                                                                        <TableCell className="text-right font-mono text-emerald-600 font-semibold">{registrationsCount}</TableCell>
                                                                        <TableCell className="text-right font-mono">{formatCurrency(registrationsValue)}</TableCell>
                                                                        <TableCell className="text-right font-mono">{commissionPercentage}%</TableCell>
                                                                        <TableCell className="text-right font-mono font-bold text-emerald-700">{formatCurrency(commissionPayout)}</TableCell>
                                                                        <TableCell className="text-right font-mono">{bookingsCount}</TableCell>
                                                                        <TableCell className="text-right font-mono">{bookingTarget}</TableCell>
                                                                        <TableCell className="text-right font-mono font-bold">{targetAchieved}%</TableCell>
                                                                    </TableRow>
                                                                );
                                                            }
                                                            
                                                            const won = bd.salesWonAmount || 0;
                                                            const target = bd.target || 0;
                                                            const expectedOrders = bd.expectedOrdersAmount || 0;
                                                            const targetAchieved = target > 0 ? ((won / target) * 100).toFixed(2) : "0.00";
                                                            const deviation = won - target;
                                                            return (
                                                                <TableRow key={bd.bdId || index}>
                                                                    <TableCell className="font-medium">{bd.bdName || "Unknown"}</TableCell>
                                                                    <TableCell className="text-right font-mono">{formatCurrency(won)}</TableCell>
                                                                    <TableCell className="text-right font-mono">{formatCurrency(target)}</TableCell>
                                                                    <TableCell className="text-right font-mono">{targetAchieved}%</TableCell>
                                                                    <TableCell className="text-right font-mono">{formatCurrency(expectedOrders)}</TableCell>
                                                                    <TableCell className={`text-right font-mono ${deviation >= 0 ? "text-[#01a64e]" : "text-red-600"}`}>
                                                                        {deviation >= 0 ? "+" : ""}{formatCurrency(deviation)}
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono">{formatCurrency(won + expectedOrders)}</TableCell>
                                                                </TableRow>
                                                            );
                                                        }) : (
                                                            <TableRow><TableCell colSpan={pipelineMode === "B2C" ? 9 : 7} className="text-center py-8 text-gray-500">No annual summary data available</TableCell></TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Top Performers */}
                            {hasTopPerformersPermission && (
                                <Card className="border-0 shadow-sm">
                                    <CardHeader className="pb-4">
                                        <CardTitle className="text-lg font-semibold text-gray-900">Top Performers</CardTitle>
                                        <CardDescription className="text-gray-600">
                                            {pipelineMode === "B2C" 
                                                ? "Ranked by weighted performance score (New Registrations 40%, Exam Bookings 25%, Student Leads 20%, Booking Target 15%)"
                                                : "Ranked by weighted performance score (Sales Won 40%, Expected Orders 25%, Leads 20%, Conversion 15%)"
                                            }
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {analytics?.topPerformers?.map((performer, index) => {
                                                const isFirst = index === 0;
                                                const isSecond = index === 1;
                                                const isThird = index === 2;
                                                
                                                return (
                                                    <div 
                                                        key={performer.marketerId} 
                                                        className="group relative flex flex-col p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#004E98]/20 transition-all duration-300 overflow-hidden"
                                                    >
                                                        {isFirst && (
                                                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                                                <Trophy className="w-16 h-16 text-[#D0AC01]" />
                                                            </div>
                                                        )}
                                                        
                                                        <div className="flex items-start justify-between mb-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={cn(
                                                                    "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm",
                                                                    isFirst ? "bg-[#D0AC01]/10 text-[#D0AC01] border border-[#D0AC01]/20" :
                                                                    isSecond ? "bg-slate-100 text-slate-500 border border-slate-200" :
                                                                    isThird ? "bg-amber-100 text-amber-700 border border-amber-200" :
                                                                    "bg-gray-50 text-gray-400 border border-gray-100"
                                                                )}>
                                                                    {isFirst ? <Trophy className="w-4 h-4" /> : index + 1}
                                                                </div>
                                                                <div>
                                                                    <h4 className="font-bold text-gray-900 leading-tight">{performer.marketerName}</h4>
                                                                    <p className="text-[10px] font-medium text-[#004E98] uppercase tracking-wider mt-0.5">Performance Tier</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-2xl font-black text-gray-900 leading-none">{performer.weightedScore.toFixed(0)}%</div>
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Score</span>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-4">
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                                                                        {pipelineMode === "B2C" ? "New Registrations" : "Sales Won"}
                                                                    </span>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-[#01a64e]" />
                                                                        <span className="text-sm font-black text-gray-800">
                                                                            {pipelineMode === "B2C" ? performer.salesWonAmount : formatCurrency(performer.salesWonAmount)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                                                                        {pipelineMode === "B2C" ? "Bookings Target" : "Target"}
                                                                    </span>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-[#e55f00]" />
                                                                        <span className="text-sm font-black text-gray-800">
                                                                            {pipelineMode === "B2C" ? performer.target : formatCurrency(performer.target || 0)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-1.5 pt-1">
                                                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                                                                    <span className="text-gray-400">Weighted Performance</span>
                                                                    <span className="text-[#01a64e]">{performer.weightedScore.toFixed(1)}%</span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className={cn(
                                                                            "h-full rounded-full transition-all duration-1000 ease-out",
                                                                            isFirst ? "bg-gradient-to-r from-[#D0AC01] to-[#FFD700]" :
                                                                            "bg-[#01a64e]"
                                                                        )}
                                                                        style={{ width: `${Math.min(performer.weightedScore, 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    ) : (
                        /* Table view */
                        <div className="space-y-6">
                            {analyticsLoading ? (
                                <Fragment><TableSkeleton /><TableSkeleton /><TableSkeleton /></Fragment>
                            ) : analytics ? (
                                <Fragment>
                                    {/* Sales Won vs Target Table */}
                                    {hasSalesWonChartPermission && (
                                        <Card className="border-0 shadow-sm">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                                                    <BarChart3 className="h-5 w-5 text-[#004E98]" /><span>Sales Won vs Target Performance</span>
                                                </CardTitle>
                                                <CardDescription>Individual marketer performance against targets with achievement rates</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-[#004E98]/5">
                                                                <TableHead>Marketer</TableHead>
                                                                <TableHead className="text-center">Sales Won</TableHead>
                                                                <TableHead className="text-center">Target</TableHead>
                                                                <TableHead className="text-center">Achievement Rate</TableHead>
                                                                <TableHead className="text-center">Status</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {analytics.salesWonPerMarketer?.map((marketer) => {
                                                                const achievementRate = marketer.target > 0 ? (marketer.salesWon / marketer.target) * 100 : 0;
                                                                const isAchieved = achievementRate >= 100;
                                                                return (
                                                                    <TableRow key={marketer.marketerId} className="hover:bg-gray-50/50">
                                                                        <TableCell className="font-medium">{marketer.marketerName}</TableCell>
                                                                        <TableCell className="text-center font-semibold text-[#01a64e]">{formatCurrency(marketer.salesWon)}</TableCell>
                                                                        <TableCell className="text-center text-gray-600">{formatCurrency(marketer.target)}</TableCell>
                                                                        <TableCell className="text-center">
                                                                            <div className="flex items-center justify-center space-x-2">
                                                                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                                                                    <div className={`h-2 rounded-full ${isAchieved ? "bg-[#01a64e]" : "bg-red-500"}`} style={{ width: `${Math.min(achievementRate, 100)}%` }} />
                                                                                </div>
                                                                                <span className={`font-semibold ${isAchieved ? "text-[#01a64e]" : "text-red-600"}`}>{achievementRate.toFixed(1)}%</span>
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="text-center"><Badge variant={isAchieved ? "default" : "destructive"}>{isAchieved ? "Achieved" : "Pending"}</Badge></TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}



                                    {/* Monthly Trends Table */}
                                    <Card className="border-0 shadow-sm">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                                                <Activity className="h-5 w-5 text-[#01a64e]" /><span>Monthly Performance Trends</span>
                                            </CardTitle>
                                            <CardDescription>Performance metrics over time with trend indicators</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow><TableHead>Month</TableHead><TableHead className="text-center">Leads</TableHead><TableHead className="text-center">Sales Won</TableHead><TableHead className="text-center">Expected Orders</TableHead><TableHead className="text-center">Total Value</TableHead></TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {analytics.monthlyTrends?.map((trend, index) => {
                                                            const prev = index > 0 ? analytics.monthlyTrends[index - 1] : null;
                                                            const leadsChange = prev ? trend.leads - prev.leads : 0;
                                                            const salesChange = prev ? trend.salesWon - prev.salesWon : 0;
                                                            return (
                                                                <TableRow key={trend.month} className="hover:bg-gray-50/50">
                                                                    <TableCell className="font-medium">{trend.month}</TableCell>
                                                                    <TableCell className="text-center">
                                                                        <div className="flex items-center justify-center space-x-1">
                                                                            <span className="font-semibold text-[#004E98]">{trend.leads}</span>
                                                                            {leadsChange !== 0 && <span className={`text-xs ${leadsChange > 0 ? "text-[#01a64e]" : "text-red-600"}`}>({leadsChange > 0 ? "+" : ""}{leadsChange})</span>}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-center">
                                                                        <div className="flex items-center justify-center space-x-1">
                                                                            <span className="font-semibold text-[#01a64e]">{formatCurrency(trend.salesWon)}</span>
                                                                            {salesChange !== 0 && <span className={`text-xs ${salesChange > 0 ? "text-[#01a64e]" : "text-red-600"}`}>({salesChange > 0 ? "+" : ""}{formatCurrency(salesChange)})</span>}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-center font-semibold text-[#004E98]">{formatCurrency(trend.expectedOrders)}</TableCell>
                                                                    <TableCell className="text-center font-bold">{formatCurrency(trend.salesWon + trend.expectedOrders)}</TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Fragment>
                            ) : (
                                <div className="text-center py-12">
                                    <TableIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                                    <p className="text-lg font-medium text-gray-500">No Analytics Data Available</p>
                                    <Button onClick={onRetryAnalytics} variant="outline" className="mt-4">Retry Loading</Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Quick Actions */}
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-gray-900">Quick Actions</CardTitle>
                    <CardDescription className="text-gray-600">Add new records or export data</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Button onClick={() => onExport("leads")} variant="outline" className="h-16 flex flex-col items-center justify-center space-y-2 border-gray-200 hover:bg-gray-50">
                            <FileDown className="h-5 w-5" /><span className="text-sm font-medium">Export Leads</span>
                        </Button>
                        <Button onClick={() => onExport("sales-won")} variant="outline" className="h-16 flex flex-col items-center justify-center space-y-2 border-gray-200 hover:bg-gray-50">
                            <FileDown className="h-5 w-5" /><span className="text-sm font-medium">Export Sales</span>
                        </Button>
                        {isAdmin && (
                            <Button
                                onClick={() => {
                                    const token = localStorage.getItem("marketingToken");
                                    const a = document.createElement("a");
                                    a.href = `/api/marketing/ambassador-report`;
                                    // Trigger with auth header via fetch → blob download
                                    fetch("/api/marketing/ambassador-report", {
                                        headers: { Authorization: `Bearer ${token}` }
                                    })
                                    .then(res => res.blob())
                                    .then(blob => {
                                        const url = URL.createObjectURL(blob);
                                        const link = document.createElement("a");
                                        link.href = url;
                                        link.download = `ambassador-report-${Date.now()}.pdf`;
                                        document.body.appendChild(link);
                                        link.click();
                                        URL.revokeObjectURL(url);
                                        document.body.removeChild(link);
                                    })
                                    .catch(e => console.error("Report download failed:", e));
                                }}
                                variant="outline"
                                className="h-16 flex flex-col items-center justify-center space-y-2 border-[#004E98]/20 hover:bg-[#004E98]/5 text-[#004E98] hover:text-[#004E98]"
                            >
                                <FileDown className="h-5 w-5" />
                                <span className="text-sm font-medium">Ambassador Report</span>
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
