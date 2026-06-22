import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Building2, ClipboardList, MapPin, Search, CheckCircle2,
    RotateCw, AlertTriangle, ArrowRight, Loader2, ChevronRight, UserCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

export interface AccreditationProcess {
    id: string;
    stakeholderId: string;
    stage: string;
    status: string;
    assignedOfficerId?: string;
    assignedOfficerName?: string;
    applicationDate?: string;
    assessmentDate?: string;
    decisionDate?: string;
    renewalDate?: string;
    slaDeadline?: string;
    notes?: string;
    createdAt: string;
    stakeholderName: string;
    organization?: string;
}

interface AccreditationKanbanProps {
    processes: AccreditationProcess[];
    onStageChange: (id: string, newStage: string) => void;
    onProcessClick: (id: string) => void;
    isLoading?: boolean;
}

const ACCREDITATION_STAGES = [
    "inquiry",
    "application_submitted",
    "assessment_visit",
    "under_review",
    "active_partner",
    "renewal",
    "lapsed"
];

const STAGE_LABELS: Record<string, string> = {
    inquiry: "Inquiry (Stage 1)",
    application_submitted: "App Submitted (Stage 2)",
    assessment_visit: "Assessment Visit (Stage 3)",
    under_review: "Under Review (Stage 4)",
    active_partner: "Accredited (Stage 5)",
    renewal: "Renewal (Stage 6)",
    lapsed: "Lapsed (Stage 7)"
};

