import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ProgressBar, KASNEB_COLORS } from "./executive-shared";

const resolutionTrendData = [
    { month: "Jul", avgHours: 28, target: 24 }, { month: "Aug", avgHours: 26, target: 24 },
    { month: "Sep", avgHours: 22, target: 24 }, { month: "Oct", avgHours: 20, target: 24 },
    { month: "Nov", avgHours: 23, target: 24 }, { month: "Dec", avgHours: 25, target: 24 },
    { month: "Jan", avgHours: 21, target: 24 }, { month: "Feb", avgHours: 19, target: 24 },
];
const departmentPerformance = [
    { name: "Examinations", sla: 94, resolved: 120, avgTime: 18, satisfaction: 4.5 },
    { name: "Registration", sla: 88, resolved: 95, avgTime: 22, satisfaction: 4.2 },
    { name: "Certification", sla: 91, resolved: 80, avgTime: 20, satisfaction: 4.4 },
    { name: "Finance", sla: 85, resolved: 65, avgTime: 26, satisfaction: 3.9 },
    { name: "Student Affairs", sla: 92, resolved: 110, avgTime: 16, satisfaction: 4.6 },
];
const agentPerformance = [
    { name: "John Kamau", cases: 45, resolved: 42, sla: 96, satisfaction: 4.7 },
    { name: "Mary Wanjiku", cases: 38, resolved: 35, sla: 92, satisfaction: 4.5 },
    { name: "Peter Ochieng", cases: 52, resolved: 48, sla: 90, satisfaction: 4.3 },
    { name: "Grace Muthoni", cases: 41, resolved: 39, sla: 95, satisfaction: 4.6 },
    { name: "James Kiprop", cases: 35, resolved: 33, sla: 88, satisfaction: 4.1 },
];

interface PerformanceTabProps { slaCompliance: number; }

export function PerformanceTab({ slaCompliance }: PerformanceTabProps) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {[
                    { label: "Overall SLA Compliance", value: slaCompliance, target: "90%", color: KASNEB_COLORS.green, display: `${slaCompliance}%` },
                    { label: "Response Time Compliance", value: 94, target: "95%", color: KASNEB_COLORS.blue, display: "94%" },
                    { label: "First Contact Resolution", value: 72, target: "75%", color: KASNEB_COLORS.gold, display: "72%" },
                ].map((kpi) => (
                    <Card key={kpi.label}>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle></CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold mb-2" style={{ color: kpi.color }}>{kpi.display}</div>
                            <ProgressBar value={kpi.value} color={kpi.color} />
                            <p className="text-xs text-muted-foreground mt-2">Target: {kpi.target}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader><CardTitle className="text-lg">Department Performance</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {departmentPerformance.map((dept) => {
                            const barColor = dept.sla >= 90 ? KASNEB_COLORS.green : dept.sla >= 85 ? KASNEB_COLORS.gold : KASNEB_COLORS.orange;
                            return (
                                <div key={dept.name} className="flex items-center gap-4">
                                    <div className="w-32 text-sm font-medium truncate">{dept.name}</div>
                                    <div className="flex-1"><ProgressBar value={dept.sla} color={barColor} /></div>
                                    <div className="w-12 text-sm font-semibold text-right">{dept.sla}%</div>
                                    <Badge variant="outline" className="text-xs">{dept.resolved} resolved</Badge>
                                    <Badge variant="outline" className="text-xs">{dept.avgTime}h avg</Badge>
                                    <Badge variant="outline" className="text-xs">★ {dept.satisfaction}</Badge>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle className="text-lg">Agent Performance</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {agentPerformance.map((agent) => {
                                const slaColor = agent.sla >= 95 ? KASNEB_COLORS.green : agent.sla >= 90 ? KASNEB_COLORS.gold : KASNEB_COLORS.orange;
                                return (
                                    <div key={agent.name} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                                        <div><div className="font-medium text-sm">{agent.name}</div><div className="text-xs text-muted-foreground">{agent.cases} cases · {agent.resolved} resolved</div></div>
                                        <div className="text-right"><div className="text-sm font-semibold" style={{ color: slaColor }}>{agent.sla}% SLA</div><div className="text-xs text-muted-foreground">★ {agent.satisfaction}</div></div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="text-lg">Resolution Time Trend</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={resolutionTrendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} />
                                <Tooltip /><Legend />
                                <Area type="monotone" dataKey="avgHours" stroke={KASNEB_COLORS.blue} fill={`${KASNEB_COLORS.blue}20`} strokeWidth={2} name="Avg Hours" />
                                <Area type="monotone" dataKey="target" stroke={KASNEB_COLORS.orange} fill="none" strokeWidth={2} strokeDasharray="5 5" name="Target" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
