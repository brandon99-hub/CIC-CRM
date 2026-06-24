import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, TrendingUp, Target, Plus, FileDown, LogOut, BarChart3, Bell, Menu, X,
  PieChart, Home, UserCheck, XCircle, Megaphone, MessageSquare, ClipboardList, LayoutDashboard,
  Binoculars, Grid3X3, List, ArrowLeft, FolderOpen, Loader2, FileText, Calendar, FlaskConical
} from "lucide-react";
import { CICPipelineDashboard } from "@/components/marketing/cic-pipeline-dashboard";
import { SimulationTab } from "@/components/marketing/simulation-tab";
import { MarketingLeadForm } from "@/components/marketing/lead-form";
import { MarketingProspectsForm } from "@/components/marketing/prospects-form";
import { MarketingSalesWonForm } from "@/components/marketing/sales-won-form";
import { SectorsManagement, Sector } from "@/components/marketing/sectors-management";
import { UserManagement } from "@/components/marketing/user-management";
import { MarketingActivitiesTable } from "@/components/marketing/activities-table";
import { cn } from "@/lib/utils";
import MarketingPasswordChangeModal from "@/components/marketing/marketing-password-change-modal";
import { MarketingOverview } from "@/components/marketing/marketing-overview";
import { MarketingDocumentsTable } from "@/components/marketing/documents-table";
import { CampaignsTab } from "@/components/marketing/campaigns-tab";
import { SurveysTab } from "@/components/marketing/surveys-tab";
import { CampaignROIDashboard } from "@/components/marketing/campaign-roi-dashboard";
import { DashboardLayout } from "@/components/shared/dashboard-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NavGroup } from "@/components/shared/dashboard-sidebar";
import { StatsCarousel } from "@/components/shared/stats-carousel";
import { useScreenSize } from "@/hooks/use-mobile";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { MarketingPageHeader } from "@/components/marketing/marketing-page-header";
import { CAMPAIGN_TEMPLATES } from "@/lib/campaign-templates";
import { ForensicIssuesModal } from "@/components/marketing/forensic-issues-modal";

// ─── Types ───────────────────────────────────────────────────────────────────

import { DashboardStats, AdminDashboardStats, AnalyticsData, MarketingUser } from "@/types/marketing-types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const nairobiTime = new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi", hour: "numeric", hour12: false });
  const hour = parseInt(nairobiTime, 10);
  const key = "crm_mkt_visited";
  const hasVisited = sessionStorage.getItem(key);
  if (!hasVisited) { sessionStorage.setItem(key, "true"); return "Welcome"; }
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Welcome back";
}

