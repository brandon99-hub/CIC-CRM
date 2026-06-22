import { LucideIcon, ChevronLeft, ChevronRight, LayoutDashboard, X } from "lucide-react";
import { useLocation } from "wouter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

interface DashboardSidebarProps {
  title: string;
  subtitle: string;
  navGroups: NavGroup[];
  activeSection: string;
  onNavigate: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  hubVisible?: boolean;
}

export function DashboardSidebar({
  title,
  subtitle,
  navGroups,
  activeSection,
  onNavigate,
  collapsed,
  onToggleCollapse,
  isMobileOpen,
  onMobileClose,
  hubVisible = true,
}: DashboardSidebarProps) {
  const [, setLocation] = useLocation();

  return (
    <div
      className={`${isMobileOpen ? "translate-x-0" : "-translate-x-full"} 
        fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 
        transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 
        ${collapsed ? "lg:w-16" : "lg:w-60"} w-64 flex flex-col`}
    >
      <div className="flex flex-col h-full">
        {/* Sidebar header */}
        <div className={`flex border-b border-gray-100 p-5 ${collapsed ? "flex-col items-center" : "flex-row items-center justify-between gap-3"}`}>
          <div className={`flex items-center ${collapsed ? "w-full justify-center" : "flex-1 min-w-0"}`}>
            <img src="/logo.png" alt="KASNEB Logo" className="h-9 w-auto flex-shrink-0 drop-shadow-sm" />
            {!collapsed && (
              <div className="min-w-0 flex-1 ml-3.5 flex flex-col justify-center">
                <h1 className="text-[13px] font-black text-gray-900 uppercase tracking-tight truncate leading-tight mb-0.5">{title}</h1>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate leading-tight">{subtitle}</p>
              </div>
            )}
          </div>
          
          {/* Desktop collapse toggle - position depends on state */}
          <button
            onClick={onToggleCollapse}
            className={`hidden lg:flex items-center justify-center h-8 w-8 flex-shrink-0 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:bg-[#004E98] hover:border-[#004E98] hover:text-white transition-all text-gray-400 group ${collapsed ? "mt-4" : ""}`}
          >
            {collapsed ? <ChevronRight className="h-4 w-4 group-hover:scale-110 transition-transform" /> : <ChevronLeft className="h-4 w-4 group-hover:scale-110 transition-transform" />}
          </button>

          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            className="flex lg:hidden items-center justify-center h-7 w-7 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 flex-shrink-0 ml-3"
            title="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          <TooltipProvider delayDuration={0}>
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                {!collapsed && (
                  <h3 className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {group.title}
                  </h3>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  
                  const navButton = (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        if (isMobileOpen) onMobileClose();
                      }}
                      className={`relative w-full flex items-center p-2.5 mb-0.5 rounded-lg transition-all duration-200 ${isActive
                        ? "bg-[#004E98] text-white shadow-md shadow-blue-100"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        } group ${collapsed ? "justify-center" : "space-x-3"}`}
                    >
                      <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-white" : "text-gray-400 group-hover:text-gray-600"}`} />
                      {!collapsed && (
                        <div className="flex-1 flex items-center justify-between min-w-0">
                          <span className="ml-3 font-medium text-sm truncate">{item.label}</span>
                          {item.badge !== undefined && (
                            <span className="ml-2 inline-flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold px-1.5 min-w-[1.25rem] h-5 rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                      {isActive && !collapsed && item.badge === undefined && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                      )}
                      {collapsed && item.badge !== undefined && (
                        <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
                      )}
                    </button>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={item.id}>
                        <TooltipTrigger asChild>
                          {navButton}
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-white text-gray-900 border-none shadow-2xl ring-1 ring-black/5 p-3 rounded-xl ml-2 z-[300]">
                          <p className="text-[11px] font-black uppercase tracking-widest">{item.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return navButton;
                })}
              </div>
            ))}

            {hubVisible && (
              <div className="pt-4 border-t border-gray-100">
                {(() => {
                  const hubButton = (
                    <button
                      onClick={() => {
                        setLocation("/dashboard");
                      }}
                      className={`w-full flex items-center p-2.5 rounded-lg text-[#004E98] hover:bg-blue-50 transition-colors ${collapsed ? "justify-center" : "space-x-3"}`}
                    >
                      <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span className="ml-3 font-medium text-sm">Dashboard Hub</span>}
                    </button>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {hubButton}
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-white text-gray-900 border-none shadow-2xl ring-1 ring-black/5 p-3 rounded-xl ml-2 z-[300]">
                          <p className="text-[11px] font-black uppercase tracking-widest">Dashboard Hub</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return hubButton;
                })()}
              </div>
            )}
          </TooltipProvider>
        </nav>
      </div>
    </div>
  );
}
