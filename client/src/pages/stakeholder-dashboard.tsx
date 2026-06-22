import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/api-client";
import { LayoutDashboard, Users, MessageSquare, Link2, Loader2, UserCircle, Calendar, Info, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useScreenSize } from "@/hooks/use-mobile";

import { StakeholderOverview } from "@/components/stakeholders/stakeholder-overview";
import { StakeholderDirectory } from "@/components/stakeholders/stakeholder-directory";
import { StakeholderProfile } from "@/components/stakeholders/stakeholder-profile";
import { InteractionsTab } from "@/components/stakeholders/interactions-tab";
import { RelationshipsTab } from "@/components/stakeholders/relationships-tab";
import { AccreditationKanban } from "@/components/stakeholders/accreditation-kanban";
import { DashboardLayout } from "@/components/shared/dashboard-layout";
import { NavGroup } from "@/components/shared/dashboard-sidebar";
import { CaseWorkspaceContent } from "./cases/case-workspace";
import {
  STAKEHOLDER_TYPES,
  type StakeholderType, type Stakeholder, type Interaction,
  type Relationship, type StakeholderStats,
} from "@/components/stakeholders/stakeholder-types";

// ── Types ──────────────────────────────────────────────────────────────────
interface StakeholderProfileData {
  stakeholder: Stakeholder; interactions: Interaction[]; relationships: Relationship[];
}



