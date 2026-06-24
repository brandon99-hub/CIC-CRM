import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Briefcase,
  Shield,
  LogOut,
  TrendingUp,
  ArrowRight,
  BarChart3,
  Sparkles,
  LayoutDashboard,
  Star,
  MessageSquare
} from "lucide-react";
import { DashboardNavbar } from "@/components/shared/dashboard-navbar";
import { useNotifications } from "@/hooks/use-notifications";
import { useTranslation } from "react-i18next";

interface DashboardOption {
  id: string;
  label: string;
  description: string;
  icon: any;
  path: string;
  color: string;
  bgColor: string;
}

const GET_ALL_DASHBOARDS = (t: any): DashboardOption[] => [
  {
    id: "cases",
    label: t("cases.title", "Case Management & SLA"),
    description: t("cases.desc", "Multi-channel tracking, SLA monitoring, and escalations"),
    icon: Briefcase,
    path: "/cases/dashboard",
    color: "#F59E0B",
    bgColor: "bg-amber-50",
  },
  {
    id: "marketing",
    label: t("marketing.title", "Sales & Marketing"),
    description: t("marketing.desc", "Sales pipeline, campaigns, surveys, and sector analytics"),
    icon: TrendingUp,
    path: "/marketing/dashboard",
    color: "#004E98",
    bgColor: "bg-blue-50",
  },
  {
    id: "communications",
    label: t("communications.title", "Communications Hub"),
    description: t("communications.desc", "Manage omnichannel conversations, social publishing, and Avaya voice integrations"),
    icon: MessageSquare,
    path: "/communications/dashboard",
    color: "#0284C7",
    bgColor: "bg-sky-50",
  },
  {
    id: "stakeholders",
    label: t("stakeholders_dash.title", "Stakeholder Intelligence"),
    description: t("stakeholders_dash.desc", "360° stakeholder profiles, scoring, and relationship mapping"),
    icon: Users,
    path: "/stakeholders/dashboard",
    color: "#10B981",
    bgColor: "bg-emerald-50",
  },
  {
    id: "executive",
    label: t("executive.title", "Executive Dashboard"),
    description: t("executive.desc", "KPI analytics, performance metrics, and trend reports"),
    icon: BarChart3,
    path: "/executive/dashboard",
    color: "#8B5CF6",
    bgColor: "bg-violet-50",
  },
  {
    id: "admin",
    label: t("admin.title", "System Administration"),
    description: t("admin.desc", "RBAC, SLA rules, escalation chains, and audit logs"),
    icon: Shield,
    path: "/admin/dashboard",
    color: "#EF4444",
    bgColor: "bg-red-50",
  },
];

