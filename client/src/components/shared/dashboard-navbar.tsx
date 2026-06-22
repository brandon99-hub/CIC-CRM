import { useState, useRef, useEffect } from "react";
import {
    ChevronRight,
    ChevronDown,
    LogOut,
    LayoutDashboard,
    Menu,
    X,
    LucideIcon,
    Bell,
    User,
    Check,
    Briefcase,
    TrendingUp,
    MessageSquare,
    Users,
    BarChart3,
    Shield,
    Grid,
    Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useRegion, type Region } from "@/lib/RegionContext";

const GET_ALL_DASHBOARDS = (t: any) => [
  { id: "cases", label: t("cases.title", "Case Management & SLA"), icon: Briefcase, path: "/cases/dashboard", color: "#F59E0B", bgColor: "bg-amber-50" },
  { id: "marketing", label: t("marketing.title", "Marketing & Engagement"), icon: TrendingUp, path: "/marketing/dashboard", color: "#004E98", bgColor: "bg-blue-50" },
  { id: "communications", label: t("communications.title", "Communications Hub"), icon: MessageSquare, path: "/communications/dashboard", color: "#0284C7", bgColor: "bg-sky-50" },
  { id: "stakeholders", label: t("stakeholders_dash.title", "Stakeholder Intelligence"), icon: Users, path: "/stakeholders/dashboard", color: "#10B981", bgColor: "bg-emerald-50" },
  { id: "executive", label: t("executive.title", "Executive Dashboard"), icon: BarChart3, path: "/executive/dashboard", color: "#8B5CF6", bgColor: "bg-violet-50" },
  { id: "admin", label: t("admin.title", "System Administration"), icon: Shield, path: "/admin/dashboard", color: "#EF4444", bgColor: "bg-red-50" },
];

interface User {
    firstName?: string;
    lastName?: string;
    email: string;
    role?: string;
}

interface DashboardNavbarProps {
    activeTab: string;
    tabLabel?: string;
    tabIcon?: LucideIcon;
    user: User | null;
    onLogout: () => void;
    onToggleMobileMenu: () => void;
    isMobileMenuOpen: boolean;
    breadcrumbs?: Array<{ label: string; icon?: LucideIcon; onClick?: () => void }>;
    notifications?: any[];
    onNotificationRead?: (id: string) => void;
    onReadAllNotifications?: () => void;
    hubVisible?: boolean;
    isHub?: boolean;
}

