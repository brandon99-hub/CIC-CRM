import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export const KASNEB_COLORS = {
    blue: "#004E98", green: "#01a64e", gold: "#D0AC01", orange: "#e55f00",
};
export const CHART_COLORS = ["#004E98", "#01a64e", "#D0AC01", "#e55f00", "#6366f1", "#ec4899"];
export const formatLabel = (val: string) => val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export interface StakeholderStats {
    total: number; byType: Record<string, number>; avgEngagement: number;
    riskDistribution: Record<string, number>; activeCount: number; inactiveCount: number;
}
export interface CaseStats {
    open: number; pending: number; inProgress: number; escalated: number;
    resolved: number; closed: number; slaBreached: number; total: number;
    byPriority: Record<string, number>; byChannel: Record<string, number>; byStatus: Record<string, number>;
}

interface KpiCardProps {
    title: string; value: string | number; icon: React.ReactNode;
    color: string; trend?: { value: string; positive: boolean };
}
export function KpiCard({ title, value, icon, color, trend }: KpiCardProps) {
    return (
        <Card className="border-l-4" style={{ borderLeftColor: color }}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15` }}>{icon}</div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold" style={{ color }}>{value}</div>
                {trend && (
                    <div className="flex items-center gap-1 mt-1">
                        {trend.positive ? <ArrowUpRight className="h-3 w-3 text-green-600" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
                        <span className={`text-xs ${trend.positive ? "text-green-600" : "text-red-500"}`}>{trend.value}</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export function ProgressBar({ value, color }: { value: number; color: string }) {
    return (
        <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="h-3 rounded-full transition-all duration-500" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }} />
        </div>
    );
}
