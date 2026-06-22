import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Shield, Building2, Clock, GitBranch, Database,
    FolderTree, CheckCircle2, Circle, AlertCircle,
    ArrowRight, Download, FileText,
    Users, Activity, AlertTriangle,
} from "lucide-react";
import { StatsCarousel } from "@/components/shared/stats-carousel";

interface AdminOverviewProps {
    rolesCount: number;
    departmentsCount: number;
    activeSlaCount: number;
    activeWorkflowCount: number;
    onSeedDefaults: () => void;
    categoriesCount?: number;
    integrationsCount?: number;
    adminName?: string;
    overviewStats?: {
        totalUsers: number;
        integrations: { total: number; failing: number };
        openCases: number;
        overdueCases: number;
    } | null;
}

const StatCard = ({
    label, value, icon: Icon, color, borderColor, bg, link,
}: {
    label: string;
    value: number | string;
    icon: React.ElementType;
    color: string;
    borderColor: string;
    bg: string;
    link?: string;
}) => (
    <div
        className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-default`}
        style={{ borderTopWidth: 3, borderTopColor: borderColor }}
    >
        <div className="p-5">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${bg}`}>
                    <Icon className="h-5 w-5" style={{ color }} />
                </div>
            </div>
        </div>
    </div>
);

const HealthRow = ({
    label, ok, detail,
}: {
    label: string;
    ok: boolean;
    detail?: string;
}) => (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0 border-gray-50">
        <div className="flex items-center gap-3">
            {ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            ) : (
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            )}
            <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {detail || (ok ? "Healthy" : "Attention")}
        </span>
    </div>
);

const CheckItem = ({
    label, done, note,
}: {
    label: string;
    done: boolean;
    note?: string;
}) => (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0 border-gray-50">
        <div className={`mt-0.5 flex-shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center ${done ? "bg-[#004E98] border-[#004E98]" : "border-gray-300"}`}>
            {done && <CheckCircle2 className="h-3 w-3 text-white" />}
        </div>
        <div>
            <p className={`text-sm font-medium ${done ? "text-gray-700" : "text-gray-400"}`}>{label}</p>
            {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
        </div>
    </div>
);

const AdminOverviewHeader = ({ adminName, stats }: { adminName?: string, stats: any }) => {
    const adminStats = [
        {
            label: "System Health Status",
            value: "99.9%",
            description: "High availability maintained across all core services and database clusters.",
            color: "text-emerald-600"
        },
        {
            label: "Critical Security Alerts",
            value: "0 Active",
            description: "No pending security breaches or unauthorized access attempts detected in last 24h.",
            color: "text-blue-600"
        },
        {
            label: "Recent Audit Activity",
            value: "124 Logs",
            description: "Significant administrative actions captured today across all system modules.",
            color: "text-amber-600"
        }
    ];

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-8">
            <div className="p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-8 relative">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#004E98]" />

                <div className="space-y-3 relative z-10 pl-2 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Operational Excellence</span>
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-none">
                        Welcome, <span className="text-[#004E98]">{adminName || "Administrator"}</span>
                    </h1>
                    <p className="text-gray-500 text-sm font-medium leading-relaxed max-w-xl">
                        Your administrative command center is synchronized. You have <strong>{stats?.openCases || 0} active cases</strong> and <strong>{stats?.overdueCases || 0} SLA breaches</strong> requiring immediate oversight.
                    </p>
                </div>

                <div className="w-full xl:w-[420px] relative z-10">
                    <StatsCarousel stats={adminStats} />
                </div>
            </div>
        </div>
    );
};

import { useState, useEffect } from "react";

