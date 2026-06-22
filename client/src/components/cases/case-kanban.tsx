import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Clock, MessageSquare, AlertTriangle, CheckCircle2, 
    ArrowRight, Loader2, User, ChevronRight, Zap
} from "lucide-react";
import { getDeadlineStatus, formatLabel, statusColors } from "./case-utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from "@/components/ui/dropdown-menu";

interface CaseItem {
    id: string;
    caseNumber: string;
    title: string;
    status: string;
    priority: string;
    assignedToName?: string;
    description?: string;
    channel: string;
    slaDeadline: string | null;
    slaResponseDeadline: string | null;
    firstResponseAt: string | null;
    resolvedAt: string | null;
    createdAt: string;
    tags?: any[];
    assignedTo?: string;
    slaResponseMinutes?: number;
    slaResolutionMinutes?: number;
    slaMetricType?: string;
    policyNumber?: string;
    stakeholderName?: string;
}

interface CaseKanbanProps {
    cases: CaseItem[];
    onStatusChange: (id: string, newStatus: string, currentStatus: string) => void;
    onCaseClick: (id: string) => void;
    isLoading?: boolean;
    currentUserId?: string;
}

const KANBAN_STATUSES = ["open", "in_progress", "escalated", "resolved", "pending_acceptance"];

