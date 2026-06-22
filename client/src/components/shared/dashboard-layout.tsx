import { useState, ReactNode, useEffect } from "react";
import { DashboardSidebar, NavGroup } from "./dashboard-sidebar";
import { DashboardNavbar } from "./dashboard-navbar";
import { LucideIcon, Loader2 } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";

interface User {
    firstName?: string;
    lastName?: string;
    email: string;
    role?: string;
    dashboardAccess?: string[];
}

interface DashboardLayoutProps {
    title: string;
    subtitle: string;
    navGroups: NavGroup[];
    activeTab: string;
    setActiveTab: (id: string) => void;
    user: User | null;
    onLogout: () => void;
    loading?: boolean;
    children: ReactNode;
    breadcrumbs?: Array<{ label: string; icon?: LucideIcon; onClick?: () => void }>;
    tabDescriptions?: Record<string, string>;
    sidebarStorageKey?: string;
    noPadding?: boolean;
}

export function DashboardLayout({
    title,
    subtitle,
    navGroups,
    activeTab,
    setActiveTab,
    user,
    onLogout,
    loading = false,
    children,
    breadcrumbs,
    tabDescriptions,
    sidebarStorageKey = "dashboardSidebarCollapsed",
    noPadding = false,
}: DashboardLayoutProps) {
    const [collapsed, setCollapsed] = useState(() => {
        try {
            const saved = localStorage.getItem(sidebarStorageKey);
            return saved === "true";
        } catch {
            return false;
        }
    });
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const { notifications, markAsRead, markAllAsRead } = useNotifications();

    const toggleCollapse = () => {
        setCollapsed(prev => {
            const next = !prev;
            try { localStorage.setItem(sidebarStorageKey, String(next)); } catch { }
            return next;
        });
    };

    const activeItem = navGroups.flatMap(g => g.items).find(i => i.id === activeTab);
    const dashboardAccess = user?.dashboardAccess || [];
    const hubVisible = dashboardAccess.length > 1;

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <DashboardSidebar
                title={title}
                subtitle={subtitle}
                navGroups={navGroups}
                activeSection={activeTab}
                onNavigate={setActiveTab}
                collapsed={collapsed}
                onToggleCollapse={toggleCollapse}
                isMobileOpen={isMobileOpen}
                onMobileClose={() => setIsMobileOpen(false)}
                hubVisible={hubVisible}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <DashboardNavbar
                    activeTab={activeTab}
                    tabLabel={activeItem?.label}
                    tabIcon={activeItem?.icon}
                    user={user}
                    onLogout={onLogout}
                    onToggleMobileMenu={() => setIsMobileOpen(!isMobileOpen)}
                    isMobileMenuOpen={isMobileOpen}
                    breadcrumbs={breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs : undefined}
                    notifications={notifications}
                    onNotificationRead={markAsRead}
                    onReadAllNotifications={markAllAsRead}
                    hubVisible={hubVisible}
                />

                <main className={`flex-1 flex flex-col min-h-0 relative ${noPadding ? "overflow-hidden" : "overflow-y-auto p-4 sm:p-6"}`}>
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-8 w-8 animate-spin text-[#004E98]" />
                                <p className="text-sm text-gray-500 font-medium">Loading data...</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {children}
                        </>
                    )}
                </main>
            </div>

            {/* Mobile overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}
        </div>
    );
}
