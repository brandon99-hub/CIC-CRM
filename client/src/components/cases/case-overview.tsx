import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    formatLabel, channelIcons, statusColors, getDeadlineStatus,
} from "./case-utils";
import { MessageSquare, Clock, CheckCircle2, AlertTriangle, Activity, BarChart3, TrendingUp, PieChart as PieIcon, ArrowRight, Zap, Shield, XCircle } from "lucide-react";
import { StatsCarousel } from "@/components/shared/stats-carousel";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { Button } from "@/components/ui/button";
import { CaseKanban } from "./case-kanban";

interface CaseStats {
    open: number;
    pending: number;
    inProgress: number;
    escalated: number;
    resolved: number;
    closed: number;
    slaBreached: number;
    total: number;
    taggedCount?: number;
    resolutionRate: number;
    byPriority: Record<string, number>;
    byChannel: Record<string, number>;
    byStatus: Record<string, number>;
    weekly?: { activeWorkload: number; slaBreached: number; resolved: number; resolutionRate: number };
    taggedSlaBreached?: number;
}

interface BreachedCase {
    id: string;
    title: string;
    caseNumber: string;
    status: string;
    slaResponseDeadline: string | null;
    slaDeadline: string | null;
    firstResponseAt: string | null;
    resolvedAt: string | null;
    createdAt: string;
    slaResponseMinutes?: number;
    slaResolutionMinutes?: number;
    assignedToName?: string;
}

interface CaseOverviewProps {
    stats: CaseStats;
    userName?: string;
    trends?: any[];
    distribution?: any;
    hotspots?: any[];
    activity?: any[];
    breachedCases?: BreachedCase[];
    userPerms?: { permissions: string[] };
    kanbanCases?: any[];
    onStatusChange?: (id: string, newStatus: string, currentStatus: string) => void;
    onCaseClick?: (id: string) => void;
    isLoadingKanban?: boolean;
    currentUserId?: string;
}

/** Returns a time-aware greeting based on Nairobi (EAT UTC+3) time. */
function getGreeting(): string {
    const nairobiTime = new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi", hour: "numeric", hour12: false });
    const hour = parseInt(nairobiTime, 10);
    const hasVisited = sessionStorage.getItem("crm_dashboard_visited");
    if (!hasVisited) {
        sessionStorage.setItem("crm_dashboard_visited", "true");
        return "Welcome";
    }
    if (hour >= 5 && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 17) return "Good Afternoon";
    if (hour >= 17 && hour < 21) return "Good Evening";
    return "Welcome back";
}

function formatRate(rate: number): string {
    return `${rate}%`;
}

const CaseOverviewHeader = ({ userName, stats }: { userName?: string; stats: CaseStats }) => {
    const [greeting, setGreeting] = useState("Hello");

    useEffect(() => {
        setGreeting(getGreeting());
    }, []);

    const weekly = stats.weekly || { activeWorkload: 0, slaBreached: 0, resolved: 0, resolutionRate: 0 };
    const weeklyRateLabel = formatRate(weekly.resolutionRate);

    const activeWorkload = (stats.open || 0) + (stats.pending || 0) + (stats.inProgress || 0);

    const caseStats = [
        {
            label: "Active Workload",
            value: `${activeWorkload} Cases`,
            description: `${activeWorkload === 1 ? "1 case is" : `${activeWorkload} cases are`} currently open or in progress and assigned to you.`,
            color: "text-blue-600"
        },
        {
            label: "SLA Breach Warnings",
            value: `${stats.slaBreached} Critical`,
            description: stats.taggedSlaBreached
                ? `${stats.slaBreached} breach${stats.slaBreached !== 1 ? "es" : ""} on your assigned cases. ${stats.taggedSlaBreached} more on tagged cases you collaborate on.`
                : `SLA breaches on cases currently assigned to you. Tagged cases show separately.`,
            color: "text-rose-600"
        },
        {
            label: "Resolution Rate",
            value: `${weeklyRateLabel} Within SLA`,
            description: weekly.resolutionRate > 0
                ? `Percentage of cases resolved within SLA this week. Based on ${weekly.resolved} resolved case${weekly.resolved !== 1 ? "s" : ""}.`
                : "No cases resolved this week yet. This metric updates as cases are closed.",
            color: "text-emerald-600"
        }
    ];

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-8">
            <div className="p-4 md:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-4 md:gap-8 relative">

                <div className="space-y-3 relative z-10 pl-2 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">
                            {new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Africa/Nairobi" })}
                        </span>
                    </div>
                    <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight leading-tight">
                        {greeting}, <span className="text-[#004E98]">{userName || "Case Manager"}</span>
                    </h1>
                </div>

                <div className="w-full xl:w-[420px] relative z-10">
                    <StatsCarousel stats={caseStats} />
                </div>
            </div>
        </div>
    );
};

