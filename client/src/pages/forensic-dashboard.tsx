import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api-client";
import { useLocation, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardLayout } from "@/components/shared/dashboard-layout";
import { useNotifications } from "@/hooks/use-notifications";
import {
  Users,
  Briefcase,
  TrendingUp,
  MapPin,
  Calendar,
  Shuffle,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Building,
  UserCheck,
  Home,
  Target,
  XCircle,
  Megaphone,
  ClipboardList,
  FileText,
  PieChart,
  Binoculars,
} from "lucide-react";

interface ForensicDashboardProps {
  id?: string; // Event ID passed from wouter parameter
}

interface EventData {
  id: string;
  name: string;
  scheduledAt: string;
  eventDate?: string;
  venue: string;
}

interface AdmissionSubmission {
  id: string;
  createdAt: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  institution: string;
  productOfInterest: string;
}

interface SupportSubmission {
  id: string;
  createdAt: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  institution: string;
  issuesReported: string;
  isDispatched?: boolean;
}

interface Department {
  id: string;
  name: string;
  isActive: boolean;
}

interface CRMUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string | null;
}

export default function ForensicDashboard({ id }: ForensicDashboardProps) {
  const [, setLocation] = useLocation();
  const [match, routeParams] = useRoute("/marketing/events/:id/forensics");
  const eventId = id || routeParams?.id;
  const { toast } = useToast();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();

  // Core Data States
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const userData = localStorage.getItem("marketingUser");
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  });
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [admissions, setAdmissions] = useState<AdmissionSubmission[]>([]);
  const [pendingSupport, setPendingSupport] = useState<SupportSubmission[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<CRMUser[]>([]);
  
  // Staging Assignments State
  const [selectedDepartments, setSelectedDepartments] = useState<Record<string, string>>({});
  const [selectedOfficers, setSelectedOfficers] = useState<Record<string, string>>({});
  
  // Loading & Action States
  const [isLoading, setIsLoading] = useState(true);
  const [isDispatching, setIsDispatching] = useState<Record<string, boolean>>({});
  const [isAutoAssigning, setIsAutoAssigning] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"support" | "admissions">("support");

  const isEventPassed = () => {
    if (!eventData) return false;
    const targetDate = eventData.eventDate || eventData.scheduledAt;
    if (!targetDate) return false;
    try {
      const evDate = new Date(targetDate);
      evDate.setHours(23, 59, 59, 999);
      return evDate < new Date();
    } catch {
      return false;
    }
  };

  const formatEventDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // ─── Fetch Forensic Data ──────────────────────────────────────────────────
  const fetchForensicData = async () => {
    if (!eventId) return;
    try {
      const res = await apiRequest(`/api/marketing/events/${eventId}/forensics`);

      if (!res.ok) {
        throw new Error("Failed to load forensic data");
      }

      const data = await res.json();
      setEventData(data.event);
      setAdmissions(data.admissions);
      setPendingSupport(data.pendingSupport);
      setDepartments(data.departments);
      setUsers(data.users);
    } catch (err: any) {
      toast({
        title: "Load Error",
        description: err.message || "Failed to fetch event details.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem("marketingUser");
    if (!userData) {
      setLocation("/marketing/login");
      return;
    }
    setCurrentUser(JSON.parse(userData));
    if (eventId) {
      fetchForensicData();
    }
  }, [eventId]);

  // ─── Workload Auto-assignment Algorithm ───────────────────────────────────
  const handleAutoAssign = async (submissionId: string) => {
    const deptId = selectedDepartments[submissionId];
    if (!deptId) {
      toast({
        title: "Triage Alert",
        description: "Please select a target department first before auto-assigning.",
        variant: "destructive",
      });
      return;
    }

    setIsAutoAssigning((prev) => ({ ...prev, [submissionId]: true }));
    try {
      const res = await apiRequest(`/api/cases`);

      if (!res.ok) throw new Error("Failed to scan current CRM workload database.");
      const casesData = await res.json();
      const allCases = casesData.cases || [];

      // Get users in the selected department
      const deptOfficers = users.filter((u) => u.departmentId === deptId);
      if (deptOfficers.length === 0) {
        throw new Error("No active CRM officers found inside the chosen department.");
      }

      // Count open/active tickets per officer
      const workloadMap: Record<string, number> = {};
      deptOfficers.forEach((officer) => {
        workloadMap[officer.id] = 0;
      });

      allCases.forEach((c: any) => {
        if (
          c.assignedTo &&
          workloadMap[c.assignedTo] !== undefined &&
          ["open", "pending_acceptance", "in_progress"].includes(c.status)
        ) {
          workloadMap[c.assignedTo]++;
        }
      });

      // Find the officer with the minimum workload
      let optimalOfficerId = deptOfficers[0].id;
      let minCount = workloadMap[optimalOfficerId];

      deptOfficers.forEach((officer) => {
        const count = workloadMap[officer.id];
        if (count < minCount) {
          minCount = count;
          optimalOfficerId = officer.id;
        }
      });

      const chosenOfficer = deptOfficers.find((o) => o.id === optimalOfficerId);
      setSelectedOfficers((prev) => ({ ...prev, [submissionId]: optimalOfficerId }));

      toast({
        title: "Routing Calibrated",
        description: `Auto-assigned to ${chosenOfficer?.firstName} ${chosenOfficer?.lastName} (Queue volume: ${minCount} cases).`,
      });
    } catch (err: any) {
      toast({
        title: "Auto-Assignment Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsAutoAssigning((prev) => ({ ...prev, [submissionId]: false }));
    }
  };

  // ─── Dispatch Support Complaint to Central CRM ───────────────────────────
  const handleDispatch = async (submissionId: string) => {
    const departmentId = selectedDepartments[submissionId];
    const officerId = selectedOfficers[submissionId];

    if (!departmentId || !officerId) {
      toast({
        title: "Dispatch Blocked",
        description: "Please allocate both a Department and an Officer before dispatching.",
        variant: "destructive",
      });
      return;
    }

    setIsDispatching((prev) => ({ ...prev, [submissionId]: true }));
    try {
      const res = await apiRequest("/api/marketing/forensics/dispatch", {
        method: "POST",
        body: JSON.stringify({
          submissionId,
          departmentId,
          officerId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Dispatch failed");
      }

      const response = await res.json();
      toast({
        title: "Support Ticket Dispatched",
        description: `Staged record converted successfully. Ticket ${response.caseNumber} created in central cases.`,
      });

      // Refresh list to filter out the dispatched case
      await fetchForensicData();
    } catch (err: any) {
      toast({
        title: "Dispatch Action Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsDispatching((prev) => ({ ...prev, [submissionId]: false }));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("marketingToken");
    localStorage.removeItem("marketingUser");
    setLocation("/marketing/login");
  };

  const handleExportExcel = async () => {
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      
      // Sheet 1: Admissions Roster
      const admissionsSheet = workbook.addWorksheet("Admissions");
      admissionsSheet.columns = [
        { header: "First Name", key: "firstName", width: 15 },
        { header: "Last Name", key: "lastName", width: 15 },
        { header: "Email Address", key: "email", width: 25 },
        { header: "Phone Number", key: "phone", width: 15 },
        { header: "Institution", key: "institution", width: 25 },
        { header: "Product of Interest", key: "productOfInterest", width: 30 },
        { header: "Registered At", key: "registeredAt", width: 25 }
      ];
      
      admissions.forEach(adm => {
        admissionsSheet.addRow({
          firstName: adm.firstName,
          lastName: adm.lastName,
          email: adm.email || "N/A",
          phone: adm.phone,
          institution: adm.institution || "N/A",
          productOfInterest: adm.productOfInterest,
          registeredAt: new Date(adm.createdAt).toLocaleString()
        });
      });
      
      admissionsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      admissionsSheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF004E98" }
      };

      // Sheet 2: Support Issues Staging
      const issuesSheet = workbook.addWorksheet("Issues");
      issuesSheet.columns = [
        { header: "First Name", key: "firstName", width: 15 },
        { header: "Last Name", key: "lastName", width: 15 },
        { header: "Email Address", key: "email", width: 25 },
        { header: "Phone Number", key: "phone", width: 15 },
        { header: "Institution", key: "institution", width: 25 },
        { header: "Reported Issues / Complaints", key: "issuesReported", width: 45 },
        { header: "Staged At", key: "createdAt", width: 25 }
      ];

      pendingSupport.forEach(issue => {
        issuesSheet.addRow({
          firstName: issue.firstName,
          lastName: issue.lastName,
          email: issue.email || "N/A",
          phone: issue.phone,
          institution: issue.institution || "N/A",
          issuesReported: issue.issuesReported,
          createdAt: new Date(issue.createdAt).toLocaleString()
        });
      });

      issuesSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      issuesSheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF004E98" }
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `${eventData?.name || "Event"}_Desk_Export.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Excel Export Complete",
        description: `Successfully exported ${admissions.length} admissions and ${pendingSupport.length} issues.`,
      });
    } catch (error: any) {
      console.error("Excel generation failed:", error);
      toast({
        title: "Export Failed",
        description: error.message || "An error occurred while generating the Excel spreadsheet.",
        variant: "destructive"
      });
    }
  };

  // Setup Dynamic Breadcrumbs Array
  const breadcrumbs = [
    { label: "Campaigns", onClick: () => setLocation("/marketing/dashboard?tab=campaigns&subtab=events") },
    { label: "Event Desk" },
  ];

  // Setup Sidebar Nav Groups (matching marketing dashboard)
  const navGroups = [
    {
      title: "Core",
      items: [{ id: "overview", label: "Overview", icon: Home }],
    },
    ...(currentUser?.permissions?.includes("marketing.view_assigned") || currentUser?.permissions?.includes("marketing.view_all") || currentUser?.role === "admin" ? [
      {
        title: "Pipeline",
        items: [
          { id: "leads", label: "Leads", icon: Users },
          { id: "prospects", label: "Prospects", icon: Binoculars },
          { id: "expected-orders", label: "Expected Orders", icon: Target },
          { id: "sales-won", label: "Won", icon: TrendingUp },
          { id: "lost-projects", label: "Lost Projects", icon: XCircle },
        ],
      }
    ] : []),
    {
      title: "Engagement",
      items: [
        { id: "activities", label: "My Activities", icon: Calendar },
        ...(currentUser?.permissions?.includes("marketing.view_campaigns") || currentUser?.permissions?.includes("marketing.view_all") || currentUser?.role === "admin" ? [
          { id: "campaigns", label: "Campaigns", icon: Megaphone }
        ] : []),
        ...(currentUser?.permissions?.includes("marketing.view_surveys") || currentUser?.permissions?.includes("marketing.view_all") || currentUser?.role === "admin" ? [
          { id: "surveys", label: "Feedback & Surveys", icon: ClipboardList }
        ] : []),
      ],
    },
    ...((currentUser?.permissions?.includes("marketing.view_all") || currentUser?.role === "admin") ? [
      {
        title: "Management",
        items: [
          { id: "documents", label: "Documents", icon: FileText },
          { id: "sectors", label: "Sectors", icon: PieChart },
          { id: "users", label: "Users", icon: UserCheck },
        ],
      },
    ] : []),
  ];

  return (
    <DashboardLayout
      title="CIC CRM"
      subtitle="FORENSIC DASHBOARD"
      navGroups={navGroups}
      activeTab="campaigns"
      setActiveTab={(tab) => {
        if (tab === "campaigns") {
          setLocation(`/marketing/dashboard?tab=campaigns&subtab=events`);
        } else {
          setLocation(`/marketing/dashboard?tab=${tab}`);
        }
      }}
      user={currentUser}
      onLogout={handleLogout}
      breadcrumbs={breadcrumbs}
      noPadding={true}
      sidebarStorageKey="marketingSidebarCollapsed"
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="h-10 w-10 text-[#004E98] animate-spin mb-4" />
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Loading event desk...</p>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8 animate-in fade-in duration-500">
        
        {/* Compact, Minimalist Page Header */}
        <div className="flex flex-col gap-1 border-b border-gray-100 pb-5">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-[#004E98]" />
            <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">
              {eventData?.name || "Event Desk"}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 font-medium mt-1">
            <span className="font-black text-[#004E98] uppercase tracking-wider bg-blue-50/50 px-2 py-0.5 rounded-md text-[9px] whitespace-nowrap">
              Event Desk
            </span>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-500" />
              <span>{eventData?.venue || "No Location Listed"}</span>
            </div>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              <span>{formatEventDate(eventData?.eventDate || eventData?.scheduledAt) || "No Date Set"}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden claymorphism-card">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Outreach Registrations</p>
                <h3 className="text-3xl font-black text-slate-900">{admissions.length}</h3>
                <p className="text-xs text-slate-400 font-bold">
                  {isEventPassed() ? "Total Admissions (Event Passed)" : "Path A (Admissions Desk)"}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#004E98]">
                <Users className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden claymorphism-card">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Pending Assignments</p>
                <h3 className="text-3xl font-black text-amber-600">{pendingSupport.length}</h3>
                <p className="text-xs text-slate-400 font-bold">
                  {isEventPassed() ? "Unresolved Service Queries" : "Path B (Service Challenges)"}
                </p>
                {isEventPassed() && pendingSupport.length > 0 && (
                  <span className="inline-block text-[9px] font-black uppercase text-red-600 bg-red-50/50 px-1.5 py-0.5 rounded-md mt-1 animate-pulse">
                    Requires Post-Event Resolution
                  </span>
                )}
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                <HelpCircle className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Custom Premium Tab Selector & Control Section */}
        <div className="flex border-b border-gray-100 mb-6 gap-6 pt-2 w-full justify-between items-center flex-wrap">
          <div className="flex gap-6">
            {[
              { id: 'support', label: 'Support Desk Queue', count: pendingSupport.length, icon: HelpCircle },
              { id: 'admissions', label: 'Admissions Staging', count: admissions.length, icon: ClipboardList }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex items-center gap-2 pb-4 border-b-2 font-black uppercase tracking-wider text-[11px] transition-all relative cursor-pointer",
                    isActive 
                      ? "border-[#004E98] text-[#004E98]" 
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-[#004E98]" : "text-gray-400")} />
                  {tab.label}
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-black leading-none ml-1",
                    isActive ? "bg-[#004E98]/10 text-[#004E98]" : "bg-gray-100 text-gray-400"
                  )}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 pb-3">
            <Button
              variant="outline"
              className="h-10 rounded-xl font-bold text-xs uppercase tracking-wide border-slate-200 hover:bg-slate-50 flex items-center gap-1.5"
              onClick={handleExportExcel}
              disabled={isLoading || (admissions.length === 0 && pendingSupport.length === 0)}
            >
              <FileText className="h-4 w-4 text-[#004E98]" />
              Export Excel
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-xl font-bold text-xs uppercase tracking-wide border-slate-200 hover:bg-slate-50"
              onClick={fetchForensicData}
            >
              Sync Submissions
            </Button>
          </div>
        </div>

        {/* Path B: Support Desk Hub */}
        {activeTab === "support" && (
          <div className="animate-in fade-in duration-300">
            {pendingSupport.length === 0 ? (
              <Card className="rounded-[2.5rem] border-dashed border-slate-200 shadow-none py-16 text-center">
                <CardContent className="space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Queue Clear</h3>
                    <p className="text-slate-400 text-sm max-w-sm mx-auto font-medium">
                      No pending event support desk tickets staged for assignment. All records have been successfully triaged.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="p-6 border-b bg-gray-50/20">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-[#004E98]">
                    Staged Outreach Complaints
                  </CardTitle>
                  <CardDescription>
                    Assign a target department and officer to register the complaint directly in the central CRM cases workflow.
                  </CardDescription>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead className="font-black text-xs uppercase tracking-wider text-slate-500 py-4 pl-6">Stakeholder</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-wider text-slate-500 py-4">Contact Info</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-wider text-slate-500 py-4 max-w-[300px]">Reported Issue</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-wider text-slate-500 py-4 min-w-[200px]">Target Department</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-wider text-slate-500 py-4 min-w-[200px]">CRM Officer</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-wider text-slate-500 py-4 pr-6 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingSupport.map((sub) => {
                        const name = `${sub.firstName} ${sub.lastName}`.trim() || "Outreach Attendee";
                        const selectedDept = selectedDepartments[sub.id];
                        const deptOfficers = users.filter((u) => u.departmentId === selectedDept);

                        return (
                          <TableRow key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell className="py-5 pl-6 font-bold text-slate-800">
                              <div className="space-y-0.5">
                                <p className="text-sm">{name}</p>
                                <p className="text-xs text-slate-400 font-medium">{sub.institution || "No Institution"}</p>
                              </div>
                            </TableCell>
                            <TableCell className="py-5 text-sm text-slate-600">
                              <div className="space-y-0.5">
                                <p className="font-bold flex items-center gap-1.5">
                                  <span className="text-slate-400">P:</span> {sub.phone}
                                </p>
                                <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                                  <span className="text-slate-400">E:</span> {sub.email || "No Email"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="py-5 max-w-[300px]">
                              <p className="text-sm text-slate-600 italic font-medium leading-relaxed">
                                "{sub.issuesReported}"
                              </p>
                            </TableCell>
                            <TableCell className="py-5">
                              <Select
                                value={selectedDept || ""}
                                onValueChange={(val) => {
                                  setSelectedDepartments((prev) => ({ ...prev, [sub.id]: val }));
                                  setSelectedOfficers((prev) => ({ ...prev, [sub.id]: "" }));
                                }}
                              >
                                <SelectTrigger className="h-10 rounded-xl border-slate-200">
                                  <SelectValue placeholder="Assign Dept..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-100 shadow-2xl">
                                  {departments.map((d) => (
                                    <SelectItem key={d.id} value={d.id}>
                                      {d.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="py-5">
                              <div className="flex items-center gap-2">
                                <Select
                                  value={selectedOfficers[sub.id] || ""}
                                  onValueChange={(val) =>
                                    setSelectedOfficers((prev) => ({ ...prev, [sub.id]: val }))
                                  }
                                  disabled={!selectedDept}
                                >
                                  <SelectTrigger className="h-10 rounded-xl border-slate-200 flex-1">
                                    <SelectValue placeholder={selectedDept ? "Select User..." : "Select Dept First"} />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl border-slate-100 shadow-2xl">
                                    {deptOfficers.map((o) => (
                                      <SelectItem key={o.id} value={o.id}>
                                        {o.firstName} {o.lastName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-10 w-10 p-0 rounded-xl bg-slate-50 hover:bg-[#004E98]/10 hover:text-[#004E98] text-slate-400 border border-slate-200"
                                  onClick={() => handleAutoAssign(sub.id)}
                                  disabled={!selectedDept || isAutoAssigning[sub.id]}
                                  title="Auto-Assign based on Queue Volume"
                                >
                                  {isAutoAssigning[sub.id] ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-[#004E98]" />
                                  ) : (
                                    <Shuffle className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="py-5 pr-6 text-right">
                              <Button
                                className="h-10 rounded-xl px-5 font-black uppercase text-xs tracking-wider bg-[#004E98] hover:bg-[#003B73] text-white shadow-sm flex items-center gap-2 ml-auto"
                                onClick={() => handleDispatch(sub.id)}
                                disabled={isDispatching[sub.id]}
                              >
                                {isDispatching[sub.id] ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                                Dispatch
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Path A: Admissions Desk Hub */}
        {activeTab === "admissions" && (
          <div className="animate-in fade-in duration-300">
            {admissions.length === 0 ? (
              <Card className="rounded-[2.5rem] border-dashed border-slate-200 shadow-none py-16 text-center">
                <CardContent className="space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <Users className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">No Submissions</h3>
                    <p className="text-slate-400 text-sm max-w-sm mx-auto font-medium">
                      No outreach admission registrations have been logged yet for this physical outreach event campaign.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="p-6 border-b bg-gray-50/20">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-[#004E98]">
                    Registrant Roster
                  </CardTitle>
                  <CardDescription>
                    All registered stakeholders who completed Path A registration at the outreach event.
                  </CardDescription>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead className="font-black text-xs uppercase tracking-wider text-slate-500 py-4 pl-6">Stakeholder</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-wider text-slate-500 py-4">Contact Info</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-wider text-slate-500 py-4">Institution</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-wider text-slate-500 py-4">Product of Interest</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-wider text-slate-500 py-4 pr-6 text-right">Registered At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {admissions.map((sub) => {
                        const name = `${sub.firstName} ${sub.lastName}`.trim() || "Outreach Attendee";
                        return (
                          <TableRow key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell className="py-5 pl-6 font-bold text-slate-800 text-sm">
                              {name}
                            </TableCell>
                            <TableCell className="py-5 text-sm text-slate-600">
                              <div className="space-y-0.5">
                                <p className="font-bold">{sub.phone}</p>
                                <p className="text-xs text-slate-400 font-medium">{sub.email || "No Email Address"}</p>
                              </div>
                            </TableCell>
                            <TableCell className="py-5 text-sm text-slate-600 font-bold">
                              {sub.institution || "Outreach Prospect"}
                            </TableCell>
                            <TableCell className="py-5">
                              <Badge className="rounded-lg bg-blue-50 text-[#004E98] hover:bg-blue-50 border-none font-bold uppercase text-[10px] tracking-wider px-3 py-1">
                                {sub.productOfInterest}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-5 pr-6 text-right text-xs font-bold text-slate-400">
                              {new Date(sub.createdAt).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    )}

    </DashboardLayout>
  );
}