export function AccreditationKanban({ processes, onStageChange, onProcessClick, isLoading }: AccreditationKanbanProps) {
    const groupedProcesses = ACCREDITATION_STAGES.reduce((acc, stage) => {
        acc[stage] = processes.filter(p => p.stage === stage);
        return acc;
    }, {} as Record<string, AccreditationProcess[]>);

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-20 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 animate-pulse" />
                ))}
            </div>
        );
    }

    const columnColors: Record<string, string> = {
        inquiry: "from-blue-50/50 to-white",
        application_submitted: "from-purple-50/50 to-white",
        assessment_visit: "from-orange-50/50 to-white",
        under_review: "from-amber-50/50 to-white",
        active_partner: "from-emerald-50/50 to-white",
        renewal: "from-teal-50/50 to-white",
        lapsed: "from-rose-50/50 to-white"
    };

    const iconColors: Record<string, string> = {
        inquiry: "text-blue-500",
        application_submitted: "text-purple-500",
        assessment_visit: "text-orange-500",
        under_review: "text-amber-500",
        active_partner: "text-emerald-500",
        renewal: "text-teal-500",
        lapsed: "text-rose-500"
    };

    return (
        <Card className="border-gray-100 shadow-sm overflow-hidden rounded-2xl">
            <CardContent className="p-0">
                <Accordion type="multiple" defaultValue={["inquiry", "application_submitted", "assessment_visit"]} className="w-full divide-y divide-gray-50">
                    {ACCREDITATION_STAGES.map((stage) => {
                        const StageIcon = stage === "inquiry" ? Search
                            : stage === "application_submitted" ? ClipboardList
                            : stage === "assessment_visit" ? MapPin
                            : stage === "under_review" ? Building2
                            : stage === "active_partner" ? CheckCircle2
                            : stage === "renewal" ? RotateCw
                            : AlertTriangle;
                            
                        const processesInStage = groupedProcesses[stage] || [];

                        return (
                            <AccordionItem key={stage} value={stage} className="border-none">
                                <AccordionTrigger className={`px-6 py-4 hover:no-underline bg-gradient-to-r ${columnColors[stage]} transition-colors`}>
                                    <div className="flex items-center gap-4 text-left w-full">
                                        <div className="p-2.5 rounded-xl bg-white shadow-sm border border-gray-100/50">
                                            <StageIcon className={`h-5 w-5 ${iconColors[stage]}`} />
                                        </div>
                                        <div className="flex-1 flex items-center justify-between pr-4">
                                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                                {STAGE_LABELS[stage]}
                                            </h3>
                                            <Badge variant="secondary" className="h-6 px-2 text-[11px] font-black bg-white border-gray-100 shadow-sm text-gray-600">
                                                {processesInStage.length} {processesInStage.length === 1 ? 'Institution' : 'Institutions'}
                                            </Badge>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-6 pb-6 pt-2 border-t border-gray-50/50 bg-gray-50/30">
                                    {processesInStage.length === 0 ? (
                                        <div className="py-8 flex flex-col items-center justify-center opacity-40 text-center">
                                            <StageIcon className="h-8 w-8 mb-3" />
                                            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">No institutions in this stage</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                                            {processesInStage.map(p => (
                                                <KanbanCard
                                                    key={p.id}
                                                    process={p}
                                                    onStageChange={onStageChange}
                                                    onClick={() => onProcessClick(p.stakeholderId)} 
                                                />
                                            ))}
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            </CardContent>
        </Card>
    );
}

function KanbanCard({ process, onStageChange, onClick }: {
    process: AccreditationProcess;
    onStageChange: (id: string, newStage: string) => void;
    onClick: () => void;
}) {
    const getSlaStatus = () => {
        if (process.stage !== "application_submitted" || !process.slaDeadline) return null;
        
        const deadline = new Date(process.slaDeadline).getTime();
        const now = Date.now();
        const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return { text: "Overdue", color: "text-rose-600 bg-rose-50 border-rose-100" };
        if (diffDays <= 14) return { text: `${diffDays}d left`, color: "text-amber-600 bg-amber-50 border-amber-100" };
        return { text: `${diffDays}d left`, color: "text-[#004E98] bg-blue-50 border-blue-100" };
    };

    const slaStatus = getSlaStatus();

    return (
        <Card
            className="group relative bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden rounded-xl"
            onClick={onClick}
        >
            <div className={`absolute top-0 left-0 right-0 h-1 ${
                process.stage === 'inquiry' ? 'bg-blue-500/50' :
                process.stage === 'application_submitted' ? 'bg-purple-500/50' :
                process.stage === 'assessment_visit' ? 'bg-orange-500/50' :
                process.stage === 'under_review' ? 'bg-amber-500/50' :
                process.stage === 'active_partner' ? 'bg-emerald-500/50' :
                process.stage === 'renewal' ? 'bg-teal-500/50' :
                'bg-rose-500/50'
            }`} />

            <CardContent className="p-4 pt-5">
                <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100 shrink-0">
                        <Building2 className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-[13px] font-bold text-gray-900 leading-tight group-hover:text-[#004E98] transition-colors truncate">
                            {process.organization || process.stakeholderName}
                        </h4>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5" title={process.assignedOfficerName || "Unassigned"}>
                            Assigned: {process.assignedOfficerName || "Unassigned"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#004E98] hover:bg-blue-50 transition-all gap-1.5 rounded-lg"
                                onClick={(e) => e.stopPropagation()}
                            >
                                Change Stage <ChevronRight className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 rounded-xl border-none shadow-xl p-2 bg-white ring-1 ring-black/5 z-[200]">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-[2px] text-gray-400 px-3 py-2">Move To</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-gray-50 my-1" />
                            {ACCREDITATION_STAGES.filter(s => s !== process.stage).map(stage => (
                                <DropdownMenuItem
                                    key={stage}
                                    className="text-[11px] font-bold uppercase tracking-tight py-2.5 px-3 rounded-lg focus:bg-blue-50 focus:text-[#004E98] cursor-pointer transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStageChange(process.id, stage);
                                    }}
                                >
                                    {STAGE_LABELS[stage]}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    
                    {slaStatus ? (
                        <Badge variant="outline" className={`h-5 px-1.5 text-[9px] font-black uppercase tracking-widest ${slaStatus.color}`}>
                            {slaStatus.text}
                        </Badge>
                    ) : (
                        <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-[#004E98] transition-all transform group-hover:translate-x-1" />
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