export default function DashboardHub() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [accessibleDashboards, setAccessibleDashboards] = useState<DashboardOption[]>([]);
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const { t } = useTranslation();

  useEffect(() => {
    const userData = localStorage.getItem("marketingUser");
    if (!userData) {
      setLocation("/marketing/login");
      return;
    }
    try {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      let access: string[] = parsed.dashboardAccess
        ? (typeof parsed.dashboardAccess === "string"
          ? JSON.parse(parsed.dashboardAccess)
          : parsed.dashboardAccess)
        : [];

      // Temporarily ensure anyone with marketing access can see communications
      if (access.includes("marketing") && !access.includes("communications")) {
        access.push("communications");
      }

      const allDashboards = GET_ALL_DASHBOARDS(t);
      const filtered = allDashboards.filter((d) => access.includes(d.id));
      setAccessibleDashboards(filtered);

      // Auto-redirect if only one dashboard is accessible
      if (filtered.length === 1) {
        setLocation(filtered[0].path);
      }
    } catch {
      setLocation("/marketing/login");
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("marketingUser");
    setLocation("/marketing/login");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#FDFDFF] relative overflow-hidden">
      
      <DashboardNavbar
        activeTab="hub"
        tabLabel="Portal Hub"
        tabIcon={Shield}
        user={user}
        onLogout={handleLogout}
        onToggleMobileMenu={() => { }}
        isMobileMenuOpen={false}
        notifications={notifications}
        onNotificationRead={markAsRead}
        onReadAllNotifications={markAllAsRead}
        hubVisible={accessibleDashboards.length > 1}
        isHub={true}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col items-center relative z-10">
        <div className="text-center mb-10 space-y-2 animate-in fade-in slide-in-from-top-4 duration-1000">
          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-none">
            {t("dashboard.welcome", "Welcome,")} <br />
            <span className="bg-gradient-to-r from-[#004E98] to-[#1e3a8a] bg-clip-text text-transparent">
              {user.firstName} {user.lastName}
            </span>
          </h1>
          
          <p className="max-w-lg mx-auto text-slate-400 font-medium text-sm tracking-wide pt-4">
            {t("dashboard.select_workspace", "Select a workspace to manage the CRM ecosystem.")}
          </p>
        </div>

        {accessibleDashboards.length === 0 ? (
          <div className="text-center py-20 bg-white/50 backdrop-blur-xl rounded-[3rem] border border-slate-100 shadow-xl w-full max-w-2xl">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">{t("dashboard.restricted", "Access Restricted")}</h3>
            <p className="text-slate-500 font-medium px-10">
              {t("dashboard.restricted_msg", "Your account has not been provisioned with dashboard permissions yet. Please contact your system administrator to assign roles.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-6xl mx-auto px-0 justify-items-center">
            {accessibleDashboards.map((dashboard, index) => {
              const Icon = dashboard.icon;
              return (
                <div 
                  key={dashboard.id}
                  className="animate-in fade-in slide-in-from-bottom-8 duration-700" 
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <Card
                    className="group cursor-pointer relative h-full min-h-[300px] overflow-hidden border-none claymorphism-card rounded-[3rem]"
                    onClick={() => setLocation(dashboard.path)}
                  >
                    {/* Abstract Background Decor */}
                    <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 bg-gradient-to-br from-white/20 to-transparent rounded-full rotate-45 transition-transform duration-700 group-hover:scale-150" />
                    <div 
                      className="absolute bottom-0 right-0 w-48 h-48 -br-12 -bb-12 rounded-full opacity-0 group-hover:opacity-10 blur-3xl transition-opacity duration-700"
                      style={{ backgroundColor: dashboard.color }}
                    />

                    <CardContent className="p-4 sm:p-6 md:p-8 h-full flex flex-col justify-between relative z-10">
                      <div className="space-y-8">
                        {/* Icon Container with multi-layered glow */}
                        <div className="relative w-16 h-16">
                          <div 
                            className="absolute inset-0 rounded-2xl blur-xl opacity-20 transition-all duration-500 group-hover:opacity-40"
                            style={{ backgroundColor: dashboard.color }}
                          />
                          <div
                            className="relative w-14 h-14 rounded-2xl flex items-center justify-center bg-white claymorphism-inner-shadow transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3"
                            style={{ color: dashboard.color }}
                          >
                            <Icon className="h-7 w-7 stroke-[2.2]" />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-xl font-black text-slate-900 leading-tight tracking-tight group-hover:text-[#004E98] transition-colors">
                            {dashboard.label}
                          </h3>
                          <p className="text-sm text-slate-500 leading-relaxed font-medium">
                            {dashboard.description}
                          </p>
                        </div>
                      </div>

                      <div className="pt-8 space-y-4">
                         <div className="h-1 w-8 bg-slate-100 rounded-full group-hover:w-full group-hover:bg-[#004E98]/20 transition-all duration-700" />
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-[#004E98] transition-colors">
                              {t("dashboard.enter_workspace", "Enter Workspace")}
                            </span>
                            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-[#004E98] group-hover:text-white transition-all duration-500 group-hover:scale-110">
                              <ArrowRight className="h-5 w-5 stroke-[2.5]" />
                            </div>
                         </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="mt-auto py-12 px-6 border-t border-slate-100 bg-white/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#004E98] rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/10">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-black text-slate-900 uppercase tracking-tighter">CIC <span className="text-blue-600">CRM</span></span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            &copy; {new Date().getFullYear()} CIC Insurance Group. Optimized for high-performance administrative workflows.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-xs font-black text-slate-400 hover:text-[#004E98] transition-colors uppercase tracking-widest">Help Center</a>
            <a href="#" className="text-xs font-black text-slate-400 hover:text-[#004E98] transition-colors uppercase tracking-widest">SLA Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