export function CaseKanban({ cases, onStatusChange, onCaseClick, isLoading, currentUserId }: CaseKanbanProps) {
    const groupedCases = KANBAN_STATUSES.reduce((acc, status) => {
        acc[status] = cases.filter(c => c.status === status);
        return acc;
    }, {} as Record<string, CaseItem[]>);

    if (isLoading) {
        return (
            <div className="flex overflow-x-auto pb-4 gap-4 sm:gap-6 min-h-[500px]">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="min-w-[280px] sm:min-w-[320px] flex-shrink-0 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div>
            {/* Mobile scroll hint */}
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 sm:hidden">
                <span>←</span> Swipe to see all statuses <span>→</span>
            </p>
        <div className="flex overflow-x-auto pb-6 gap-4 sm:gap-6 min-h-[600px] snap-x snap-mandatory custom-scrollbar transition-all">
                {KANBAN_STATUSES.map(status => (
                    <div key={status} className="min-w-[280px] sm:min-w-[320px] h-full flex-shrink-0 snap-start">
                        <KanbanColumn 
                            status={status} 
                            cases={groupedCases[status] || []} 
                            onStatusChange={onStatusChange}
                            onCaseClick={onCaseClick}
                            currentUserId={currentUserId}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

function KanbanColumn({ status, cases, onStatusChange, onCaseClick, currentUserId }: { 
    status: string; 
    cases: CaseItem[]; 
    onStatusChange: (id: string, newStatus: string, currentStatus: string) => void;
    onCaseClick: (id: string) => void;
    currentUserId?: string;
}) {
    const columnColors: Record<string, string> = {
        open: "bg-blue-50/30",
        pending_acceptance: "bg-orange-50/30",
        in_progress: "bg-amber-50/30",
        escalated: "bg-rose-50/30",
        resolved: "bg-emerald-50/30"
    };

    const iconColors: Record<string, string> = {
        open: "text-[#004E98]",
        pending_acceptance: "text-orange-500",
        in_progress: "text-amber-500",
        escalated: "text-rose-500",
        resolved: "text-emerald-500"
    };

    const StatusIcon = status === "open" ? MessageSquare 
        : status === "in_progress" ? Clock 
        : status === "escalated" ? AlertTriangle 
        : CheckCircle2;

    return (
        <div className={`flex flex-col rounded-2xl border ${columnColors[status]} border-gray-100 shadow-sm h-full max-h-[700px] overflow-hidden`}>
            <div className="p-4 flex items-center justify-between border-b bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <StatusIcon className={`h-4 w-4 ${iconColors[status]}`} />
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-tighter">{formatLabel(status)}</h3>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-black bg-white border-gray-100 text-gray-500">
                        {cases.length}
                    </Badge>
                </div>
            </div>

            <ScrollArea className="flex-1 p-3">
                <div className="space-y-3">
                    {cases.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center opacity-20 text-center px-4">
                            <StatusIcon className="h-8 w-8 mb-2" />
                            <p className="text-[10px] font-bold uppercase tracking-widest">No {status} cases</p>
                        </div>
                    ) : (
                        cases.map(c => (
                            <KanbanCard 
                                key={c.id} 
                                caseItem={c} 
                                onStatusChange={onStatusChange}
                                onClick={() => onCaseClick(c.id)}
                                currentUserId={currentUserId}
                            />
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

function KanbanCard({ caseItem, onStatusChange, onClick, currentUserId }: { 
    caseItem: CaseItem; 
    onStatusChange: (id: string, newStatus: string, currentStatus: string) => void;
    onClick: () => void;
    currentUserId?: string;
}) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60000); 
        return () => clearInterval(timer);
    }, []);

    const responseStatus = getDeadlineStatus(
        caseItem.slaResponseDeadline, 
        caseItem.firstResponseAt, 
        caseItem.slaResponseMinutes, 
        caseItem.createdAt
    );

    const resolutionStatus = getDeadlineStatus(
        caseItem.slaDeadline, 
        caseItem.resolvedAt, 
        caseItem.slaResolutionMinutes, 
        caseItem.createdAt
    );

    const getInitials = (name?: string) => {
        if (!name) return "U";
        return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
    };

    const isCollaborator = currentUserId && caseItem.assignedTo !== currentUserId && 
        Array.isArray(caseItem.tags) && caseItem.tags.some(t => t.id === currentUserId || t === currentUserId);

    const formatResolutionVelocity = () => {
        if (!caseItem.resolvedAt || !caseItem.createdAt) return null;
        const start = new Date(caseItem.firstResponseAt || caseItem.createdAt).getTime();
        const end = new Date(caseItem.resolvedAt).getTime();
        const diffMs = end - start;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 60) return `${diffMins}m`;
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}h ${mins}m`;
    };

    return (
        <Card 
            className="group relative bg-white border-0 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden rounded-2xl ring-1 ring-black/[0.03]"
            onClick={onClick}
        >
            <div className={`absolute top-0 left-0 right-0 h-1 ${
                caseItem.status === 'open' ? 'bg-[#004E98]/20' : 
                caseItem.status === 'in_progress' ? 'bg-amber-500/20' : 
                caseItem.status === 'escalated' ? 'bg-rose-500/20' : 'bg-emerald-500/20'
            }`} />

            <CardContent className="p-4 pt-5">
                <div className="flex justify-between items-center mb-4">
                    <Badge variant="outline" className="text-[10px] font-black text-[#004E98] bg-blue-50/50 border-blue-100/50 px-2 py-0.5 rounded-lg tracking-tight">
                        #{caseItem.caseNumber}
                    </Badge>
                    <div className="flex items-center gap-1.5 overflow-hidden ml-2 max-w-[120px]">
                        <span className="text-[11px] font-black text-gray-700 truncate" title={caseItem.assignedToName || "Unassigned"}>
                            {caseItem.assignedToName || "Unassigned"}
                        </span>
                    </div>
                </div>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <h4 className="text-[12px] font-black text-gray-900 leading-tight mb-4 group-hover:text-[#004E98] transition-colors line-clamp-1 uppercase tracking-tight cursor-help min-h-[16px]">
                                {caseItem.policyNumber || "GUEST"}: {caseItem.stakeholderName || "UNKNOWN"}
                            </h4>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[320px] p-4 rounded-2xl shadow-2xl border-none ring-1 ring-black/10 bg-white/98 backdrop-blur-xl z-[100]">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                    <MessageSquare className="h-3.5 w-3.5 text-[#004E98]" />
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Case Description</span>
                                </div>
                                <p className="text-xs font-medium text-gray-600 leading-relaxed italic">
                                    {caseItem.description || "No description provided."}
                                </p>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <div className="space-y-3 mt-auto">
                    {caseItem.status === "resolved" ? (
                        <div className="flex items-center justify-between bg-emerald-50/40 p-2 rounded-xl border border-emerald-100/30">
                            <div className="flex items-center gap-3">
                                <div className="p-1 bg-white rounded-lg shadow-sm">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                </div>
                                <span className="text-[8px] font-black text-emerald-800 uppercase tracking-widest">Velocity</span>
                            </div>
                            <Badge variant="outline" className="h-5 text-[9px] font-black border-emerald-200 bg-white text-emerald-700 uppercase tracking-tight">
                                {formatResolutionVelocity()}
                            </Badge>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1.5 p-2.5 bg-gray-50/50 rounded-xl border border-gray-100/30">
                                <div className="flex items-center gap-1 opacity-40">
                                    <span className="text-[7px] font-black uppercase tracking-widest">Response</span>
                                </div>
                                <SlaTimer status={responseStatus} />
                            </div>
                            <div className="flex flex-col gap-1.5 p-2.5 bg-gray-50/50 rounded-xl border border-gray-100/30">
                                <div className="flex items-center gap-1 opacity-40">
                                    <span className="text-[7px] font-black uppercase tracking-widest">{caseItem.slaMetricType ? caseItem.slaMetricType.split('_')[0] : 'Resolve'}</span>
                                </div>
                                <SlaTimer status={resolutionStatus} />
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-5 pt-4 border-t border-gray-50 flex items-center justify-between">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-2.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#004E98] hover:bg-blue-50 transition-all gap-2 rounded-xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                Actions <ChevronRight className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64 rounded-[2rem] border-none shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-3 bg-white/98 backdrop-blur-xl ring-1 ring-black/5 z-[200]">
                            <DropdownMenuLabel className="text-[11px] font-black uppercase tracking-[2px] text-[#004E98]/50 px-4 py-3">Quick Transitions</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-gray-50 my-1" />
                            {KANBAN_STATUSES.filter(s => s !== caseItem.status && s !== 'pending_acceptance').map(status => (
                                <DropdownMenuItem 
                                    key={status}
                                    className="text-xs font-black uppercase tracking-tight py-4 px-5 rounded-2xl focus:bg-blue-50 focus:text-[#004E98] cursor-pointer transition-all active:scale-[0.98] group/item"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStatusChange(caseItem.id, status, caseItem.status);
                                    }}
                                >
                                    Move to {formatLabel(status)}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-[#004E98] transition-all transform group-hover:translate-x-1" />
                </div>
            </CardContent>
        </Card>
    );
}

function SlaTimer({ status }: { status: any }) {
    const colors: Record<string, string> = {
        completed: "text-emerald-600 bg-emerald-50 border-emerald-100/50",
        breached: "text-rose-600 bg-rose-50 border-rose-100/50",
        approaching: "text-amber-600 bg-amber-50 border-amber-100/50",
        within: "text-[#004E98] bg-blue-50 border-blue-100/50",
        none: "text-gray-400 bg-gray-50 border-gray-100/50"
    };

    return (
        <Badge variant="outline" className={`h-6 text-[10px] font-black border-2 uppercase tracking-tighter shadow-sm ${colors[status.status] || colors.none}`}>
            {status.text}
        </Badge>
    );
}