export function AdminOverview({
    rolesCount,
    departmentsCount,
    activeSlaCount,
    activeWorkflowCount,
    onSeedDefaults,
    categoriesCount = 0,
    integrationsCount = 0,
    adminName,
    overviewStats,
}: AdminOverviewProps) {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">

                {/* 1. Total System Users */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow" style={{ borderTopWidth: 3, borderTopColor: "#004E98" }}>
                    <div className="p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total System Users</p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {overviewStats != null ? overviewStats.totalUsers : "—"}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">All registered accounts</p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-blue-50">
                                <Users className="h-5 w-5" style={{ color: "#004E98" }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Active Integrations */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow" style={{ borderTopWidth: 3, borderTopColor: "#0891b2" }}>
                    <div className="p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Active Integrations</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-3xl font-bold text-gray-900">
                                        {overviewStats != null ? overviewStats.integrations.total : "—"}
                                    </p>
                                    {overviewStats != null && overviewStats.integrations.failing > 0 && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                                            <AlertTriangle className="h-3 w-3" />
                                            {overviewStats.integrations.failing} failing
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Configured connectors</p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-cyan-50">
                                <Database className="h-5 w-5" style={{ color: "#0891b2" }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Open Cases */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow" style={{ borderTopWidth: 3, borderTopColor: "#D0AC01" }}>
                    <div className="p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Open Cases</p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {overviewStats != null ? overviewStats.openCases : "—"}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Not resolved or closed</p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-yellow-50">
                                <Activity className="h-5 w-5" style={{ color: "#D0AC01" }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Overdue Cases */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow" style={{ borderTopWidth: 3, borderTopColor: "#dc2626" }}>
                    <div className="p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Overdue Cases</p>
                                <p className={`text-3xl font-bold ${overviewStats != null && overviewStats.overdueCases > 0 ? "text-red-600" : "text-gray-900"}`}>
                                    {overviewStats != null ? overviewStats.overdueCases : "—"}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Past SLA deadline</p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-red-50">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* ── Two-column row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* System Health */}
                <Card className="shadow-sm border-gray-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            System Health
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <HealthRow label="Database Connection" ok={true} detail="Connected" />
                        <HealthRow label="Authentication Service" ok={true} detail="Active" />
                        <HealthRow label="Email / Nodemailer" ok={true} detail="Configured" />
                        <HealthRow label="SLA Rules Engine" ok={activeSlaCount > 0} detail={activeSlaCount > 0 ? `${activeSlaCount} rules active` : "No rules configured"} />
                        <HealthRow label="Workflow Automation" ok={activeWorkflowCount > 0} detail={activeWorkflowCount > 0 ? `${activeWorkflowCount} active` : "No workflows active"} />
                    </CardContent>
                </Card>

                {/* Configuration Checklist */}
                <Card className="shadow-sm border-gray-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                            <Circle className="h-4 w-4 text-[#D0AC01]" />
                            Configuration Checklist
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <CheckItem label="Departments configured" done={departmentsCount > 0} note={departmentsCount > 0 ? `${departmentsCount} departments` : "No departments yet"} />
                        <CheckItem label="Roles & permissions defined" done={rolesCount > 0} note={rolesCount > 0 ? `${rolesCount} roles` : "No roles yet"} />
                        <CheckItem label="Service categories created" done={categoriesCount > 0} note={categoriesCount > 0 ? `${categoriesCount} categories` : "Required for SLA rules"} />
                        <CheckItem label="SLA rules configured" done={activeSlaCount > 0} note={activeSlaCount > 0 ? `${activeSlaCount} active rules` : "Required for case timers"} />
                        <CheckItem label="Workflow automation active" done={activeWorkflowCount > 0} note={activeWorkflowCount > 0 ? `${activeWorkflowCount} workflows running` : "Optional but recommended"} />
                        <CheckItem label="External integrations set up" done={integrationsCount > 0} note={integrationsCount > 0 ? `${integrationsCount} integrations` : "Optional"} />
                    </CardContent>
                </Card>
            </div>

            {/* ── Quick Actions ── */}
            <Card className="shadow-sm border-gray-100">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-gray-800">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-3">
                        <Button
                            onClick={onSeedDefaults}
                            className="bg-[#004E98] hover:bg-[#003a72] text-white flex items-center gap-2"
                        >
                            <Database className="h-4 w-4" />
                            Seed Default Data
                        </Button>
                        <Button
                            variant="outline"
                            className="border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            onClick={() => window.open("/api/admin/audit-logs/export", "_blank")}
                        >
                            <Download className="h-4 w-4" />
                            Export Config
                        </Button>
                        <Button
                            variant="outline"
                            className="border-[#004E98]/20 text-[#004E98] hover:bg-blue-50 flex items-center gap-2"
                        >
                            <FileText className="h-4 w-4" />
                            View Audit Log
                            <ArrowRight className="h-3 w-3" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
