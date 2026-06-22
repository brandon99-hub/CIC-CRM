import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Shield,
  Building2,
  FolderTree,
  Clock,
  ArrowUpCircle,
  GitBranch,
  LogOut,
  Menu,
  X,
  Loader2,
  Database,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  AlertCircle,
  Globe,
  Calendar,
  Users,
  Activity,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useScreenSize } from "@/hooks/use-mobile";

import { AdminOverview } from "@/components/admin/admin-overview";
import { RolesPermissions } from "@/components/admin/roles-permissions";
import { Departments } from "@/components/admin/departments";
import { ServiceCategories } from "@/components/admin/service-categories";
import { SlaRules } from "@/components/admin/sla-rules";
import { EscalationChains } from "@/components/admin/escalation-chains";
import { WorkflowRules } from "@/components/admin/workflow-rules";
import { Integrations } from "@/components/admin/integrations";
import { AuditLogs } from "@/components/admin/audit-logs";
import { Timezones } from "@/components/admin/timezones";
import { DashboardLayout } from "@/components/shared/dashboard-layout";
import { NavGroup } from "@/components/shared/dashboard-sidebar";
import { StatsCarousel } from "@/components/shared/stats-carousel";
import { ShiftScheduling } from "@/components/admin/workforce/shift-scheduling";
import { CapacityPlanning } from "@/components/admin/workforce/capacity-planning";
import { QueueManagement } from "@/components/admin/workforce/queue-management";

import {
  Role, Permission, RolePermission, Department, ServiceCategory, SlaRule,
  EscalationChain, EscalationStep, WorkflowRule, Integration, AuditLog,
  SystemUser, UserRoleAssignment, UserForm
} from "@/types/admin";

function getGreeting(): string {
  const nairobiTime = new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi", hour: "numeric", hour12: false });
  const hour = parseInt(nairobiTime, 10);
  const key = "crm_admin_visited";
  const hasVisited = sessionStorage.getItem(key);
  if (!hasVisited) { sessionStorage.setItem(key, "true"); return "Welcome"; }
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Welcome back";
}

const AdminDashboardHeader = ({
  userName, roleCount, deptCount, slaCount, workflowCount
}: {
  userName?: string;
  roleCount: number;
  deptCount: number;
  slaCount: number;
  workflowCount: number;
}) => {
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => { setGreeting(getGreeting()); }, []);

  const adminStats = [
    {
      label: "System Configuration",
      value: `${roleCount} Roles / ${deptCount} Depts`,
      description: `${roleCount} roles and ${deptCount} departments are currently active and configured in the system.`,
      color: "text-blue-600"
    },
    {
      label: "SLA Rules Active",
      value: `${slaCount} Rules`,
      description: `${slaCount} SLA rules are governing case response and resolution targets across all service categories.`,
      color: "text-rose-600"
    },
    {
      label: "Workflow Automation",
      value: `${workflowCount} Active`,
      description: `${workflowCount} automated workflow rules are configured to trigger actions on system events.`,
      color: "text-emerald-600"
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
            {greeting}, <span className="text-[#004E98]">{userName || "Administrator"}</span>
          </h1>
        </div>
        <div className="w-full xl:w-[420px] relative z-10">
          <StatsCarousel stats={adminStats} />
        </div>
      </div>
    </div>
  );
};



