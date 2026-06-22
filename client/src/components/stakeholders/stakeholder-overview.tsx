import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Users, TrendingUp, Activity, AlertTriangle, MessageSquare, Plus, Link2, Globe
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import { StatsCarousel } from "@/components/shared/stats-carousel";
import type { StakeholderStats } from "./stakeholder-types";
import { STAKEHOLDER_TYPES } from "./stakeholder-types";
import { STAKEHOLDER_TYPE_COLORS, STAKEHOLDER_TYPE_ICONS } from "./stakeholder-type-colors";

const riskColors: Record<string, string> = {
    low: "bg-green-100 text-green-700", medium: "bg-amber-100 text-amber-700",
    high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700",
};

// ── Greeting helper ────────────────────────────────────────────────────────
function getGreeting(): string {
    const nairobiTime = new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi", hour: "numeric", hour12: false });
    const hour = parseInt(nairobiTime, 10);
    const key = "crm_sh_visited";
    const hasVisited = sessionStorage.getItem(key);
    if (!hasVisited) { sessionStorage.setItem(key, "true"); return "Welcome"; }
    if (hour >= 5 && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 17) return "Good Afternoon";
    if (hour >= 17 && hour < 21) return "Good Evening";
    return "Welcome back";
}

// ── Dashboard Header ───────────────────────────────────────────────────────
// Renders ONLY on the Overview tab — mirrors exact Case Management design.
const StakeholderDashboardHeader = ({
    userName, stats
}: {
    userName?: string;
    stats: StakeholderStats;
}) => {
    const [greeting, setGreeting] = useState("Hello");
    useEffect(() => { setGreeting(getGreeting()); }, []);

    const carouselStats = [
        {
            label: "Total Stakeholders",
            value: `${stats.total ?? 0} Registered`,
            description: `${stats.total ?? 0} stakeholders registered across all engagement categories in the CRM.`,
            color: "text-blue-600"
        },
        {
            label: "Top Engagement (Week)",
            value: stats.mostEngagedTypeLastWeek
                ? <><span className="text-emerald-600 font-black">{stats.mostEngagedTypeLastWeek.type.charAt(0).toUpperCase() + stats.mostEngagedTypeLastWeek.type.slice(1)}</span> <span className="text-gray-900 font-bold text-lg">Stakeholders had the most engagement this week</span></>
                : "Monitoring Engagement...",
            description: stats.mostEngagedTypeLastWeek
                ? ""
                : "Analyzing stakeholder interaction trends to identify top performers.",
        },
        {
            label: "Avg Engagement Score",
            value: `${(stats.avgEngagement ?? 0).toFixed(1)} / 100`,
            description: "Average engagement score computed from interactions, recency, channel diversity, and case linkage.",
            color: "text-[#004E98]"
        },
    ];

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-8">
            <div className="p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-8 relative">
                <div className="space-y-3 relative z-10 pl-2 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">
                            {new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Africa/Nairobi" })}
                        </span>
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-none">
                        {greeting}, <span className="text-[#004E98]">{userName || "Stakeholder Manager"}</span>
                    </h1>
                </div>
                <div className="w-full xl:w-[420px] relative z-10">
                    <StatsCarousel stats={carouselStats} />
                </div>
            </div>
        </div>
    );
};

// ── Overview Component ─────────────────────────────────────────────────────
interface StakeholderOverviewProps {
    stats: StakeholderStats;
    userName?: string;
    recentInteractions: any[];
    onNavigate: (to: string) => void;
    onViewCase?: (id: string) => void;
}