// ── Orchestrator ───────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function StakeholderDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isMobile } = useScreenSize();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("overview");

  // Fetch the actual logged-in user from the same query used in App.tsx
  const { data: user } = useQuery<any>({
    queryKey: ["auth", "me"],
    staleTime: Infinity,
  });

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterLifecycle, setFilterLifecycle] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [selectedStakeholderId, setSelectedStakeholderId] = useState<string | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

  // Interaction Specific Filters
  const [intSearchQuery, setIntSearchQuery] = useState("");
  const [intFilterStatus, setIntFilterStatus] = useState("");
  const [intFilterPriority, setIntFilterPriority] = useState("");
  const [intFilterType, setIntFilterType] = useState("");
  const [intPage, setIntPage] = useState(1);
  const intPageSize = 10;

  const [relPage, setRelPage] = useState(1);
  const relPageSize = 10;
  const [relSearchQuery, setRelSearchQuery] = useState("");
  const [relFilterType, setRelFilterType] = useState("all");
  const [relSubTab, setRelSubTab] = useState("connections");
  const [segPage, setSegPage] = useState(1);
  const [segSearchQuery, setSegSearchQuery] = useState("");

  // Modals
  const [stakeholderModalOpen, setStakeholderModalOpen] = useState(false);
  const [stakeholderForm, setStakeholderForm] = useState({
    name: "", type: "student" as StakeholderType, email: "", phone: "",
    organization: "", address: "", notes: "", riskLevel: "low",
    lifecycleStage: "active", preferredLanguage: "English", communicationFrequency: "As needed",
    accountId: "",
    metadata: {
      exam_sitting: "",
      study_center: "",
      accreditation_expiry: "",
      programme_enrolled: ""
    } as Record<string, any>
  });


  const [interactionModalOpen, setInteractionModalOpen] = useState(false);
  const [submittingInteraction, setSubmittingInteraction] = useState(false);
  const [interactionForm, setInteractionForm] = useState({ stakeholderId: "", type: "call", channel: "phone", subject: "", description: "", date: new Date().toISOString().split("T")[0] });

  const [relationshipModalOpen, setRelationshipModalOpen] = useState(false);
  const [relationshipForm, setRelationshipForm] = useState({ sourceStakeholderId: "", targetStakeholderId: "", relationshipType: "student_institution", description: "" });



  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: statsData, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["stakeholders", "stats"],
    queryFn: async () => {
      const res = await apiRequest("/api/stakeholders/stats");
      return res.json();
    },
    enabled: activeTab === "overview",
  });

  const stats: StakeholderStats = useMemo(() => {
    if (!statsData) return { total: 0, byType: {}, avgEngagement: 0, riskDistribution: {}, activeCount: 0, inactiveCount: 0 };
    return {
      total: statsData.total || 0,
      byType: statsData.byType || {},
      avgEngagementByType: statsData.avgEngagementByType || {},
      avgEngagement: statsData.avgEngagement || 0,
      activeCount: statsData.activeCount || 0,
      inactiveCount: statsData.inactiveCount || 0,
      riskDistribution: statsData.riskDistribution || {},
      regionalDistribution: statsData.regionalDistribution || {},
      mostEngagedTypeLastWeek: statsData.mostEngagedTypeLastWeek
    };
  }, [statsData]);

  const { data: stakeholdersData, isLoading: directoryLoading } = useQuery<{ stakeholders: Stakeholder[], total: number }>({
    queryKey: ["stakeholders", "list", { filterType, filterLifecycle, searchQuery, currentPage }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterType && filterType !== "all") params.set("type", filterType);
      if (filterLifecycle && filterLifecycle !== "all") params.set("lifecycleStage", filterLifecycle);
      if (searchQuery) params.set("search", searchQuery);
      params.set("page", currentPage.toString());
      params.set("limit", pageSize.toString());
      const res = await apiRequest(`/api/stakeholders?${params}`);
      return res.json();
    },
    enabled: activeTab === "stakeholders" || activeTab === "interactions" || activeTab === "relationships",
  });

  const { data: profileData, isLoading: profileLoading } = useQuery<StakeholderProfileData & { cases: any[] }>({
    queryKey: ["stakeholders", "profile", selectedStakeholderId],
    queryFn: async () => {
      const res = await apiRequest(`/api/stakeholders/${selectedStakeholderId}`);
      return res.json();
    },
    enabled: !!selectedStakeholderId && activeTab === "profile",
  });

  const { data: recentInteractionsResponse, isLoading: recentInteractionsLoading } = useQuery<{ interactions: Interaction[] }>({
    queryKey: ["stakeholders", "interactions", "recent"],
    queryFn: async () => {
      const res = await apiRequest("/api/stakeholder-interactions?limit=7");
      return res.json();
    },
    enabled: activeTab === "overview",
  });

  const { data: interactionsResponse, isLoading: interactionsLoading } = useQuery<{ interactions: Interaction[], total: number }>({
    queryKey: ["stakeholders", "interactions", "global", { intSearchQuery, intFilterStatus, intFilterPriority, intFilterType, intPage }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (intSearchQuery) params.set("search", intSearchQuery);
      if (intFilterStatus) params.set("status", intFilterStatus);
      if (intFilterPriority) params.set("priority", intFilterPriority);
      params.set("page", intPage.toString());
      params.set("limit", intPageSize.toString());
      // Touchpoint type handling can be added if backend supports it
      const res = await apiRequest(`/api/stakeholder-interactions?${params}`);
      return res.json();
    },
    enabled: activeTab === "interactions",
  });

  const { data: relationshipsResponse, isLoading: relationshipsLoading } = useQuery<{ data: Relationship[], pagination: { total: number, page: number, limit: number, totalPages: number } }>({
    queryKey: ["stakeholders", "relationships", "global", { relPage, relSearchQuery, relFilterType }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", relPage.toString());
      params.set("limit", relPageSize.toString());
      if (relSearchQuery) params.set("search", relSearchQuery);
      if (relFilterType && relFilterType !== "all") params.set("type", relFilterType);
      const res = await apiRequest(`/api/stakeholder-relationships?${params}`);
      return res.json();
    },
    enabled: activeTab === "relationships",
  });

  const { data: segmentsResponse, isLoading: segmentsLoading } = useQuery<{
    stakeholders: any[],
    pagination: { total: number, page: number, totalPages: number }
  }>({
    queryKey: ["stakeholders", "segments", { segPage, segSearchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", segPage.toString());
      params.set("limit", "10");
      if (segSearchQuery) params.set("search", segSearchQuery);
      const res = await apiRequest(`/api/stakeholders/segments?${params}`);
      return res.json();
    },
    enabled: activeTab === "relationships",
  });

  const segmentsData = segmentsResponse?.stakeholders || [];
  const totalSegments = segmentsResponse?.pagination?.total || 0;
  const segmentsTotalPages = segmentsResponse?.pagination?.totalPages || 0;

  const { data: accreditationData, isLoading: accreditationLoading } = useQuery<{ processes: any[] }>({
    queryKey: ["accreditation", "global"],
    queryFn: async () => {
      const res = await apiRequest(`/api/accreditation`);
      return res.json();
    },
    enabled: activeTab === "accreditation",
  });

  const updateProcessStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string, stage: string }) => {
      const res = await apiRequest(`/api/accreditation/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ stage })
      });
      if (!res.ok) throw new Error("Failed to update stage");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accreditation"] });
    }
  });

  const stakeholders = stakeholdersData?.stakeholders || [];

  const totalStakeholders = stakeholdersData?.total || 0;
  const recentInteractions = recentInteractionsResponse?.interactions || [];
  const allRelationships = relationshipsResponse?.data || [];
  const totalRelationships = relationshipsResponse?.pagination?.total || 0;
  const relationshipsTotalPages = relationshipsResponse?.pagination?.totalPages || 0;

  const allInteractions = interactionsResponse?.interactions || [];
  const totalInteractions = interactionsResponse?.total || 0;

  const loading = statsLoading || directoryLoading || profileLoading || interactionsLoading || relationshipsLoading || recentInteractionsLoading;
  const allStakeholdersList = stakeholdersData?.stakeholders || []; // Simplified for modal usage

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleCreateStakeholder = async () => {
    const res = await apiRequest("/api/stakeholders", { method: "POST", body: JSON.stringify(stakeholderForm) });
    if (res.ok) {
      toast({ title: "Success", description: "Stakeholder created successfully." });
      setStakeholderModalOpen(false);
      setStakeholderForm({
        name: "", type: "student", email: "", phone: "", organization: "", address: "", notes: "", riskLevel: "low",
        lifecycleStage: "active", preferredLanguage: "English", communicationFrequency: "As needed", accountId: "",
        metadata: {}
      });
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
    } else {
      const data = await res.json().catch(() => ({}));
      toast({ title: "Error", description: data.message || "Failed to create stakeholder.", variant: "destructive" });
    }
  };

  const handleCreateInteraction = async () => {
    if (!interactionForm.stakeholderId) { toast({ title: "Error", description: "Please select a stakeholder.", variant: "destructive" }); return; }
    setSubmittingInteraction(true);
    try {
      const res = await apiRequest(`/api/stakeholders/${interactionForm.stakeholderId}/interactions`, {
        method: "POST",
        body: JSON.stringify({
          type: interactionForm.type,
          channel: interactionForm.channel,
          subject: interactionForm.subject,
          description: interactionForm.description,
          date: interactionForm.date
        })
      });
      if (res.ok) {
        toast({ title: "Success", description: "Interaction logged successfully." });
        setInteractionModalOpen(false);
        setInteractionForm({ stakeholderId: "", type: "call", channel: "phone", subject: "", description: "", date: new Date().toISOString().split("T")[0] });
        queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Error", description: data.message || "Failed to log interaction.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setSubmittingInteraction(false);
    }
  };

  const handleCreateRelationship = async () => {
    if (!relationshipForm.sourceStakeholderId || !relationshipForm.targetStakeholderId) { toast({ title: "Error", description: "Please select both stakeholders.", variant: "destructive" }); return; }
    const res = await apiRequest("/api/stakeholders/relationships", { method: "POST", body: JSON.stringify(relationshipForm) });
    if (res.ok) {
      toast({ title: "Success", description: "Relationship created successfully." });
      setRelationshipModalOpen(false);
      setRelationshipForm({ sourceStakeholderId: "", targetStakeholderId: "", relationshipType: "student_institution", description: "" });
      queryClient.invalidateQueries({ queryKey: ["stakeholders", "relationships"] });
    } else { const data = await res.json().catch(() => ({})); toast({ title: "Error", description: data.message || "Failed to create relationship.", variant: "destructive" }); }
  };

  const updateStakeholderMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<Stakeholder> }) => {
      const res = await apiRequest(`/api/stakeholders/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to update stakeholder.");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stakeholder updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const uniqueOrganizations = useMemo(() => {
    const orgs = new Set<string>();
    allStakeholdersList.forEach(s => {
      if (s.organization) orgs.add(s.organization);
      if (s.name && (s.type === "institution" || s.type === "employer")) orgs.add(s.name);
    });
    return Array.from(orgs).sort();
  }, [allStakeholdersList]);

  const viewStakeholderProfile = (id: string) => { setSelectedStakeholderId(id); setActiveTab("profile"); };
  const handleLogout = () => { localStorage.removeItem("marketingToken"); setLocation("/marketing/login"); };

  const openInteractionModal = (stakeholderId?: string) => {
    setInteractionForm({ stakeholderId: stakeholderId || "", type: "call", channel: "phone", subject: "", description: "", date: new Date().toISOString().split("T")[0] });
    setInteractionModalOpen(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const navGroups: NavGroup[] = [
    {
      title: "Core",
      items: [{ id: "overview", label: "Overview", icon: LayoutDashboard }],
    },
    {
      title: "Management",
      items: [
        { id: "stakeholders", label: "Stakeholders", icon: Users },
        { id: "accreditation", label: "Accreditation", icon: CheckCircle2 },
      ],
    },
    {
      title: "Engagement",
      items: [
        { id: "interactions", label: "Interactions", icon: MessageSquare },
        { id: "relationships", label: "Relationships", icon: Link2 },
      ],
    },
  ];

  const tabDescriptions: Record<string, string> = {
    overview: "Summary of stakeholder metrics and engagement statistics",
    stakeholders: "Browse and search all stakeholders in the system",
    profile: "Comprehensive 360° view of stakeholder data",
    interactions: "Communication history and case-based interactions",
    relationships: "Visualize and manage stakeholder connections",
    accreditation: "Manage institutional accreditation pipeline",
  };

  const renderContent = () => {
    if (activeCaseId) {
      return (
        <CaseWorkspaceContent
          id={activeCaseId}
          onBack={() => setActiveCaseId(null)}
          user={user}
        />
      );
    }
    if (loading && activeTab === "overview") return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" style={{ color: "#004E98" }} /></div>;
    switch (activeTab) {
      case "overview": return <StakeholderOverview stats={stats} userName={user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user?.email} recentInteractions={recentInteractions || []} onNavigate={setLocation} onViewCase={(cid) => setActiveCaseId(cid)} />;
      case "stakeholders":
        return <StakeholderDirectory stakeholders={stakeholders} loading={directoryLoading} total={totalStakeholders} page={currentPage} pageSize={pageSize} searchQuery={searchQuery} filterType={filterType} filterLifecycle={filterLifecycle} onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }} onTypeFilter={(v) => { setFilterType(v); setCurrentPage(1); }} onLifecycleFilter={(v) => { setFilterLifecycle(v); setCurrentPage(1); }} onPageChange={setCurrentPage} onViewProfile={viewStakeholderProfile} onAddStakeholder={() => setStakeholderModalOpen(true)} />;
      case "profile":
        return (
          <StakeholderProfile
            profile={profileData || null}
            isLoading={profileLoading}
            onBack={() => {
              setSelectedStakeholderId(null);
              setActiveTab("stakeholders");
            }}
            onLogInteraction={openInteractionModal}
            onNavigate={setLocation}
            onCaseClick={(cid) => setActiveCaseId(cid)}
            onUpdateStakeholder={(id, updates) => updateStakeholderMutation.mutateAsync({ id, updates })}
            organizations={uniqueOrganizations}
          />
        );
      case "interactions":
        return (
          <InteractionsTab
            interactions={allInteractions || []}
            loading={interactionsLoading}
            total={totalInteractions}
            page={intPage}
            pageSize={intPageSize}
            searchQuery={intSearchQuery}
            onSearchChange={setIntSearchQuery}
            filterStatus={intFilterStatus}
            onStatusFilter={setIntFilterStatus}
            filterPriority={intFilterPriority}
            onPriorityFilter={setIntFilterPriority}
            filterType={intFilterType}
            onTypeFilter={setIntFilterType}
            onPageChange={setIntPage}
            onNavigate={setLocation}
            onViewCase={(cid) => setActiveCaseId(cid)}
          />
        );
      case "relationships":
        return (
          <RelationshipsTab
            relationships={allRelationships}
            loading={relationshipsLoading}
            total={totalRelationships}
            page={relPage}
            totalPages={relationshipsTotalPages}
            onPageChange={setRelPage}
            searchQuery={relSearchQuery}
            onSearchChange={(v) => { setRelSearchQuery(v); setRelPage(1); }}
            typeFilter={relFilterType}
            onTypeFilterChange={(v) => { setRelFilterType(v); setRelPage(1); }}
            segments={segmentsData || []}
            segmentsLoading={segmentsLoading}
            segPage={segPage}
            segTotalPages={segmentsTotalPages}
            onSegPageChange={setSegPage}
            segSearchQuery={segSearchQuery}
            onSegSearchChange={setSegSearchQuery}
            activeSubTab={relSubTab}
            onSubTabChange={setRelSubTab}
            onViewProfile={viewStakeholderProfile}
          />

        );
      case "accreditation":
        return (
          <div className="p-6">
            <AccreditationKanban
              processes={accreditationData?.processes || []}
              isLoading={accreditationLoading}
              onStageChange={(id, newStage) => updateProcessStageMutation.mutate({ id, stage: newStage })}
              onProcessClick={(id) => {
                const process = accreditationData?.processes.find(p => p.id === id);
                if (process) {
                  viewStakeholderProfile(process.stakeholderId);
                }
              }}
            />
          </div>
        );
      default: return null;
    }
  };


  return (
    <DashboardLayout
      title="KASNEB CRM"
      subtitle="Stakeholder Intelligence"
      navGroups={navGroups}
      activeTab={activeTab}
      setActiveTab={(tab) => {
        setActiveCaseId(null);
        setActiveTab(tab);
      }}
      user={user}
      onLogout={handleLogout}
      loading={loading && activeTab === "overview"}
      tabDescriptions={tabDescriptions}
      sidebarStorageKey="stakeholderSidebarCollapsed"
    >
      {renderContent()}

      {/* Stakeholder modal */}
      <Dialog open={stakeholderModalOpen} onOpenChange={setStakeholderModalOpen}>
        <DialogContent className="sm:max-w-[850px] p-0 border-0 shadow-2xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5 max-h-[92vh] overflow-y-auto custom-scrollbar flex flex-col">
          {/* Header */}
          <DialogHeader className="p-8 pb-6 bg-white border-b border-gray-50">
            <div className="flex items-center gap-5">
              <div className="bg-[#004E98]/10 p-4 rounded-2xl shadow-sm">
                <Users className="h-7 w-7 text-[#004E98]" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black text-gray-900 tracking-tight">
                  Add New Ecosystem Stakeholder
                </DialogTitle>
                <DialogDescription className="text-gray-500 font-bold text-xs mt-1 uppercase tracking-[0.2em]">
                  Initialize a new record in the stakeholder intelligence directory
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-8 bg-gray-50/30 flex-1">
            {/* 1. Core Identity & Classification */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 ml-1">
                <div className="h-1.5 w-6 bg-[#004E98] rounded-full" />
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[#004E98]">Core Identity & Classification</span>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Full Name / Entity Name *</Label>
                  <Input
                    value={stakeholderForm.name}
                    onChange={(e) => setStakeholderForm({ ...stakeholderForm, name: e.target.value })}
                    placeholder="e.g. Samuel Owino"
                    className="h-14 font-black bg-white border-0 shadow-lg shadow-blue-500/5 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6 text-gray-900 border-gray-100/50"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Stakeholder Type *</Label>
                  <Select value={stakeholderForm.type} onValueChange={(v) => setStakeholderForm({ ...stakeholderForm, type: v as StakeholderType })}>
                    <SelectTrigger className="h-14 font-black bg-white border-0 shadow-lg shadow-blue-500/5 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6 text-gray-900 border-gray-100/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-gray-100 shadow-xl">
                      {STAKEHOLDER_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="font-bold py-3 capitalize">{t.split('_').join(' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 2. Contact Mechanics */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 ml-1">
                <div className="h-1.5 w-6 bg-emerald-500 rounded-full" />
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-emerald-600">Contact Mechanics</span>
              </div>
              <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-6">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Primary Email Address</Label>
                    <Input
                      type="email"
                      value={stakeholderForm.email}
                      onChange={(e) => setStakeholderForm({ ...stakeholderForm, email: e.target.value })}
                      placeholder="email@kasneb.or.ke"
                      className="h-14 font-black bg-gray-50/30 border-0 shadow-inner focus:ring-2 focus:ring-[#004E98]/10 rounded-2xl px-6 text-gray-900"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Direct Phone Number</Label>
                    <Input
                      value={stakeholderForm.phone}
                      onChange={(e) => setStakeholderForm({ ...stakeholderForm, phone: e.target.value })}
                      placeholder="+254 7XX XXX XXX"
                      className="h-14 font-black bg-gray-50/30 border-0 shadow-inner focus:ring-2 focus:ring-[#004E98]/10 rounded-2xl px-6 text-gray-900"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Institutional Linkage & Lifecycle */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 ml-1">
                <div className="h-1.5 w-6 bg-amber-500 rounded-full" />
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-amber-600">Institutional Linkage & Lifecycle</span>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Link to existing Institution</Label>
                  <Select value={stakeholderForm.accountId} onValueChange={(v) => {
                    const found = allStakeholdersList.find(s => s.id === v);
                    setStakeholderForm({ ...stakeholderForm, accountId: v, organization: found?.organization || found?.name || "" });
                  }}>
                    <SelectTrigger className="h-14 font-black bg-white border-0 shadow-lg shadow-blue-500/5 focus:ring-2 focus:ring-[#004E98]/10 rounded-2xl px-6 text-gray-900 border-gray-100/50">
                      <SelectValue placeholder="No Primary Affiliate" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-gray-100 shadow-xl max-h-[300px]">
                      <SelectItem value="none" className="font-bold py-3 text-gray-400">Independent / None</SelectItem>
                      {allStakeholdersList.filter(s => s.type === "institution").map((inst) => (
                        <SelectItem key={inst.id} value={inst.id} className="font-bold py-3">{inst.organization || inst.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Lifecycle Stage</Label>
                  <Select value={stakeholderForm.lifecycleStage} onValueChange={(v) => setStakeholderForm({ ...stakeholderForm, lifecycleStage: v })}>
                    <SelectTrigger className="h-14 font-black bg-white border-0 shadow-lg shadow-blue-500/5 focus:ring-2 focus:ring-[#004E98]/10 rounded-2xl px-6 text-gray-900 border-gray-100/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-gray-100 shadow-xl">
                      {stakeholderForm.type === "student" || stakeholderForm.type === "international_student" ? (
                        <>
                          <SelectItem value="registered" className="font-bold py-3 text-sky-600">Registered</SelectItem>
                          <SelectItem value="alumni" className="font-bold py-3 text-[#004E98]">Alumni</SelectItem>
                          <SelectItem value="suspended" className="font-bold py-3 text-orange-500">Suspended</SelectItem>
                          <SelectItem value="dormant" className="font-bold py-3 text-slate-500">Dormant</SelectItem>
                        </>
                      ) : stakeholderForm.type === "institution" ? (
                        <>
                          <SelectItem value="inquiry" className="font-bold py-3 text-blue-600">Inquiry (Stage 1)</SelectItem>
                          <SelectItem value="application_submitted" className="font-bold py-3 text-indigo-600">App Submitted (Stage 2)</SelectItem>
                          <SelectItem value="assessment_visit" className="font-bold py-3 text-amber-600">Assessment (Stage 3)</SelectItem>
                          <SelectItem value="under_review" className="font-bold py-3 text-orange-600">Under Review (Stage 4)</SelectItem>
                          <SelectItem value="accredited" className="font-bold py-3 text-emerald-600">Accredited (Stage 5)</SelectItem>
                          <SelectItem value="renewal" className="font-bold py-3 text-teal-600">Renewal (Stage 6)</SelectItem>
                          <SelectItem value="lapsed" className="font-bold py-3 text-red-600">Lapsed (Stage 7)</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="active" className="font-bold py-3 text-emerald-600">Active</SelectItem>
                          <SelectItem value="inactive" className="font-bold py-3 text-gray-500">Inactive</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 4. Infrastructure & Strategy */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 ml-1">
                <div className="h-1.5 w-6 bg-purple-500 rounded-full" />
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-purple-600">Infrastructure & Strategy</span>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-6">
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Preferred Language</Label>
                    <Select value={stakeholderForm.preferredLanguage} onValueChange={(v) => setStakeholderForm({ ...stakeholderForm, preferredLanguage: v })}>
                      <SelectTrigger className="h-12 font-bold bg-gray-50/50 border-0 rounded-xl px-4">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                        <SelectItem value="English" className="font-bold">English</SelectItem>
                        <SelectItem value="Swahili" className="font-bold">Swahili</SelectItem>
                        <SelectItem value="French" className="font-bold">French</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Risk Classification</Label>
                    <Select value={stakeholderForm.riskLevel} onValueChange={(v) => setStakeholderForm({ ...stakeholderForm, riskLevel: v })}>
                      <SelectTrigger className="h-12 font-bold bg-gray-50/50 border-0 rounded-xl px-4">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                        <SelectItem value="low" className="font-bold text-emerald-600">Low Risk</SelectItem>
                        <SelectItem value="medium" className="font-bold text-amber-600">Medium Risk</SelectItem>
                        <SelectItem value="high" className="font-bold text-orange-600">High Risk</SelectItem>
                        <SelectItem value="critical" className="font-bold text-red-600">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Internal Intelligence Notes</Label>
                  <Textarea
                    value={stakeholderForm.notes}
                    onChange={(e) => setStakeholderForm({ ...stakeholderForm, notes: e.target.value })}
                    placeholder="Provide detailed context for this entity..."
                    className="min-h-[160px] bg-white border-0 shadow-lg shadow-blue-500/5 ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 rounded-2xl font-bold text-gray-700 p-5 resize-none leading-relaxed transition-all"
                  />
                </div>
              </div>
            </div>

            {/* 5. Custom Information (KASNEB Specific) */}
            <div className="space-y-6 pb-4">
              <div className="flex items-center gap-2 ml-1">
                <div className="h-1.5 w-6 bg-[#D0AC01] rounded-full" />
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[#D0AC01]">Custom Information</span>
              </div>
              <div className="p-6 bg-[#D0AC01]/5 rounded-2xl border border-[#D0AC01]/10 grid grid-cols-2 gap-8">
                {stakeholderForm.type === "student" && (
                  <>
                    <div className="space-y-3">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Programme Enrolled</Label>
                      <Input
                        value={stakeholderForm.metadata.programme_enrolled || ""}
                        onChange={(e) => setStakeholderForm({ ...stakeholderForm, metadata: { ...stakeholderForm.metadata, programme_enrolled: e.target.value } })}
                        placeholder="e.g. CPA Section 6"
                        className="h-12 font-bold bg-white border-0 rounded-xl px-4"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Exam Sitting</Label>
                      <Select
                        value={stakeholderForm.metadata.exam_sitting || ""}
                        onValueChange={(v) => setStakeholderForm({ ...stakeholderForm, metadata: { ...stakeholderForm.metadata, exam_sitting: v } })}
                      >
                        <SelectTrigger className="h-12 font-bold bg-white border-0 rounded-xl px-4">
                          <SelectValue placeholder="Select sitting" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="Aug 2025" className="font-bold">Aug 2025</SelectItem>
                          <SelectItem value="Dec 2025" className="font-bold">Dec 2025</SelectItem>
                          <SelectItem value="Apr 2026" className="font-bold">Apr 2026</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Study Center</Label>
                      <Input
                        value={stakeholderForm.metadata.study_center || ""}
                        onChange={(e) => setStakeholderForm({ ...stakeholderForm, metadata: { ...stakeholderForm.metadata, study_center: e.target.value } })}
                        placeholder="e.g. Strathmore"
                        className="h-12 font-bold bg-white border-0 rounded-xl px-4"
                      />
                    </div>

                  </>
                )}

                {stakeholderForm.type === "institution" && (
                  <>
                    <div className="space-y-3">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Accreditation Expiry</Label>
                      <Input
                        type="date"
                        value={stakeholderForm.metadata.accreditation_expiry || ""}
                        onChange={(e) => setStakeholderForm({ ...stakeholderForm, metadata: { ...stakeholderForm.metadata, accreditation_expiry: e.target.value } })}
                        className="h-12 font-bold bg-white border-0 rounded-xl px-4"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Accreditation Status</Label>
                      <Select
                        value={stakeholderForm.metadata.accreditation_status || "Active"}
                        onValueChange={(v) => setStakeholderForm({ ...stakeholderForm, metadata: { ...stakeholderForm.metadata, accreditation_status: v } })}
                      >
                        <SelectTrigger className="h-12 font-bold bg-white border-0 rounded-xl px-4">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="Active" className="font-bold text-emerald-600">Fully Accredited</SelectItem>
                          <SelectItem value="Provision" className="font-bold text-amber-600">Provisional</SelectItem>
                          <SelectItem value="Expired" className="font-bold text-red-600">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {stakeholderForm.type === "employer" && (
                  <div className="space-y-3 lg:col-span-2">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Industry Sector</Label>
                    <Input
                      value={stakeholderForm.metadata.industry || ""}
                      onChange={(e) => setStakeholderForm({ ...stakeholderForm, metadata: { ...stakeholderForm.metadata, industry: e.target.value } })}
                      placeholder="e.g. Financial Services"
                      className="h-12 font-bold bg-white border-0 rounded-xl px-4"
                    />
                  </div>
                )}

                {(stakeholderForm.type === "alumni" || stakeholderForm.type === "international_student" || stakeholderForm.type === "student") && (
                  <>
                    <div className="space-y-3">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Subject Expertise</Label>
                      <Input
                        value={stakeholderForm.metadata.subject_area || ""}
                        onChange={(e) => setStakeholderForm({ ...stakeholderForm, metadata: { ...stakeholderForm.metadata, subject_area: e.target.value } })}
                        placeholder="e.g. Advanced Taxation"
                        className="h-12 font-bold bg-white border-0 rounded-xl px-4"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Panel Role</Label>
                      <Input
                        value={stakeholderForm.metadata.panel_role || ""}
                        onChange={(e) => setStakeholderForm({ ...stakeholderForm, metadata: { ...stakeholderForm.metadata, panel_role: e.target.value } })}
                        placeholder="e.g. Senior Reviewer"
                        className="h-12 font-bold bg-white border-0 rounded-xl px-4"
                      />
                    </div>
                  </>
                )}

                {stakeholderForm.type === "staff" && (
                  <>
                    <div className="space-y-3">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">KASNEB Department</Label>
                      <Input
                        value={stakeholderForm.metadata.department || ""}
                        onChange={(e) => setStakeholderForm({ ...stakeholderForm, metadata: { ...stakeholderForm.metadata, department: e.target.value } })}
                        placeholder="e.g. Examinations"
                        className="h-12 font-bold bg-white border-0 rounded-xl px-4"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-1">Internal Role</Label>
                      <Input
                        value={stakeholderForm.metadata.internal_role || ""}
                        onChange={(e) => setStakeholderForm({ ...stakeholderForm, metadata: { ...stakeholderForm.metadata, internal_role: e.target.value } })}
                        placeholder="e.g. QA Specialist"
                        className="h-12 font-bold bg-white border-0 rounded-xl px-4"
                      />
                    </div>
                  </>
                )}

                {/* Default message if no specific fields for other types */}
                {!["student", "institution", "employer", "marker", "setter", "staff"].includes(stakeholderForm.type) && (
                  <div className="col-span-2 text-center py-4 italic text-gray-400 text-sm">
                    No custom fields available for this stakeholder type.
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-white border-t border-gray-50 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStakeholderModalOpen(false)}
              className="font-black text-gray-400 uppercase tracking-[0.2em] text-[10px] hover:text-gray-900 transition-all px-8 h-14 rounded-2xl"
            >
              Discard Entry
            </Button>
            <Button
              onClick={handleCreateStakeholder}
              disabled={!stakeholderForm.name}
              className="bg-[#004E98] hover:bg-[#003B73] text-white font-black rounded-2xl shadow-2xl shadow-blue-500/20 transition-all uppercase tracking-[0.2em] text-[11px] h-14 px-12 gap-3"
            >
              <Users className="h-5 w-5" />
              Initialize Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interaction modal */}
      <Dialog open={interactionModalOpen} onOpenChange={setInteractionModalOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden">
          <div className="p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <DialogHeader>
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <MessageSquare className="h-5 w-5 text-[#004E98]" />
                <DialogTitle className="text-2xl font-bold text-gray-900">
                  Log Interaction
                </DialogTitle>
              </div>
              <DialogDescription className="text-gray-500 text-sm mt-3">
                Record a new touchpoint or engagement note for this stakeholder to maintain an accurate ecosystem record.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-8 space-y-6">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-inner">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-1">Target Stakeholder</p>
                <div className="flex items-center gap-3">
                  {interactionForm.stakeholderId ? (
                    <div className="flex items-center gap-2">
                      <UserCircle className="h-5 w-5 text-[#004E98]" />
                      <span className="text-sm font-bold text-gray-900">
                        {(() => {
                          const found = allStakeholdersList.find(s => s.id === interactionForm.stakeholderId);
                          if (!found) return interactionForm.stakeholderId;
                          if (["institution", "employer", "department"].includes(found.type) && found.organization) {
                            return found.organization;
                          }
                          return found.name || `${found.firstName} ${found.lastName}`.trim();
                        })()}
                      </span>
                    </div>
                  ) : (
                    <Select value={interactionForm.stakeholderId} onValueChange={(v) => setInteractionForm({ ...interactionForm, stakeholderId: v })}>
                      <SelectTrigger className="h-10 border-gray-200 focus:ring-2 focus:ring-[#004E98]/10"><SelectValue placeholder="Select stakeholder" /></SelectTrigger>
                      <SelectContent>{allStakeholdersList.map((s) => <SelectItem key={s.id} value={s.id}>{s.name || s.organization} ({s.type})</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black text-gray-400 uppercase tracking-wider">Channel</Label>
                <Select value={interactionForm.channel} onValueChange={(v) => setInteractionForm({ ...interactionForm, channel: v })}>
                  <SelectTrigger className="h-11 border-gray-200 focus:ring-2 focus:ring-[#004E98]/10 transition-all">
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="portal">Portal</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                    <SelectItem value="social_media">Social Media</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-black text-gray-400 uppercase tracking-wider">Interaction Type</Label>
                  <Select value={interactionForm.type} onValueChange={(v) => setInteractionForm({ ...interactionForm, type: v })}>
                    <SelectTrigger className="h-11 border-gray-200 focus:ring-2 focus:ring-[#004E98]/10 transition-all">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="portal_activity">Portal Activity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-gray-400 uppercase tracking-wider">Interaction Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input type="date" className="h-11 pl-10 border-gray-200 focus:ring-2 focus:ring-[#004E98]/10 transition-all" value={interactionForm.date} onChange={(e) => setInteractionForm({ ...interactionForm, date: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black text-gray-400 uppercase tracking-wider">Subject / Purpose</Label>
                <div className="relative">
                  <Info className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input className="h-11 pl-10 border-gray-200 focus:ring-2 focus:ring-[#004E98]/10 transition-all" value={interactionForm.subject} onChange={(e) => setInteractionForm({ ...interactionForm, subject: e.target.value })} placeholder="Brief summary of interaction" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black text-gray-400 uppercase tracking-wider">Detailed Description</Label>
                <Textarea
                  className="min-h-[120px] p-4 border-gray-200 focus:ring-2 focus:ring-[#004E98]/10 transition-all text-sm"
                  value={interactionForm.description}
                  onChange={(e) => setInteractionForm({ ...interactionForm, description: e.target.value })}
                  placeholder="Provide comprehensive details of the discussion or activity..."
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 gap-3">
            <Button variant="ghost" onClick={() => setInteractionModalOpen(false)} className="font-semibold text-gray-500 hover:text-gray-700">Discard</Button>
            <Button
              onClick={handleCreateInteraction}
              disabled={!interactionForm.stakeholderId || !interactionForm.subject || submittingInteraction}
              className="bg-[#004E98] hover:bg-[#003B73] px-10 h-11 font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform gap-2 text-white"
            >
              {submittingInteraction ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submittingInteraction ? "Logging..." : "Log Interaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Relationship modal */}
      <Dialog open={relationshipModalOpen} onOpenChange={setRelationshipModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle style={{ color: "#004E98" }}>Add Relationship</DialogTitle><DialogDescription>Create a relationship between two stakeholders.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Source Stakeholder *</Label>
              <Select value={relationshipForm.sourceStakeholderId} onValueChange={(v) => setRelationshipForm({ ...relationshipForm, sourceStakeholderId: v })}>
                <SelectTrigger><SelectValue placeholder="Select source stakeholder" /></SelectTrigger>
                <SelectContent>{allStakeholdersList.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.type})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Relationship Type *</Label>
              <Select value={relationshipForm.relationshipType} onValueChange={(v) => setRelationshipForm({ ...relationshipForm, relationshipType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Professional</SelectLabel>
                    <SelectItem value="student_institution">Student ↔ Institution</SelectItem>
                    <SelectItem value="employer_org">Employer ↔ Organization</SelectItem>
                    <SelectItem value="colleague">Colleague ↔ Colleague</SelectItem>
                  </SelectGroup>
                  <SelectSeparator className="my-1" />
                  <SelectGroup>
                    <SelectLabel className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Hierarchy & Department</SelectLabel>
                    <SelectItem value="staff_dept">Staff ↔ Department</SelectItem>
                    <SelectItem value="manager_report">Manager ↔ Reporting Staff</SelectItem>
                    <SelectItem value="dept_hierarchy">Department ↔ Parent Dept</SelectItem>
                  </SelectGroup>
                  <SelectSeparator className="my-1" />
                  <SelectGroup>
                    <SelectLabel className="text-[10px] font-black uppercase text-gray-400 tracking-widest pt-2">Family</SelectLabel>
                    <SelectItem value="parent_child">Parent ↔ Child</SelectItem>
                    <SelectItem value="mother_child">Mother ↔ Child</SelectItem>
                    <SelectItem value="father_child">Father ↔ Child</SelectItem>
                  </SelectGroup>
                  <SelectSeparator className="my-1" />
                  <SelectGroup>
                    <SelectItem value="other">Specialized Connection / Other</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Target Stakeholder *</Label>
              <Select value={relationshipForm.targetStakeholderId} onValueChange={(v) => setRelationshipForm({ ...relationshipForm, targetStakeholderId: v })}>
                <SelectTrigger><SelectValue placeholder="Select target stakeholder" /></SelectTrigger>
                <SelectContent>{allStakeholdersList.filter((s) => s.id !== relationshipForm.sourceStakeholderId).map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.type})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={relationshipForm.description} onChange={(e) => setRelationshipForm({ ...relationshipForm, description: e.target.value })} placeholder="Describe the relationship..." rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRelationshipModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRelationship} disabled={!relationshipForm.sourceStakeholderId || !relationshipForm.targetStakeholderId} style={{ backgroundColor: "#D0AC01" }} className="text-white">Create Relationship</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout >
  );
}
