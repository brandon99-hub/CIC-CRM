import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { LayoutDashboard, FolderOpen, BookOpen, Clock, MessageSquare, Terminal, Filter, Calendar } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { DashboardLayout } from "@/components/shared/dashboard-layout";
import { NavGroup } from "@/components/shared/dashboard-sidebar";
import { CaseWorkspaceContent } from "./cases/case-workspace";

// Tab Containers
import { CaseOverviewTab } from "@/components/cases/case-overview-tab";
import { CaseListTab } from "@/components/cases/case-list-tab";
import { KnowledgeBaseTab } from "@/components/cases/knowledge-base-tab";
import { SlaMonitor } from "@/components/cases/sla-monitor";
import { SimulationTab } from "@/components/cases/simulation-tab";
import { TriageTab } from "@/components/cases/triage-tab";
import { CollaborationContent } from "@/components/cases/collaboration-content";
import { IntakeStation } from "@/components/cases/intake-station";
import { MyShiftsTab } from "@/components/cases/my-shifts-tab";

export default function CaseDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // 1. URL State Sync
  const [activeTab, setActiveTab] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get("tab") || "overview";
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setViewingWorkspaceId(null);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    setLocation(`${window.location.pathname}?${params.toString()}`);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
      setViewingWorkspaceId(null);
    }
  }, [window.location.search, activeTab]);

  // 2. Global State (User & Workspace)
  const [user, setUser] = useState<any>(null);
  const [viewingWorkspaceId, setViewingWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem("marketingUser");
    if (userData) setUser(JSON.parse(userData));
  }, []);

  const { data: userPerms } = useQuery<{ permissions: string[] }>({
    queryKey: ["auth", "permissions"],
    queryFn: async () => {
      const res = await apiRequest("/api/auth/permissions");
      return res.json();
    }
  });

  // 3. Actions
  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    queryClient.clear();
    window.location.href = "/marketing/login";
  };

  const triggerSimulationScenario = async (scenario: string) => {
    const res = await apiRequest("/api/simulation/scenario", { method: "POST", body: JSON.stringify({ scenario }) });
    if (!res.ok) throw new Error("Failed to trigger");
  };

  const simulateSignal = async (signal: any) => {
    const res = await apiRequest("/api/simulation/signal", { method: "POST", body: JSON.stringify(signal) });
    if (!res.ok) throw new Error("Failed to simulate");
  };

  // 4. Configs
  const isManager = user?.role?.toLowerCase() === "manager" || user?.role?.toLowerCase() === "admin";

    const navGroups: NavGroup[] = [
    {
      title: "Workplace",
      items: [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        { id: "cases", label: "All Cases", icon: FolderOpen },
        { id: "collaboration", label: "Discussions", icon: MessageSquare },
        { id: "myshifts", label: "My Shifts", icon: Calendar },
      ],
    },
    {
      title: "Strategic Intelligence",
      items: [
        { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
        ...(isManager ? [{ id: "triage", label: "Triage", icon: Filter }] : []),
      ],
    },
    {
      title: "Governance",
      items: [
        { id: "sla", label: "SLA Monitor", icon: Clock },
      ],
    },
    ...(user?.role === "admin" ? [
      {
        title: "System Lab",
        items: [
          { id: "simulate", label: "Simulate Scenarios", icon: Terminal },
        ],
      }
    ] : []),
  ];

  const tabDescriptions: Record<string, string> = {
    overview: "Service desk performance and case statistics",
    cases: "Manage and resolve customer support cases",
    knowledge: "Knowledge base articles and FAQs",
    sla: "Monitor Service Level Agreement compliance",
    simulate: "Test intake and assignment scenarios",
    triage: "Review and assign incoming cases",
    myshifts: "View and manage your upcoming shifts",
  };

  // 5. Render
  const breadcrumbs = viewingWorkspaceId ? [
    { label: "All Cases", icon: FolderOpen, onClick: () => setViewingWorkspaceId(null) },
    { label: "Case Workspace" }
  ] : (activeTab === "cases" ? [{ label: "All Cases", icon: FolderOpen }] : undefined);

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return <CaseOverviewTab user={user} onViewWorkspace={setViewingWorkspaceId} userPerms={userPerms} />;
      case "cases":
        return <CaseListTab userPerms={userPerms} onViewWorkspace={setViewingWorkspaceId} onNewCaseOpen={() => handleTabChange("intake")} />;
      case "knowledge":
        return <KnowledgeBaseTab user={user} permissions={userPerms?.permissions || []} />;
      case "sla":
        return <SlaMonitor onCaseClick={(id) => setViewingWorkspaceId(id)} currentUserId={user?.id} />;
      case "collaboration":
        return <CollaborationContent user={user} onViewWorkspace={setViewingWorkspaceId} />;
      case "intake":
        return <IntakeStation onBack={() => handleTabChange("cases")} onCaseCreated={() => handleTabChange("cases")} />;
      case "simulate":
        return <SimulationTab onTriggerScenario={triggerSimulationScenario} onSimulateSignal={simulateSignal} />;
      case "triage":
        return isManager ? <TriageTab onRefreshCases={() => { }} /> : null;
      case "myshifts":
        return <MyShiftsTab user={user} />;
      default:
        return null;
    }
  };

  const finalContent = () => {
    if (viewingWorkspaceId) {
      return (
        <CaseWorkspaceContent
          id={viewingWorkspaceId}
          onBack={() => setViewingWorkspaceId(null)}
          user={user}
        />
      );
    }
    return renderContent();
  };

  return (
    <DashboardLayout
      title="CIC CRM"
      subtitle="CASE MANAGEMENT"
      navGroups={navGroups}
      activeTab={activeTab}
      setActiveTab={handleTabChange}
      user={user}
      onLogout={handleLogout}
      tabDescriptions={tabDescriptions}
      sidebarStorageKey="caseSidebarCollapsed"
      breadcrumbs={breadcrumbs}
    >
      {finalContent()}
    </DashboardLayout>
  );
}