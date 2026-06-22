import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Briefcase, Megaphone, CheckCircle2, Star, BarChart3, Calendar, Download, TrendingUp } from "lucide-react";

interface ReportsTabProps {
    dateRange: string;
    onDateRangeChange: (v: string) => void;
    onExport: (type: string) => void;
}

export function ReportsTab({ dateRange, onDateRangeChange, onExport }: ReportsTabProps) {
    const reportMetrics = [
        { label: "Cases Opened (Period)", value: dateRange === "this_week" ? 14 : dateRange === "this_month" ? 62 : dateRange === "this_quarter" ? 185 : 720 },
        { label: "Cases Resolved (Period)", value: dateRange === "this_week" ? 12 : dateRange === "this_month" ? 57 : dateRange === "this_quarter" ? 172 : 685 },
        { label: "New Stakeholders", value: dateRange === "this_week" ? 8 : dateRange === "this_month" ? 34 : dateRange === "this_quarter" ? 98 : 412 },
        { label: "SLA Breaches", value: dateRange === "this_week" ? 1 : dateRange === "this_month" ? 5 : dateRange === "this_quarter" ? 14 : 52 },
        { label: "Avg Satisfaction", value: dateRange === "this_week" ? "4.6" : dateRange === "this_month" ? "4.5" : dateRange === "this_quarter" ? "4.4" : "4.3" },
        { label: "Campaigns Launched", value: dateRange === "this_week" ? 1 : dateRange === "this_month" ? 3 : dateRange === "this_quarter" ? 8 : 28 },
    ];

    const exportButtons = [
        { label: "Stakeholder Engagement Spectrum", desc: "Detailed interactions by type and channel", icon: Users, color: "#004E98" },
        { label: "Double-Breach SLA Audit", desc: "Cases breaching both Response & Resolution SLAs", icon: Briefcase, color: "#e55f00" },
        { label: "Marketing ROI & Conversion Audit", desc: "Prospect-to-sale funnel by sector and marketer", icon: TrendingUp, color: "#01a64e" },
        { label: "Team Performance & Velocity", desc: "Ranking staff by resolution speed and SLA rate", icon: BarChart3, color: "#D0AC01" },
        { label: "Strategic Pipeline Risk", desc: "Stagnant opportunities and potential revenue risks", icon: CheckCircle2, color: "#004E98" },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-[#004E98]">Reports Overview</h2>
                    <p className="text-sm text-muted-foreground">Aggregated metrics for the selected period</p>
                </div>
                <Select value={dateRange} onValueChange={onDateRangeChange}>
                    <SelectTrigger className="w-[180px]">
                        <Calendar className="h-4 w-4 mr-2" /><SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="this_week">This Week</SelectItem>
                        <SelectItem value="this_month">This Month</SelectItem>
                        <SelectItem value="this_quarter">This Quarter</SelectItem>
                        <SelectItem value="this_year">This Year</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {reportMetrics.map((m) => (
                    <Card key={m.label}>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle></CardHeader>
                        <CardContent><div className="text-3xl font-bold text-[#004E98]">{m.value}</div></CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader><CardTitle className="text-lg">Export Reports</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {exportButtons.map((btn) => (
                            <Button key={btn.label} variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => onExport(btn.label)}>
                                <btn.icon className="h-6 w-6" style={{ color: btn.color }} />
                                <span className="font-medium">{btn.label}</span>
                                <span className="text-xs text-muted-foreground text-center">{btn.desc}</span>
                                <Download className="h-4 w-4" />
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
