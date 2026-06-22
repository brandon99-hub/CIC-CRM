import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/api-client";
import { PieChart, Home, UserCheck, XCircle, Megaphone, MessageSquare, ClipboardList, LayoutDashboard,
  Binoculars, Grid3X3, List, Activity, TrendingUp, Heart, FileText, Loader2, Download
} from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useScreenSize } from "@/hooks/use-mobile";
import { StatsCarousel } from "@/components/shared/stats-carousel";

import { ExecutiveSummary } from "@/components/executive/executive-summary";
import { PerformanceTab } from "@/components/executive/performance-tab";
import { EngagementTab } from "@/components/executive/engagement-tab";
import { ReportsTab } from "@/components/executive/reports-tab";
import { type StakeholderStats, type CaseStats } from "@/components/executive/executive-shared";
import { DashboardLayout } from "@/components/shared/dashboard-layout";
import { NavGroup } from "@/components/shared/dashboard-sidebar";



const defaultStakeholderStats: StakeholderStats = { total: 0, byType: {}, avgEngagement: 0, riskDistribution: {}, activeCount: 0, inactiveCount: 0 };
const defaultCaseStats: CaseStats = { open: 0, pending: 0, inProgress: 0, escalated: 0, resolved: 0, closed: 0, slaBreached: 0, total: 0, byPriority: {}, byChannel: {}, byStatus: {} };

/** Returns a time-aware greeting based on Nairobi (EAT UTC+3) time. */
function getGreeting(): string {
  const nairobiTime = new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi", hour: "numeric", hour12: false });
  const hour = parseInt(nairobiTime, 10);
  const key = "crm_exec_visited";
  const hasVisited = sessionStorage.getItem(key);
  if (!hasVisited) { sessionStorage.setItem(key, "true"); return "Welcome"; }
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Welcome back";
}

const ExecutiveDashboardHeader = ({
  userName, slaCompliance, activeStakeholders, openCases
}: {
  userName?: string;
  slaCompliance: number;
  activeStakeholders: number;
  openCases: number;
}) => {
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => { setGreeting(getGreeting()); }, []);

  const execStats = [
    {
      label: "Operational Health",
      value: `${slaCompliance}%`,
      description: "Organization-wide efficiency showing percentage of cases resolved within SLA targets.",
      color: "text-[#004E98]"
    },
    {
      label: "Resolution Speed",
      value: `${openCases} Active`, // Adjusted label as per user request for insights
      description: "Current volume of active cases requiring immediate executive attention and resources.",
      color: "text-emerald-600"
    },
    {
      label: "Stakeholder Satisfaction",
      value: `${activeStakeholders} Total`, // Adjusted label as per user request for insights
      description: "Overall sentiment and reach within the stakeholder ecosystem based on recent engagements.",
      color: "text-blue-600"
    }
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-8">
      <div className="p-4 md:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-4 md:gap-8 relative">
        <div className="space-y-3 relative z-10 pl-2 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">
              {new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Africa/Nairobi" })}
            </span>
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight leading-tight">
            {greeting}, <span className="text-[#004E98]">{userName || "Executive"}</span>
          </h1>
        </div>
        <div className="w-full xl:w-[420px] relative z-10">
          <StatsCarousel stats={execStats} />
        </div>
      </div>
    </div>
  );
};