const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs} hour${hrs > 1 ? "s" : ""}`;
  }
  const days = Math.floor(minutes / 1440);
  const remaining = minutes % 1440;
  if (remaining === 0) return `${days} day${days > 1 ? "s" : ""}`;
  return `${days}d ${formatMinutes(remaining)}`;
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const TRIGGER_EVENTS = [
  "case_created",
  "case_updated",
  "sla_approaching",
  "sla_breached",
  "case_escalated",
  "case_resolved",
];

const PORTAL_TYPES = [
  { value: "erp", label: "ERP" },
  { value: "call", label: "Phone Calls" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "live_chat", label: "Live Chat" },
  { value: "chatbot", label: "Chatbot" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "tiktok", label: "TikTok" },
  { value: "website", label: "Website Inquiries" },
  { value: "walk_in", label: "Walk-ins" },
  { value: "sms", label: "SMS Gateway" },
];


const tabDescriptions: Record<string, string> = {
  overview: "System administration overview and quick actions",
  roles: "Manage roles and assign permissions",
  departments: "Manage organizational departments",
  categories: "Manage service categories and default priorities",
  sla: "Configure SLA response and resolution times",
  escalation: "Define escalation chains and steps",
  workflows: "Automate actions based on trigger events",
  integrations: "Manage external system integrations and connections",
  audit: "View system audit logs and activity history",
  scheduling: "Manage shifts and assign agents",
  capacity: "Plan workforce capacity against forecasted demand",
  queues: "Manage agent queues and routing strategies",
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("overview");
  const [adminUser, setAdminUser] = useState<any>(() => { try { return JSON.parse(localStorage.getItem("marketingUser") || "{}"); } catch { return {}; } });

  // Pagination/Filters
  const [auditPage, setAuditPage] = useState(1);
  const [auditModule, setAuditModule] = useState("");
  const [auditAction, setAuditAction] = useState("");

  const [selectedDeptForSubs, setSelectedDeptForSubs] = useState<Department | null>(null);

  // Modals (state kept as is for simplicity)
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({ name: "", description: "", dashboards: [] as string[] });

  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState({ name: "", code: "", description: "", parentDepartmentId: "" });

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ServiceCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: "", code: "", description: "", departmentId: "", defaultPriority: "medium" });

  const [slaModalOpen, setSlaModalOpen] = useState(false);
  const [editingSla, setEditingSla] = useState<SlaRule | null>(null);
  const [slaForm, setSlaForm] = useState({
    name: "", serviceCategoryId: "", priority: "medium",
    metricType: "resolution_time", timeline: 1, timelineUnit: "working days",
    responseTimeMinutes: 0,
    businessHoursOnly: false,
  });

  const [chainModalOpen, setChainModalOpen] = useState(false);
  const [editingChain, setEditingChain] = useState<EscalationChain | null>(null);
  const [chainForm, setChainForm] = useState({ name: "", serviceCategoryId: "", slaId: "", priority: "", description: "", assigneeUserId: "", escalateAfterMinutes: 0 });
  const [expandedChain, setExpandedChain] = useState<string | null>(null);

  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [stepChainId, setStepChainId] = useState<string>("");
  const [editingStep, setEditingStep] = useState<EscalationStep | null>(null);
  const [stepForm, setStepForm] = useState({ assigneeDepartmentId: "", targetDepartmentId: "", assigneeRoleId: "", assigneeUserId: null as string | null, escalateAfterMinutes: 30, requiresConsent: false, gracePeriodMinutes: 0, notifyChannel: "email", description: "" });

  const [wfModalOpen, setWfModalOpen] = useState(false);
  const [editingWf, setEditingWf] = useState<WorkflowRule | null>(null);
  const [wfForm, setWfForm] = useState({ name: "", description: "", triggerEvent: "case_created", serviceCategoryId: "", priority: "", conditions: "[]", actions: "[]" });

  const [integrationModalOpen, setIntegrationModalOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [integrationForm, setIntegrationForm] = useState({ name: "", portalType: "erp", baseUrl: "", apiKey: "", clientId: "", clientSecret: "", authType: "api_key", isActive: true });

  const [selectedPermRole, setSelectedPermRole] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDept, setIsSavingDept] = useState(false);
  const [isSavingCat, setIsSavingCat] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; title: string; description: string; onConfirm: () => Promise<void>; } | null>(null);

  // ── Auth context ───────────────────────────────────────────────────────


  // ── Queries ────────────────────────────────────────────────────────────

  const { data: overviewStats, isLoading: overviewLoading } = useQuery<any>({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/overview-stats");
      return res.json();
    },
    enabled: activeTab === "overview",
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["admin", "roles"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/roles");
      const d = await res.json();
      return d.roles || d || [];
    },
    enabled: activeTab === "roles" || activeTab === "escalation" || activeTab === "overview",
  });

  const { data: departments = [], isLoading: deptsLoading } = useQuery<Department[]>({
    queryKey: ["admin", "departments"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/departments");
      const d = await res.json();
      return d.departments || d || [];
    },
    enabled: activeTab === "departments" || activeTab === "categories" || activeTab === "overview",
  });

  const { data: categories = [], isLoading: catsLoading } = useQuery<ServiceCategory[]>({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/service-categories");
      const d = await res.json();
      return d.serviceCategories || d || [];
    },
    enabled: activeTab === "categories" || activeTab === "sla" || activeTab === "escalation" || activeTab === "workflows",
  });

  const { data: slaRules = [], isLoading: slaLoading } = useQuery<SlaRule[]>({
    queryKey: ["admin", "sla"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/sla-rules");
      const d = await res.json();
      return d.slaRules || d || [];
    },
    enabled: activeTab === "sla" || activeTab === "overview",
  });

  const { data: chains = [], isLoading: chainsLoading } = useQuery<EscalationChain[]>({
    queryKey: ["admin", "escalation", "chains"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/escalation-chains");
      const d = await res.json();
      return d.escalationChains || d || [];
    },
    enabled: activeTab === "escalation",
  });

  const { data: workflows = [], isLoading: workflowsLoading } = useQuery<WorkflowRule[]>({
    queryKey: ["admin", "workflows"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/workflow-rules");
      const d = await res.json();
      return d.workflowRules || d || [];
    },
    enabled: activeTab === "workflows" || activeTab === "overview",
  });

  const { data: integrations = [], isLoading: integrationsLoading } = useQuery<Integration[]>({
    queryKey: ["admin", "integrations"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/integrations");
      const d = await res.json();
      return d.integrations || d || [];
    },
    enabled: activeTab === "integrations",
  });

  const { data: auditData, isLoading: auditLoading } = useQuery<any>({
    queryKey: ["admin", "audit", { auditPage, auditModule, auditAction }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(auditPage), limit: "50" });
      if (auditModule) params.set("module", auditModule);
      if (auditAction) params.set("action", auditAction);
      const res = await apiRequest(`/api/admin/audit-logs?${params}`);
      return res.json();
    },
    enabled: activeTab === "audit",
  });

  const auditLogs = auditData?.logs || auditData?.data || (Array.isArray(auditData) ? auditData : []);
  const auditTotalPages = auditData?.totalPages || Math.ceil((auditData?.total || 0) / 50) || 1;

  const { data: systemUsers = [], isLoading: usersLoading } = useQuery<SystemUser[]>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/users");
      const d = await res.json();
      return d.users || (Array.isArray(d) ? d : []);
    },
    enabled: activeTab === "roles" || activeTab === "escalation",
  });

  const { data: userRoleAssignments = [], isLoading: assignmentsLoading } = useQuery<UserRoleAssignment[]>({
    queryKey: ["admin", "user-role-assignments"],
    queryFn: async () => {
      const all: UserRoleAssignment[] = [];
      // This is still N+1 but better handled by query. Ideally we need a bulk endpoint.
      // Keeping N+1 for now as we don't have the bulk endpoint in this turn.
      await Promise.all(systemUsers.map(async (u) => {
        const res = await apiRequest(`/api/admin/users/${u.id}/roles`);
        if (res.ok) { const d = await res.json(); all.push(...(d.userRoles || [])); }
      }));
      return all;
    },
    enabled: activeTab === "roles" && systemUsers.length > 0,
  });

  const { data: permissions = [], isLoading: permsLoading } = useQuery<Permission[]>({
    queryKey: ["admin", "permissions"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/permissions");
      const d = await res.json();
      return d.permissions || d || [];
    },
    enabled: activeTab === "roles",
  });

  const { data: rolePermissions = [], isLoading: rolePermsLoading } = useQuery<RolePermission[]>({
    queryKey: ["admin", "role-permissions"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/role-permissions");
      const d = await res.json();
      return d.rolePermissions || d || [];
    },
    enabled: activeTab === "roles",
  });

  const { data: stepData = [], isLoading: stepsLoading } = useQuery<EscalationStep[]>({
    queryKey: ["admin", "escalation", "steps", expandedChain],
    queryFn: async () => {
      const res = await apiRequest(`/api/admin/escalation-steps/${expandedChain}`);
      const d = await res.json();
      return d.escalationSteps || d || [];
    },
    enabled: !!expandedChain,
  });

  const loading = overviewLoading || rolesLoading || deptsLoading || catsLoading || slaLoading || chainsLoading || workflowsLoading || integrationsLoading || auditLoading || usersLoading || assignmentsLoading || permsLoading || rolePermsLoading || stepsLoading;

  const loadTabData = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  };

  // ── Helpers ──
  const getDeptName = (id: string | null) => departments.find((d) => d.id === id)?.name || "—";
  const getCatName = (id: string | null) => categories.find((c) => c.id === id)?.name || "—";
  const getRoleName = (id: string | null) => roles.find((r) => r.id === id)?.name || "—";
  const getSlaName = (id: string | null) => slaRules.find((s) => s.id === id)?.name || "—";
  const convertToMinutes = (value: number, unit: string): number => unit === "hours" ? value * 60 : unit === "days" ? value * 1440 : value;

  // ── Seed defaults ──
  const handleSeedDefaults = async () => {
    try {
      const res = await apiRequest("/api/admin/seed-defaults", { method: "POST" });
      if (res.ok) {
        toast({ title: "Success", description: "Default data seeded successfully." });
        queryClient.invalidateQueries({ queryKey: ["admin"] });
      }
      else { const d = await res.json().catch(() => ({})); toast({ title: "Error", description: d.message || "Failed to seed defaults.", variant: "destructive" }); }
    } catch { toast({ title: "Error", description: "Failed to seed default data.", variant: "destructive" }); }
  };

  // ── User CRUD ──
  const handleAddUser = async (form: UserForm) => {
    const res = await apiRequest("/api/admin/users", { method: "POST", body: JSON.stringify(form) });
    if (res.ok) {
      toast({ title: "User created", description: "Welcome email sent with credentials." });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "user-role-assignments"] });
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Error", description: d.error || "Failed to create user.", variant: "destructive" });
    }
  };
  const handleEditUser = async (id: string, form: Partial<UserForm>) => {
    try {
      const body: Record<string, unknown> = { ...form };
      if (form.roleIds !== undefined) {
        // First update roles
        const roleRes = await apiRequest(`/api/admin/users/${id}/roles`, {
          method: "PUT",
          body: JSON.stringify({ roleIds: form.roleIds })
        });
        if (!roleRes.ok) {
          const d = await roleRes.json().catch(() => ({}));
          throw new Error(d.error || "Failed to update roles");
        }
        delete body.roleIds;
      }

      // Then update user profile
      const res = await apiRequest(`/api/admin/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(body)
      });

      if (res.ok) {
        toast({ title: "User updated", description: "Changes saved successfully." });
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "user-role-assignments"] });
      } else {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Error", description: d.error || "Failed to update user.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update user.", variant: "destructive" });
    }
  };
  const handleDeleteUser = async (id: string, email: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Delete User?",
      description: `Are you sure you want to permanently delete ${email}? This action cannot be undone and will remove all associated role assignments.`,
      onConfirm: async () => {
        try {
          const res = await apiRequest(`/api/admin/users/${id}`, { method: "DELETE" });
          if (res.ok) {
            toast({ title: "User deleted", description: "The account has been permanently removed." });
            queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
          } else {
            const d = await res.json().catch(() => ({}));
            toast({ title: "Error", description: d.error || "Failed to delete user.", variant: "destructive" });
          }
        } catch (err: any) {
          toast({ title: "Error", description: err.message || "Failed to delete user.", variant: "destructive" });
        }
      }
    });
  };

  // ── Role CRUD ──
  const openRoleModal = (role?: Role) => {
    if (role) { setEditingRole(role); setRoleForm({ name: role.name, description: role.description || "", dashboards: role.dashboards || [] }); }
    else { setEditingRole(null); setRoleForm({ name: "", description: "", dashboards: [] }); }
    setRoleModalOpen(true);
  };
  const saveRole = async () => {
    try {
      const res = await apiRequest(editingRole ? `/api/admin/roles/${editingRole.id}` : "/api/admin/roles", { method: editingRole ? "PUT" : "POST", body: JSON.stringify(roleForm) });
      if (res.ok) {
        toast({ title: "Success", description: `Role ${editingRole ? "updated" : "created"} successfully.` });
        setRoleModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      } else { const d = await res.json().catch(() => ({})); toast({ title: "Error", description: d.message || "Failed to save role.", variant: "destructive" }); }
    } catch { toast({ title: "Error", description: "Failed to save role.", variant: "destructive" }); }
  };
  const deleteRole = async (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Delete Role?",
      description: "Are you sure you want to delete this role? This action cannot be undone and may affect user permissions.",
      onConfirm: async () => {
        try {
          const res = await apiRequest(`/api/admin/roles/${id}`, { method: "DELETE" });
          if (res.ok) {
            toast({ title: "Success", description: "Role deleted." });
            queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
          } else { toast({ title: "Error", description: "Failed to delete role.", variant: "destructive" }); }
        } catch { toast({ title: "Error", description: "Failed to delete role.", variant: "destructive" }); }
      }
    });
  };
  const togglePermission = async (roleId: string, permissionId: string, hasIt: boolean) => {
    try {
      if (hasIt) {
        const rp = rolePermissions.find((rp) => rp.roleId === roleId && rp.permissionId === permissionId);
        if (rp) await apiRequest(`/api/admin/role-permissions/${rp.id}`, { method: "DELETE" });
      } else {
        await apiRequest("/api/admin/role-permissions", { method: "POST", body: JSON.stringify({ roleId, permissionId }) });
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "role-permissions"] });
    } catch { toast({ title: "Error", description: "Failed to update permission.", variant: "destructive" }); }
  };

  const handleBulkPermissions = async (roleId: string, permissionIds: string[], action: 'add' | 'remove') => {
    try {
      const res = await apiRequest("/api/admin/role-permissions/bulk", {
        method: "POST",
        body: JSON.stringify({ roleId, permissionIds, action })
      });
      if (res.ok) {
        toast({ title: "Success", description: "Permissions updated successfully." });
        queryClient.invalidateQueries({ queryKey: ["admin", "role-permissions"] });
      } else {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Error", description: d.error || "Failed to update permissions.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update permissions.", variant: "destructive" });
    }
  };

  // ── Department CRUD ──
  const openDeptModal = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setDeptForm({ name: dept.name, code: dept.code, description: dept.description || "", parentDepartmentId: dept.parentDepartmentId || "none" });
    } else {
      setEditingDept(null);
      setDeptForm({
        name: "",
        code: `DEPT-${String(departments.length + 1).padStart(3, '0')}`,
        description: "",
        parentDepartmentId: selectedDeptForSubs ? selectedDeptForSubs.id : "none"
      });
    }
    setDeptModalOpen(true);
  };
  const saveDept = async () => {
    setIsSavingDept(true);
    try {
      const payload = {
        ...deptForm,
        parentDepartmentId: (deptForm.parentDepartmentId && deptForm.parentDepartmentId !== "none") ? deptForm.parentDepartmentId : null
      };
      const res = await apiRequest(editingDept ? `/api/admin/departments/${editingDept.id}` : "/api/admin/departments", {
        method: editingDept ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast({ title: "Success", description: `Department ${editingDept ? "updated" : "created"}.` });
        setDeptModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
      }
      else { const d = await res.json().catch(() => ({})); toast({ title: "Error", description: d.message || "Failed to save department.", variant: "destructive" }); }
    } catch { toast({ title: "Error", description: "Failed to save department.", variant: "destructive" }); }
    finally { setIsSavingDept(false); }
  };
  const deleteDept = async (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Delete Department?",
      description: "Are you sure you want to delete this department? All sub-departments and associated mappings will be affected.",
      onConfirm: async () => {
        try {
          const res = await apiRequest(`/api/admin/departments/${id}`, { method: "DELETE" });
          if (res.ok) {
            toast({ title: "Success", description: "Department deleted." });
            queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
          }
          else { toast({ title: "Error", description: "Failed to delete department.", variant: "destructive" }); }
        } catch { toast({ title: "Error", description: "Failed to delete department.", variant: "destructive" }); }
      }
    });
  };

  // ── Category CRUD ──
  const openCatModal = (cat?: ServiceCategory) => {
    if (cat) { setEditingCat(cat); setCatForm({ name: cat.name, code: cat.code, description: cat.description || "", departmentId: cat.departmentId || "", defaultPriority: cat.defaultPriority }); }
    else { setEditingCat(null); setCatForm({ name: "", code: `SC-${String(categories.length + 1).padStart(3, '0')}`, description: "", departmentId: "", defaultPriority: "medium" }); }
    setCatModalOpen(true);
  };
  const saveCat = async () => {
    setIsSavingCat(true);
    try {
      const res = await apiRequest(editingCat ? `/api/admin/service-categories/${editingCat.id}` : "/api/admin/service-categories", { method: editingCat ? "PUT" : "POST", body: JSON.stringify({ ...catForm, departmentId: catForm.departmentId || null }) });
      if (res.ok) {
        toast({ title: "Success", description: `Category ${editingCat ? "updated" : "created"}.` });
        setCatModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      }
      else { const d = await res.json().catch(() => ({})); toast({ title: "Error", description: d.message || "Failed to save category.", variant: "destructive" }); }
    } catch { toast({ title: "Error", description: "Failed to save category.", variant: "destructive" }); }
    finally { setIsSavingCat(false); }
  };
  const deleteCat = async (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Delete Category?",
      description: "Are you sure you want to remove this service classification? Existing cases using this category will persist but it will no longer be assignable.",
      onConfirm: async () => {
        try {
          const res = await apiRequest(`/api/admin/service-categories/${id}`, { method: "DELETE" });
          if (res.ok) {
            toast({ title: "Success", description: "Category deleted." });
            queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
          }
          else { toast({ title: "Error", description: "Failed to delete category.", variant: "destructive" }); }
        } catch { toast({ title: "Error", description: "Failed to delete category.", variant: "destructive" }); }
      }
    });
  };

  // ── SLA CRUD ──
  const openSlaModal = (sla?: SlaRule) => {
    if (sla) {
      setEditingSla(sla);
      setSlaForm({ name: sla.name, serviceCategoryId: sla.serviceCategoryId || "", priority: sla.priority, metricType: sla.metricType, timeline: sla.timeline, timelineUnit: sla.timelineUnit, responseTimeMinutes: sla.responseTimeMinutes || 0, businessHoursOnly: sla.businessHoursOnly });
    } else {
      setEditingSla(null);
      setSlaForm({ name: "", serviceCategoryId: "", priority: "medium", metricType: "resolution_time", timeline: 1, timelineUnit: "working days", responseTimeMinutes: 0, businessHoursOnly: false });
    }
    setSlaModalOpen(true);
  };
  const saveSla = async () => {
    try {
      const body = { name: slaForm.name, serviceCategoryId: slaForm.serviceCategoryId || null, priority: slaForm.priority, metricType: slaForm.metricType, timeline: slaForm.timeline, timelineUnit: slaForm.timelineUnit, responseTimeMinutes: slaForm.responseTimeMinutes || null, businessHoursOnly: slaForm.businessHoursOnly };
      const res = await apiRequest(editingSla ? `/api/admin/sla-rules/${editingSla.id}` : "/api/admin/sla-rules", { method: editingSla ? "PUT" : "POST", body: JSON.stringify(body) });
      if (res.ok) {
        toast({ title: "Success", description: `SLA rule ${editingSla ? "updated" : "created"}.` });
        setSlaModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["admin", "sla"] });
      }
      else { const d = await res.json().catch(() => ({})); toast({ title: "Error", description: d.message || "Failed to save SLA rule.", variant: "destructive" }); }
    } catch { toast({ title: "Error", description: "Failed to save SLA rule.", variant: "destructive" }); }
  };
  const deleteSla = async (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Remove SLA Rule?",
      description: "Are you sure you want to delete this Service Level Agreement? Performance benchmarks for linked categories will revert to defaults.",
      onConfirm: async () => {
        try {
          const res = await apiRequest(`/api/admin/sla-rules/${id}`, { method: "DELETE" });
          if (res.ok) {
            toast({ title: "Success", description: "SLA rule deleted." });
            queryClient.invalidateQueries({ queryKey: ["admin", "sla"] });
          }
          else { toast({ title: "Error", description: "Failed to delete SLA rule.", variant: "destructive" }); }
        } catch { toast({ title: "Error", description: "Failed to delete SLA rule.", variant: "destructive" }); }
      }
    });
  };

  // ── Escalation Chain CRUD ──
  const openChainModal = (chain?: EscalationChain) => {
    if (chain) {
      setEditingChain(chain);
      setChainForm({
        name: chain.name,
        serviceCategoryId: chain.serviceCategoryId || "",
        slaId: chain.slaId || "",
        priority: chain.priority || "",
        description: chain.description || "",
        assigneeUserId: "", // Editing existing doesn't auto-fill these for "one-go" (or could if needed)
        escalateAfterMinutes: 0
      });
    } else {
      setEditingChain(null);
      setChainForm({
        name: "",
        serviceCategoryId: "",
        slaId: "",
        priority: "",
        description: "",
        assigneeUserId: "",
        escalateAfterMinutes: 30 // Default 30 mins
      });
    }
    setChainModalOpen(true);
  };
  const saveChain = async () => {
    setIsSaving(true);
    try {
      const url = editingChain ? `/api/admin/escalation-chains/${editingChain.id}` : "/api/admin/escalation-chains";
      const method = editingChain ? "PUT" : "POST";
      const res = await apiRequest(url, {
        method,
        body: JSON.stringify({
          name: chainForm.name,
          serviceCategoryId: chainForm.serviceCategoryId || null,
          slaId: chainForm.slaId || null,
          priority: chainForm.priority || null,
          description: chainForm.description || null,
          // Only send these for NEW chains if they are filled, as they are for the initial step
          ...(editingChain ? {} : {
            assigneeUserId: chainForm.assigneeUserId || null,
            escalateAfterMinutes: Number(chainForm.escalateAfterMinutes)
          })
        })
      });
      if (res.ok) {
        toast({ title: "Success", description: `Escalation chain ${editingChain ? "updated" : "created"}.` });
        setChainModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["admin", "escalation"] });
      }
      else { const d = await res.json().catch(() => ({})); toast({ title: "Error", description: d.message || "Failed to save chain.", variant: "destructive" }); }
    } catch { toast({ title: "Error", description: "Failed to save chain.", variant: "destructive" }); }
    finally { setIsSaving(false); }
  };
  const deleteChain = async (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Dissolve Escalation Chain?",
      description: "This will remove the entire multi-tier hierarchy for this protocol. Urgent issues may not reach the right authorities without an active chain.",
      onConfirm: async () => {
        try {
          const res = await apiRequest(`/api/admin/escalation-chains/${id}`, { method: "DELETE" });
          if (res.ok) {
            toast({ title: "Success", description: "Chain deleted." });
            queryClient.invalidateQueries({ queryKey: ["admin", "escalation"] });
          }
          else { toast({ title: "Error", description: "Failed to delete chain.", variant: "destructive" }); }
        } catch { toast({ title: "Error", description: "Failed to delete chain.", variant: "destructive" }); }
      }
    });
  };
  const toggleChainExpand = (chainId: string) => {
    if (expandedChain === chainId) { setExpandedChain(null); return; }
    setExpandedChain(chainId);
  };
  const openStepModal = (chainId: string, step?: EscalationStep) => {
    setStepChainId(chainId);
    if (step) {
      setEditingStep(step);
      setStepForm({
        assigneeDepartmentId: step.assigneeDepartmentId || "",
        targetDepartmentId: step.targetDepartmentId || "",
        assigneeRoleId: step.assigneeRoleId || "",
        assigneeUserId: step.assigneeUserId,
        escalateAfterMinutes: step.escalateAfterMinutes,
        requiresConsent: step.requiresConsent,
        gracePeriodMinutes: step.gracePeriodMinutes,
        notifyChannel: step.notifyChannel,
        description: step.description || ""
      });
    } else {
      setEditingStep(null);
      // Auto-resolve current department from chain
      const chain = chains.find(c => c.id === chainId);
      let autoDeptId = "";
      if (chain) {
        const cat = categories.find(c => c.id === chain.serviceCategoryId);
        if (cat?.departmentId) {
          autoDeptId = cat.departmentId;
        } else if (chain.slaId) {
          const sla = slaRules.find(s => s.id === chain.slaId);
          const slaCat = categories.find(c => c.id === sla?.serviceCategoryId);
          if (slaCat?.departmentId) autoDeptId = slaCat.departmentId;
        }
      }

      setStepForm({
        assigneeDepartmentId: autoDeptId,
        targetDepartmentId: "",
        assigneeRoleId: "",
        assigneeUserId: null,
        escalateAfterMinutes: 30,
        requiresConsent: false,
        gracePeriodMinutes: 0,
        notifyChannel: "email",
        description: ""
      });
    }
    setStepModalOpen(true);
  };
  const saveStep = async () => {
    setIsSaving(true);
    try {
      const url = editingStep
        ? `/api/admin/escalation-steps/${editingStep.id}`
        : `/api/admin/escalation-chains/${stepChainId}/steps`;
      const method = editingStep ? "PUT" : "POST";

      const chain = chains.find(c => c.id === stepChainId);
      const stepOrder = editingStep ? editingStep.stepOrder : (chain?.steps?.length || 0) + 1;

      const res = await apiRequest(url, {
        method,
        body: JSON.stringify({
          ...stepForm,
          stepOrder,
          assigneeDepartmentId: stepForm.assigneeDepartmentId || null,
          targetDepartmentId: stepForm.targetDepartmentId || null,
          assigneeRoleId: stepForm.assigneeRoleId === "unassigned" || !stepForm.assigneeRoleId ? null : stepForm.assigneeRoleId,
          assigneeUserId: stepForm.assigneeUserId || null,
          requiresConsent: stepForm.requiresConsent,
          gracePeriodMinutes: stepForm.gracePeriodMinutes,
          chainId: stepChainId
        })
      });
      if (res.ok) {
        toast({ title: "Success", description: `Step ${editingStep ? "updated" : "added"}.` });
        setStepModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["admin", "escalation"] });
      }
      else {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Error", description: d.error || `Failed to ${editingStep ? "update" : "add"} step.`, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: `Failed to ${editingStep ? "update" : "add"} step.`, variant: "destructive" });
    }
    finally { setIsSaving(false); }
  };
  const deleteStep = async (chainId: string, stepId: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Remove Escalation Tier?",
      description: "Are you sure you want to delete this specific escalation step? This will simplify the chain and reduce operational redundancy.",
      onConfirm: async () => {
        try {
          const res = await apiRequest(`/api/admin/escalation-steps/${stepId}`, { method: "DELETE" });
          if (res.ok) {
            toast({ title: "Success", description: "Step deleted." });
            queryClient.invalidateQueries({ queryKey: ["admin", "escalation"] });
          }
          else { toast({ title: "Error", description: "Failed to delete step.", variant: "destructive" }); }
        } catch { toast({ title: "Error", description: "Failed to delete step.", variant: "destructive" }); }
      }
    });
  };

  // ── Workflow CRUD ──
  const openWfModal = (wf?: WorkflowRule) => {
    if (wf) { setEditingWf(wf); setWfForm({ name: wf.name, description: wf.description || "", triggerEvent: wf.triggerEvent, serviceCategoryId: wf.serviceCategoryId || "", priority: wf.priority || "", conditions: JSON.stringify(wf.conditions, null, 2), actions: JSON.stringify(wf.actions, null, 2) }); }
    else { setEditingWf(null); setWfForm({ name: "", description: "", triggerEvent: "case_created", serviceCategoryId: "", priority: "", conditions: "[]", actions: "[]" }); }
    setWfModalOpen(true);
  };
  const saveWf = async () => {
    let conditions, actions;
    try { conditions = JSON.parse(wfForm.conditions); actions = JSON.parse(wfForm.actions); }
    catch { toast({ title: "Error", description: "Invalid JSON in conditions or actions.", variant: "destructive" }); return; }
    try {
      const body = { name: wfForm.name, description: wfForm.description || null, triggerEvent: wfForm.triggerEvent, serviceCategoryId: wfForm.serviceCategoryId || null, priority: wfForm.priority || null, conditions, actions };
      const res = await apiRequest(editingWf ? `/api/admin/workflow-rules/${editingWf.id}` : "/api/admin/workflow-rules", { method: editingWf ? "PUT" : "POST", body: JSON.stringify(body) });
      if (res.ok) {
        toast({ title: "Success", description: `Workflow rule ${editingWf ? "updated" : "created"}.` });
        setWfModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["admin", "workflows"] });
      }
      else { const d = await res.json().catch(() => ({})); toast({ title: "Error", description: d.message || "Failed to save workflow.", variant: "destructive" }); }
    } catch { toast({ title: "Error", description: "Failed to save workflow.", variant: "destructive" }); }
  };
  const deleteWf = async (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Terminate Automation?",
      description: "Are you sure you want to delete this workflow rule? Event-driven behavioral logic for this protocol will cease immediately.",
      onConfirm: async () => {
        try {
          const res = await apiRequest(`/api/admin/workflow-rules/${id}`, { method: "DELETE" });
          if (res.ok) {
            toast({ title: "Success", description: "Workflow rule deleted." });
            queryClient.invalidateQueries({ queryKey: ["admin", "workflows"] });
          }
          else { toast({ title: "Error", description: "Failed to delete workflow.", variant: "destructive" }); }
        } catch { toast({ title: "Error", description: "Failed to delete workflow.", variant: "destructive" }); }
      }
    });
  };
  const toggleWfActive = async (wf: WorkflowRule) => {
    try {
      const res = await apiRequest(`/api/admin/workflow-rules/${wf.id}`, { method: "PUT", body: JSON.stringify({ ...wf, isActive: !wf.isActive }) });
      if (res.ok) {
        toast({ title: "Success", description: `Workflow ${wf.isActive ? "deactivated" : "activated"}.` });
        queryClient.invalidateQueries({ queryKey: ["admin", "workflows"] });
      }
    } catch { toast({ title: "Error", description: "Failed to toggle workflow.", variant: "destructive" }); }
  };

  // ── Integration CRUD ──
  const openIntegrationModal = (integration?: Integration) => {
    if (integration) { setEditingIntegration(integration); setIntegrationForm({ name: integration.name, portalType: integration.portalType, baseUrl: integration.baseUrl || "", apiKey: integration.apiKey || "", clientId: integration.clientId || "", clientSecret: integration.clientSecret || "", authType: integration.authType, isActive: integration.isActive }); }
    else { setEditingIntegration(null); setIntegrationForm({ name: "", portalType: "erp", baseUrl: "", apiKey: "", clientId: "", clientSecret: "", authType: "api_key", isActive: true }); }
    setIntegrationModalOpen(true);
  };
  const saveIntegration = async () => {
    setIsSaving(true);
    try {
      const res = await apiRequest(editingIntegration ? `/api/admin/integrations/${editingIntegration.id}` : "/api/admin/integrations", { method: editingIntegration ? "PUT" : "POST", body: JSON.stringify(integrationForm) });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Success", description: `Integration ${editingIntegration ? "updated" : "created"}.` });
        setIntegrationModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["admin", "integrations"] });
        
        // Initiate OAuth flow if it's a social media integration (Meta) or Gmail
        if (['facebook', 'instagram', 'meta', 'gmail', 'email'].includes(integrationForm.portalType)) {
            const integrationId = editingIntegration ? editingIntegration.id : data.integration.id;
            try {
                let oauthUrl = "";
                if (integrationForm.portalType === 'gmail' || integrationForm.portalType === 'email') {
                    const oauthRes = await apiRequest(`/api/integrations/google/auth?integrationId=${integrationId}`);
                    if (oauthRes.ok) {
                        const oauthData = await oauthRes.json();
                        oauthUrl = oauthData.url;
                    }
                } else {
                    const oauthRes = await apiRequest(`/api/auth/meta/url?integrationId=${integrationId}`);
                    if (oauthRes.ok) {
                        const oauthData = await oauthRes.json();
                        oauthUrl = oauthData.url;
                    }
                }
                
                if (oauthUrl) {
                    window.location.href = oauthUrl;
                    return; // Stop execution here
                }
            } catch (err) {
                console.error("Failed to initiate OAuth", err);
                toast({ title: "Error", description: "Failed to initiate OAuth flow.", variant: "destructive" });
            }
        }
      }
      else { const d = await res.json().catch(() => ({})); toast({ title: "Error", description: d.message || "Failed to save integration.", variant: "destructive" }); }
    } catch { toast({ title: "Error", description: "Failed to save integration.", variant: "destructive" }); }
    finally { setIsSaving(false); }
  };
  const deleteIntegration = async (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Disconnect Portal?",
      description: "Are you sure you want to delete this integration? Connectivity with the external system will be lost.",
      onConfirm: async () => {
        try {
          const res = await apiRequest(`/api/admin/integrations/${id}`, { method: "DELETE" });
          if (res.ok) {
            toast({ title: "Success", description: "Integration deleted." });
            queryClient.invalidateQueries({ queryKey: ["admin", "integrations"] });
          }
          else { toast({ title: "Error", description: "Failed to delete integration.", variant: "destructive" }); }
        } catch { toast({ title: "Error", description: "Failed to delete integration.", variant: "destructive" }); }
      }
    });
  };

  const handleTestIntegration = async (id: string) => {
    try {
      const res = await apiRequest(`/api/admin/integrations/${id}/test`, { method: "POST" });
      const d = await res.json();
      if (res.ok) toast({ title: d.status === "success" ? "Success" : "Warning", description: d.message || "Connection test completed.", variant: d.status === "success" ? "default" : "destructive" });
      else toast({ title: "Error", description: "Failed to test integration.", variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["admin", "integrations"] });
    } catch { toast({ title: "Error", description: "Connection probe failed.", variant: "destructive" }); }
  };

  const handleSyncIntegration = async (id: string) => {
    try {
      const res = await apiRequest(`/api/admin/integrations/${id}/sync`, { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        toast({ title: "Sync Triggered", description: d.message || "Synchronization initiated in the background." });
        queryClient.invalidateQueries({ queryKey: ["admin", "integrations"] });
      } else {
        toast({ title: "Error", description: d.error || "Failed to initiate sync.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Sync request failed.", variant: "destructive" });
    }
  };

  // Re-subscribes page to webhook events — fixes DEGRADED without re-doing OAuth
  const handleResubscribeIntegration = async (id: string) => {
    try {
      const res = await apiRequest(`/api/admin/integrations/${id}/resubscribe`, { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        toast({
          title: d.success ? "✓ Re-subscribed" : "Partial Success",
          description: d.message || "Pages re-subscribed to Facebook webhook events.",
          variant: d.success ? "default" : "destructive"
        });
        queryClient.invalidateQueries({ queryKey: ["admin", "integrations"] });
      } else {
        toast({ title: "Error", description: d.error || "Re-subscription failed.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Re-subscription request failed.", variant: "destructive" });
    }
  };

  // Backfills missed DMs from Facebook Graph API into the local database
  const handleBackfillMessages = async (id: string) => {
    toast({ title: "Backfill Started", description: "Pulling missed conversations from Facebook. This may take a moment..." });
    try {
      const res = await apiRequest(`/api/admin/integrations/${id}/backfill-messages`, {
        method: "POST",
        body: JSON.stringify({ limit: 50 })
      });
      const d = await res.json();
      if (res.ok) {
        toast({
          title: "Backfill Complete",
          description: d.message || `Imported ${d.totalImported} conversation(s).`,
          variant: "default"
        });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      } else {
        toast({ title: "Backfill Failed", description: d.error || d.message || "Could not backfill messages.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Backfill request failed.", variant: "destructive" });
    }
  };

  const navGroups = [
    {
      title: "Main",
      items: [{ id: "overview", label: "Overview", icon: LayoutDashboard, permission: "admin.view" }],
    },
    {
      title: "Organization",
      items: [
        { id: "departments", label: "Departments", icon: Building2, permission: "admin.departments.manage" },
        { id: "categories", label: "Service Categories", icon: FolderTree, permission: "admin.categories.manage" },
      ],
    },
    {
      title: "Access Control",
      items: [
        { id: "roles", label: "Roles & Permissions", icon: Shield, permission: "admin.roles.manage" },
        { id: "timezones", label: "Timezones Management", icon: Globe, permission: "admin.roles.manage" }
      ],
    },
    {
      title: "Automation",
      items: [
        { id: "sla", label: "SLA Rules", icon: Clock, permission: "admin.sla.manage" },
        { id: "escalation", label: "Escalation Chains", icon: ArrowUpCircle, permission: "admin.escalation.manage" },
        { id: "workflows", label: "Workflow Rules", icon: GitBranch, permission: "admin.workflows.manage" },
      ],
    },
    {
      title: "Connectivity",
      items: [{ id: "integrations", label: "Integrations", icon: Database, permission: "admin.integrations.manage" }],
    },
    {
      title: "Staff & Productivity",
      items: [
        { id: "scheduling", label: "Shift Scheduling", icon: Calendar, permission: "admin.roles.manage" },
        { id: "capacity", label: "Capacity Planning", icon: Activity, permission: "admin.roles.manage" },
        { id: "queues", label: "Queue Management", icon: Users, permission: "admin.roles.manage" },
      ],
    },
    {
      title: "System",
      items: [{ id: "audit", label: "Audit Logs", icon: FileText, permission: "admin.audit.view" }],
    },
  ].map(group => ({
    ...group,
    items: group.items.filter(item =>
      !item.permission || (adminUser?.permissions as string[] || []).includes(item.permission)
    )
  })).filter(group => group.items.length > 0);


  const handleLogout = () => {
    localStorage.removeItem("marketingToken");
    localStorage.removeItem("marketingUser");
    setLocation("/marketing/login");
  };

  return (
    <DashboardLayout
      title="KASNEB CRM"
      subtitle="System Admin"
      navGroups={navGroups}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      user={adminUser as any}
      onLogout={handleLogout}
      tabDescriptions={tabDescriptions}
      sidebarStorageKey="adminSidebarCollapsed"
      breadcrumbs={activeTab === "departments" && (selectedDeptForSubs as any) ? [
        { label: "Departments", icon: Building2, onClick: () => setSelectedDeptForSubs?.(null) },
        { label: (selectedDeptForSubs as any).name }
      ] : undefined}
    >
      <>
        {activeTab === "overview" && (
          <AdminDashboardHeader
            userName={adminUser?.firstName ? `${adminUser.firstName} ${adminUser.lastName || ""}`.trim() : adminUser?.email}
            roleCount={roles.length}
            deptCount={departments.length}
            slaCount={slaRules.length}
            workflowCount={workflows.length}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#004E98]" />
          </div>
        ) : (
          <>
            {activeTab === "overview" && (
              <AdminOverview
                rolesCount={roles.length}
                departmentsCount={departments.length}
                activeSlaCount={slaRules.filter((s) => s.isActive).length}
                activeWorkflowCount={workflows.filter((w) => w.isActive).length}
                onSeedDefaults={handleSeedDefaults}
                categoriesCount={categories.length}
                integrationsCount={integrations.length}
                overviewStats={overviewStats}
                adminName={adminUser?.firstName ? `${adminUser.firstName} ${adminUser.lastName || ""}`.trim() : adminUser?.email || "Administrator"}
              />
            )}
            {activeTab === "roles" && (
              <RolesPermissions
                roles={roles}
                permissions={permissions}
                rolePermissions={rolePermissions}
                selectedPermRole={selectedPermRole}
                onSelectPermRole={setSelectedPermRole}
                roleModalOpen={roleModalOpen}
                editingRole={editingRole}
                roleForm={roleForm}
                onRoleFormChange={(f) => setRoleForm({ ...roleForm, ...f })}
                onOpenRoleModal={openRoleModal}
                onSaveRole={saveRole}
                onDeleteRole={deleteRole}
                onCloseRoleModal={() => setRoleModalOpen(false)}
                onTogglePermission={togglePermission}
                users={systemUsers}
                userRoleAssignments={userRoleAssignments}
                departments={departments}
                onAddUser={handleAddUser}
                onEditUser={handleEditUser}
                onDeleteUser={handleDeleteUser}
                onBulkPermissions={handleBulkPermissions}
              />
            )}
            {activeTab === "timezones" && (
              <Timezones />
            )}
            {activeTab === "departments" && (
              <Departments
                departments={departments}
                getDeptName={getDeptName}
                selectedParent={selectedDeptForSubs}
                onViewSubs={setSelectedDeptForSubs}
                deptModalOpen={deptModalOpen}
                editingDept={editingDept}
                deptForm={deptForm}
                onDeptFormChange={setDeptForm}
                onOpenDeptModal={openDeptModal}
                onSaveDept={saveDept}
                onDeleteDept={deleteDept}
                onCloseDeptModal={() => setDeptModalOpen(false)}
                isSaving={isSavingDept}
              />
            )}
            {activeTab === "categories" && (
              <ServiceCategories
                categories={categories}
                departments={departments}
                getDeptName={getDeptName}
                priorityColors={priorityColors}
                catModalOpen={catModalOpen}
                editingCat={editingCat}
                catForm={catForm}
                onCatFormChange={setCatForm}
                onOpenCatModal={openCatModal}
                onSaveCat={saveCat}
                onDeleteCat={deleteCat}
                onCloseCatModal={() => setCatModalOpen(false)}
                isSaving={isSavingCat}
              />
            )}
            {activeTab === "sla" && (
              <SlaRules
                slaRules={slaRules}
                categories={categories}
                getCatName={getCatName}
                priorityColors={priorityColors}
                formatMinutes={formatMinutes}
                slaModalOpen={slaModalOpen}
                editingSla={editingSla}
                slaForm={slaForm}
                onSlaFormChange={setSlaForm}
                onOpenSlaModal={openSlaModal}
                onSaveSla={saveSla}
                onDeleteSla={deleteSla}
                onCloseSlaModal={() => setSlaModalOpen(false)}
              />
            )}
            {activeTab === "escalation" && (
              <EscalationChains
                chains={chains}
                roles={roles}
                categories={categories}
                expandedChain={expandedChain}
                getCatName={getCatName}
                getRoleName={getRoleName}
                getSlaName={getSlaName}
                formatMinutes={formatMinutes}
                onToggleChainExpand={toggleChainExpand}
                chainModalOpen={chainModalOpen}
                editingChain={editingChain}
                chainForm={chainForm}
                onChainFormChange={(f) => setChainForm({ ...chainForm, ...f })}
                onOpenChainModal={openChainModal}
                onSaveChain={saveChain}
                onDeleteChain={deleteChain}
                onCloseChainModal={() => setChainModalOpen(false)}
                stepModalOpen={stepModalOpen}
                stepForm={stepForm}
                onStepFormChange={(f) => setStepForm({ ...stepForm, ...f })}
                onOpenStepModal={openStepModal}
                onSaveStep={saveStep}
                onDeleteStep={deleteStep}
                onCloseStepModal={() => setStepModalOpen(false)}
                slaRules={slaRules}
                users={systemUsers}
                departments={departments}
                stepChainId={stepChainId}
                isSaving={isSaving}
                editingStep={editingStep}
                stepData={stepData}
                stepsLoading={stepsLoading}
              />
            )}
            {activeTab === "workflows" && (
              <WorkflowRules
                workflows={workflows}
                categories={categories}
                slaRules={slaRules}
                escalationChains={chains}
                getCatName={getCatName}
                priorityColors={priorityColors}
                triggerEvents={TRIGGER_EVENTS}
                roles={roles}
                users={systemUsers}
                onToggleWfActive={toggleWfActive}
                wfModalOpen={wfModalOpen}
                editingWf={editingWf}
                wfForm={wfForm}
                onWfFormChange={setWfForm}
                onOpenWfModal={openWfModal}
                onSaveWf={saveWf}
                onDeleteWf={deleteWf}
                onCloseWfModal={() => setWfModalOpen(false)}
                isSaving={isSaving}
              />
            )}
            {activeTab === "integrations" && (
              <Integrations
                integrations={integrations}
                portalTypes={PORTAL_TYPES}
                onTestIntegration={handleTestIntegration}
                onSyncIntegration={handleSyncIntegration}
                onResubscribeIntegration={handleResubscribeIntegration}
                onBackfillMessages={handleBackfillMessages}
                integrationModalOpen={integrationModalOpen}
                editingIntegration={editingIntegration}
                integrationForm={integrationForm}
                onIntegrationFormChange={setIntegrationForm}
                onOpenIntegrationModal={openIntegrationModal}
                onSaveIntegration={saveIntegration}
                onDeleteIntegration={deleteIntegration}
                onCloseIntegrationModal={() => setIntegrationModalOpen(false)}
                isSavingIntegration={isSaving}
              />
            )}
            {activeTab === "scheduling" && <ShiftScheduling />}
            {activeTab === "capacity" && <CapacityPlanning />}
            {activeTab === "queues" && <QueueManagement />}
            {activeTab === "audit" && (
              <AuditLogs
                auditLogs={auditLogs}
                auditPage={auditPage}
                auditTotalPages={auditTotalPages}
                auditModule={auditModule}
                auditAction={auditAction}
                onModuleChange={(v) => { setAuditModule(v === "all" ? "" : v); setAuditPage(1); }}
                onActionChange={(v) => { setAuditAction(v === "all" ? "" : v); setAuditPage(1); }}
                onClearFilters={() => { setAuditModule(""); setAuditAction(""); setAuditPage(1); }}
                onPageChange={(delta) => setAuditPage((p) => p + delta)}
              />
            )}
          </>
        )}
        {deleteConfirm && (
          <Dialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && setDeleteConfirm(prev => prev ? { ...prev, isOpen: false } : null)}>
            <DialogContent className="sm:max-w-[420px] p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden">
              <div className="p-6 text-center">
                <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-gray-900 text-center">{deleteConfirm.title}</DialogTitle>
                  <DialogDescription className="text-gray-500 text-sm mt-2 text-center">
                    {deleteConfirm.description}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <DialogFooter className="bg-gray-50/50 p-6 flex gap-3 sm:justify-center border-t border-gray-100">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(prev => prev ? { ...prev, isOpen: false } : null)}
                  className="flex-1 h-11 border-gray-200 text-gray-600 font-bold hover:bg-white hover:border-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  disabled={isSaving}
                  onClick={async () => {
                    if (deleteConfirm?.onConfirm) {
                      setIsSaving(true);
                      try {
                        await deleteConfirm.onConfirm();
                        setDeleteConfirm(null);
                      } finally {
                        setIsSaving(false);
                      }
                    }
                  }}
                  className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-100 transition-all active:scale-95 disabled:opacity-70"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Permanently"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </>
    </DashboardLayout>
  );
}