function unwrapCampaignContent(html: string): string {
  if (!html) return "";
  if (!html.includes("<!DOCTYPE") && !html.includes("<html") && !html.includes("<body")) {
    return html;
  }
  
  const rules = [
    /<div style="font-weight: 500;">([\s\S]*?)<\/div>/i,
    /<div class="body-text">([\s\S]*?)<\/div>/i,
    /<div style="font-size: 16px; line-height: 1.8; margin-bottom: 24px;">([\s\S]*?)<\/div>/i,
    /<div style="color: #555; font-size: 16px; line-height: 1.8;">([\s\S]*?)<\/div>/i
  ];

  for (const regex of rules) {
    const match = html.match(regex);
    if (match && match[1]) {
      return match[1].replace(/<br\s*\/?>/gi, "\n").trim();
    }
  }

  // Fallback cleanup
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MarketingDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const token = () => localStorage.getItem("marketingToken");

  const [user, setUser] = useState<MarketingUser | null>(null);
  const [activeSection, setActiveSection] = useState<string>(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      return searchParams.get("tab") || "overview";
    } catch {
      return "overview";
    }
  });
  const [prospectSubTab, setProspectSubTab] = useState<"B2C" | "B2B">("B2C");
  const [wonSubTab, setWonSubTab] = useState<"converted" | "sales-won">("converted");
  const [selectedMarketer, setSelectedMarketer] = useState("");
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [showProspectModal, setShowProspectModal] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showSalesWonModal, setShowSalesWonModal] = useState(false);
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [pipelineMode, setPipelineMode] = useState<"B2C" | "B2B">("B2C");
  const [selectedCycle, setSelectedCycle] = useState<string>("August");
  const [selectedCycleYear, setSelectedCycleYear] = useState<string>(new Date().getFullYear().toString());
  const [sectorSearch, setSectorSearch] = useState("");
  const [sectorViewMode, setSectorViewMode] = useState<"grid" | "table">("grid");
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  const [forensicModalOpen, setForensicModalOpen] = useState(false);
  const [selectedEventForForensic, setSelectedEventForForensic] = useState<{id: string, name: string} | null>(null);

  // Campaigns state
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState<{
    name: string;
    type: string;
    channel: string;
    subject: string;
    content: string;
    status: string;
    scheduledAt: string;
    targetAudience: { segment: string; stakeholderType: string; eventStartTime?: string; eventEndTime?: string };
    budget: string;
    actualCost: string;
    requestedAmount: string;
    venue: string;
    eventDate: string;
    expectedCapacity: string;
  }>({
    name: "",
    type: "promotional",
    channel: "email",
    subject: "",
    content: "",
    status: "draft",
    scheduledAt: "",
    targetAudience: { segment: "all", stakeholderType: "all", eventStartTime: "", eventEndTime: "" },
    budget: "",
    actualCost: "",
    requestedAmount: "",
    venue: "",
    eventDate: "",
    expectedCapacity: "",
  });
  const [editingCampaign, setEditingCampaign] = useState<any>(null);

  // Surveys state
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [surveyForm, setSurveyForm] = useState({ 
    name: "", 
    description: "", 
    questions: "[]",
    googleFormLink: "",
    targetAudience: { segment: "all", stakeholderType: "all" }
  });
  const [editingSurvey, setEditingSurvey] = useState<any>(null);

  // Pagination & Search states
  const [campaignsSearch, setCampaignsSearch] = useState("");
  const [campaignsPage, setCampaignsPage] = useState(1);
  const [selectedROICampaignId, setSelectedROICampaignId] = useState<string | null>(null);
  const [surveysSearch, setSurveysSearch] = useState("");
  const [surveysPage, setSurveysPage] = useState(1);


  const { isMobile } = useScreenSize();

  // ── Auth & init ──────────────────────────────────────────────────────────

  useEffect(() => {
    const userData = localStorage.getItem("marketingUser");
    if (!userData) { setLocation("/marketing/login"); return; }
    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      if (parsedUser.bdType === "b2c") setPipelineMode("B2C");
      else if (parsedUser.bdType === "b2b") setPipelineMode("B2B");
      if (parsedUser.mustChangePassword) setShowPasswordChangeModal(true);
    } catch {
      setLocation("/marketing/login");
    }
  }, []);

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const tab = searchParams.get("tab");
      if (tab && tab !== activeSection) {
        setActiveSection(tab);
      }
    } catch (e) {
      console.error(e);
    }
  }, [window.location.search]);

  // ── Queries ────────────────────────────────────────────────────────────

  const isAdmin = !!(user?.permissions?.includes("marketing.view_all") || user?.permissions?.includes("admin.view"));
  const canViewAnalytics = isAdmin || !!(user?.permissions?.includes("marketing.view_analytics"));

  const { toast } = useToast();

  const { data: adminStats, isLoading: adminStatsLoading, refetch: refetchAdminStats } = useQuery<AdminDashboardStats>({
    queryKey: ["marketing", "admin", "stats", selectedYear, pipelineMode],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (selectedYear) params.append("year", selectedYear);
        params.append("pipeline", pipelineMode);
        const res = await fetch(`/api/marketing/admin/dashboard/stats?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
        if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
        const d = await res.json();
        return {
          year: d.year || new Date().getFullYear(),
          totalProspectsCount: d.totalProspectsCount || 0,
          totalLeadsCount: d.totalLeadsCount || 0,
          totalExpectedOrdersCount: d.totalExpectedOrdersCount || 0,
          totalSalesWonCount: d.totalSalesWonCount || 0,
          totalRevenue: d.totalRevenue || 0,
          totalExpectedOrdersRevenue: d.totalExpectedOrdersRevenue || 0,
          bdStats: d.bdStats || [],
          b2cStats: d.b2cStats || null,
        };
      } catch (err) {
        console.error("Admin stats fetch error:", err);
        return { year: new Date().getFullYear(), totalProspectsCount: 0, totalLeadsCount: 0, totalExpectedOrdersCount: 0, totalSalesWonCount: 0, totalRevenue: 0, totalExpectedOrdersRevenue: 0, bdStats: [] };
      }
    },
    enabled: canViewAnalytics && activeSection === "overview",
    staleTime: 300000,
  });

  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery<AnalyticsData>({
    queryKey: ["marketing", "admin", "analytics", selectedYear, selectedMonth, pipelineMode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedYear) params.append("year", selectedYear);
      if (selectedMonth && selectedMonth !== "all") params.append("month", selectedMonth);
      params.append("pipeline", pipelineMode);
      const res = await fetch(`/api/marketing/admin/analytics?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) return { year: new Date().getFullYear(), conversionRates: [], quarterlyStats: [], bdStats: [], topPerformers: [], salesWonPerMarketer: [], expectedOrdersShare: [], monthlyTrends: [] };
      return res.json();
    },
    enabled: canViewAnalytics && activeSection === "overview",
    staleTime: 300000,
  });

  const { data: kanbanData, isLoading: kanbanLoading, refetch: refetchKanban } = useQuery({
    queryKey: ["marketing", "kanban", selectedYear, pipelineMode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedYear) params.append("year", selectedYear);
      if (pipelineMode) params.append("pipeline", pipelineMode);
      const res = await fetch(`/api/marketing/kanban?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) return { lead: [], prospect: [], expected_order: [], sales_won: [] };
      return res.json();
    },
    enabled: activeSection === "overview",
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, newStatus, currentStatus }: { id: string, newStatus: string, currentStatus: string }) => {
      const res = await fetch("/api/marketing/kanban/update-stage", {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`
        },
        body: JSON.stringify({ id, newStatus, currentStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update stage");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Stage Updated", description: "The item has been successfully moved to the new stage." });
      refetchKanban();
      refetchAdminStats();
      refetchAnalytics();
    },
    onError: (error: any) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    }
  });

  const handleKanbanStatusChange = (id: string, newStatus: string, currentStatus: string) => {
    updateStageMutation.mutate({ id, newStatus, currentStatus });
  };

  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ["marketing", "forecast", selectedYear, pipelineMode, selectedCycle, selectedCycleYear],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (pipelineMode === "B2B") {
        if (selectedYear) params.append("year", selectedYear);
      } else {
        if (selectedCycleYear) params.append("year", selectedCycleYear);
        if (selectedCycle) params.append("cycle", selectedCycle);
      }
      if (pipelineMode) params.append("pipeline", pipelineMode);
      const res = await fetch(`/api/marketing/forecast?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) return {
        forecast: [],
        historicalData: { lead_entered: 0, opportunity_entered: 0, engagement_entered: 0, expected_order_entered: 0, sales_won: 0 },
        quarterlyTarget: 500000,
        expectedOrderDeals: [],
        studentData: { lead: 0, registration: 0, booking: 0, converted: 0 },
        studentHistoricalData: { lead_entered: 0, converted: 0 },
        studentReturningRebookers: 0,
        studentRebookingRate: 0,
        dormantStudentCount: 0
      };
      return res.json();
    },
    enabled: activeSection === "overview",
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["marketing", "user", "stats", selectedYear, pipelineMode],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (selectedYear) params.append("year", selectedYear);
        params.append("pipeline", pipelineMode);
        const res = await fetch(`/api/marketing/dashboard/stats?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
        if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
        const d = await res.json();
        return {
          year: d.year || new Date().getFullYear(),
          prospectsCount: d.prospectsCount || 0,
          leadsCount: d.leadsCount || 0,
          expectedOrdersCount: d.expectedOrdersCount || 0,
          salesWonCount: d.salesWonCount || 0,
          totalRevenue: d.totalRevenue || 0,
          target: d.target || 0,
          revisedTarget: d.revisedTarget || 0,
          expectedTarget: d.expectedTarget || 0,
          targetAchievement: d.targetAchievement || 0,
          annualSummary: d.annualSummary || null,
          b2cStats: d.b2cStats || null,
        };
      } catch (err) {
        console.error("User stats fetch error:", err);
        return { year: new Date().getFullYear(), prospectsCount: 0, leadsCount: 0, expectedOrdersCount: 0, salesWonCount: 0, totalRevenue: 0, target: 0, revisedTarget: 0, expectedTarget: 0, targetAchievement: 0, annualSummary: null };
      }
    },
    enabled: !(user?.permissions?.includes("marketing.view_all") || user?.permissions?.includes("admin.view")) && activeSection === "overview",
    staleTime: 300000,
  });

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery<any>({
    queryKey: ["marketing", "campaigns", campaignsSearch, campaignsPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (campaignsSearch) params.append("search", campaignsSearch);
      params.append("page", campaignsPage.toString());
      params.append("limit", "10");
      const res = await fetch(`/api/campaigns?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
      return res.json();
    },
    enabled: activeSection === "campaigns",
    staleTime: 300000,
  });

  const campaignsList = campaignsData?.campaigns || [];
  const campaignsPagination = campaignsData?.pagination;

  const { data: surveysData, isLoading: surveysLoading } = useQuery<any>({
    queryKey: ["marketing", "surveys", surveysSearch, surveysPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (surveysSearch) params.append("search", surveysSearch);
      params.append("page", surveysPage.toString());
      params.append("limit", "10");
      const res = await fetch(`/api/surveys?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
      return res.json();
    },
    enabled: activeSection === "surveys",
    staleTime: 300000,
  });

  const surveysList = surveysData?.surveys || [];
  const surveysPagination = surveysData?.pagination;

  const loading = (activeSection === "overview" && (adminStatsLoading || analyticsLoading || statsLoading)) ||
    (activeSection === "campaigns" && campaignsLoading) ||
    (activeSection === "surveys" && surveysLoading);

  // ── API helpers ──────────────────────────────────────────────────────────

  // ── Mutations ──────────────────────────────────────────────────────────

  const saveCampaignMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string, data: any }) => {
      const url = id ? `/api/campaigns/${id}` : "/api/campaigns";
      const method = id ? "PUT" : "POST";
      
      let finalContent = data.content;
      if (data.channel === "email") {
        const templateFn = CAMPAIGN_TEMPLATES[data.type as keyof typeof CAMPAIGN_TEMPLATES];
        if (templateFn) {
          // Use current ID or placeholder for new campaigns
          const trackingId = id || "{{ID}}";
          const baseUrl = window.location.origin;
          const trackingUrl = `${baseUrl}/api/track/${trackingId}`;
          finalContent = templateFn(data.subject, data.content, trackingUrl);
        }
      }

      const res = await fetch(url, { 
        method, 
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, 
        body: JSON.stringify({ 
          ...data, 
          content: finalContent,
          // Automatically set CTA URL to the landing page if not provided
          ctaUrl: data.ctaUrl || `${window.location.origin}/marketing/campaign-landing/${id || '{{ID}}'}`
        }) 
      });
      if (!res.ok) throw new Error("Failed to save campaign");
      return res.json();
    },
    onSuccess: () => {
      setCampaignModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["marketing", "campaigns"] });
    }
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/campaigns/${id}`, { 
        method: "DELETE", 
        headers: { Authorization: `Bearer ${token()}` } 
      });
      if (!res.ok) throw new Error("Failed to delete campaign");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing", "campaigns"] });
    }
  });

  const saveSurveyMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string, data: any }) => {
      let questions: unknown[];
      try { questions = JSON.parse(data.questions); } catch { questions = []; }
      const url = id ? `/api/surveys/${id}` : "/api/surveys";
      const method = id ? "PUT" : "POST";
      const res = await fetch(url, { 
        method, 
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, 
        body: JSON.stringify({ ...data, questions }) 
      });
      if (!res.ok) throw new Error("Failed to save survey");
      return res.json();
    },
    onSuccess: () => {
      setSurveyModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["marketing", "surveys"] });
    }
  });

  const handleExport = async (type: string) => {
    try {
      const res = await fetch(`/api/marketing/export?type=${type}&format=excel`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${type}_export.xlsx`;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(url); document.body.removeChild(a);
      }
    } catch (e) { console.error("Export failed:", e); }
  };

  // ── Navigation ───────────────────────────────────────────────────────────

  const navGroups: NavGroup[] = [
    {
      title: "Core",
      items: [{ id: "overview", label: "Overview", icon: Home }],
    },
    ...(user?.permissions?.includes("marketing.view_assigned") || user?.permissions?.includes("marketing.view_all") || user?.permissions?.includes("admin.view") ? [
      {
        title: "Pipeline",
        items: [
          { id: "pipeline", label: "Pipeline", icon: LayoutDashboard },
        ],
      }
    ] : []),
    {
      title: "Engagement",
      items: [
        { id: "activities", label: "My Activities", icon: Calendar },
        ...(user?.permissions?.includes("marketing.view_campaigns") || user?.permissions?.includes("marketing.view_all") || user?.permissions?.includes("admin.view") ? [
          { id: "campaigns", label: "Campaigns", icon: Megaphone }
        ] : []),
        ...(user?.permissions?.includes("marketing.view_surveys") || user?.permissions?.includes("marketing.view_all") || user?.permissions?.includes("admin.view") ? [
          { id: "surveys", label: "Feedback & Surveys", icon: ClipboardList }
        ] : []),
      ],
    },
    ...((user?.permissions?.includes("marketing.view_all") || user?.permissions?.includes("admin.view")) ? [
      {
        title: "Management",
        items: [
          { id: "documents", label: "Documents", icon: FileText },
          { id: "sectors", label: "Sectors", icon: PieChart },
          { id: "users", label: "Users", icon: UserCheck },
        ],
      },
    ] : []),
    {
      title: "Testing",
      items: [
        { id: "simulate", label: "Simulate Scenarios", icon: FlaskConical },
      ],
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem("marketingToken");
    localStorage.removeItem("marketingUser");
    setLocation("/marketing/login");
  };

  // ── Guards ───────────────────────────────────────────────────────────────

  if (!user) return null;

  const sectionDescriptions: Record<string, string> = {
    overview: "Your marketing performance overview with analytics",
    prospects: "Track potential opportunities and initial client interest",
    leads: "Manage qualified leads and interested clients",
    "expected-orders": "Monitor expected orders and revenue",
    "sales-won": "Track successful sales and contracts",
    "lost-projects": "Review projects that didn't proceed and analyze reasons for loss",
    campaigns: "Create and manage marketing campaigns across channels",
    surveys: "Collect feedback and run satisfaction surveys",
    sectors: "Manage business sectors and their projects",
    users: "Manage marketing team members",
  };

  return (
    <DashboardLayout
      title="CIC CRM"
      subtitle="MARKETING DASHBOARD"
      navGroups={navGroups}
      activeTab={activeSection}
      setActiveTab={(tab) => {
        setActiveSection(tab);
        if (tab !== 'sectors') setSelectedSector(null);
        try {
          const newUrl = `${window.location.pathname}?tab=${tab}`;
          window.history.pushState({ path: newUrl }, "", newUrl);
        } catch (e) {
          console.error(e);
        }
      }}
      user={user as any}
      onLogout={handleLogout}
      loading={false}
      tabDescriptions={sectionDescriptions}
      sidebarStorageKey="marketingSidebarCollapsed"
      breadcrumbs={activeSection === 'sectors' ? (
        selectedSector 
          ? [
              { label: "Sectors", icon: PieChart, onClick: () => setSelectedSector(null) },
              { label: selectedSector.name.toUpperCase() }
            ]
          : [{ label: "Sectors", icon: PieChart }]
      ) : undefined}
    >
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-50 flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#004E98]" />
              <p className="text-xs font-medium text-gray-500 animate-pulse uppercase tracking-widest">Loading {activeSection}...</p>
            </div>
          </div>
        )}


        {activeSection === "overview" && user && (
          <MarketingOverview
            user={user as MarketingUser}
            stats={stats || null}
            adminStats={adminStats || null}
            analytics={analytics || null}
            analyticsLoading={analyticsLoading}
            viewMode={viewMode}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onViewModeChange={setViewMode}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
            onRetryAnalytics={() => queryClient.invalidateQueries({ queryKey: ["marketing"] })}
            onAddProspect={() => setShowProspectModal(true)}
            onExport={handleExport}
            kanbanData={kanbanData || null}
            kanbanLoading={kanbanLoading}
            onKanbanStatusChange={handleKanbanStatusChange}
            forecastData={forecastData || null}
            forecastLoading={forecastLoading}
            pipelineMode={pipelineMode}
            setPipelineMode={setPipelineMode}
            selectedCycle={selectedCycle}
            setSelectedCycle={setSelectedCycle}
            selectedCycleYear={selectedCycleYear}
            setSelectedCycleYear={setSelectedCycleYear}
          />
        )}

        {activeSection === "pipeline" && (
          <CICPipelineDashboard 
            pipelineMode={pipelineMode}
            setPipelineMode={setPipelineMode}
            user={user as MarketingUser}
            onAddLead={() => setShowLeadModal(true)}
          />
        )}

        {activeSection === "simulate" && (
          <SimulationTab />
        )}

        {activeSection === "documents" && (
          <MarketingDocumentsTable 
            currentUser={user}
            showMarketerInfo={!!(user.permissions?.includes("marketing.view_all") || user.permissions?.includes("admin.view"))}
            selectedMarketer={selectedMarketer}
            onMarketerChange={setSelectedMarketer}
          />
        )}

        {activeSection === "activities" && (
          <MarketingActivitiesTable 
            currentUser={user}
            showMarketerInfo={isAdmin}
          />
        )}

        {activeSection === "campaigns" && (
          <div className="space-y-6">
            <MarketingPageHeader
              title="Campaign Centers"
              subtitle="Create and manage marketing campaigns across multiple channels."
              icon={Megaphone}
              searchValue={campaignsSearch}
              onSearchChange={(v) => { setCampaignsSearch(v); setCampaignsPage(1); }}
              actionButton={
                user?.permissions?.includes("marketing.create_campaigns") || user?.permissions?.includes("admin.view")
                  ? {
                      label: "New Campaign",
                      onClick: () => {
                        setEditingCampaign(null);
                        setCampaignForm({
                          name: "",
                          type: "promotional",
                          channel: "email",
                          subject: "",
                          content: "",
                          status: "draft",
                          scheduledAt: "",
                          targetAudience: { segment: "all", stakeholderType: "all", eventStartTime: "", eventEndTime: "" },
                          budget: "",
                          actualCost: "",
                          requestedAmount: "",
                          venue: "",
                          eventDate: "",
                          expectedCapacity: ""
                        });
                        setCampaignModalOpen(true);
                      },
                      icon: Plus
                    }
                  : undefined
              }
            />
            {(() => {
              const digitalCampaigns = (campaignsList || []).filter((c: any) => c.type !== "event");
              const eventCampaigns = (campaignsList || []).filter((c: any) => c.type === "event");
              return (
                <Tabs defaultValue="campaigns" className="w-full">
                  <div className="flex items-center justify-between mb-4 border-b border-gray-100 bg-transparent px-6 pt-2">
                    <TabsList className="bg-transparent h-12 gap-8 border-none p-0 flex">
                      <TabsTrigger 
                        value="campaigns" 
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"
                      >
                        <Megaphone className="h-4 w-4" />
                        Digital Campaigns
                      </TabsTrigger>
                      <TabsTrigger 
                        value="events" 
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"
                      >
                        <Calendar className="h-4 w-4" />
                        Events
                      </TabsTrigger>
                      {user?.permissions?.includes("marketing.view_roi") && (
                        <TabsTrigger 
                          value="roi" 
                          className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"
                        >
                          <BarChart3 className="h-4 w-4" />
                          ROI Analysis
                        </TabsTrigger>
                      )}
                    </TabsList>
                  </div>

                  <TabsContent value="campaigns" className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CampaignsTab
                      campaigns={digitalCampaigns}
                      onOpenModal={(campaign: any) => {
                        setEditingCampaign(campaign || null);
                        setCampaignForm(campaign
                          ? {
                            name: campaign.name,
                            type: campaign.type,
                            channel: campaign.channel,
                            subject: campaign.subject || "",
                            content: unwrapCampaignContent(campaign.content || ""),
                            status: campaign.status,
                            scheduledAt: campaign.scheduledAt || "",
                            targetAudience: campaign.targetAudience || { segment: "all", stakeholderType: "all", eventStartTime: "", eventEndTime: "" },
                            budget: campaign.budget?.toString() || "",
                            actualCost: campaign.actualCost?.toString() || "",
                            requestedAmount: campaign.requestedAmount?.toString() || "",
                            venue: campaign.venue || "",
                            eventDate: campaign.eventDate || "",
                            expectedCapacity: campaign.expectedCapacity?.toString() || ""
                          }
                          : {
                            name: "",
                            type: "promotional",
                            channel: "email",
                            subject: "",
                            content: "",
                            status: "draft",
                            scheduledAt: "",
                            targetAudience: { segment: "all", stakeholderType: "all", eventStartTime: "", eventEndTime: "" },
                            budget: "",
                            actualCost: "",
                            requestedAmount: "",
                            venue: "",
                            eventDate: "",
                            expectedCapacity: ""
                          }
                        );
                        setCampaignModalOpen(true);
                      }}
                      onDelete={(id) => deleteCampaignMutation.mutate(id)}
                      onViewIssues={(id) => {
                        setLocation(`/marketing/events/${id}/forensics`);
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="events" className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CampaignsTab
                      campaigns={eventCampaigns}
                      isEventView={true}
                      onOpenModal={(campaign: any) => {
                        setEditingCampaign(campaign || null);
                        setCampaignForm(campaign
                          ? {
                            name: campaign.name,
                            type: campaign.type,
                            channel: campaign.channel,
                            subject: campaign.subject || "",
                            content: unwrapCampaignContent(campaign.content || ""),
                            status: campaign.status,
                            scheduledAt: campaign.scheduledAt || "",
                            targetAudience: campaign.targetAudience || { segment: "all", stakeholderType: "all", eventStartTime: "", eventEndTime: "" },
                            budget: campaign.budget?.toString() || "",
                            actualCost: campaign.actualCost?.toString() || "",
                            requestedAmount: campaign.requestedAmount?.toString() || "",
                            venue: campaign.venue || "",
                            eventDate: campaign.eventDate || "",
                            expectedCapacity: campaign.expectedCapacity?.toString() || ""
                          }
                          : {
                            name: "",
                            type: "event",
                            channel: "email",
                            subject: "",
                            content: "",
                            status: "draft",
                            scheduledAt: "",
                            targetAudience: { segment: "all", stakeholderType: "all", eventStartTime: "", eventEndTime: "" },
                            budget: "",
                            actualCost: "",
                            requestedAmount: "",
                            venue: "",
                            eventDate: "",
                            expectedCapacity: ""
                          }
                        );
                        setCampaignModalOpen(true);
                      }}
                      onDelete={(id) => deleteCampaignMutation.mutate(id)}
                      onViewIssues={(id) => {
                        setLocation(`/marketing/events/${id}/forensics`);
                      }}
                    />
                  </TabsContent>

                  {user?.permissions?.includes("marketing.view_roi") && (
                    <TabsContent value="roi" className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="space-y-6">
                        <Card className="rounded-[2rem] border-gray-100 shadow-sm overflow-hidden">
                          <CardHeader className="p-6 border-b bg-gray-50/30">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div>
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-[#004E98]">ROI Deep Dive</CardTitle>
                                <CardDescription>Select a campaign to analyze its financial performance and conversion metrics.</CardDescription>
                              </div>
                              <div className="w-full md:w-[300px]">
                                <Select 
                                  value={selectedROICampaignId || ""} 
                                  onValueChange={setSelectedROICampaignId}
                                >
                                  <SelectTrigger className="h-11 rounded-xl border-gray-200">
                                    <SelectValue placeholder="Select Campaign..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl border-gray-100 shadow-2xl">
                                    {campaignsList.map((c: any) => (
                                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-8">
                            {selectedROICampaignId ? (
                              <CampaignROIDashboard campaignId={selectedROICampaignId} />
                            ) : (
                              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                <div className="bg-blue-50 p-6 rounded-full">
                                    <Megaphone className="h-12 w-12 text-[#004E98] opacity-50" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900">No Campaign Selected</h3>
                                    <p className="text-sm text-gray-500 max-w-sm mx-auto mt-2">
                                        Choose a marketing campaign from the dropdown above to view its detailed Return on Investment analysis.
                                    </p>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
              );
            })()}
          </div>
        )}

        {activeSection === "surveys" && (
          <div className="space-y-6">
            <MarketingPageHeader
              title="Feedback & Surveys"
              subtitle="Collect customer feedback and run satisfaction surveys."
              icon={ClipboardList}
              searchValue={surveysSearch}
              onSearchChange={(v) => { setSurveysSearch(v); setSurveysPage(1); }}
              actionButton={
                user?.permissions?.includes("marketing.create_surveys") || user?.permissions?.includes("admin.view")
                  ? {
                      label: "New Survey",
                      onClick: () => {
                        setEditingSurvey(null);
                        setSurveyForm({ 
                          name: "", 
                          description: "", 
                          questions: "[]",
                          googleFormLink: "",
                          targetAudience: { segment: "all", stakeholderType: "all" }
                        });
                        setSurveyModalOpen(true);
                      },
                      icon: Plus
                    }
                  : undefined
              }
            />
            <SurveysTab
              surveys={surveysList}
              pagination={surveysPagination}
              onPageChange={setSurveysPage}
              onOpenModal={(survey?) => {
                setEditingSurvey(survey || null);
                setSurveyForm(survey
                  ? { 
                      name: survey.name, 
                      description: survey.description || "", 
                      questions: JSON.stringify(survey.questions || []),
                      googleFormLink: survey.googleFormLink || "",
                      targetAudience: survey.targetAudience || { segment: "all", stakeholderType: "all" }
                    }
                  : { 
                      name: "", 
                      description: "", 
                      questions: "[]",
                      googleFormLink: "",
                      targetAudience: { segment: "all", stakeholderType: "all" }
                    }
                );
                setSurveyModalOpen(true);
              }}
            />
          </div>
        )}


        {activeSection === "sectors" && (user.permissions?.includes("marketing.view_all") || user.permissions?.includes("admin.view")) && (
          <div className="space-y-6">
            <MarketingPageHeader
              title={selectedSector ? selectedSector.name : "Sectors & Projects"}
              subtitle={selectedSector ? `Managing projects for ${selectedSector.name}` : "Manage business sectors and track associated institutional projects."}
              icon={selectedSector ? FolderOpen : PieChart}
              searchValue={sectorSearch}
              onSearchChange={setSectorSearch}
              actionButton={{
                label: selectedSector ? "Add Project" : "Add Sector",
                onClick: () => selectedSector ? setIsProjectModalOpen(true) : setIsSectorModalOpen(true),
                icon: Plus
              }}
            >
              {selectedSector && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSector(null)}
                  className="h-8 px-3 rounded-md border-gray-200 hover:bg-gray-50 text-gray-600"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sectors
                </Button>
              )}
              <div className="flex items-center space-x-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                <Button
                  variant={sectorViewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSectorViewMode('grid')}
                  className={cn("h-8 px-3 rounded-md", sectorViewMode === 'grid' && "bg-white shadow-sm text-[#004E98] hover:bg-white")}
                >
                  <Grid3X3 className="h-4 w-4 mr-2" />
                  Grid
                </Button>
                <Button
                  variant={sectorViewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSectorViewMode('table')}
                  className={cn("h-8 px-3 rounded-md", sectorViewMode === 'table' && "bg-white shadow-sm text-[#004E98] hover:bg-white")}
                >
                  <List className="h-4 w-4 mr-2" />
                  List
                </Button>
              </div>
            </MarketingPageHeader>
            <SectorsManagement 
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ["marketing"] })} 
              externalSearch={sectorSearch}
              externalViewMode={sectorViewMode}
              isExternalCreateOpen={isSectorModalOpen}
              onExternalCreateClose={() => setIsSectorModalOpen(false)}
              onSectorSelect={(sector) => setSelectedSector(sector)}
              isProjectCreateOpenExternal={isProjectModalOpen}
              onProjectCreateCloseExternal={() => setIsProjectModalOpen(false)}
              externalSelectedSector={selectedSector}
            />
          </div>
        )}

        {activeSection === "users" && (user.permissions?.includes("marketing.view_all") || user.permissions?.includes("admin.view")) && (
          <UserManagement />
        )}

        {/* Modals */}
        <MarketingPasswordChangeModal
          isOpen={showPasswordChangeModal}
          onClose={() => setShowPasswordChangeModal(false)}
          onPasswordChanged={() => {
            const userData = localStorage.getItem("marketingUser");
            if (userData) { try { setUser(JSON.parse(userData)); } catch { } }
          }}
          isForced={!!user.mustChangePassword}
        />

        <MarketingProspectsForm
          isOpen={showProspectModal}
          onClose={() => setShowProspectModal(false)}
          hideTrigger={true}
          onSuccess={() => { setShowProspectModal(false); queryClient.invalidateQueries({ queryKey: ["marketing"] }); }}
        />

        <MarketingLeadForm
          isOpen={showLeadModal}
          onClose={() => setShowLeadModal(false)}
          hideTrigger={true}
          onSuccess={() => { setShowLeadModal(false); queryClient.invalidateQueries({ queryKey: ["marketing"] }); }}
        />

        <MarketingSalesWonForm
          isOpen={showSalesWonModal}
          onClose={() => setShowSalesWonModal(false)}
          hideTrigger={true}
          onSuccess={() => { setShowSalesWonModal(false); queryClient.invalidateQueries({ queryKey: ["marketing"] }); }}
        />

        <Dialog open={campaignModalOpen} onOpenChange={setCampaignModalOpen}>
          <DialogContent className="max-w-3xl p-0 border-0 shadow-2xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
            <div className="max-h-[92vh] overflow-y-auto custom-scrollbar flex flex-col">
              
              {/* Header Section */}
              <div className="p-8 pb-6 border-b border-gray-50">
                <div className="flex items-center gap-4">
                  <div className="bg-[#004E98]/10 p-3.5 rounded-[1.25rem]">
                    <Megaphone className="h-7 w-7 text-[#004E98]" />
                  </div>
                  <div className="space-y-1">
                    <DialogTitle className="text-3xl font-black text-gray-900 tracking-tight leading-none">
                      {editingCampaign ? "Edit Campaign" : "New Marketing Campaign"}
                    </DialogTitle>
                    <DialogDescription className="text-gray-400 text-[11px] font-black uppercase tracking-[0.2em] mt-0.5">
                      Design and schedule target audience communications
                    </DialogDescription>
                  </div>
                </div>
              </div>

              {/* Form Content */}
              <div className="p-8 space-y-8 bg-gray-50/30 flex-1">
                {/* Row 1: Campaign Name, Type, Channel */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-2 space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 pl-1">
                      <FileText className="h-3.5 w-3.5 text-[#004E98]" /> Campaign Name
                    </Label>
                    <Input 
                      placeholder="e.g. Summer Intake 2026"
                      value={campaignForm.name} 
                      onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} 
                      className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 pl-1">
                      <Target className="h-3.5 w-3.5 text-[#004E98]" /> Type
                    </Label>
                    <Select value={campaignForm.type} onValueChange={(v) => setCampaignForm({ ...campaignForm, type: v })}>
                      <SelectTrigger className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6">
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-0 shadow-2xl p-2">
                        <SelectItem value="promotional" className="rounded-xl py-3 focus:bg-[#004E98]/5">Promotional</SelectItem>
                        <SelectItem value="informational" className="rounded-xl py-3 focus:bg-[#004E98]/5">Informational</SelectItem>
                        <SelectItem value="event" className="rounded-xl py-3 focus:bg-[#004E98]/5">Event</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 pl-1">
                      <Megaphone className="h-3.5 w-3.5 text-[#004E98]" /> Channel
                    </Label>
                    <Select 
                      value={campaignForm.channel} 
                      onValueChange={(v) => setCampaignForm({ ...campaignForm, channel: v })}
                    >
                      <SelectTrigger className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6">
                        <SelectValue placeholder="Select channel..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-0 shadow-2xl p-2">
                        <SelectItem value="email" className="rounded-xl py-3 focus:bg-[#004E98]/5">Email</SelectItem>
                        <SelectItem value="sms" className="rounded-xl py-3 focus:bg-[#004E98]/5">SMS</SelectItem>
                        <SelectItem value="push_notification" className="rounded-xl py-3 focus:bg-[#004E98]/5">Push Notification</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Event-Only Fields */}
                {campaignForm.type === "event" && (
                  <div className="border-t border-gray-100 pt-6 space-y-6 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="bg-[#004E98]/10 p-1.5 rounded-lg text-[#004E98]">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700">Event Logistics & Financials</Label>
                    </div>

                    {/* Row 1: Venue / Location & Capacity */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="md:col-span-3 space-y-3">
                        <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 pl-1">Venue / Location</Label>
                        <Input
                          placeholder="e.g. Strathmore University Auditorium"
                          value={campaignForm.venue}
                          onChange={(e) => setCampaignForm({ ...campaignForm, venue: e.target.value })}
                          className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6"
                        />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 pl-1">Expected Capacity</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 200"
                          value={campaignForm.expectedCapacity}
                          onChange={(e) => setCampaignForm({ ...campaignForm, expectedCapacity: e.target.value })}
                          className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6"
                        />
                      </div>
                    </div>

                    {/* Row 2: Date & Timing */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="md:col-span-2 space-y-3">
                        <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 pl-1">Date</Label>
                        <Input
                          type="date"
                          value={campaignForm.eventDate}
                          onChange={(e) => setCampaignForm({ ...campaignForm, eventDate: e.target.value })}
                          className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6"
                        />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 pl-1">Start Time</Label>
                        <Input
                          type="time"
                          value={campaignForm.targetAudience?.eventStartTime || ""}
                          onChange={(e) => setCampaignForm({
                            ...campaignForm,
                            targetAudience: { ...campaignForm.targetAudience, eventStartTime: e.target.value }
                          })}
                          className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6"
                        />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 pl-1">End Time</Label>
                        <Input
                          type="time"
                          value={campaignForm.targetAudience?.eventEndTime || ""}
                          onChange={(e) => setCampaignForm({
                            ...campaignForm,
                            targetAudience: { ...campaignForm.targetAudience, eventEndTime: e.target.value }
                          })}
                          className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6"
                        />
                      </div>
                    </div>

                    {/* Row 3: Financial Estimates */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-3">
                        <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 pl-1">Budget (KES)</Label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          value={campaignForm.budget} 
                          onChange={(e) => setCampaignForm({ ...campaignForm, budget: e.target.value })} 
                          className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6" 
                        />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 pl-1">Requested (KES)</Label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          value={campaignForm.requestedAmount} 
                          onChange={(e) => setCampaignForm({ ...campaignForm, requestedAmount: e.target.value })} 
                          className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-[#004E98]/20 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6" 
                        />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 pl-1">Actual Cost (KES)</Label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          value={campaignForm.actualCost} 
                          onChange={(e) => setCampaignForm({ ...campaignForm, actualCost: e.target.value })} 
                          className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6" 
                        />
                      </div>
                    </div>

                    {/* Targeting & Notifications */}
                    <div className="border-t border-gray-100 pt-6 space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="bg-[#004E98]/10 p-1.5 rounded-lg text-[#004E98]">
                          <Target className="h-4 w-4" />
                        </div>
                        <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700">Targeting & Notifications</Label>
                      </div>

                      <div className="space-y-3 max-w-md">
                        <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 pl-1">Stakeholder Type to Notify</Label>
                        <Select
                          value={campaignForm.targetAudience?.stakeholderType || "all"}
                          onValueChange={(v) => setCampaignForm({
                            ...campaignForm,
                            targetAudience: { ...campaignForm.targetAudience, stakeholderType: v, segment: campaignForm.targetAudience?.segment || "all" }
                          })}
                        >
                          <SelectTrigger className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-0 shadow-2xl p-2 max-h-[250px]">
                            <SelectItem value="all" className="rounded-xl py-3 focus:bg-[#004E98]/5">Any Type</SelectItem>
                            <SelectItem value="student" className="rounded-xl py-3 focus:bg-[#004E98]/5">Students/Candidates</SelectItem>
                            <SelectItem value="alumni" className="rounded-xl py-3 focus:bg-[#004E98]/5">Alumni</SelectItem>
                            <SelectItem value="institution" className="rounded-xl py-3 focus:bg-[#004E98]/5">Training Institutions</SelectItem>
                            <SelectItem value="employer" className="rounded-xl py-3 focus:bg-[#004E98]/5">Employers</SelectItem>
                            <SelectItem value="corporate_partner" className="rounded-xl py-3 focus:bg-[#004E98]/5">Corporate Partners</SelectItem>
                            <SelectItem value="government_agency" className="rounded-xl py-3 focus:bg-[#004E98]/5">Government Agencies</SelectItem>
                            <SelectItem value="media" className="rounded-xl py-3 focus:bg-[#004E98]/5">Media</SelectItem>
                            <SelectItem value="sponsor" className="rounded-xl py-3 focus:bg-[#004E98]/5">Sponsors</SelectItem>
                            <SelectItem value="international_student" className="rounded-xl py-3 focus:bg-[#004E98]/5">Regional/International Students</SelectItem>
                            <SelectItem value="vendor" className="rounded-xl py-3 focus:bg-[#004E98]/5">Suppliers/Vendors</SelectItem>
                            <SelectItem value="staff" className="rounded-xl py-3 focus:bg-[#004E98]/5">Staff Members</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Digital Campaign Fields */}
                {campaignForm.type !== "event" && (
                  <>
                    <div className="space-y-3">
                      <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 pl-1">
                        <MessageSquare className="h-3.5 w-3.5 text-[#004E98]" /> Subject / Header
                      </Label>
                      <Input
                        placeholder="Enter a compelling subject line..."
                        value={campaignForm.subject}
                        onChange={(e) => setCampaignForm({ ...campaignForm, subject: e.target.value })}
                        className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 pl-1">
                        <FileText className="h-3.5 w-3.5 text-[#004E98]" /> Campaign Content
                      </Label>
                      <Textarea
                        placeholder="Draft your message content here..."
                        value={campaignForm.content}
                        onChange={(e) => setCampaignForm({ ...campaignForm, content: e.target.value })}
                        rows={6}
                        className="font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-[1.25rem] p-6 resize-none"
                      />
                      {campaignForm.channel === "sms" && (
                        <div className="flex items-center justify-between px-2 pt-1">
                          <span className="text-[9px] font-bold text-gray-400 uppercase">SMS Counter</span>
                          <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full", campaignForm.content.length > 160 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600")}>
                            {campaignForm.content.length} / 160 Characters
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {campaignForm.type !== "event" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 pl-1">
                        <TrendingUp className="h-3.5 w-3.5 text-[#004E98]" /> Current Status
                      </Label>
                      <Select value={campaignForm.status} onValueChange={(v) => setCampaignForm({ ...campaignForm, status: v })}>
                        <SelectTrigger className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-0 shadow-2xl p-2">
                          <SelectItem value="draft" className="rounded-xl py-3 focus:bg-[#004E98]/5">Draft</SelectItem>
                          <SelectItem value="scheduled" className="rounded-xl py-3 focus:bg-[#004E98]/5">Scheduled</SelectItem>
                          <SelectItem value="sent" className="rounded-xl py-3 focus:bg-[#004E98]/5">Sent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {campaignForm.status === "scheduled" && (
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-[#004E98] flex items-center gap-2 pl-1">
                          <Calendar className="h-3.5 w-3.5 text-[#004E98]" /> Execution Time
                        </Label>
                        <Input 
                          type="datetime-local" 
                          value={campaignForm.scheduledAt} 
                          onChange={(e) => setCampaignForm({ ...campaignForm, scheduledAt: e.target.value })} 
                          className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-[#004E98]/20 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6 text-[#004E98]" 
                        />
                      </div>
                    )}
                  </div>
                )}

                {campaignForm.type !== "event" && (
                  <div className="border-t border-gray-100 pt-6 space-y-6">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="bg-[#004E98]/10 p-1.5 rounded-lg text-[#004E98]">
                        <Target className="h-4 w-4" />
                      </div>
                      <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700">Targeting Intelligence</Label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 pl-1">Stakeholder Segment</Label>
                        <Select
                          value={campaignForm.targetAudience?.segment || "all"}
                          onValueChange={(v) => setCampaignForm({
                            ...campaignForm,
                            targetAudience: { ...campaignForm.targetAudience, segment: v }
                          })}
                        >
                          <SelectTrigger className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6">
                            <SelectValue placeholder="Select segment..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-0 shadow-2xl p-2 max-h-[300px] overflow-y-auto">
                            <SelectItem value="all" className="rounded-xl py-3 focus:bg-[#004E98]/5">All Stakeholders</SelectItem>
                            <SelectItem value="seg:promoter" className="rounded-xl py-3 focus:bg-[#004E98]/5">Promoter (Highly Satisfied)</SelectItem>
                            <SelectItem value="seg:detractor" className="rounded-xl py-3 focus:bg-[#004E98]/5">Detractor (Low Satisfaction/Escalated)</SelectItem>
                            <SelectItem value="seg:churn_risk" className="rounded-xl py-3 focus:bg-[#004E98]/5">Churn Risk (Predictive Warning)</SelectItem>
                            <SelectItem value="seg:exam_ready" className="rounded-xl py-3 focus:bg-[#004E98]/5">Exam Ready (Students)</SelectItem>
                            <SelectItem value="seg:exam_critical" className="rounded-xl py-3 focus:bg-[#004E98]/5">Exam Critical (Imminent Exam)</SelectItem>
                            <SelectItem value="seg:certification_pending" className="rounded-xl py-3 focus:bg-[#004E98]/5">Certification Pending</SelectItem>
                            <SelectItem value="seg:near_completion" className="rounded-xl py-3 focus:bg-[#004E98]/5">Near Completion (Final Stretch)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 pl-1">Stakeholder Type</Label>
                        <Select
                          value={campaignForm.targetAudience?.stakeholderType || "all"}
                          onValueChange={(v) => setCampaignForm({
                            ...campaignForm,
                            targetAudience: { ...campaignForm.targetAudience, stakeholderType: v }
                          })}
                        >
                          <SelectTrigger className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-0 shadow-2xl p-2 max-h-[250px]">
                            <SelectItem value="all" className="rounded-xl py-3 focus:bg-[#004E98]/5">Any Type</SelectItem>
                            <SelectItem value="student" className="rounded-xl py-3 focus:bg-[#004E98]/5">Students/Candidates</SelectItem>
                            <SelectItem value="alumni" className="rounded-xl py-3 focus:bg-[#004E98]/5">Alumni</SelectItem>
                            <SelectItem value="institution" className="rounded-xl py-3 focus:bg-[#004E98]/5">Training Institutions</SelectItem>
                            <SelectItem value="employer" className="rounded-xl py-3 focus:bg-[#004E98]/5">Employers</SelectItem>
                            <SelectItem value="corporate_partner" className="rounded-xl py-3 focus:bg-[#004E98]/5">Corporate Partners</SelectItem>
                            <SelectItem value="government_agency" className="rounded-xl py-3 focus:bg-[#004E98]/5">Government Agencies</SelectItem>
                            <SelectItem value="media" className="rounded-xl py-3 focus:bg-[#004E98]/5">Media</SelectItem>
                            <SelectItem value="sponsor" className="rounded-xl py-3 focus:bg-[#004E98]/5">Sponsors</SelectItem>
                            <SelectItem value="international_student" className="rounded-xl py-3 focus:bg-[#004E98]/5">Regional/International Students</SelectItem>
                            <SelectItem value="vendor" className="rounded-xl py-3 focus:bg-[#004E98]/5">Suppliers/Vendors</SelectItem>
                            <SelectItem value="staff" className="rounded-xl py-3 focus:bg-[#004E98]/5">Staff Members</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-8 border-t border-gray-50 bg-white">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setCampaignModalOpen(false)} 
                  className="font-black text-gray-400 uppercase tracking-widest text-[11px] hover:text-gray-900 hover:bg-gray-100 h-14 px-10 rounded-2xl transition-all"
                >
                  Discard
                </Button>
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    saveCampaignMutation.mutate({ id: editingCampaign?.id, data: campaignForm });
                  }}
                  disabled={saveCampaignMutation.isPending}
                  className="bg-[#004E98] hover:bg-[#003d7a] text-white font-black rounded-2xl shadow-xl shadow-blue-500/10 transition-all uppercase tracking-[0.15em] text-[12px] h-14 px-12 gap-3"
                >
                  {saveCampaignMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Megaphone className="h-4 w-4" />
                  )}
                  {editingCampaign ? "Update Campaign" : "Save Campaign"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={surveyModalOpen} onOpenChange={setSurveyModalOpen}>
          <DialogContent className="max-w-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 border-b bg-gray-50/50">
              <DialogTitle className="text-xl font-black text-gray-900 uppercase tracking-tight">
                {editingSurvey ? "Edit Survey" : "New Feedback Survey"}
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto">
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Survey Name</Label>
                  <Input 
                    placeholder="e.g. Annual Student Satisfaction 2026"
                    value={surveyForm.name} 
                    onChange={(e) => setSurveyForm({ ...surveyForm, name: e.target.value })} 
                    className="border-gray-200 focus:border-[#004E98] focus:ring-4 focus:ring-[#004E98]/5 rounded-xl h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Description</Label>
                  <Textarea 
                    placeholder="Provide a brief description of the survey goals..."
                    value={surveyForm.description} 
                    onChange={(e) => setSurveyForm({ ...surveyForm, description: e.target.value })} 
                    rows={2} 
                    className="border-gray-200 focus:border-[#004E98] focus:ring-4 focus:ring-[#004E98]/5 rounded-xl resize-none"
                  />
                </div>

                <div className="p-6 bg-emerald-50/50 rounded-[2rem] border border-emerald-100/50 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-emerald-600 p-1.5 rounded-lg">
                      <LayoutDashboard className="h-4 w-4 text-white" />
                    </div>
                    <Label className="text-xs font-black text-gray-700 uppercase tracking-widest">External Integration</Label>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Google Forms Link (Optional)</Label>
                    <Input 
                      placeholder="https://docs.google.com/forms/d/..."
                      value={surveyForm.googleFormLink} 
                      onChange={(e) => setSurveyForm({ ...surveyForm, googleFormLink: e.target.value })} 
                      className="bg-white border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 rounded-xl h-11"
                    />
                    <p className="text-[10px] text-gray-400 italic">If provided, the survey will redirect or link users to this Google Form instead of using internal questions.</p>
                  </div>
                </div>


                <div className="p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100/50 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-[#004E98] p-1.5 rounded-lg">
                      <Target className="h-4 w-4 text-white" />
                    </div>
                    <Label className="text-xs font-black text-gray-700 uppercase tracking-widest">Targeting Intelligence</Label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-gray-400 pl-1">Stakeholder Segment</Label>
                      <Select
                        value={surveyForm.targetAudience?.segment || "all"}
                        onValueChange={(v) => setSurveyForm({
                          ...surveyForm,
                          targetAudience: { ...surveyForm.targetAudience, segment: v }
                        })}
                      >
                        <SelectTrigger className="h-10 bg-white border-gray-200 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-100 shadow-2xl">
                          <SelectItem value="all">All Stakeholders</SelectItem>
                          <SelectItem value="leads">Qualified Leads Only</SelectItem>
                          <SelectItem value="prospects">Active Prospects</SelectItem>
                          <SelectItem value="won">Closed Clients (Won)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-gray-400 pl-1">Stakeholder Type</Label>
                      <Select
                        value={surveyForm.targetAudience?.stakeholderType || "all"}
                        onValueChange={(v) => setSurveyForm({
                          ...surveyForm,
                          targetAudience: { ...surveyForm.targetAudience, stakeholderType: v }
                        })}
                      >
                        <SelectTrigger className="h-10 bg-white border-gray-200 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-100 shadow-2xl">
                          <SelectItem value="all">Any Type</SelectItem>
                          <SelectItem value="student">Students/Candidates</SelectItem>
                          <SelectItem value="alumni">Alumni</SelectItem>
                          <SelectItem value="institution">Training Institutions</SelectItem>
                          <SelectItem value="employer">Employers</SelectItem>
                          <SelectItem value="corporate_partner">Corporate Partners</SelectItem>
                          <SelectItem value="government_agency">Government Agencies</SelectItem>
                          <SelectItem value="media">Media</SelectItem>
                          <SelectItem value="sponsor">Sponsors</SelectItem>
                          <SelectItem value="international_student">Regional/International Students</SelectItem>
                          <SelectItem value="vendor">Suppliers/Vendors</SelectItem>
                          <SelectItem value="staff">Staff Members</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="p-6 border-t bg-gray-50/30">
              <Button variant="ghost" onClick={() => setSurveyModalOpen(false)} className="rounded-xl font-bold text-xs uppercase tracking-widest text-gray-400 hover:text-gray-900">Cancel</Button>
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  saveSurveyMutation.mutate({ id: editingSurvey?.id, data: surveyForm });
                }}
                disabled={saveSurveyMutation.isPending}
                className="flex-1 h-11 bg-[#004E98] hover:bg-[#004E98]/90 text-white rounded-xl px-8 font-black shadow-lg shadow-blue-900/10 transition-transform active:scale-95"
              >
                {saveSurveyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    {editingSurvey ? "Update Survey" : "Deploy Survey"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <ForensicIssuesModal
          isOpen={forensicModalOpen}
          onClose={() => setForensicModalOpen(false)}
          eventId={selectedEventForForensic?.id || null}
          eventName={selectedEventForForensic?.name || ""}
        />
      </div>
    </DashboardLayout>
  );
}
