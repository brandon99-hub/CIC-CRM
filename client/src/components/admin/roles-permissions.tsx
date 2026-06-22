import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Plus, Pencil, Trash2, Users, User, Shield, Search,
    CheckCircle2, XCircle, Info, Filter, ChevronRight, ChevronLeft,
    LayoutDashboard, Settings2, Globe, Settings, Eye, EyeOff,
    ArrowLeft, Mail, Phone, Calendar, Briefcase, Activity, Clock
} from "lucide-react";
import { Role, Permission } from "@/types/admin";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RolePermission {
    id: string;
    roleId: string;
    permissionId: string;
}

interface SystemUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string | null;
    role: string;
    departmentId?: string | null;
    isActive: boolean;
    mustChangePassword: boolean;
    dashboardAccess: string;
    createdAt: string;
}

interface UserRoleAssignment {
    id: string;
    userId: string;
    roleId: string;
}

const DASHBOARD_OPTIONS = [
    { key: "marketing", label: "Marketing" },
    { key: "cases", label: "Cases" },
    { key: "stakeholders", label: "Stakeholders" },
    { key: "executive", label: "Executive" },
    { key: "admin", label: "Admin" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState({ entity }: { entity: string }) {
    return (
        <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No {entity} found.</p>
            <p className="text-gray-400 text-sm mt-1">Add your first {entity.toLowerCase()} to get started.</p>
        </div>
    );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface RolesPermissionsProps {
    // Roles
    roles: Role[];
    permissions: Permission[];
    rolePermissions: RolePermission[];
    selectedPermRole: string;
    onSelectPermRole: (id: string) => void;
    roleModalOpen: boolean;
    editingRole: Role | null;
    roleForm: { name: string; description: string; dashboards: string[] };
    onRoleFormChange: (form: { name: string; description: string; dashboards: string[] }) => void;
    onOpenRoleModal: (role?: Role) => void;
    onSaveRole: () => Promise<void>;
    onDeleteRole: (id: string) => void;
    onCloseRoleModal: () => void;
    onTogglePermission: (roleId: string, permissionId: string, hasIt: boolean) => void;
    // Users
    users: SystemUser[];
    userRoleAssignments: UserRoleAssignment[];
    departments: { id: string; name: string }[];
    onAddUser: (form: UserForm) => Promise<void>;
    onEditUser: (id: string, form: Partial<UserForm>) => Promise<void>;
    onDeleteUser: (id: string, email: string) => void;
    onBulkPermissions?: (roleId: string, permissionIds: string[], action: 'add' | 'remove') => Promise<void>;
}

interface UserForm {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    departmentId: string;
    roleIds: string[];
    password?: string;
}

const DEFAULT_USER_FORM: UserForm = {
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    departmentId: "",
    roleIds: [],
};

// ── Main component ─────────────────────────────────────────────────────────────

export function RolesPermissions({
    roles, permissions, rolePermissions, selectedPermRole, onSelectPermRole,
    roleModalOpen, editingRole, roleForm, onRoleFormChange,
    onOpenRoleModal, onSaveRole, onDeleteRole, onCloseRoleModal, onTogglePermission,
    users, userRoleAssignments, departments, onAddUser, onEditUser, onDeleteUser, onBulkPermissions,
}: RolesPermissionsProps) {
    const permissionsByModule = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
        const moduleKey = (p.module || "General").toUpperCase();
        if (!acc[moduleKey]) acc[moduleKey] = [];
        acc[moduleKey].push(p);
        return acc;
    }, {});

    const [roleSearch, setRoleSearch] = useState("");
    const [permissionSearch, setPermissionSearch] = useState("");
    const [userSearch, setUserSearch] = useState("");
    const [userRoleFilter, setUserRoleFilter] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("roles");

    const getSLACountdown = (deadline: string | null) => {
        if (!deadline) return "N/A";
        const now = new Date().getTime();
        const target = new Date(deadline).getTime();
        const diff = target - now;
        if (diff <= 0) return "SLA Breached";
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        return `${minutes}m`;
    };

    const [viewingUserDetails, setViewingUserDetails] = useState<SystemUser | null>(null);
    const [userAnalytics, setUserAnalytics] = useState<any>(null);
    const [performanceHistory, setPerformanceHistory] = useState<any[]>([]);
    const [showPassword, setShowPassword] = useState(false);
    const [performanceStatus, setPerformanceStatus] = useState<"active" | "resolved">("active");
    const [performancePage, setPerformancePage] = useState(1);
    const [performanceTotalPages, setPerformanceTotalPages] = useState(1);
    const [performanceLoading, setPerformanceLoading] = useState(false);

    useEffect(() => {
        if (viewingUserDetails) {
            fetchAnalytics();
            fetchPerformance();
        } else {
            setUserAnalytics(null);
            setPerformanceHistory([]);
        }
    }, [viewingUserDetails]);

    useEffect(() => {
        if (viewingUserDetails) {
            fetchPerformance();
        }
    }, [performanceStatus, performancePage]);

    const fetchAnalytics = async () => {
        if (!viewingUserDetails) return;
        try {
            const res = await fetch(`/api/admin/users/${viewingUserDetails.id}/analytics`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("marketingToken")}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUserAnalytics(data);
            }
        } catch (error) {
            console.error("Error fetching analytics:", error);
        }
    };

    const fetchPerformance = async () => {
        if (!viewingUserDetails) return;
        setPerformanceLoading(true);
        try {
            const params = new URLSearchParams({
                status: performanceStatus,
                page: String(performancePage),
                limit: "5"
            });
            const res = await fetch(`/api/admin/users/${viewingUserDetails.id}/performance?${params}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("marketingToken")}` }
            });
            if (res.ok) {
                const data = await res.json();
                setPerformanceHistory(data.cases || []);
                setPerformanceTotalPages(data.totalPages || 1);
            }
        } catch (error) {
            console.error("Error fetching performance:", error);
        } finally {
            setPerformanceLoading(false);
        }
    };

    const filteredRoles = roles.filter(r =>
        r.name.toLowerCase().includes(roleSearch.toLowerCase()) ||
        (r.description || "").toLowerCase().includes(roleSearch.toLowerCase())
    );

    const filteredUsersRaw = users.filter(u =>
        u.firstName.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.lastName.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase())
    );

    const filteredUsers = userRoleFilter
        ? filteredUsersRaw.filter(u => userRoleAssignments.some(a => a.userId === u.id && a.roleId === userRoleFilter))
        : filteredUsersRaw;

    async function handleSelectAllInModule(module: string, perms: Permission[], select: boolean) {
        if (!selectedPermRole) return;

        if (onBulkPermissions) {
            const pIds = perms.map(p => p.id);
            await onBulkPermissions(selectedPermRole, pIds, select ? 'add' : 'remove');
        } else {
            // Fallback to sequential if bulk handler not provided (safety)
            for (const p of perms) {
                const hasIt = rolePermissions.some(rp => rp.roleId === selectedPermRole && rp.permissionId === p.id);
                if (select && !hasIt) {
                    await onTogglePermission(selectedPermRole, p.id, false);
                } else if (!select && hasIt) {
                    await onTogglePermission(selectedPermRole, p.id, true);
                }
            }
        }
    }

    // User modal state (self-contained here)
    const [userModalOpen, setUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
    const [userForm, setUserForm] = useState<UserForm>(DEFAULT_USER_FORM);
    const [saving, setSaving] = useState(false);
    const [savingRole, setSavingRole] = useState(false);

    function openAddUser() {
        setEditingUser(null);
        setUserForm(DEFAULT_USER_FORM);
        setUserModalOpen(true);
    }

    function openEditUser(u: SystemUser) {
        const assignedRoleIds = userRoleAssignments.filter(a => a.userId === u.id).map(a => a.roleId);
        setEditingUser(u);
        setUserForm({
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            phoneNumber: u.phoneNumber || "",
            departmentId: u.departmentId || "",
            roleIds: assignedRoleIds,
            password: "",
        });
        setUserModalOpen(true);
    }

    async function handleSaveUser() {
        setSaving(true);
        try {
            if (editingUser) {
                await onEditUser(editingUser.id, userForm);
            } else {
                await onAddUser(userForm);
            }
            setUserModalOpen(false);
        } finally {
            setSaving(false);
        }
    }

    function toggleRoleDashboard(key: string) {
        const dashboards = roleForm.dashboards || [];
        onRoleFormChange({
            ...roleForm,
            dashboards: dashboards.includes(key)
                ? dashboards.filter(k => k !== key)
                : [...dashboards, key],
        });
    }

    async function handleSaveRoleInternal() {
        setSavingRole(true);
        try {
            await onSaveRole();
        } finally {
            setSavingRole(false);
        }
    }

    function toggleRole(id: string) {
        setUserForm(prev => ({
            ...prev,
            roleIds: prev.roleIds.includes(id)
                ? prev.roleIds.filter(r => r !== id)
                : [...prev.roleIds, id],
        }));
    }

    function getUserRoleNames(userId: string) {
        const ids = userRoleAssignments.filter(a => a.userId === userId).map(a => a.roleId);
        return ids.map(id => roles.find(r => r.id === id)?.name).filter(Boolean) as string[];
    }

    function getDashboardBadges(userId: string) {
        const assignedRoleIds = userRoleAssignments.filter(a => a.userId === userId).map(a => a.roleId);
        const userDashboards = new Set<string>();
        assignedRoleIds.forEach(id => {
            const role = roles.find(r => r.id === id);
            if (role?.dashboards && Array.isArray(role.dashboards)) {
                role.dashboards.forEach(d => userDashboards.add(d));
            }
        });
        return Array.from(userDashboards);
    }

    if (viewingUserDetails) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setViewingUserDetails(null)} className="h-10 w-10">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 leading-none">{viewingUserDetails.firstName} {viewingUserDetails.lastName}</h3>
                            <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5" /> {viewingUserDetails.email}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="font-bold gap-2" onClick={() => openEditUser(viewingUserDetails)}>
                            <Pencil className="h-4 w-4" /> Edit Profile
                        </Button>
                        <Badge className={`${viewingUserDetails.isActive ? "bg-emerald-500" : "bg-gray-300"} px-4 py-2 text-sm`}>
                            {viewingUserDetails.isActive ? "Active Account" : "Disabled Account"}
                        </Badge>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-1 p-6 space-y-6 border-gray-100 shadow-sm">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center border-4 border-white shadow-lg ring-1 ring-blue-50">
                                <span className="text-2xl font-black text-[#004E98] uppercase">
                                    {viewingUserDetails.firstName[0]}{viewingUserDetails.lastName[0]}
                                </span>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-lg">{viewingUserDetails.firstName} {viewingUserDetails.lastName}</h4>
                                <div className="flex flex-wrap justify-center gap-1 mt-1">
                                    {getDashboardBadges(viewingUserDetails.id).map(d => (
                                        <Badge key={d} variant="secondary" className="text-[10px] uppercase font-bold px-2 py-0">
                                            {d}
                                        </Badge>
                                    ))}
                                    {getDashboardBadges(viewingUserDetails.id).length === 0 && (
                                        <p className="text-xs text-gray-400 italic">No Dashboard Access</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-gray-50">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400 font-medium">Phone</span>
                                <span className="text-gray-900 font-bold">{viewingUserDetails.phoneNumber || "N/A"}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400 font-medium">Joined On</span>
                                <span className="text-gray-900 font-bold">{new Date(viewingUserDetails.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400 font-medium">Last Access</span>
                                <span className="text-gray-900 font-bold italic">Recent Activity</span>
                            </div>
                        </div>

                        <div className="space-y-3 pt-4">
                            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assigned Roles</h5>
                            <div className="flex flex-wrap gap-2">
                                {getUserRoleNames(viewingUserDetails.id).map(r => (
                                    <Badge key={r} variant="outline" className="bg-blue-50 text-[#004E98] border-blue-100 font-bold">
                                        {r}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </Card>

                    <div className="lg:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                {
                                    label: "Workload Status",
                                    value: userAnalytics ? `${userAnalytics.workloadPercentage}%` : "0%",
                                    icon: Activity,
                                    color: (userAnalytics?.workloadPercentage || 0) > 80 ? "text-red-600" : (userAnalytics?.workloadPercentage || 0) > 50 ? "text-amber-600" : "text-blue-600",
                                    bg: (userAnalytics?.workloadPercentage || 0) > 80 ? "bg-red-50" : (userAnalytics?.workloadPercentage || 0) > 50 ? "bg-amber-50" : "bg-blue-50"
                                },
                                { label: "Resolved Cases", value: userAnalytics?.resolvedCount?.toString() || "0", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
                                { label: "Avg Resolution", value: userAnalytics?.avgDuration ? `${(userAnalytics.avgDuration / 60).toFixed(1)}h` : "N/A", icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
                                { label: "Satisfaction", value: userAnalytics?.avgSatisfaction ? `${userAnalytics.avgSatisfaction.toFixed(1)}/5` : "N/A", icon: Globe, color: "text-indigo-600", bg: "bg-indigo-50" },
                            ].map((stat) => (
                                <Card key={stat.label} className="p-4 flex items-center gap-4 border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
                                        <stat.icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                                        <p className="text-xl font-black text-gray-900">{stat.value}</p>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        <Card className="p-6 border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="font-bold text-gray-900 flex items-center gap-2">
                                    <Briefcase className="h-4 w-4 text-[#004E98]" /> User Performance History
                                </h4>
                                <div className="flex bg-gray-100 p-1 rounded-lg">
                                    <Button
                                        variant={performanceStatus === "active" ? "secondary" : "ghost"}
                                        size="sm"
                                        onClick={() => { setPerformanceStatus("active"); setPerformancePage(1); }}
                                        className="h-8 text-xs font-bold px-3"
                                    >
                                        Active
                                    </Button>
                                    <Button
                                        variant={performanceStatus === "resolved" ? "secondary" : "ghost"}
                                        size="sm"
                                        onClick={() => { setPerformanceStatus("resolved"); setPerformancePage(1); }}
                                        className="h-8 text-xs font-bold px-3"
                                    >
                                        Resolved
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {performanceLoading ? (
                                    <div className="py-12 text-center text-gray-400 text-sm">Loading performance data...</div>
                                ) : performanceHistory.length === 0 ? (
                                    <div className="py-12 text-center text-gray-400 text-sm">No {performanceStatus} cases found.</div>
                                ) : (
                                    <>
                                        {performanceHistory.map((item, idx) => (
                                            <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 rounded-lg transition-all px-2">
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-mono text-gray-400">{item.caseNumber}</span>
                                                        <p className="text-sm font-bold text-gray-900 truncate">{item.title}</p>
                                                    </div>
                                                    <p className="text-[10px] text-gray-400">{new Date(item.createdAt).toLocaleString()}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    {performanceStatus === "active" ? (
                                                        <div className="flex flex-col items-end">
                                                            <Badge variant="outline" className={`text-[10px] font-mono ${item.slaBreached ? "border-red-100 text-red-600 bg-red-50" : "border-blue-100 text-blue-600 bg-blue-50"}`}>
                                                                SLA: {getSLACountdown(item.slaDeadline)}
                                                            </Badge>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[10px] font-mono border-emerald-100 text-emerald-700 bg-emerald-50">
                                                            Time: {item.resolutionDurationMinutes || 0}m
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {performanceTotalPages > 1 && (
                                            <div className="flex items-center justify-center gap-2 pt-4 border-t border-gray-50 mt-4">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={performancePage === 1}
                                                    onClick={() => setPerformancePage(p => p - 1)}
                                                    className="h-8 w-8 p-0"
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <span className="text-xs font-bold text-gray-500">Page {performancePage} of {performanceTotalPages}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={performancePage === performanceTotalPages}
                                                    onClick={() => setPerformancePage(p => p + 1)}
                                                    className="h-8 w-8 p-0"
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <TabsList className="bg-gray-100/80 p-1 rounded-xl w-full sm:w-fit flex flex-wrap h-auto justify-start">
                    <TabsTrigger value="roles" className="rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2">
                        <Shield className="h-4 w-4" />Roles & Permissions
                    </TabsTrigger>
                    <TabsTrigger value="users" className="rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2">
                        <Users className="h-4 w-4" />Users
                    </TabsTrigger>
                </TabsList>
            </div>

            {/* ── ROLES TAB ── */}
            <TabsContent value="roles" className="space-y-6 outline-none">
                <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#004E98]/10 p-3 rounded-lg">
                            <Shield className="h-6 w-6 text-[#004E98]" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 leading-none">System Roles</h3>
                            <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-1.5">
                                <Settings className="h-3.5 w-3.5 text-gray-400" /> Manage access levels and group-based permissions
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Quick filter roles..."
                                value={roleSearch}
                                onChange={(e) => setRoleSearch(e.target.value)}
                                className="pl-9 h-10 bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                            />
                        </div>
                        <Button onClick={() => onOpenRoleModal()} className="bg-[#004E98] hover:bg-[#003B73] shadow-md transition-all hover:scale-[1.02] font-bold">
                            <Plus className="h-4 w-4 mr-2" />Add Role
                        </Button>
                    </div>
                </div>

                {filteredRoles.length === 0 ? <EmptyState entity={roleSearch ? "matching roles" : "roles"} /> : (
                    <Card className="overflow-hidden border-gray-200 shadow-lg group">
                        <div className="overflow-x-auto">
                            <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                                    <TableHead className="font-bold text-gray-700 py-4 pl-6">Role Identity</TableHead>
                                    <TableHead className="font-bold text-gray-700">Visibility</TableHead>
                                    <TableHead className="font-bold text-gray-700 text-right pr-6">Management</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRoles.map((role) => (
                                    <TableRow key={role.id} className="hover:bg-gray-50/50 transition-colors group/row">
                                        <TableCell className="pl-6">
                                            <div className="flex items-center gap-4 py-2">
                                                <div className="h-11 w-11 rounded-xl flex items-center justify-center shadow-sm border transition-all bg-gray-50 border-gray-100">
                                                    <Shield className="h-5 w-5 text-gray-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-gray-900 text-lg">{role.name}</span>
                                                        <div className={`w-2 h-2 rounded-full ${role.isActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-gray-300"}`} />
                                                    </div>
                                                    <p className="text-sm text-gray-500 italic line-clamp-1 max-w-[500px]">
                                                        {role.description || "No description provided for this operational role."}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1.5">
                                                {role.dashboards && Array.isArray(role.dashboards) && role.dashboards.map((d: string) => (
                                                    <Badge key={d} className="bg-blue-50 text-[#004E98] text-[10px] font-bold border-blue-100 px-2 py-0 border-0">
                                                        {d}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setUserRoleFilter(role.id);
                                                        setActiveTab("users");
                                                    }}
                                                    title="Filter users in this role"
                                                    className="h-9 w-9 text-blue-500 hover:text-[#004E98] hover:bg-blue-50 border border-transparent hover:border-blue-100 shadow-none"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => onOpenRoleModal(role)}
                                                    className="h-9 w-9 text-gray-500 hover:text-[#004E98] hover:bg-blue-50 border border-transparent hover:border-blue-100 shadow-none"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => onDeleteRole(role.id)}
                                                    className="h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 shadow-none"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            </Table>
                        </div>
                    </Card>
                )}

                {/* Permission assignment redesign */}
                <div className="pt-4 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold text-gray-900">Permission Overrides</h3>
                            <p className="text-sm text-gray-500">Configure fine-grained access control per role</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="w-full sm:w-64">
                                <Label className="text-xs font-bold text-gray-400 uppercase mb-1.5 block">Target Role</Label>
                                <Select value={selectedPermRole} onValueChange={onSelectPermRole}>
                                    <SelectTrigger className="bg-white border-gray-200">
                                        <SelectValue placeholder="Select a role to configure" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-full sm:w-64">
                                <Label className="text-xs font-bold text-gray-400 uppercase mb-1.5 block">Search Permissions</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Quick filter..."
                                        value={permissionSearch}
                                        onChange={(e) => setPermissionSearch(e.target.value)}
                                        className="pl-9 bg-white border-gray-200"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {!selectedPermRole ? (
                        <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                            <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                <Info className="h-6 w-6 text-[#004E98]" />
                            </div>
                            <h4 className="text-gray-900 font-semibold mb-1">No Role Selected</h4>
                            <p className="text-gray-500 max-w-sm mx-auto text-sm">Please select a role from the dropdown above to view and manage its assigned permissions.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.entries(permissionsByModule).map(([module, perms]) => {
                                const filteredPerms = perms.filter(p =>
                                    p.key.toLowerCase().includes(permissionSearch.toLowerCase()) ||
                                    (p.description || "").toLowerCase().includes(permissionSearch.toLowerCase())
                                );

                                if (permissionSearch && filteredPerms.length === 0) return null;

                                const allSelected = filteredPerms.every(p => rolePermissions.some(rp => rp.roleId === selectedPermRole && rp.permissionId === p.id));
                                const someSelected = filteredPerms.some(p => rolePermissions.some(rp => rp.roleId === selectedPermRole && rp.permissionId === p.id)) && !allSelected;

                                return (
                                    <Card key={module} className="border-gray-100 shadow-sm flex flex-col hover:border-blue-100 transition-colors">
                                        <div className="p-4 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-[#004E98]" />
                                                <h4 className="font-bold text-xs uppercase tracking-wider text-[#004E98]">{module}</h4>
                                            </div>
                                            <Button
                                                onClick={() => handleSelectAllInModule(module, filteredPerms, !allSelected)}
                                                className="h-7 text-[10px] font-bold uppercase tracking-tight text-[#004E98] hover:bg-blue-50 bg-transparent shadow-none px-2 py-0"
                                            >
                                                {allSelected ? "Deselect All" : "Select All"}
                                            </Button>
                                        </div>
                                        <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-60 custom-scrollbar">
                                            {filteredPerms.map((p) => {
                                                const hasIt = rolePermissions.some((rp) => rp.roleId === selectedPermRole && rp.permissionId === p.id);
                                                return (
                                                    <div
                                                        key={p.id}
                                                        className={`flex items-start gap-3 p-2 rounded-lg transition-colors cursor-pointer group hover:bg-gray-50 ${hasIt ? 'bg-blue-50/30' : ''}`}
                                                        onClick={() => onTogglePermission(selectedPermRole, p.id, hasIt)}
                                                    >
                                                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${hasIt ? 'bg-[#004E98] border-[#004E98]' : 'border-gray-300 group-hover:border-gray-400 bg-white'}`}>
                                                            {hasIt && <CheckCircle2 className="h-3 w-3 text-white" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className={`text-sm font-medium leading-none ${hasIt ? 'text-gray-900 font-semibold' : 'text-gray-600'}`}>{p.description || p.key}</p>
                                                            <p className="text-[10px] text-gray-400 mt-1 truncate">{p.key}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </TabsContent>


            {/* ── USERS TAB ── */}
            <TabsContent value="users" className="space-y-6 outline-none">
                <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#004E98]/10 p-3 rounded-lg">
                            <Users className="h-6 w-6 text-[#004E98]" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 leading-none">System Users</h3>
                            <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-1.5">
                                <Shield className="h-3.5 w-3.5 text-gray-400" /> Manage user identity, roles and platform visibility
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {userRoleFilter && (
                            <Badge variant="secondary" className="bg-blue-50 text-[#004E98] border-blue-100 px-3 py-1.5 flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                                Role: {roles.find(r => r.id === userRoleFilter)?.name}
                                <XCircle className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => setUserRoleFilter(null)} />
                            </Badge>
                        )}
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search by name, email or phone..."
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                className="pl-9 h-10 bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                            />
                        </div>
                        <Button onClick={openAddUser} className="bg-[#004E98] hover:bg-[#003B73] shadow-md transition-all hover:scale-[1.02] font-bold">
                            <Plus className="h-4 w-4 mr-2" />Add User
                        </Button>
                    </div>
                </div>
                {filteredUsers.length === 0 ? <EmptyState entity={userSearch ? "matching users" : "users"} /> : (
                    <Card className="overflow-hidden border-gray-200 shadow-lg group">
                        <div className="overflow-x-auto">
                            <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                                    <TableHead className="font-bold text-gray-700 py-4 pl-6">Principal Profile</TableHead>
                                    <TableHead className="font-bold text-gray-700 hidden lg:table-cell">Contact</TableHead>
                                    <TableHead className="font-bold text-gray-700">Assigned Roles</TableHead>
                                    <TableHead className="font-bold text-gray-700 hidden md:table-cell">Visibility</TableHead>
                                    <TableHead className="font-bold text-gray-700">Department</TableHead>
                                    <TableHead className="font-bold text-gray-700 text-right pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.map((u) => {
                                    const roleNames = getUserRoleNames(u.id);
                                    const dashboards = getDashboardBadges(u.id);
                                    const initials = `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase();

                                    return (
                                        <TableRow key={u.id} className="hover:bg-gray-50/50 transition-colors group/row">
                                            <TableCell className="pl-6">
                                                <div className="flex items-center gap-3 py-1">
                                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm ring-1 ring-blue-50">
                                                        <span className="text-xs font-black text-[#004E98] tracking-tighter">{initials || <User className="h-4 w-4" />}</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-gray-900 truncate">{u.firstName} {u.lastName}</p>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-gray-300"}`} title={u.isActive ? "Active" : "Disabled"} />
                                                        </div>
                                                        <p className="text-xs text-gray-500 font-medium truncate">{u.email}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell">
                                                <div className="text-sm text-gray-600 font-medium">
                                                    {u.phoneNumber || <span className="text-gray-300 italic text-xs">Unspecified</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {roleNames.length === 0
                                                        ? <span className="text-gray-300 text-xs italic">No roles assigned</span>
                                                        : roleNames.map(n => (
                                                            <Badge key={n} variant="outline" className="bg-blue-50/50 text-[#004E98] text-[10px] font-bold border-blue-100 px-2 py-0 border-0">
                                                                {n}
                                                            </Badge>
                                                        ))
                                                    }
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {dashboards.map(d => (
                                                        <Badge key={d} className="bg-gray-100 text-gray-500 text-[9px] font-black uppercase tracking-tight border-0 shadow-none">
                                                            {d}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm font-semibold text-gray-700">
                                                    {departments.find(d => d.id === u.departmentId)?.name || "External/Unassigned"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right pr-4">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-blue-500 hover:text-[#004E98] hover:bg-blue-50"
                                                        onClick={() => setViewingUserDetails(u)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-gray-500 hover:text-[#004E98] hover:bg-blue-50"
                                                        onClick={() => openEditUser(u)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50"
                                                        onClick={() => onDeleteUser(u.id, u.email)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                            </Table>
                        </div>
                    </Card>
                )}
            </TabsContent>

            {/* ── ROLE MODAL ── */}
            <Dialog open={roleModalOpen} onOpenChange={onCloseRoleModal}>
                <DialogContent className="max-w-2xl p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden max-h-[90vh] flex flex-col">
                    <div className="p-6 border-b border-gray-100 flex-shrink-0">
                        <DialogHeader>
                            <div className="flex items-center gap-2 pb-2">
                                <Shield className="h-5 w-5 text-[#004E98]" />
                                <DialogTitle className="text-xl font-bold text-gray-900">
                                    {editingRole ? "Edit System Role" : "Create New Role"}
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-gray-500 text-sm mt-3">
                                Configure authority levels and operational descriptions for this role.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Role Name</Label>
                                    <Input
                                        value={roleForm.name}
                                        onChange={(e) => onRoleFormChange({ ...roleForm, name: e.target.value })}
                                        placeholder="e.g. Audit Manager"
                                        className="h-11 bg-gray-50/50 focus:bg-white border-gray-200"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Description</Label>
                                    <Textarea
                                        value={roleForm.description}
                                        onChange={(e) => onRoleFormChange({ ...roleForm, description: e.target.value })}
                                        placeholder="Briefly describe the purpose of this role..."
                                        className="min-h-[100px] bg-gray-50/50 focus:bg-white border-gray-200 resize-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-xs font-bold text-[#004E98] uppercase tracking-wider ml-1">Dashboard Visibility</Label>
                                <div className="grid grid-cols-1 gap-2.5">
                                    {DASHBOARD_OPTIONS.map(d => (
                                        <label key={d.key} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer group ${roleForm.dashboards.includes(d.key) ? 'bg-blue-50/40 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:border-blue-100 hover:bg-gray-50/50'}`}>
                                            <div className={`w-5 h-5 rounded flex items-center justify-center transition-all border ${roleForm.dashboards.includes(d.key) ? 'bg-[#004E98] border-[#004E98]' : 'bg-white border-gray-300 group-hover:border-[#004E98]'}`}>
                                                {roleForm.dashboards.includes(d.key) && <CheckCircle2 className="h-3 w-3 text-white" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-bold ${roleForm.dashboards.includes(d.key) ? 'text-[#004E98]' : 'text-gray-700'}`}>{d.label}</p>
                                            </div>
                                            <input type="checkbox" className="hidden" checked={roleForm.dashboards.includes(d.key)} onChange={() => toggleRoleDashboard(d.key)} />
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex gap-3">
                            <Info className="h-4 w-4 text-[#004E98] mt-0.5" />
                            <p className="text-[11px] text-blue-800 leading-relaxed">
                                Role definitions provide the baseline security tokens. Dashboard visibility determines which system areas users in this role can traverse.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 gap-3 flex-shrink-0">
                        <Button variant="outline" onClick={onCloseRoleModal} className="px-6" disabled={savingRole}>Cancel</Button>
                        <Button onClick={handleSaveRoleInternal} className="bg-[#004E98] hover:bg-[#003B73] text-white px-8 font-bold shadow-lg shadow-blue-500/10 min-w-[140px]" disabled={savingRole}>
                            {savingRole ? (
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 animate-spin" /> <span>Syncing...</span>
                                </div>
                            ) : (
                                editingRole ? "Update Role" : "Create Role"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── USER MODAL ── */}
            <Dialog open={userModalOpen} onOpenChange={(open: boolean) => { if (!open) setUserModalOpen(false); }}>
                <DialogContent className="max-w-2xl p-0 border-0 shadow-2xl rounded-2xl bg-white max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="p-8">
                        <DialogHeader className="mb-8">
                            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                <Users className="h-5 w-5 text-[#004E98]" />
                                <DialogTitle className="text-2xl font-bold text-gray-900">
                                    {editingUser ? "Configure User Account" : "Onboard New User"}
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-gray-500 text-sm mt-3">
                                {editingUser ? "Modify access tokens and security profiles." : "Provision a new administrative identity in the core system."}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-10">
                            {/* Section 1: Personal Details */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                                    <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <User className="h-4 w-4 text-[#004E98]" />
                                    </div>
                                    <h4 className="text-xs font-bold text-[#004E98] uppercase tracking-[0.2em]">Profile Information</h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold text-gray-400 uppercase ml-1">First Name</Label>
                                        <Input
                                            value={userForm.firstName}
                                            onChange={e => setUserForm(p => ({ ...p, firstName: e.target.value }))}
                                            placeholder="John"
                                            className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-[#004E98] transition-all shadow-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Last Name</Label>
                                        <Input
                                            value={userForm.lastName}
                                            onChange={e => setUserForm(p => ({ ...p, lastName: e.target.value }))}
                                            placeholder="Doe"
                                            className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-[#004E98] transition-all shadow-none"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-xs font-bold text-gray-700">Email Address</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={userForm.email}
                                            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                                            placeholder="email@kasneb.or.ke"
                                            className="h-10 border-gray-100"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phoneNumber" className="text-xs font-bold text-gray-700">Contact Number</Label>
                                        <Input
                                            id="phoneNumber"
                                            value={userForm.phoneNumber}
                                            onChange={e => setUserForm(p => ({ ...p, phoneNumber: e.target.value }))}
                                            placeholder="+254 700 000 000"
                                            className="h-10 border-gray-100"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Department</Label>
                                        </div>
                                        <Select
                                            value={userForm.departmentId}
                                            onValueChange={(val: string) => setUserForm({ ...userForm, departmentId: val })}
                                        >
                                            <SelectTrigger className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-[#004E98] transition-all shadow-none">
                                                <SelectValue placeholder="Select Department" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {departments.map(d => (
                                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Password Reset</Label>
                                            <span className="text-[10px] text-amber-500 font-medium italic">Leave blank to keep current signature</span>
                                        </div>
                                        <div className="relative">
                                            <Input
                                                id="password"
                                                type={showPassword ? "text" : "password"}
                                                value={userForm.password || ""}
                                                onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))}
                                                placeholder="••••••••••••"
                                                className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-[#004E98] transition-all shadow-none pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Access & Roles */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                                    <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <Shield className="h-4 w-4 text-[#004E98]" />
                                    </div>
                                    <h4 className="text-xs font-bold text-[#004E98] uppercase tracking-[0.2em]">Assign Role</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar p-1">
                                    {roles.map(r => (
                                        <label key={r.id} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer group ${userForm.roleIds.includes(r.id) ? 'bg-blue-50/40 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:border-blue-100 hover:bg-gray-50/50'}`}>
                                            <div className={`w-5 h-5 rounded flex items-center justify-center transition-all border ${userForm.roleIds.includes(r.id) ? 'bg-[#004E98] border-[#004E98]' : 'bg-white border-gray-300 group-hover:border-[#004E98]'}`}>
                                                {userForm.roleIds.includes(r.id) && <CheckCircle2 className="h-3 w-3 text-white" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-bold ${userForm.roleIds.includes(r.id) ? 'text-[#004E98]' : 'text-gray-700'}`}>{r.name}</p>
                                            </div>
                                            <input type="checkbox" className="hidden" checked={userForm.roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} />
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {!editingUser && (
                                <div className="p-5 rounded-2xl bg-[#004E98]/5 border border-[#004E98]/10 flex gap-5">
                                    <div className="h-10 w-10 rounded-xl bg-[#004E98]/10 flex items-center justify-center flex-shrink-0">
                                        <Info className="h-5 w-5 text-[#004E98]" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-sm font-bold text-gray-900">System Notification</p>
                                        <p className="text-xs text-gray-600 leading-relaxed max-w-lg">
                                            Upon account creation, the system will securely generate temporary credentials and dispatch a setup guide to the user's primary email.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="pt-8 bg-white border-t border-gray-100 flex items-center justify-end gap-4 mt-10">
                                <Button
                                    onClick={() => setUserModalOpen(false)}
                                    variant="ghost"
                                    className="text-gray-500 hover:bg-white hover:text-gray-700 h-12 px-8 font-bold border border-transparent hover:border-gray-200"
                                >
                                    Cancel Changes
                                </Button>
                                <Button
                                    onClick={handleSaveUser}
                                    disabled={saving || !userForm.firstName || !userForm.lastName || !userForm.email}
                                    className="bg-[#004E98] hover:bg-[#003a72] text-white h-12 px-10 font-bold shadow-xl shadow-blue-500/10 transition-all active:scale-[0.98]"
                                >
                                    {saving ? (
                                        <span className="flex items-center gap-3">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Processing...
                                        </span>
                                    ) : editingUser ? "Save Updates" : "Issue Account"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Tabs>
    );
}