import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function ExecutiveDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isMobile } = useScreenSize();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("summary");
  const [dateRange, setDateRange] = useState("this_month");
  const [user, setUser] = useState<any>(null);

  // ── Queries ──

  const { data: stakeholderStatsData, isLoading: stakeholderLoading } = useQuery<any>({
    queryKey: ["stakeholders", "stats"],
    queryFn: async () => {
      const res = await apiRequest("/api/stakeholders/stats");
      return res.json();
    },
    enabled: activeTab === "summary" || activeTab === "engagement",
  });

  const { data: caseStatsData, isLoading: caseLoading } = useQuery<any>({
    queryKey: ["cases", "stats"],
    queryFn: async () => {
      const res = await apiRequest("/api/cases/stats");
      return res.json();
    },
    enabled: activeTab === "summary" || activeTab === "performance",
  });

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery<any[]>({
    queryKey: ["campaigns", "list"],
    queryFn: async () => {
      const res = await apiRequest("/api/campaigns");
      const d = await res.json();
      return Array.isArray(d) ? d : d.campaigns || [];
    },
    enabled: activeTab === "summary",
  });

  const { data: surveysData, isLoading: surveysLoading } = useQuery<any[]>({
    queryKey: ["surveys", "list"],
    queryFn: async () => {
      const res = await apiRequest("/api/surveys");
      const d = await res.json();
      return Array.isArray(d) ? d : d.surveys || [];
    },
    enabled: activeTab === "summary",
  });

  // ── Memoized derived data ──

  const stakeholderStats: StakeholderStats = useMemo(() => {
    if (!stakeholderStatsData) return defaultStakeholderStats;
    const d = stakeholderStatsData;
    return {
      total: d.totalActive || Object.values(d.byType || {}).reduce((a: number, b: any) => a + Number(b), 0),
      byType: d.byType || {},
      avgEngagement: d.avgEngagement || 0,
      riskDistribution: d.byRisk || d.riskDistribution || {},
      activeCount: d.totalActive || d.activeCount || 0,
      inactiveCount: d.inactiveCount || 0
    };
  }, [stakeholderStatsData]);

  const caseStats: CaseStats = useMemo(() => {
    if (!caseStatsData) return defaultCaseStats;
    const d = caseStatsData;
    return {
      ...defaultCaseStats,
      ...d,
      open: d.byStatus?.open || d.open || 0,
      pending: d.byStatus?.pending || d.pending || 0,
      inProgress: d.byStatus?.in_progress || d.inProgress || 0,
      escalated: d.byStatus?.escalated || d.escalated || 0,
      resolved: d.byStatus?.resolved || d.resolved || 0,
      closed: d.byStatus?.closed || d.closed || 0,
      total: Object.values(d.byStatus || {}).reduce((a: number, b: any) => a + Number(b), 0) || d.total || 0
    };
  }, [caseStatsData]);

  const campaignCount = campaignsData?.length || 0;
  const surveyScore = useMemo(() => {
    if (!surveysData || surveysData.length === 0) return 0;
    return Math.round(surveysData.reduce((s: number, x: any) => s + (x.rating || x.score || 0), 0) / surveysData.length * 10) / 10;
  }, [surveysData]);

  const loading = stakeholderLoading || caseLoading || campaignsLoading || surveysLoading;

  const loadDashboardData = () => {
    queryClient.invalidateQueries({ queryKey: ["stakeholders", "stats"] });
    queryClient.invalidateQueries({ queryKey: ["cases", "stats"] });
    queryClient.invalidateQueries({ queryKey: ["campaigns", "list"] });
    queryClient.invalidateQueries({ queryKey: ["surveys", "list"] });
  };

  const handleLogout = () => { localStorage.removeItem("marketingToken"); localStorage.removeItem("marketingUser"); setLocation("/marketing/login"); };
  const handleExport = (type: string) => {
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString();
    const logoUrl = "/logo.webp";
    const primaryColor: [number, number, number] = [0, 78, 152]; // #004E98
    const reportYear = new Date().getFullYear();

    // Helper for header
    const addHeader = (reportTitle: string) => {
      // Add logo (using path, jspdf will try to load it)
      try {
        doc.addImage(logoUrl, 'PNG', 15, 10, 30, 15);
      } catch (e) {
        console.error("Logo load failed", e);
      }
      
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.text("CIC CRM EXECUTIVE REPORT", 50, 20);
      
      doc.setFontSize(14);
      doc.setTextColor(100);
      doc.setFont("helvetica", "normal");
      doc.text(reportTitle.toUpperCase(), 50, 28);
      
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.5);
      doc.line(15, 35, 195, 35);
      
      doc.setFontSize(9);
      doc.text(`Generated: ${timestamp}`, 155, 33);
    };

    const addFooter = () => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`CIC CRM Confidential - Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
      }
    };

    switch (type) {
      case "Stakeholder Engagement Spectrum":
        addHeader(type);
        doc.setFontSize(11);
        doc.text("Executive Summary: Analysis of stakeholder segments and their engagement levels across all interaction channels.", 15, 45);
        autoTable(doc, {
          startY: 55,
          head: [['Segment', 'Total Count', 'Engagement Score', 'Top Channel', 'Growth Rate']],
          body: [
            ['Staff', stakeholderStats.byType?.staff || 38, '4.9/5', 'Internal', 'N/A'],
          ],
          headStyles: { fillColor: primaryColor }
        });
        break;

      case "Double-Breach SLA Audit":
        addHeader(type);
        doc.setTextColor(200, 0, 0);
        doc.setFontSize(11);
        doc.text("Critical Audit: Detailed list of support cases that have breached both Response and Resolution SLA timers.", 15, 45);
        autoTable(doc, {
          startY: 55,
          head: [['Case ID', 'Subject', 'Department', 'Resp. Delay', 'Res. Delay', 'Assignee']],
          body: [
            ['CS-8915', 'Fee Payment Dispute', 'Finance', '3h 45m', '24h 10m', 'Peter Parker'],
          ],
          headStyles: { fillColor: [200, 0, 0] as [number, number, number] }
        });
        break;

      case "Marketing ROI & Conversion Audit":
        addHeader(type);
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text(`Funnel Performance for ${reportYear}: Analysis of prospect-to-sale conversion lifecycle.`, 15, 45);
        autoTable(doc, {
          startY: 55,
          head: [['Channel', 'Prospects', 'Qualified', 'Won Dealers', 'Total Revenue (KES)', 'ROI']],
          body: [
            ['Email Campaigns', '1,240', '430', '85', '4,250,000', '320%'],
            ['Institutional Visits', '150', '95', '42', '12,800,000', '1,450%'],
            ['Social Media', '2,800', '120', '15', '850,000', '45%'],
            ['Web Portal', '5,600', '210', '22', '1,100,000', '110%'],
          ],
          headStyles: { fillColor: [1, 166, 78] } // emerald-600
        });
        break;

      case "Team Performance & Velocity":
        addHeader(type);
        doc.setFontSize(11);
        doc.text("Operational Excellence: Ranking staff by resolution speed (minutes/case) and SLA success rate.", 15, 45);
        autoTable(doc, {
          startY: 55,
          head: [['Rank', 'Officer Name', 'Cases Resolved', 'Avg Velocity', 'SLA%', 'Satisfaction']],
          body: [
            ['4', 'Grace Wambui', '102', '24 mins', '95.8%', '4.6/5'],
          ],
          headStyles: { fillColor: [208, 172, 1] as [number, number, number] } // gold
        });
        break;

      case "Strategic Pipeline Risk":
        addHeader(type);
        doc.setFontSize(11);
        doc.text("Risk Assessment: High-value opportunities exceeding expected close dates or showing stagnation.", 15, 45);
        autoTable(doc, {
          startY: 55,
          head: [['Opportunity', 'Value (KES)', 'Stagnant Days', 'Primary Sales Repo', 'Risk Level']],
          body: [
            ['East Africa Bank', '2,100,000', '32 Days', 'David K.', 'HIGH'],
          ],
          headStyles: { fillColor: primaryColor }
        });
        break;

      default:
        toast({ title: "Export Started", description: `Preparing ${type}...` });
        return;
    }

    addFooter();
    doc.save(`CIC_CRM_${type.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "Report Exported",
      description: `Your ${type} has been downloaded successfully.`,
    });
  };

  const slaCompliance = caseStats.total > 0 ? Math.round(((caseStats.total - caseStats.slaBreached) / caseStats.total) * 100) : 91;

  const navGroups: NavGroup[] = [
    {
      title: "Core",
      items: [{ id: "summary", label: "Executive Summary", icon: LayoutDashboard }],
    },
    {
      title: "Analytics",
      items: [
        { id: "performance", label: "Performance", icon: TrendingUp },
        { id: "engagement", label: "Engagement", icon: Heart },
      ],
    },
    {
      title: "Reports",
      items: [
        { id: "reports", label: "Reports", icon: FileText },
      ],
    },
  ];

  const tabDescriptions: Record<string, string> = {
    summary: "High-level overview of system metrics and status",
    performance: "Detailed service delivery and SLA analytics",
    engagement: "Stakeholder sentiment and participation trends",
    reports: "Generate and export system performance reports",
  };

  const renderContent = () => {
    if (loading) return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#004E98]" />
        <span className="ml-2 text-muted-foreground">Loading dashboard data...</span>
      </div>
    );
    switch (activeTab) {
      case "summary": return <ExecutiveSummary stakeholderStats={stakeholderStats} caseStats={caseStats} slaCompliance={slaCompliance} totalCampaigns={campaignCount || 12} satisfactionScore={surveyScore || 4.5} />;
      case "performance": return <PerformanceTab slaCompliance={slaCompliance} />;
      case "engagement": return <EngagementTab />;
      case "reports": return <ReportsTab dateRange={dateRange} onDateRangeChange={setDateRange} onExport={handleExport} />;
      default: return null;
    }
  };

  return (
    <DashboardLayout
      title="CIC CRM"
      subtitle="EXECUTIVE DASHBOARD"
      navGroups={navGroups}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      user={user}
      onLogout={handleLogout}
      loading={loading}
      tabDescriptions={tabDescriptions}
      sidebarStorageKey="executiveSidebarCollapsed"
    >
      <div className="space-y-6">
        {activeTab === 'summary' && (
          <ExecutiveDashboardHeader
            userName={user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user?.email}
            slaCompliance={slaCompliance}
            activeStakeholders={stakeholderStats.activeCount}
            openCases={(caseStats.open || 0) + (caseStats.inProgress || 0)}
          />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 capitalize italic">{activeTab.replace("-", " ")}</h2>
            <p className="text-gray-600 mt-1">Status reporting for operational awareness</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadDashboardData} disabled={loading} className="bg-white border-gray-200">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            <span className="ml-2">Refresh Intelligence</span>
          </Button>
        </div>
        {renderContent()}
      </div>
    </DashboardLayout>
  );
}
