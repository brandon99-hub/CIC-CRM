import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, Search, Target, Activity, TrendingUp, AlertTriangle, GraduationCap, Globe, Briefcase, ShieldCheck, Info, Car, HeartPulse, Heart, Home, Anchor, UserPlus, Banknote, Users, Star, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getSegmentDescription } from "./segment-definitions";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { STAKEHOLDER_TYPE_COLORS } from "./stakeholder-type-colors";
import type { Relationship } from "./stakeholder-types";

interface RelationshipsTabProps {
    searchQuery: string;
    onSearchChange: (search: string) => void;
    typeFilter: string;
    onTypeFilterChange: (type: string) => void;
    segments: any[];
    segmentsLoading: boolean;
    onViewProfile: (id: string) => void;
}

export function RelationshipsTab({
    searchQuery,
    onSearchChange,
    typeFilter,
    onTypeFilterChange,
    segments = [],
    segmentsLoading = false,
    onViewProfile
}: RelationshipsTabProps) {

    const filteredSegmentsList = useMemo(() => {
        const segMap = new Map<string, { id: string; name: string; description: string; count: number; stakeholders: any[] }>();
        segments.forEach((s: any) => {
            (s.segments || []).forEach((seg: any) => {
                if (!segMap.has(seg.id)) segMap.set(seg.id, { ...seg, count: 0, stakeholders: [] });
                const entry = segMap.get(seg.id)!;
                entry.count++;
                entry.stakeholders.push(s);
            });
        });

        const searchLower = searchQuery.toLowerCase();
        return Array.from(segMap.values()).filter(item => {
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

    const getIconForSegment = (id: string) => {
        const lowerId = id.toLowerCase();
        if (lowerId.includes("motor")) return <Car className="h-6 w-6" />;
        if (lowerId.includes("medical")) return <HeartPulse className="h-6 w-6" />;
        if (lowerId.includes("life")) return <Heart className="h-6 w-6" />;
        if (lowerId.includes("property")) return <Home className="h-6 w-6" />;
        if (lowerId.includes("marine")) return <Anchor className="h-6 w-6" />;
        if (lowerId.includes("pension") || lowerId.includes("high_value")) return <Banknote className="h-6 w-6" />;
        if (lowerId.includes("sacco") || lowerId.includes("corporate")) return <Users className="h-6 w-6" />;
        if (lowerId.includes("agent")) return <Briefcase className="h-6 w-6" />;
        if (lowerId.includes("new_client")) return <Star className="h-6 w-6" />;
        if (lowerId.includes("renewal")) return <RefreshCw className="h-6 w-6" />;
        if (lowerId.includes("international")) return <Globe className="h-6 w-6" />;
        if (lowerId.includes("dormant") || lowerId.includes("lapsed")) return <Activity className="h-6 w-6" />;
        if (lowerId.includes("promoter")) return <TrendingUp className="h-6 w-6" />;
        if (lowerId.includes("risk") || lowerId.includes("detractor")) return <AlertTriangle className="h-6 w-6" />;
        return <Target className="h-6 w-6" />;
    };

    const getGradientForSegment = (id: string) => {
        const lowerId = id.toLowerCase();
        if (lowerId.includes("motor")) return "from-blue-500/10 to-blue-600/10 text-blue-600 border-blue-200/50";
        if (lowerId.includes("medical") || lowerId.includes("life")) return "from-rose-500/10 to-rose-600/10 text-rose-600 border-rose-200/50";
        if (lowerId.includes("property") || lowerId.includes("marine")) return "from-cyan-500/10 to-cyan-600/10 text-cyan-600 border-cyan-200/50";
        if (lowerId.includes("new_client") || lowerId.includes("promoter")) return "from-emerald-500/10 to-emerald-600/10 text-emerald-600 border-emerald-200/50";
        if (lowerId.includes("sacco") || lowerId.includes("corporate")) return "from-indigo-500/10 to-indigo-600/10 text-indigo-600 border-indigo-200/50";
        if (lowerId.includes("risk") || lowerId.includes("detractor")) return "from-red-500/10 to-red-600/10 text-red-600 border-red-200/50";
        if (lowerId.includes("renewal")) return "from-amber-500/10 to-amber-600/10 text-amber-600 border-amber-200/50";
        if (lowerId.includes("dormant") || lowerId.includes("lapsed")) return "from-slate-500/10 to-slate-600/10 text-slate-600 border-slate-200/50";
        return "from-[#D0AC01]/10 to-[#D0AC01]/5 text-[#D0AC01] border-[#D0AC01]/20";
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ── Header card — matches Case Management All Cases pattern ── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                {/* Row 1: Branding & Global Actions */}
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#D0AC01]/10 p-3 rounded-lg flex-shrink-0">
                            <Target className="h-6 w-6 text-[#D0AC01]" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 leading-none">
                                Segments
                            </h3>
                            <p className="text-sm text-gray-500 mt-2 flex items-center gap-1.5 font-medium">
                                Behavioral clustering indicating risks or opportunities
                            </p>
                        </div>
                    </div>
                </div>

                {/* Row 2: Search & Granular Filters */}
                <div className="px-5 pb-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex flex-1 items-center gap-4 max-w-2xl">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search segments..."
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="pl-12 h-11 bg-white border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/10 font-bold text-sm"
                            />
                        </div>

                        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
                            <SelectTrigger className="w-[220px] h-11 bg-white border-gray-200/50 rounded-xl font-bold px-4 text-xs">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                                <SelectItem value="all" className="font-bold">All Categories</SelectItem>
                                <SelectItem value="seg:promoter" className="font-bold">Promoters</SelectItem>
                                <SelectItem value="seg:detractor" className="font-bold">Detractors</SelectItem>
                                <SelectItem value="seg:churn_risk" className="font-bold">Churn Risk</SelectItem>
                                <SelectItem value="seg:exam_ready" className="font-bold">Ready</SelectItem>
                                <SelectItem value="seg:exam_critical" className="font-bold">Critical Risk</SelectItem>
                                <SelectItem value="seg:certification_pending" className="font-bold">Pending Processing</SelectItem>
                                <SelectItem value="seg:near_completion" className="font-bold">Near Completion</SelectItem>
                                <SelectItem value="qual" className="font-bold">Qualifications</SelectItem>
                                <SelectItem value="international" className="font-bold">International Stakeholders</SelectItem>
                                <SelectItem value="dormant" className="font-bold">Dormant</SelectItem>
                                <SelectItem value="employer" className="font-bold">Employers</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* ── Content View ─────────────────────────────────────────────── */}
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                {/* Accordion List */}
                {segmentsLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-10 w-10 animate-spin text-[#004E98]" />
                    </div>
                ) : filteredSegmentsList.length === 0 ? (
                    <Card className="border-gray-100 shadow-sm overflow-hidden rounded-2xl">
                        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                            <Search className="h-10 w-10 text-gray-300 mb-4" />
                            <h3 className="text-lg font-bold text-gray-900">No segments found</h3>
                            <p className="text-gray-500 font-medium">No segment groups match your criteria.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="border-gray-100 shadow-sm overflow-hidden rounded-2xl">
                        <CardContent className="p-0">
                            <Accordion type="single" collapsible className="w-full divide-y divide-gray-50">
                                {filteredSegmentsList.map((item) => (
                                    <AccordionItem key={item.id} value={item.id} className="border-none">
                                        <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50/50 transition-colors">
                                            <div className="flex items-center gap-4 text-left w-full">
                                                <div className={`p-2.5 rounded-xl border bg-gradient-to-br ${getGradientForSegment(item.id)} shadow-sm`}>
                                                    {getIconForSegment(item.id)}
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                                        {item.name}
                                                        <Badge className="bg-[#D0AC01] text-white text-[10px] font-black h-5 px-1.5">
                                                            {item.count}
                                                        </Badge>
                                                        <TooltipProvider>
                                                            <Tooltip delayDuration={200}>
                                                                <TooltipTrigger asChild>
                                                                    <div className="ml-2 cursor-help p-1 rounded-full hover:bg-gray-100 transition-colors">
                                                                        <Info className="h-4 w-4 text-gray-400" />
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="bg-white border border-gray-100 text-gray-700 shadow-xl max-w-[250px] p-3 rounded-lg z-50">
                                                                    <p className="text-xs font-medium leading-relaxed">{getSegmentDescription(item.name) || item.description}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </h3>
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
        </div>
    );
}
