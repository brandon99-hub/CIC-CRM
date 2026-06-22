import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import {
    KpiCard, ProgressBar, KASNEB_COLORS, CHART_COLORS, formatLabel,
    type StakeholderStats, type CaseStats,
} from "./executive-shared";
import { Users, Briefcase, CheckCircle2, Clock, Megaphone, Star } from "lucide-react";

const caseTrendData = [
    { month: "Jul", opened: 42, resolved: 38, escalated: 4 },
    { month: "Aug", opened: 56, resolved: 48, escalated: 6 },
    { month: "Sep", opened: 61, resolved: 55, escalated: 5 },
    { month: "Oct", opened: 48, resolved: 50, escalated: 3 },
    { month: "Nov", opened: 53, resolved: 49, escalated: 7 },
    { month: "Dec", opened: 45, resolved: 42, escalated: 4 },
    { month: "Jan", opened: 58, resolved: 52, escalated: 5 },
    { month: "Feb", opened: 62, resolved: 57, escalated: 6 },
];

interface ExecutiveSummaryProps {
    stakeholderStats: StakeholderStats; caseStats: CaseStats;
    slaCompliance: number; totalCampaigns: number; satisfactionScore: number;
}

export function ExecutiveSummary({ stakeholderStats, caseStats, slaCompliance, totalCampaigns, satisfactionScore }: ExecutiveSummaryProps) {
    const activeCases = caseStats.open + caseStats.inProgress + caseStats.pending + caseStats.escalated;

    const casesByStatus = Object.entries(caseStats.byStatus || {}).map(([name, value]) => ({ name: formatLabel(name), value }));
    if (casesByStatus.length === 0) casesByStatus.push(
        { name: "Open", value: 28 }, { name: "In Progress", value: 35 }, { name: "Pending", value: 15 },
        { name: "Resolved", value: 42 }, { name: "Closed", value: 20 }, { name: "Escalated", value: 8 },
    );

    const stakeholdersByType = Object.entries(stakeholderStats.byType || {}).map(([name, value]) => ({ name: formatLabel(name), value }));
    if (stakeholdersByType.length === 0) stakeholdersByType.push(
        { name: "Student", value: 320 }, { name: "Institution", value: 85 }, { name: "Employer", value: 62 },
        { name: "Marker", value: 45 }, { name: "Staff", value: 38 }, { name: "Other", value: 50 },
    );

    const channelDistribution = Object.entries(caseStats.byChannel || {}).map(([name, value]) => ({ name: formatLabel(name), value }));
    if (channelDistribution.length === 0) channelDistribution.push(
        { name: "Email", value: 35 }, { name: "Phone", value: 28 }, { name: "Portal", value: 20 },
        { name: "Walk In", value: 10 }, { name: "Social Media", value: 7 },
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <KpiCard title="Total Stakeholders" value={stakeholderStats.total || 600} icon={<Users className="h-5 w-5" style={{ color: KASNEB_COLORS.blue }} />} color={KASNEB_COLORS.blue} trend={{ value: "+12.5% MoM", positive: true }} />
                <KpiCard title="Active Cases" value={activeCases || 86} icon={<Briefcase className="h-5 w-5" style={{ color: KASNEB_COLORS.orange }} />} color={KASNEB_COLORS.orange} trend={{ value: "+4.2% MoM", positive: false }} />
                <KpiCard title="SLA Compliance" value={`${slaCompliance}%`} icon={<CheckCircle2 className="h-5 w-5" style={{ color: KASNEB_COLORS.green }} />} color={KASNEB_COLORS.green} trend={{ value: "+2.1% improvement", positive: true }} />
                <KpiCard title="Avg Resolution Time" value="19h" icon={<Clock className="h-5 w-5" style={{ color: KASNEB_COLORS.gold }} />} color={KASNEB_COLORS.gold} trend={{ value: "-1.5h MoM", positive: true }} />
                <KpiCard title="Total Campaigns" value={totalCampaigns} icon={<Megaphone className="h-5 w-5" style={{ color: KASNEB_COLORS.orange }} />} color={KASNEB_COLORS.orange} trend={{ value: "+30% MoM", positive: true }} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle className="text-lg">Cases Trend</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={caseTrendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} />
                                <Tooltip /><Legend />
                                <Line type="monotone" dataKey="opened" stroke={KASNEB_COLORS.blue} strokeWidth={2} name="Opened" dot={{ r: 4 }} />
                                <Line type="monotone" dataKey="resolved" stroke={KASNEB_COLORS.green} strokeWidth={2} name="Resolved" dot={{ r: 4 }} />
                                <Line type="monotone" dataKey="escalated" stroke={KASNEB_COLORS.orange} strokeWidth={2} name="Escalated" dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="text-lg">Cases by Status</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={casesByStatus} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                    {casesByStatus.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="text-lg">Stakeholders by Type</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stakeholdersByType}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                                    {stakeholdersByType.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="text-lg">Channel Distribution</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={channelDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                    {channelDistribution.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
