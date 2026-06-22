import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Loader2, MessageSquare,
    Settings2, ExternalLink, Search, Filter, ShieldAlert,
    Tag, ChevronLeft, ChevronRight
} from "lucide-react";
import type { Interaction } from "./stakeholder-types";
import { statusColors, priorityColors, formatLabel } from "../cases/case-utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface InteractionsTabProps {
    interactions: Interaction[];
    loading: boolean;
    total: number;
    page: number;
    pageSize: number;
    searchQuery: string;
    onSearchChange: (v: string) => void;
    filterStatus: string;
    onStatusFilter: (v: string) => void;
    filterPriority: string;
    onPriorityFilter: (v: string) => void;
    filterType: string;
    onTypeFilter: (v: string) => void;
    onPageChange: (p: number) => void;
    onNavigate?: (to: string) => void;
    onViewCase?: (id: string) => void;
}

const STATUS_VARIANTS: Record<string, any> = {
    open: "outline",
    in_progress: "default",
    resolved: "secondary",
    escalated: "destructive",
};

export function InteractionsTab({
    interactions, loading, total, page, pageSize,
    searchQuery, onSearchChange,
    filterStatus, onStatusFilter,
    filterPriority, onPriorityFilter,
    filterType, onTypeFilter,
    onPageChange,
    onNavigate,
    onViewCase
}: InteractionsTabProps) {
    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-6">
            {/* ── Header card — matches Case Management All Cases pattern ── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#004E98]/10 p-3 rounded-lg flex-shrink-0">
                            <MessageSquare className="h-6 w-6 text-[#004E98]" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 leading-none">Interactions</h3>
                            <p className="text-sm text-gray-500 mt-2 flex items-center gap-1.5 font-medium">
                                Unified Ecosystem Touchpoints
                            </p>
                        </div>
                    </div>
                </div>

                <div className="px-5 pb-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        <Select value={filterStatus || "all"} onValueChange={(v) => { onStatusFilter(v === "all" ? "" : v); onPageChange(1); }}>
                            <SelectTrigger className="w-[140px] h-10 border-gray-200 bg-white">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                                <SelectItem value="escalated">Escalated</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={filterPriority || "all"} onValueChange={(v) => { onPriorityFilter(v === "all" ? "" : v); onPageChange(1); }}>
                            <SelectTrigger className="w-[140px] h-10 border-gray-200 bg-white">
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Priorities</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={filterType || "all"} onValueChange={(v) => { onTypeFilter(v === "all" ? "" : v); onPageChange(1); }}>
                            <SelectTrigger className="w-[140px] h-10 border-gray-200 bg-white">
                                <SelectValue placeholder="Touchpoint" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="call">Calls</SelectItem>
                                <SelectItem value="email">Emails</SelectItem>
                                <SelectItem value="meeting">Meetings</SelectItem>
                                <SelectItem value="visit">Visits</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="relative flex-1 min-w-[200px] xl:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search subjects, cases or stakeholders..."
                                className="pl-10 h-10 border-gray-200 focus:border-[#004E98] focus:ring-[#004E98] bg-white transition-all"
                                value={searchQuery}
                                onChange={(e) => { onSearchChange(e.target.value); onPageChange(1); }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Enhanced Table ── */}
            <Card className="border-gray-100 shadow-sm overflow-hidden rounded-2xl">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow className="hover:bg-transparent border-gray-100">
                                <TableHead className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest pl-8">Touchpoint</TableHead>
                                <TableHead className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Subject & Case</TableHead>
                                <TableHead className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Stakeholder</TableHead>
                                <TableHead className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest hidden lg:table-cell">Status</TableHead>
                                <TableHead className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest hidden xl:table-cell">Priority</TableHead>
                                <TableHead className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-right pr-8">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[#004E98]" /></TableCell></TableRow>
                            ) : interactions.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-24">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-4 bg-gray-50 rounded-full border border-dashed border-gray-200">
                                            <ShieldAlert className="h-8 w-8 text-gray-300" />
                                        </div>
                                        <p className="text-gray-400 font-bold uppercase tracking-widest text-[11px]">No matching ecosystem touchpoints found</p>
                                    </div>
                                </TableCell></TableRow>
                            ) : interactions.map((int) => (
                                <TableRow
                                    key={int.id}
                                    className="group hover:bg-gray-50/80 cursor-pointer transition-colors border-gray-50 h-20"
                                    onClick={() => onViewCase ? onViewCase(int.caseId || int.id) : onNavigate?.(`/cases/workspace/${int.caseId || int.id}`)}
                                >
                                    <TableCell className="pl-8">
                                        <div className="flex flex-col">
                                            <p className="text-xs font-bold text-gray-900 uppercase tracking-tight">
                                                {int.channel?.replace(/_/g, ' ') || "Portal"}
                                            </p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <TooltipProvider>
                                            <div className="space-y-1">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <p className="font-bold text-slate-900 group-hover:text-[#004E98] transition-colors line-clamp-1 max-w-sm cursor-help">
                                                            {int.subject || "Stakeholder Query"}
                                                        </p>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-[400px] p-5 bg-white shadow-2xl border-gray-100 rounded-2xl" sideOffset={12}>
                                                        <div className="space-y-4">
                                                            <p className="text-base font-bold text-slate-800 leading-relaxed">{int.subject}</p>
                                                            <p className="text-sm font-medium text-slate-500 leading-relaxed italic border-l-4 border-[#004E98]/10 pl-4 py-1">
                                                                {int.description || "No additional background details available for this touchpoint."}
                                                            </p>
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                                
                                                <div className="flex items-center gap-2">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="text-[10px] text-gray-400 font-black tracking-widest flex items-center gap-1 uppercase hover:text-gray-600 transition-colors cursor-help">
                                                                <Tag className="h-2.5 w-2.5" /> {int.caseNumber || "SIM-INT"}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-gray-900 text-white border-none rounded-lg font-bold text-[10px] uppercase tracking-widest">
                                                            Case Reference: {int.caseNumber || "SIM-INT"}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                    <div className="w-1 h-1 rounded-full bg-gray-200" />
                                                    <button className="text-[10px] text-[#004E98] font-black uppercase hover:underline flex items-center gap-1">
                                                        Workspace <ExternalLink className="h-2.5 w-2.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </TooltipProvider>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <p className="font-bold text-gray-800 text-sm leading-none">{int.stakeholderName || "Unknown Body"}</p>
                                            <p className="text-[9px] text-gray-400 font-bold uppercase mt-1 tracking-tighter">{int.stakeholderType || "Stakeholder"}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        <Badge
                                            className={`${statusColors[int.status || "open"]} border-none uppercase text-[9px] font-black tracking-widest px-2.5 py-0.5`}
                                        >
                                            {formatLabel(int.status || "open")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="hidden xl:table-cell">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${int.priority === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${priorityColors[int.priority || "low"].split(' ')[1]}`}>
                                                {int.priority || "low"}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <div className="flex flex-col items-end">
                                            <div className="flex items-center gap-1.5 text-gray-900 font-black text-sm">
                                                {int.createdAt ? new Date(int.createdAt).toLocaleDateString("en-KE", { day: 'numeric', month: 'short' }) : "N/A"}
                                            </div>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                                                {int.createdAt ? new Date(int.createdAt).toLocaleTimeString("en-KE", { hour: '2-digit', minute: '2-digit' }) : ""}
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* ── Pagination ── */}
            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 bg-white border border-gray-100 rounded-xl shadow-sm mt-4">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-500">
                            Showing <span className="text-gray-900 font-bold">{Math.min((page - 1) * pageSize + 1, total)}</span> to <span className="text-gray-900 font-bold">{Math.min(page * pageSize, total)}</span> of <span className="text-gray-900 font-bold">{total}</span> interactions
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => onPageChange(page - 1)}
                            className="h-9 px-3 border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all font-semibold"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                        </Button>
                        <div className="flex items-center gap-1 mx-2">
                            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                                const p = i + 1;
                                return (
                                    <Button
                                        key={p}
                                        variant={page === p ? "default" : "ghost"}
                                        size="sm"
                                        className={`h-9 w-9 p-0 font-bold transition-all ${page === p ? "bg-[#004E98] text-white shadow-md shadow-[#004E98]/20" : "text-gray-500 hover:bg-gray-100"}`}
                                        onClick={() => onPageChange(p)}
                                    >
                                        {p}
                                    </Button>
                                );
                            })}
                            {totalPages > 5 && <span className="text-gray-400 px-1 font-bold">...</span>}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => onPageChange(page + 1)}
                            className="h-9 px-3 border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all font-semibold"
                        >
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
