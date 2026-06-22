import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Users, TrendingUp, DollarSign, 
    ChevronRight, Zap, Target, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from "@/components/ui/dropdown-menu";

export interface KanbanItem {
    id: string;
    client: string;
    revenue: string | null;
    stage: string;
    marketerId: string;
    bdName: string;
    remarks?: string | null;
    updatedAt: string;
}

interface MarketingKanbanProps {
    data: Record<string, KanbanItem[]>;
    pipelineType: 'B2C' | 'B2B';
    onStatusChange: (id: string, newStatus: string, currentStatus: string) => void;
    isLoading?: boolean;
}

const B2C_COLUMNS = [
    { id: 'lead', label: 'Lead', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50/30' },
    { id: 'prospect_registration', label: 'Prospect Registration', icon: Target, color: 'text-amber-500', bg: 'bg-amber-50/30' },
    { id: 'prospect_booking', label: 'Prospect Booking', icon: TrendingUp, color: 'text-[#D0AC01]', bg: 'bg-yellow-50/30' },
];

const B2B_COLUMNS = [
    { id: 'lead', label: 'Lead', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50/30' },
    { id: 'prospect_opportunity', label: 'Prospect Opportunity', icon: Target, color: 'text-amber-500', bg: 'bg-amber-50/30' },
    { id: 'prospect_engagement', label: 'Prospect Engagement', icon: Target, color: 'text-[#D0AC01]', bg: 'bg-yellow-50/30' },
    { id: 'expected_order', label: 'Expected Order', icon: TrendingUp, color: 'text-[#e55f00]', bg: 'bg-orange-50/30' },
    { id: 'sales_won', label: 'Sales Won', icon: DollarSign, color: 'text-[#01a64e]', bg: 'bg-emerald-50/30' },
];

const STAGE_LABELS: Record<string, string> = {
    lead: 'Lead',
    prospect_registration: 'Prospect Registration',
    prospect_booking: 'Prospect Booking',
    converted: 'Converted',
    dormant: 'Dormant Student',
    prospect_opportunity: 'Prospect Opportunity',
    prospect_engagement: 'Prospect Engagement',
    expected_order: 'Expected Order',
    sales_won: 'Sales Won',
    lost: 'Lost',
};

export function MarketingKanban({ data, pipelineType, onStatusChange, isLoading }: MarketingKanbanProps) {
    const columns = pipelineType === 'B2C' ? B2C_COLUMNS : B2B_COLUMNS;
    const availableStages = pipelineType === 'B2C' 
        ? ['lead', 'prospect_registration', 'prospect_booking', 'dormant', 'lost']
        : ['lead', 'prospect_opportunity', 'prospect_engagement', 'expected_order', 'sales_won', 'lost'];
    if (isLoading) {
        return (
            <div className="flex overflow-x-auto pb-4 gap-4 sm:gap-6 min-h-[400px]">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="min-w-[280px] sm:min-w-[300px] bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div>
            {/* Mobile scroll hint */}
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 sm:hidden">
                <span>←</span> Swipe to see all stages <span>→</span>
            </p>
            <div className="flex overflow-x-auto pb-6 gap-4 sm:gap-6 min-h-[500px] snap-x snap-mandatory custom-scrollbar transition-all">
                {columns.map(col => (
                    <div key={col.id} className="min-w-[280px] sm:min-w-[300px] h-full flex-shrink-0 snap-start">
                        <KanbanColumn 
                            column={col} 
                            items={data[col.id] || []} 
                            availableStages={availableStages}
                            onStatusChange={onStatusChange}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

function KanbanColumn({ column, items, availableStages, onStatusChange }: { 
    column: any; 
    items: KanbanItem[]; 
    availableStages: string[];
    onStatusChange: (id: string, newStatus: string, currentStatus: string) => void;
}) {
    const Icon = column.icon;

    return (
        <div className={`flex flex-col rounded-2xl border border-gray-100 shadow-sm h-full max-h-[600px] overflow-hidden ${column.bg}`}>
            <div className="p-4 flex items-center justify-between border-b bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${column.color}`} />
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-tighter">{column.label}</h3>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-black bg-white border-gray-100 text-gray-500">
                        {items.length}
                    </Badge>
                </div>
            </div>

            <ScrollArea className="flex-1 p-3">
                <div className="space-y-3">
                    {items.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center opacity-20 text-center px-4">
                            <Icon className="h-8 w-8 mb-2" />
                            <p className="text-[10px] font-bold uppercase tracking-widest">No stage items</p>
                        </div>
                    ) : (
                        items.map(item => (
                            <KanbanCard 
                                key={item.id} 
                                item={item} 
                                availableStages={availableStages}
                                onStatusChange={onStatusChange}
                            />
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

function KanbanCard({ item, availableStages, onStatusChange }: { 
    item: KanbanItem; 
    availableStages: string[];
    onStatusChange: (id: string, newStatus: string, currentStatus: string) => void;
}) {
    const getInitials = (name?: string) => {
        if (!name) return "U";
        return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
    };

    const formatCurrency = (amount: string | null) => {
        if (!amount) return "KES 0";
        const num = parseFloat(amount.replace(/[^0-9.]/g, ''));
        if (isNaN(num)) return amount;
        return "KES " + num.toLocaleString("en-KE");
    };

    return (
        <Card className="group relative bg-white border-0 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden rounded-2xl ring-1 ring-black/[0.03]">
            <CardContent className="p-4 pt-5">
                <div className="flex justify-between items-start mb-3">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <h4 className="text-[13px] font-black text-gray-900 leading-[1.3] group-hover:text-[#004E98] transition-colors line-clamp-2 uppercase tracking-tight min-h-[34px]">
                                    {item.client}
                                </h4>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[300px] p-4 rounded-xl shadow-2xl border-none bg-white/95 backdrop-blur-md ring-1 ring-black/5">
                                <p className="text-xs font-medium text-gray-600 leading-relaxed">
                                    {item.remarks || "No remarks available."}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <div className="flex items-center gap-2 mb-4">
                    <div className="p-1 px-2 bg-[#01a64e]/10 rounded-lg flex items-center gap-1.5">
                        <TrendingUp className="h-3 w-3 text-[#01a64e]" />
                        <span className="text-[11px] font-black text-[#01a64e]">
                            {formatCurrency(item.revenue)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50/50 rounded-xl border border-gray-100/50">
                    <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center text-[10px] font-black text-[#004E98] border border-gray-100 shadow-sm">
                        {getInitials(item.bdName)}
                    </div>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight">
                        {item.bdName}
                    </span>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 px-2 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-[#004E98] hover:bg-blue-50 transition-all gap-1.5 rounded-lg"
                                onClick={(e) => e.stopPropagation()}
                            >
                                Stage <ChevronRight className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 rounded-2xl border-none shadow-2xl p-2 ring-1 ring-black/5 bg-white/95 backdrop-blur-md">
                            <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-[2px] text-gray-400 px-3 py-2">Move Stage</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-gray-50 my-1" />
                            {availableStages.filter(s => s !== item.stage).map(stage => (
                                <DropdownMenuItem  
                                    key={stage}
                                    className="text-[10px] font-black uppercase tracking-tight py-2 px-3 rounded-xl focus:bg-blue-50 focus:text-[#004E98] cursor-pointer gap-3 transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStatusChange(item.id, stage, item.stage);
                                    }}
                                >
                                    <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                                    {STAGE_LABELS[stage] || stage}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-[#004E98] transition-all transform group-hover:translate-x-1" />
                </div>
            </CardContent>
        </Card>
    );
}
