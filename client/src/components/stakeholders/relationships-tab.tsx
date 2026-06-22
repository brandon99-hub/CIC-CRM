import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Link2, Settings2, Info, ArrowRight, Search, Filter, Users, Target, Activity, TrendingUp, AlertTriangle, GraduationCap, Globe, Briefcase, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { STAKEHOLDER_TYPE_COLORS } from "./stakeholder-type-colors";
import type { Relationship } from "./stakeholder-types";

interface RelationshipsTabProps {
    relationships: Relationship[];
    loading: boolean;
    total: number;
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    searchQuery: string;
    onSearchChange: (search: string) => void;
    typeFilter: string;
    onTypeFilterChange: (type: string) => void;
    segments: any[];
    segmentsLoading: boolean;
    segPage: number;
    segTotalPages: number;
    onSegPageChange: (page: number) => void;
    segSearchQuery: string;
    onSegSearchChange: (search: string) => void;
    activeSubTab: string;
    onSubTabChange: (tab: string) => void;
    onViewProfile: (id: string) => void;
}

export function RelationshipsTab({
    relationships,
    loading,
    total,
    page,
    totalPages,
    onPageChange,
    searchQuery,
    onSearchChange,
    typeFilter,
    onTypeFilterChange,
    segments = [],
    segmentsLoading = false,
    activeSubTab,
    onSubTabChange,
    segPage,
    segTotalPages,
    onSegPageChange,
    segSearchQuery,
    onSegSearchChange,
    onViewProfile
}: RelationshipsTabProps) {
    const [segTypeFilter, setSegTypeFilter] = useState("all");

    // Define which segment IDs belong to "Connections" (Cohorts/Qualifications)
    const cohortPrefixes = [
        "qual_", 
        "international", 
        "new_registrant", 
        "dormant", 
        "accredited_institution", 
        "employer"
    ];

    const filteredConnectionsList = useMemo(() => {
        const connMap = new Map<string, { id: string; name: string; description: string; count: number; stakeholders: any[] }>();
        segments.forEach((s: any) => {
            (s.segments || []).forEach((seg: any) => {
                const isCohort = cohortPrefixes.some(prefix => seg.id.replace('seg:', '').startsWith(prefix));
                if (isCohort) {
                    if (!connMap.has(seg.id)) connMap.set(seg.id, { ...seg, count: 0, stakeholders: [] });
                    const entry = connMap.get(seg.id)!;
                    entry.count++;
                    entry.stakeholders.push(s);
                }
            });
        });

        const searchLower = searchQuery.toLowerCase();
        return Array.from(connMap.values()).filter(item => {
            const matchesSearch = !searchQuery || 
                item.name.toLowerCase().includes(searchLower) || 
                item.description.toLowerCase().includes(searchLower);
                
            let matchesFilter = true;
            if (typeFilter !== "all") {
                if (typeFilter === "qual") matchesFilter = item.id.includes("qual_");
                else matchesFilter = item.id.includes(typeFilter);
            }
            
            return matchesSearch && matchesFilter;
        });
    }, [segments, searchQuery, typeFilter]);

    const getIconForCohort = (id: string) => {
        if (id.includes("qual_")) return <GraduationCap className="h-6 w-6" />;
        if (id.includes("international")) return <Globe className="h-6 w-6" />;
        if (id.includes("employer")) return <Briefcase className="h-6 w-6" />;
        if (id.includes("accredited")) return <ShieldCheck className="h-6 w-6" />;
        if (id.includes("dormant")) return <Activity className="h-6 w-6" />;
        return <Users className="h-6 w-6" />;
    };

    const getGradientForCohort = (id: string) => {
        if (id.includes("qual_")) return "from-blue-500/10 to-indigo-500/10 text-blue-600 border-blue-200/50";
        if (id.includes("international")) return "from-purple-500/10 to-fuchsia-500/10 text-purple-600 border-purple-200/50";
        if (id.includes("employer")) return "from-amber-500/10 to-orange-500/10 text-amber-600 border-amber-200/50";
        if (id.includes("accredited")) return "from-emerald-500/10 to-teal-500/10 text-emerald-600 border-emerald-200/50";
        if (id.includes("dormant")) return "from-slate-500/10 to-gray-500/10 text-slate-600 border-slate-200/50";
        return "from-[#004E98]/10 to-[#004E98]/5 text-[#004E98] border-[#004E98]/20";
    };

    const getSegmentIcon = (id: string) => {
        if (id.includes("inactive")) return <Activity className="h-5 w-5 text-gray-400" />;
        if (id.includes("engagement")) return <TrendingUp className="h-5 w-5 text-emerald-500" />;
        if (id.includes("at_risk") || id.includes("churn")) return <AlertTriangle className="h-5 w-5 text-red-500" />;
        if (id.includes("alumni")) return <Users className="h-5 w-5 text-[#004E98]" />;
        return <Target className="h-5 w-5 text-amber-500" />;
    };

    const getSegmentColor = (id: string) => {
        if (id.includes("inactive")) return "border-gray-100 bg-gray-50/30";
        if (id.includes("engagement")) return "border-emerald-100 bg-emerald-50/30";
        if (id.includes("at_risk") || id.includes("churn")) return "border-red-100 bg-red-50/30";
        if (id.includes("alumni")) return "border-blue-100 bg-blue-50/30";
        return "border-amber-100 bg-amber-50/30";
    };

    const filteredSegmentRows = useMemo(() => {
        const rows: any[] = [];
        segments.forEach((s: any) => {
            (s.segments || []).forEach((seg: any) => {
                // Backend already handles search and type filtering where applicable
                const isCohort = cohortPrefixes.some(prefix => seg.id.replace('seg:', '').startsWith(prefix));
                if (!isCohort) {
                    rows.push({ stakeholder: s, segment: seg });
                }
            });
        });
        return rows;
    }, [segments]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ── Header card — matches Case Management All Cases pattern ── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                {/* Row 1: Branding & Global Actions */}
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#004E98]/10 p-3 rounded-lg flex-shrink-0">
                            {activeSubTab === "connections" ? <Link2 className="h-6 w-6 text-[#004E98]" /> : <Target className="h-6 w-6 text-[#004E98]" />}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 leading-none">
                                {activeSubTab === "connections" ? "Connections" : "Segments"}
                            </h3>
                            {activeSubTab === "connections" && (
                                <p className="text-sm text-gray-500 mt-2 flex items-center gap-1.5 font-medium">
                                    Stakeholder interdependencies
                                </p>
                            )}
                        </div>
                    </div>


                </div>

                {/* Row 2: Search & Granular Filters */}
                <div className="px-5 pb-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex flex-1 items-center gap-4 max-w-2xl">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder={activeSubTab === "connections" ? "Search relationships..." : "Search segments..."}
                                value={activeSubTab === "connections" ? searchQuery : segSearchQuery}
                                onChange={(e) => activeSubTab === "connections" ? onSearchChange(e.target.value) : onSegSearchChange(e.target.value)}
                                className="pl-12 h-11 bg-white border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/10 font-bold text-sm"
                            />
                        </div>

                        {activeSubTab === "connections" ? (
                            <Select value={typeFilter} onValueChange={onTypeFilterChange}>
                                <SelectTrigger className="w-[220px] h-11 bg-white border-gray-200/50 rounded-xl font-bold px-4 text-xs">
                                    <SelectValue placeholder="Relationship Type" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                                    <SelectItem value="all" className="font-bold">All Groups</SelectItem>
                                    <SelectItem value="qual" className="font-bold">Qualifications</SelectItem>
                                    <SelectItem value="international" className="font-bold">International Students</SelectItem>
                                    <SelectItem value="new_registrant" className="font-bold">New Registrants</SelectItem>
                                    <SelectItem value="dormant" className="font-bold">Dormant</SelectItem>
                                    <SelectItem value="accredited_institution" className="font-bold">Accredited Institutions</SelectItem>
                                    <SelectItem value="employer" className="font-bold">Employers</SelectItem>
                                </SelectContent>
                            </Select>
                        ) : (
                            <Select value={segTypeFilter} onValueChange={setSegTypeFilter}>
                                <SelectTrigger className="w-[220px] h-11 bg-white border-gray-200/50 rounded-xl font-bold px-4 text-xs">
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                                    <SelectItem value="all" className="font-bold">All Categories</SelectItem>
                                    <SelectItem value="seg:promoter" className="font-bold">Promoters</SelectItem>
                                    <SelectItem value="seg:detractor" className="font-bold">Detractors</SelectItem>
                                    <SelectItem value="seg:churn_risk" className="font-bold">Churn Risk</SelectItem>
                                    <SelectItem value="seg:exam_ready" className="font-bold">Exam Ready</SelectItem>
                                    <SelectItem value="seg:exam_critical" className="font-bold">Exam Critical</SelectItem>
                                    <SelectItem value="seg:certification_pending" className="font-bold">Certification Pending</SelectItem>
                                    <SelectItem value="seg:near_completion" className="font-bold">Near Completion</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Sub-Tab Navigation ─────────────────────────────────────────────── */}
            <TooltipProvider>
                <div className="flex items-center gap-8 border-b border-gray-100 mb-6 px-2">
                    <button
                        onClick={() => onSubTabChange("connections")}
                        className={`flex items-center gap-2 pb-3 text-xs font-black uppercase tracking-widest transition-all ${
                            activeSubTab === "connections"
                            ? "text-[#004E98] border-b-2 border-[#004E98]"
                            : "text-gray-400 hover:text-gray-600 border-b-2 border-transparent"
                        }`}
                    >
                        <Link2 className="h-4 w-4" />
                        Connections ({filteredConnectionsList.length})
                    </button>
                    <button
                        onClick={() => onSubTabChange("segments")}
                        className={`flex items-center gap-2 pb-3 text-xs font-black uppercase tracking-widest transition-all ${
                            activeSubTab === "segments"
                            ? "text-[#004E98] border-b-2 border-[#004E98]"
                            : "text-gray-400 hover:text-gray-600 border-b-2 border-transparent"
                        }`}
                    >
                        <Target className="h-4 w-4" />
                        Segments ({filteredSegmentRows.length})
                    </button>
                    
                    {/* Info icon to the right of the tabs */}
                    <div className="pb-3 ml-auto">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="text-xs">
                                    {activeSubTab === "connections" 
                                        ? "Stakeholder interdependencies mapped in the ecosystem." 
                                        : "Behavioral clustering indicating risks or opportunities."}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </TooltipProvider>

            {/* ── Content View ─────────────────────────────────────────────── */}
            {activeSubTab === "connections" ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    {/* Accordion List */}
                    {segmentsLoading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="h-10 w-10 animate-spin text-[#004E98]" />
                        </div>
                    ) : filteredConnectionsList.length === 0 ? (
                        <Card className="border-gray-100 shadow-sm overflow-hidden rounded-2xl">
                            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                                <Search className="h-10 w-10 text-gray-300 mb-4" />
                                <h3 className="text-lg font-bold text-gray-900">No connections found</h3>
                                <p className="text-gray-500 font-medium">No connection groups match your criteria.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-gray-100 shadow-sm overflow-hidden rounded-2xl">
                            <CardContent className="p-0">
                                <Accordion type="single" collapsible className="w-full divide-y divide-gray-50">
                                    {filteredConnectionsList.map((item) => (
                                        <AccordionItem key={item.id} value={item.id} className="border-none">
                                            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50/50 transition-colors">
                                                <div className="flex items-center gap-4 text-left w-full">
                                                    <div className={`p-2.5 rounded-xl border bg-gradient-to-br ${getGradientForCohort(item.id)} shadow-sm`}>
                                                        {getIconForCohort(item.id)}
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                                            {item.name}
                                                            <Badge className="bg-[#004E98] hover:bg-[#004E98]/90 text-white text-[10px] font-black h-5 px-1.5">
                                                                {item.count}
                                                            </Badge>
                                                        </h3>
                                                        <p className="text-xs text-gray-500 font-medium mt-0.5">{item.description}</p>
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="px-0 pb-0 border-t border-gray-50">
                                                <div className="bg-gray-50/30 px-6 py-4">
                                                    {item.stakeholders.length > 0 ? (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                            {item.stakeholders.map((sh, idx) => (
                                                                <div 
                                                                    key={`${item.id}-sh-${sh.id || idx}`} 
                                                                    className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                                                    onClick={() => sh.id && onViewProfile(sh.id)}
                                                                >
                                                                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100">
                                                                        <span className="text-[10px] font-black text-gray-400 uppercase">{(sh.firstName || "S").charAt(0)}</span>
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-bold text-gray-900 truncate">{sh.firstName} {sh.lastName}</p>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <Badge variant="outline" className={`${STAKEHOLDER_TYPE_COLORS[sh.type || "other"]} text-[9px] px-1.5 py-0 h-4 font-bold tracking-tight uppercase truncate`}>
                                                                                {sh.type === "international_student" ? "International Student" : (sh.type || "stakeholder").replace('_', ' ')}
                                                                            </Badge>
                                                                            {sh.organization && (
                                                                                <span className="text-[10px] text-gray-500 font-medium truncate">
                                                                                    {sh.organization}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-gray-100 shrink-0 text-gray-400">
                                                                        <ArrowRight className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-gray-500 text-center py-4">No stakeholders found in this group.</p>
                                                    )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </CardContent>
                        </Card>
                    )}
                </div>
            ) : (
                /* ── Segments View ────────────────────────────────────────────── */
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">


                    {/* Segments Table (Mirrored from Connections) */}
                    <Card className="border-gray-100 shadow-sm overflow-hidden rounded-2xl">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-gray-50/50">
                                    <TableRow className="hover:bg-transparent border-gray-100">
                                        <TableHead className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest pl-6">Stakeholder</TableHead>
                                        <TableHead className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center">Segment</TableHead>
                                        <TableHead className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Organization</TableHead>
                                        <TableHead className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest hidden md:table-cell">Context</TableHead>
                                        <TableHead className="py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {segmentsLoading ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[#D0AC01]" /></TableCell></TableRow>
                                    ) : filteredSegmentRows.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-20 text-gray-400 font-medium italic">No stakeholders matching these segment criteria.</TableCell></TableRow>
                                    ) : filteredSegmentRows.map((row, idx) => (
                                        <TableRow key={`${row.stakeholder.id}-${row.segment.id}-${idx}`} className="hover:bg-gray-50/80 transition-colors border-gray-50">
                                            <TableCell className="py-5 pl-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center border border-gray-100">
                                                        <span className="text-[10px] font-black text-gray-400 uppercase">{(row.stakeholder.firstName || "S").charAt(0)}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900 text-sm line-clamp-1">{row.stakeholder.firstName} {row.stakeholder.lastName}</p>
                                                        <Badge variant="outline" className={`${STAKEHOLDER_TYPE_COLORS[row.stakeholder.type || "other"]} text-[9px] px-1.5 py-0 font-black h-4 uppercase`}>
                                                            {row.stakeholder.type || "stakeholder"}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-5 text-center px-4">
                                                <div className="flex flex-col items-center">
                                                    <Badge className="bg-[#D0AC01] text-white text-[9px] font-black tracking-tighter uppercase px-2">
                                                        {row.segment.name}
                                                    </Badge>
                                                    <div className="flex items-center gap-1 mt-1 text-gray-100">
                                                        <Target className="h-3 w-3" />
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-5">
                                                <p className="font-bold text-gray-900 text-sm line-clamp-1">{row.stakeholder.organization || "No Organization Affiliate"}</p>
                                            </TableCell>
                                            <TableCell className="py-5 hidden md:table-cell">
                                                <p className="text-xs text-gray-500 font-medium italic line-clamp-2 max-w-xs">
                                                    {row.segment.description}
                                                </p>
                                            </TableCell>
                                            <TableCell className="py-5">
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-gray-900 rounded-lg">
                                                    <ArrowRight className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>

                        {/* Pagination Footer - Mirrored from Connections */}
                        <div className="mt-8 flex items-center justify-between border-t border-gray-50 pt-8">
                            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                Page <span className="text-[#004E98]">{segPage}</span> of {segTotalPages || 1}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onSegPageChange(Math.max(1, segPage - 1))}
                                    disabled={segPage === 1 || segmentsLoading}
                                    className="h-10 px-5 rounded-xl border-gray-100 font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all"
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onSegPageChange(Math.min(segTotalPages, segPage + 1))}
                                    disabled={segPage >= (segTotalPages || 1) || segmentsLoading}
                                    className="h-10 px-5 rounded-xl border-gray-100 font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all"
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