/** Inline SLA deadline timer badge */
function DeadlineBadge({ deadline, completedAt, fallbackMinutes, createdAt }: {
    deadline: string | null; completedAt?: string | null; fallbackMinutes?: number; createdAt?: string
}) {
    const ds = getDeadlineStatus(deadline, completedAt, fallbackMinutes, createdAt);
    const color = ds.status === "breached" ? "text-red-600 bg-red-50 border-red-200"
        : ds.status === "approaching" ? "text-orange-600 bg-orange-50 border-orange-200"
            : ds.status === "completed" ? "text-green-600 bg-green-50 border-green-200"
                : ds.status === "none" ? "text-gray-400 bg-gray-50 border-gray-200"
                    : "text-[#004E98] bg-blue-50 border-blue-200";
    const Icon = ds.status === "breached" ? XCircle
        : ds.status === "completed" ? CheckCircle2
            : ds.status === "approaching" ? AlertTriangle : Clock;
    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-bold ${color}`}>
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{ds.text}</span>
        </div>
    );
}

export function CaseOverview({ 
    stats, userName, trends, distribution, hotspots, activity, breachedCases, userPerms,
    kanbanCases, onStatusChange, onCaseClick, isLoadingKanban, currentUserId 
}: CaseOverviewProps) {
    const COLORS = ["#004E98", "#01a64e", "#D0AC01", "#e55f00", "#6366f1", "#ec4899"];

    const canViewHotspots = !!userPerms?.permissions.includes('cases.view_hotspots');

    const channelData = (distribution?.byChannel || []).map((c: any) => ({
        name: formatLabel(c.label),
        value: parseInt(String(c.count), 10) || 0
    }));

    return (
        <div className="space-y-6">
            <CaseOverviewHeader userName={userName} stats={stats} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Open Cases */}
                <Card className="hover:shadow-md transition-shadow rounded-[1.5rem]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-gray-600 uppercase tracking-widest">Open Cases</CardTitle>
                        <div className="p-2 bg-[#004E98]/10 rounded-xl"><MessageSquare className="h-4 w-4 text-[#004E98]" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-gray-900 tracking-tight">
                            {stats.open}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                            <p className="text-xs font-medium text-gray-500">Currently active cases</p>
                            {stats.taggedCount ? (
                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                                    {stats.taggedCount} TAGGED
                                </span>
                            ) : null}
                        </div>
                    </CardContent>
                </Card>

                {/* 2. In Progress */}
                <Card className="hover:shadow-md transition-shadow rounded-[1.5rem]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-gray-600 uppercase tracking-widest">In Progress</CardTitle>
                        <div className="p-2 bg-amber-500/10 rounded-xl"><Clock className="h-4 w-4 text-amber-600" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-gray-900 tracking-tight">
                            {stats.inProgress}
                        </div>
                        <p className="text-xs font-medium text-gray-500 mt-1">Being handled right now</p>
                    </CardContent>
                </Card>

                {/* 3. Resolved */}
                <Card className="hover:shadow-md transition-shadow rounded-[1.5rem]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-gray-600 uppercase tracking-widest">Resolved</CardTitle>
                        <div className="p-2 bg-[#01a64e]/10 rounded-xl"><CheckCircle2 className="h-4 w-4 text-[#01a64e]" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-gray-900 tracking-tight">
                            {stats.resolved}
                        </div>
                        <p className="text-xs font-medium text-gray-500 mt-1">Successfully closed cases</p>
                    </CardContent>
                </Card>

                {/* 4. SLA Breached */}
                <Card className="hover:shadow-md transition-shadow rounded-[1.5rem]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-gray-600 uppercase tracking-widest">SLA Breached</CardTitle>
                        <div className="p-2 bg-rose-500/10 rounded-xl"><AlertTriangle className="h-4 w-4 text-rose-600" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-gray-900 tracking-tight">
                            {stats.slaBreached}
                        </div>
                        <p className="text-xs font-medium text-gray-500 mt-1">Cases exceeding deadline</p>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-[#004E98]" />
                        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Case Kanban Board</h2>
                    </div>
                </div>
                <CaseKanban 
                    cases={kanbanCases || []} 
                    onStatusChange={onStatusChange || (() => {})} 
                    onCaseClick={onCaseClick || (() => {})}
                    isLoading={isLoadingKanban}
                    currentUserId={currentUserId}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-10 gap-6">
                {/* ROW 2: SLA Breached Cases Table (70%) & Distribution by Channel (30%) */}
                <Card className="xl:col-span-7 bg-white shadow-sm border-none ring-1 ring-gray-100">
                    <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-3">
                        <div className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-red-500" />
                            <CardTitle className="text-sm font-bold">SLA Breached Cases</CardTitle>
                        </div>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider bg-red-50 border-red-100 text-red-600 px-2 py-0.5">
                            {(breachedCases || []).length} Cases
                        </Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[350px] overflow-y-auto overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50/50">
                                        <TableHead className="text-xs font-bold">Case Title</TableHead>
                                        <TableHead className="text-xs font-bold">Assigned To</TableHead>
                                        <TableHead className="text-xs font-bold">Status</TableHead>
                                        <TableHead className="text-xs font-bold">Response Time</TableHead>
                                        <TableHead className="text-xs font-bold">Resolve Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(!breachedCases || breachedCases.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <CheckCircle2 className="h-8 w-8 text-green-300" />
                                                    <span className="text-sm font-bold text-green-600">All clear — no SLA breaches</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {(breachedCases || []).map((c) => (
                                        <TableRow key={c.id} className="bg-red-50/30 hover:bg-red-50/60">
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-black text-gray-400 tracking-tight">{c.caseNumber}</span>
                                                    <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight max-w-[200px]">{c.title}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-xs font-semibold text-gray-700">{c.assignedToName || "Unassigned"}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`text-[10px] font-bold ${statusColors[c.status] || "bg-gray-100 text-gray-600"}`}>
                                                    {formatLabel(c.status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <DeadlineBadge
                                                    deadline={c.slaResponseDeadline}
                                                    completedAt={c.firstResponseAt}
                                                    fallbackMinutes={c.slaResponseMinutes}
                                                    createdAt={c.createdAt}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <DeadlineBadge
                                                    deadline={c.slaDeadline}
                                                    completedAt={c.resolvedAt}
                                                    fallbackMinutes={c.slaResolutionMinutes}
                                                    createdAt={c.createdAt}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Card className="xl:col-span-3 bg-white shadow-sm border-none ring-1 ring-gray-100">
                    <CardHeader className="flex flex-row items-center gap-2 px-6 pt-6">
                        <PieIcon className="h-5 w-5 text-[#004E98]" />
                        <CardTitle className="text-sm font-bold">By Channel</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px] p-4 pt-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={channelData}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={0}
                                    outerRadius={80}
                                    dataKey="value"
                                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                    labelLine={true}
                                >
                                    {channelData.map((_entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ fontSize: '11px', fontWeight: 700 }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* ROW 3: Issue Hotspots Table (100% Width) */}
                {canViewHotspots && (
                    <Card className="xl:col-span-10 bg-white shadow-sm border-none ring-1 ring-gray-100 overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between px-8 py-5 bg-gray-50/50 border-b">
                            <div className="flex items-center gap-3">
                                <div className="bg-red-50 p-2 rounded-xl border border-red-100">
                                    <BarChart3 className="h-5 w-5 text-red-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-base font-black text-gray-900">Issue Hotspots</CardTitle>
                                    <p className="text-xs font-medium text-gray-500">Category vs Department distribution</p>
                                </div>
                            </div>
                            <Badge variant="outline" className="bg-white text-emerald-600 border-emerald-100 px-3 py-1 font-black italic tracking-tight">Managerial Insight</Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50/30">
                                        <TableHead className="text-xs font-bold px-8">Category</TableHead>
                                        <TableHead className="text-xs font-bold">Department</TableHead>
                                        <TableHead className="text-xs font-bold text-right pr-8">Case Count</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(!hotspots || hotspots.length === 0) && (
                                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No hotspot data available</TableCell></TableRow>
                                    )}
                                    {(hotspots || []).map((h: any, idx: number) => (
                                        <TableRow key={idx} className="hover:bg-gray-50/50">
                                            <TableCell className="px-8">
                                                <span className="text-sm font-bold text-gray-800">{h.category}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs font-bold">
                                                    {h.department}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                                <span className="text-sm font-black text-[#004E98]">{h.count}</span>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
