import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, AreaChart, Area, Legend, YAxis as RechartYAxis } from "recharts";
import { ProgressBar, KASNEB_COLORS, CHART_COLORS, formatLabel } from "./executive-shared";

const engagementDistribution = [
    { range: "0-20", count: 45, label: "Low" }, { range: "21-40", count: 78, label: "Below Avg" },
    { range: "41-60", count: 156, label: "Average" }, { range: "61-80", count: 198, label: "Good" },
    { range: "81-100", count: 123, label: "Excellent" },
];
const channelEffectiveness = [
    { channel: "Email", responses: 450, avgTime: 4.2, satisfaction: 4.1 },
    { channel: "Phone", responses: 380, avgTime: 0.5, satisfaction: 4.5 },
    { channel: "Portal", responses: 290, avgTime: 8.1, satisfaction: 3.8 },
    { channel: "Walk-in", responses: 150, avgTime: 0.3, satisfaction: 4.6 },
    { channel: "Social", responses: 120, avgTime: 2.5, satisfaction: 3.9 },
    { channel: "SMS", responses: 85, avgTime: 1.2, satisfaction: 4.0 },
];
const campaignSummary = [
    { name: "Exam Registration Drive", status: "active", reach: 12500, engagement: 3200, conversion: 18.5 },
    { name: "Student Portal Launch", status: "completed", reach: 8900, engagement: 4500, conversion: 22.3 },
    { name: "Certification Awareness", status: "active", reach: 6700, engagement: 1800, conversion: 12.1 },
    { name: "Q1 Newsletter", status: "completed", reach: 15000, engagement: 5200, conversion: 15.8 },
];
const satisfactionTrend = [
    { month: "Jul", score: 4.1, responses: 120 }, { month: "Aug", score: 4.2, responses: 135 },
    { month: "Sep", score: 4.0, responses: 110 }, { month: "Oct", score: 4.3, responses: 145 },
    { month: "Nov", score: 4.4, responses: 160 }, { month: "Dec", score: 4.2, responses: 130 },
    { month: "Jan", score: 4.5, responses: 170 }, { month: "Feb", score: 4.6, responses: 185 },
];

export function EngagementTab() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle className="text-lg">Stakeholder Engagement Distribution</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={engagementDistribution}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="label" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(v: number) => [v, "Stakeholders"]} />
                                <Bar dataKey="count" name="Stakeholders" radius={[4, 4, 0, 0]}>
                                    {engagementDistribution.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="text-lg">Communication Channel Effectiveness</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {channelEffectiveness.map((ch) => (
                                <div key={ch.channel} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                                    <div><div className="font-medium text-sm">{ch.channel}</div><div className="text-xs text-muted-foreground">{ch.responses} responses · Avg {ch.avgTime}h</div></div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-24"><ProgressBar value={(ch.satisfaction / 5) * 100} color={KASNEB_COLORS.blue} /></div>
                                        <span className="text-sm font-semibold w-8">★ {ch.satisfaction}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle className="text-lg">Campaign Performance</CardTitle></CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    {["Campaign", "Status", "Reach", "Engagement", "Conversion %"].map((h) => (
                                        <th key={h} className={`py-3 px-2 font-medium text-muted-foreground ${["Reach", "Engagement", "Conversion %"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {campaignSummary.map((c) => (
                                    <tr key={c.name} className="border-b last:border-0">
                                        <td className="py-3 px-2 font-medium">{c.name}</td>
                                        <td className="py-3 px-2"><Badge className={c.status === "active" ? "bg-green-100 text-green-800 border-0" : "bg-gray-100 text-gray-700 border-0"}>{formatLabel(c.status)}</Badge></td>
                                        <td className="py-3 px-2 text-right">{c.reach.toLocaleString()}</td>
                                        <td className="py-3 px-2 text-right">{c.engagement.toLocaleString()}</td>
                                        <td className="py-3 px-2 text-right font-semibold" style={{ color: c.conversion >= 15 ? KASNEB_COLORS.green : KASNEB_COLORS.orange }}>{c.conversion}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-lg">Satisfaction Score Trend</CardTitle></CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={satisfactionTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                            <YAxis domain={[3.5, 5]} tick={{ fontSize: 12 }} />
                            <YAxis yAxisId={1} orientation="right" tick={{ fontSize: 12 }} />
                            <Tooltip /><Legend />
                            <Area type="monotone" dataKey="score" stroke={KASNEB_COLORS.gold} fill={`${KASNEB_COLORS.gold}20`} strokeWidth={2} name="Satisfaction Score" />
                            <Bar dataKey="responses" fill={`${KASNEB_COLORS.blue}40`} name="Responses" yAxisId={1} />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