export function StakeholderOverview({ stats, userName, recentInteractions, onNavigate, onViewCase }: StakeholderOverviewProps) {
    const typeStats = STAKEHOLDER_TYPES.map((type) => ({
        type,
        count: stats.byType?.[type] || 0,
        avgEngagement: stats.avgEngagementByType?.[type] || 0,
        icon: STAKEHOLDER_TYPE_ICONS[type],
        color: STAKEHOLDER_TYPE_COLORS[type],
    }));

    // Data for the engagement bar chart
    const chartData = typeStats
        .filter(s => s.count > 0)
        .map(s => ({
            name: s.type,
            engagement: s.avgEngagement,
            count: s.count,
            color: s.color?.includes('blue') ? '#004E98' :
                s.color?.includes('emerald') || s.color?.includes('green') ? '#01a64e' :
                    s.color?.includes('amber') ? '#D0AC01' :
                        s.color?.includes('indigo') ? '#4f46e5' :
                            s.color?.includes('purple') ? '#9333ea' : '#94a3b8'
        }));

    return (
        <div className="space-y-6">
            {/* Header — overview-only, mirrors Case Management design exactly */}
            <StakeholderDashboardHeader userName={userName} stats={stats} />


            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Total Stakeholders", value: stats.total || 0, icon: Users, color: "#004E98" },
                    { label: "Avg Engagement", value: `${(stats.avgEngagement ?? 0).toFixed(1)}%`, icon: TrendingUp, color: "#01a64e" },
                    { label: "Active", value: stats.activeCount || 0, icon: Activity, color: "#D0AC01" },
                    { label: "Inactive", value: stats.inactiveCount || 0, icon: AlertTriangle, color: "#e55f00" },
                ].map((kpi) => (
                    <Card key={kpi.label} className="border border-gray-100 shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-50">
                                    <kpi.icon className="h-5 w-5" style={{ color: kpi.color }} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-bold tracking-tight">{kpi.value}</span>
                                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{kpi.label}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Interactions — 2/3 width */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2" style={{ color: "#004E98" }}>
                                <Activity className="h-5 w-5" /> Recent Interactions
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">Latest case-based communications</p>
                        </div>
                        <Badge variant="outline" className="font-bold">{recentInteractions.length} Recent</Badge>
                    </CardHeader>
                    <CardContent>
                        {recentInteractions.length === 0 ? (
                            <div className="text-center py-10 border-2 border-dashed rounded-lg">
                                <p className="text-muted-foreground">No recent interactions found.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground font-medium">
                                            <th className="pb-3 pl-2">Stakeholder</th>
                                            <th className="pb-3">Subject</th>
                                            <th className="pb-3">Status</th>
                                            <th className="pb-3 text-right pr-2">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {recentInteractions.map((int: any) => (
                                            <tr
                                                key={int.id}
                                                className="group hover:bg-gray-50 cursor-pointer transition-colors"
                                                onClick={() => onViewCase ? onViewCase(int.caseId || int.id) : onNavigate(`/cases/workspace/${int.caseId || int.id}`)}
                                            >
                                                <td className="py-3 pl-2">
                                                    <div className="font-bold text-gray-900 line-clamp-1">{int.stakeholderName || "Unknown"}</div>
                                                    <div className="text-[10px] text-muted-foreground capitalize">{int.stakeholderType}</div>
                                                </td>
                                                <td className="py-3">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="font-medium text-[#004E98] group-hover:underline line-clamp-1 text-xs cursor-help">
                                                                    {int.subject || int.title || "Portal Query"}
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="max-w-[400px] p-5 bg-white shadow-2xl border-gray-100 rounded-2xl" sideOffset={12}>
                                                                <div className="space-y-4">
                                                                    <p className="text-base font-bold text-slate-700 leading-relaxed italic border-l-4 border-[#004E98]/20 pl-4 py-1">
                                                                        {int.description || "Historical background log for this engagement item."}
                                                                    </p>
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <div className="text-[10px] text-muted-foreground">#{int.caseNumber || "SIM-INT"}</div>
                                                    </TooltipProvider>
                                                </td>
                                                <td className="py-3">
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[10px] px-1.5 h-5 ${int.status === "open" ? "bg-blue-50 text-blue-700 border-blue-100" :
                                                            int.status === "resolved" ? "bg-green-50 text-green-700 border-green-100" :
                                                                "bg-gray-50 text-gray-700 border-gray-100"
                                                            }`}
                                                    >
                                                        {int.status || "logged"}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 text-right pr-2 text-muted-foreground text-[10px] font-medium">
                                                    {int.createdAt ? new Date(int.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "N/A"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Right Column: Mini Stats — 1/3 width */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-bold" style={{ color: "#004E98" }}>Stakeholders by Type</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            {typeStats.filter(s => s.count > 0).map(({ type, count, icon: Icon, color }) => (
                                <div key={type} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-5 h-5 rounded flex items-center justify-center ${color}`}><Icon className="h-2.5 w-2.5" /></div>
                                        <span className="text-[10px] font-medium capitalize">{type}</span>
                                    </div>
                                    <span className="text-[10px] font-bold">{count}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-bold" style={{ color: "#004E98" }}>Risk Distribution</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            {["low", "medium", "high", "critical"].map((level) => {
                                const count = stats.riskDistribution?.[level] || 0;
                                const barColor = level === "low" ? "#01a64e" : level === "medium" ? "#D0AC01" : level === "high" ? "#e55f00" : "#dc2626";
                                return (
                                    <div key={level} className="flex items-center justify-between">
                                        <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${riskColors[level]}`}>{level}</Badge>
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${stats.total ? (count / stats.total) * 100 : 0}%`, backgroundColor: barColor }} />
                                            </div>
                                            <span className="text-xs font-bold w-6 text-right">{count}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2" style={{ color: "#004E98" }}>
                                <Globe className="h-4 w-4" /> Regional Presence
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {Object.entries(stats.regionalDistribution || {}).sort(([,a], [,b]) => b - a).map(([region, count]) => (
                                <div key={region} className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-widest">{region}</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${stats.total ? (count / stats.total) * 100 : 0}%` }} />
                                        </div>
                                        <span className="text-xs font-bold w-6 text-right">{count}</span>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Engagement by Type — Now Full Width below the top row */}
                {/* Engagement by Type — Redesigned & Enhanced */}
                <Card className="lg:col-span-3 border-none shadow-xl bg-gradient-to-b from-white to-gray-50/30 overflow-hidden">
                    <CardHeader className="pb-4 border-b border-gray-100/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-black tracking-tight" style={{ color: "#004E98" }}>
                                    Engagement Intelligence
                                </CardTitle>
                                <p className="text-xs text-muted-foreground font-medium mt-1">
                                    Benchmarking average engagement scores across stakeholder categories
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge className="bg-[#004E98]/5 text-[#004E98] border-[#004E98]/10 hover:bg-[#004E98]/10 transition-colors">
                                    Target: 85%
                                </Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-8">
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 40 }}>
                                    <defs>
                                        {chartData.map((entry, index) => (
                                            <linearGradient key={`grad-${index}`} id={`colorGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={entry.color} stopOpacity={1} />
                                                <stop offset="95%" stopColor={entry.color} stopOpacity={0.6} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fontWeight: 800, fill: '#475569' }}
                                        tickFormatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }}
                                        domain={[0, 100]}
                                        tickFormatter={(v) => `${v}%`}
                                        dx={-10}
                                    />
                                    <RechartsTooltip
                                        cursor={{ fill: '#f1f5f9', opacity: 0.4 }}
                                        contentStyle={{
                                            borderRadius: '16px',
                                            border: '1px solid #e2e8f0',
                                            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                                            fontSize: '12px',
                                            fontWeight: '800',
                                            padding: '12px 16px'
                                        }}
                                        formatter={(value: any, name: any, props: any) => [
                                            <span style={{ color: '#0f172a' }}>{value}% Engagement</span>,
                                            <span className="text-[10px] text-gray-400 uppercase tracking-widest">{props.payload.name}</span>
                                        ]}
                                        labelStyle={{ display: 'none' }}
                                    />
                                    <Bar
                                        dataKey="engagement"
                                        radius={[8, 8, 2, 2]}
                                        barSize={50}
                                        animationDuration={1500}
                                        animationBegin={200}
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={`url(#colorGrad-${index})`} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