export function DashboardNavbar({
    activeTab,
    tabLabel,
    tabIcon: TabIcon,
    user,
    onLogout,
    onToggleMobileMenu,
    isMobileMenuOpen,
    breadcrumbs,
    notifications = [],
    onNotificationRead,
    onReadAllNotifications,
    hubVisible = true,
    isHub = false,
}: DashboardNavbarProps) {
    const [profileOpen, setProfileOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [switcherOpen, setSwitcherOpen] = useState(false);
    const [regionMenuOpen, setRegionMenuOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const notificationRef = useRef<HTMLDivElement>(null);
    const switcherRef = useRef<HTMLDivElement>(null);
    const regionRef = useRef<HTMLDivElement>(null);
    const [, setLocation] = useLocation();
    const { activeRegion, setActiveRegion, language, currency, availableRegions, activeLanguage, setActiveLanguage } = useRegion();
    const { t } = useTranslation();

    // Determine accessible dashboards
    const [accessibleDashboards, setAccessibleDashboards] = useState<any[]>([]);

    useEffect(() => {
        const userData = localStorage.getItem("marketingUser");
        if (userData) {
            try {
                const parsed = JSON.parse(userData);
                let access: string[] = parsed.dashboardAccess
                    ? (typeof parsed.dashboardAccess === "string"
                        ? JSON.parse(parsed.dashboardAccess)
                        : parsed.dashboardAccess)
                    : [];
                if (access.includes("marketing") && !access.includes("communications")) {
                    access.push("communications");
                }
                const allDashboards = GET_ALL_DASHBOARDS(t);
                const filtered = allDashboards.filter(d => access.includes(d.id));
                setAccessibleDashboards(filtered);
            } catch (e) {
                // ignore
            }
        }
    }, [t]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setProfileOpen(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setNotificationsOpen(false);
            }
            if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
                setSwitcherOpen(false);
            }
            if (regionRef.current && !regionRef.current.contains(event.target as Node)) {
                setRegionMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const userInitials = user
        ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || user.email[0].toUpperCase()
        : "U";

    const displayName = user?.firstName
        ? `${user.firstName} ${user.lastName || ""}`.trim()
        : user?.email || "User";

    return (
        <header className="bg-white sticky top-0 z-40 border-b border-gray-200">
            <div className="px-4 sm:px-6">
                <div className="flex items-center justify-between h-16">
                    {/* Mobile menu toggle */}
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 lg:hidden" onClick={onToggleMobileMenu}>
                        {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </Button>

                    {/* Breadcrumbs */}
                    <div className="flex-1 mx-4 overflow-hidden">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider overflow-x-auto no-scrollbar whitespace-nowrap">
                            <LayoutDashboard className="h-3.5 w-3.5 flex-shrink-0" />
                            <span
                                className="cursor-pointer hover:text-[#004E98] transition-colors"
                                onClick={() => setLocation("/dashboard")}
                            >
                                Dashboard
                            </span>

                            {breadcrumbs ? breadcrumbs.map((crumb, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <ChevronRight className="h-3 w-3 flex-shrink-0" />
                                    {crumb.icon && <crumb.icon className="h-3.5 w-3.5 flex-shrink-0" />}
                                    <span
                                        className={`${crumb.onClick ? "cursor-pointer hover:text-[#004E98]" : "text-[#004E98]"} transition-colors font-bold`}
                                        onClick={crumb.onClick}
                                    >
                                        {crumb.label}
                                    </span>
                                </div>
                            )) : (
                                <>
                                    <ChevronRight className="h-3 w-3 flex-shrink-0" />
                                    {TabIcon && <TabIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                                    <span className="text-[#004E98] font-bold">
                                        {tabLabel || activeTab.replace(/-/g, ' ')}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Notifications, Switcher & Profile */}
                    <div className="flex items-center gap-2">
                        {/* Dashboard Switcher */}
                        {hubVisible && !isHub && accessibleDashboards.length > 1 && (
                            <div className="relative" ref={switcherRef}>
                                <button
                                    onClick={() => setSwitcherOpen(p => !p)}
                                    className="p-2 text-gray-400 hover:text-[#004E98] hover:bg-blue-50 rounded-full transition-all relative"
                                    title="Switch Dashboard"
                                >
                                    <Grid className="h-5 w-5" />
                                </button>
                                {switcherOpen && (
                                    <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Switch Workspace</p>
                                        </div>
                                        <div className="p-2 grid grid-cols-1 gap-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                            {accessibleDashboards.map(dashboard => (
                                                <button
                                                    key={dashboard.id}
                                                    onClick={() => {
                                                        setSwitcherOpen(false);
                                                        setLocation(dashboard.path);
                                                    }}
                                                    className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                                                >
                                                    <div className={`h-8 w-8 rounded-md flex items-center justify-center ${dashboard.bgColor} transition-colors group-hover:scale-105`}>
                                                        <dashboard.icon className="h-4 w-4" style={{ color: dashboard.color }} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-gray-900 truncate group-hover:text-[#004E98] transition-colors">{dashboard.label}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50 text-center">
                                            <button 
                                                onClick={() => { setSwitcherOpen(false); setLocation("/dashboard"); }}
                                                className="text-[10px] font-bold text-[#004E98] hover:underline transition-colors uppercase tracking-widest"
                                            >
                                                Go to Dashboard Hub
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Language Switcher */}
                        <div className="relative" ref={regionRef}>
                            <button
                                onClick={() => setRegionMenuOpen(p => !p)}
                                className="p-2 text-gray-400 hover:text-[#004E98] hover:bg-blue-50 rounded-full transition-all flex items-center gap-2"
                                title={t("language.switch", "Switch Language")}
                            >
                                <Globe className="h-5 w-5" />
                                <span className="text-[11px] font-black tracking-widest hidden md:flex items-center gap-1.5 text-gray-600">
                                    <span className="uppercase text-[#004E98]">{activeRegion.code}</span>
                                    <span className="w-px h-3 bg-gray-300"></span>
                                    <span>{activeLanguage.substring(0, 2).toUpperCase()}</span>
                                </span>
                            </button>
                            {regionMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("language.switch", "Language Preference")}</p>
                                    </div>
                                    <div className="p-2 grid grid-cols-1 gap-1">
                                        {(activeRegion.supportedLanguages || [activeRegion.language]).map((lang) => (
                                            <button
                                                key={lang}
                                                onClick={() => {
                                                    setActiveLanguage(lang);
                                                    setRegionMenuOpen(false);
                                                }}
                                                className={`flex items-center justify-between w-full p-2.5 rounded-lg transition-colors text-left ${activeLanguage === lang ? 'bg-blue-50 text-[#004E98]' : 'hover:bg-gray-50'}`}
                                            >
                                                <span className="text-sm font-bold truncate">{lang}</span>
                                                {activeLanguage === lang && <Check className="h-4 w-4" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* AI Chatbot Toggle */}
                        <button
                            onClick={() => document.dispatchEvent(new CustomEvent("toggle-ai-chatbot"))}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-full transition-all relative flex items-center justify-center group"
                            title="Claude AI Assistant"
                        >
                            <img src="/claude-ai.svg" alt="Claude AI" className="h-5 w-5 transition-transform group-hover:scale-110 object-contain" />
                        </button>

                        {/* Notifications */}
                        <div className="relative" ref={notificationRef}>
                            <button
                                onClick={() => setNotificationsOpen(p => !p)}
                                className="p-2 text-gray-400 hover:text-[#004E98] hover:bg-blue-50 rounded-full transition-all relative"
                            >
                                <Bell className="h-5 w-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1 h-3.5 w-3.5 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-sm">
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </span>
                                )}
                            </button>

                            {notificationsOpen && (
                                <div className="absolute right-0 mt-2 w-[calc(100vw-1rem)] sm:w-80 max-w-sm bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in">
                                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                                        <p className="text-xs font-bold text-gray-900 uppercase tracking-widest">Notifications</p>
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={onReadAllNotifications}
                                                className="text-[10px] font-bold text-[#004E98] hover:underline"
                                            >
                                                Mark all as read
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-[350px] overflow-y-auto">
                                        {unreadCount === 0 ? (
                                            <div className="px-4 py-8 text-center text-[#004E98]">
                                                <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <Check className="h-5 w-5" />
                                                </div>
                                                <p className="text-xs font-black uppercase tracking-widest">All caught up!</p>
                                                <p className="text-[10px] text-gray-400 mt-1 font-medium">No unread notifications</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-gray-50">
                                                {notifications.filter(n => !n.isRead).map((notif) => (
                                                    <div
                                                        key={notif.id}
                                                        className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer relative group bg-blue-50/30"
                                                        onClick={() => {
                                                            if (!notif.isRead && onNotificationRead) onNotificationRead(notif.id);
                                                            if (notif.link) setLocation(notif.link);
                                                            setNotificationsOpen(false);
                                                        }}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${notif.type === "success" ? "bg-emerald-50 text-emerald-600" :
                                                                notif.type === "warning" ? "bg-amber-50 text-amber-600" :
                                                                    notif.type === "error" ? "bg-red-50 text-red-600" :
                                                                        "bg-blue-50 text-[#004E98]"
                                                                }`}>
                                                                {notif.type === "success" ? <Check className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs text-gray-900 font-bold">
                                                                    {notif.title}
                                                                </p>
                                                                <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5 leading-relaxed">
                                                                    {notif.message}
                                                                </p>
                                                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter mt-1.5 flex items-center gap-1.5">
                                                                    {notif.module && <span className="text-[#004E98]/70">{notif.module}</span>}
                                                                    <span className="h-0.5 w-0.5 rounded-full bg-gray-300" />
                                                                    {new Date(notif.createdAt).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                            <div className="h-2 w-2 rounded-full bg-[#004E98] mt-1.5 shadow-sm" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50 text-center">
                                        <button className="text-[10px] font-bold text-gray-400 hover:text-[#004E98] transition-colors uppercase tracking-widest">
                                            View all activity
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Profile dropdown */}
                        <div className="relative flex-shrink-0" ref={profileRef}>
                            <button
                                onClick={() => setProfileOpen(p => !p)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                            >
                                <div className="h-8 w-8 rounded-full bg-[#004E98] flex items-center justify-center text-white ring-2 ring-white shadow-sm">
                                    <span className="text-xs font-bold">{userInitials}</span>
                                </div>
                                <span className="hidden sm:block font-medium text-gray-700 truncate max-w-[120px]">
                                    {displayName}
                                </span>
                                <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`} />
                            </button>

                            {profileOpen && (
                                <div className="absolute right-0 mt-2 w-52 max-w-[calc(100vw-1rem)] bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in">
                                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Signed in as</p>
                                        <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">{user?.email || "—"}</p>
                                        <p className="text-[10px] text-[#004E98] font-bold uppercase mt-1 px-1.5 py-0.5 bg-blue-50 rounded w-fit inline-block">
                                            {user?.role || "User"}
                                        </p>
                                    </div>

                                    <div className="py-1">
                                        <button onClick={() => { setProfileOpen(false); setLocation("/profile"); }}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
                                            <User className="h-4 w-4 text-gray-400" />My Profile
                                        </button>

                                        {hubVisible && !isHub && (
                                            <button onClick={() => { setProfileOpen(false); setLocation("/dashboard"); }}
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
                                                <LayoutDashboard className="h-4 w-4 text-gray-400" />Dashboard Hub
                                            </button>
                                        )}
                                    </div>

                                    <div className="border-t border-gray-100 my-1" />

                                    <div className="py-1">
                                        <button onClick={() => { setProfileOpen(false); onLogout(); }}
                                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors">
                                            <LogOut className="h-4 w-4" />Sign Out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
