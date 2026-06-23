import { useState } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, Legend, Cell,
    ComposedChart, Area, Line, ReferenceLine
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Info, AlertTriangle, Users, Target, Calendar, Award } from "lucide-react";

export interface ExpectedOrderDeal {
    name: string;
    value: number;
}

export interface HistoricalData {
    lead_entered: number;
    opportunity_entered: number;
    engagement_entered: number;
    expected_order_entered: number;
    sales_won: number;
}

export interface StudentPipelineData {
    lead: number;
    leadRevenue?: number;
    registration: number;
    registrationRevenue?: number;
    booking: number;
    bookingRevenue?: number;
    converted: number;
    convertedRevenue?: number;
}

export interface StudentHistoricalData {
    lead_entered: number;
    converted: number;
}

interface ForecastData {
    stage: string;
    actual: number;
    weighted: number;
    prob: number;
}

interface ForecastingChartProps {
    data: ForecastData[];
    isLoading?: boolean;
    historicalData?: HistoricalData;
    quarterlyTarget?: number;
    expectedOrderDeals?: ExpectedOrderDeal[];
    // Student Pipeline Props
    studentData?: StudentPipelineData;
    studentHistoricalData?: StudentHistoricalData;
    studentReturningRebookers?: number;
    studentRebookingRate?: number;
    dormantStudentCount?: number;
    pipelineMode: "B2C" | "B2B";
    bookingTarget?: number;
    isProbabilityEstimated?: boolean;
    staleCounts?: Record<string, number>;
    pipelineVelocity?: number;
    avgSalesCycleLength?: number;
    selectedCycle?: string;
    setSelectedCycle?: (cycle: string) => void;
    selectedCycleYear?: string;
    setSelectedCycleYear?: (year: string) => void;
}

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const isStudentTab = payload[0].payload.rawVolume !== undefined;

        if (isStudentTab) {
            return (
                <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-black/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{label}</p>
                    <div className="space-y-3">
                        {payload.map((p: any, idx: number) => {
                            const value = p.value;
                            const name = p.name;
                            const color = p.color || '#004E98';
                            
                            // Find corresponding revenue dynamically
                            let moneyValue = 0;
                            if (name.includes("Raw Student Volume")) {
                                moneyValue = p.payload.rawRevenue || 0;
                            } else if (name.includes("Projected Converts")) {
                                moneyValue = p.payload.projectedRevenue || 0;
                            } else if (name.includes("Returning Rebookers")) {
                                moneyValue = (p.payload.returningRebookers || 0) * (p.payload.avgBookingFee || 3800);
                            }
                            return (
                                <div key={idx} className="space-y-1">
                                    <div className="flex items-center justify-between gap-8">
                                        <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                                            {name}:
                                        </span>
                                        <span className="text-[11px] font-black text-gray-900">
                                            {value} {value === 1 ? 'Student' : 'Students'}
                                        </span>
                                    </div>
                                    {moneyValue > 0 && (
                                        <div className="flex items-center justify-between gap-8 pl-3">
                                            <span className="text-[10px] font-medium text-gray-400">Value:</span>
                                            <span className="text-[10px] font-bold text-slate-600">{formatCurrency(moneyValue)}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {payload[0].payload.prob !== undefined && (
                            <div className="pt-2 border-t border-gray-50 mt-2">
                                <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none text-[9px] font-black uppercase tracking-tight">
                                    {payload[0].payload.stage === 'Lead' ? `${payload[0].payload.prob}% Lead Conversion` : 
                                     payload[0].payload.stage === 'Registered' ? `${payload[0].payload.prob}% Dynamic Booking Predictor` : 
                                     '100% Sitting Booked'}
                                </Badge>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // Organisation tab
        const volume = payload[0].payload.volume ?? 0;
        const stale = payload[0].payload.stale ?? 0;
        const slaLimit = payload[0].payload.slaLimit ?? 30;
        const isSalesWon = label.toLowerCase() === 'sales won' || label.toLowerCase() === 'sales_won';

        return (
            <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-black/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{label}</p>
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-8">
                        <span className="text-[11px] font-bold text-gray-500">Deals in Stage:</span>
                        <span className="text-[11px] font-black text-gray-900">
                            {volume} {volume === 1 ? 'Deal' : 'Deals'}
                            {!isSalesWon && stale > 0 ? ` (${stale} Stale > ${slaLimit} days)` : ''}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-8">
                        <span className="text-[11px] font-bold text-gray-500">Pipeline Value:</span>
                        <span className="text-[11px] font-black text-gray-900">{formatCurrency(payload[0].value)}</span>
                    </div>
                    {payload[1] && (
                        <div className="flex items-center justify-between gap-8">
                            <span className="text-[11px] font-bold text-blue-500">Weighted Forecast:</span>
                            <span className="text-[11px] font-black text-blue-600">{formatCurrency(payload[1].value)}</span>
                        </div>
                    )}
                    {payload[0].payload.prob !== undefined && (
                        <div className="pt-2 border-t border-gray-50 mt-2">
                            <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none text-[9px] font-black uppercase tracking-tight">
                                {payload[0].payload.prob}% Probability {payload[0].payload.isProbabilityEstimated ? '(Est.)' : ''}
                            </Badge>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return null;
};

export function ForecastingChart({ 
    data, 
    isLoading,
    historicalData,
    quarterlyTarget,
    expectedOrderDeals,
    studentData,
    studentHistoricalData,
    studentReturningRebookers = 0,
    studentRebookingRate = 0,
    dormantStudentCount = 0,
    pipelineMode,
    bookingTarget = 100,
    isProbabilityEstimated = false,
    staleCounts = { lead: 0, opportunity: 0, engagement: 0, expected_order: 0 },
    pipelineVelocity = 0,
    avgSalesCycleLength = 60,
    selectedCycle = "August",
    setSelectedCycle,
    selectedCycleYear = new Date().getFullYear().toString(),
    setSelectedCycleYear
}: ForecastingChartProps) {
    const activeTab = pipelineMode === 'B2C' ? 'student' : 'organisation';

    if (isLoading) {
        return (
            <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden aspect-[2/1] animate-pulse">
                <CardContent className="h-full flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                        <TrendingUp className="h-8 w-8 text-gray-200" />
                        <div className="h-4 w-32 bg-gray-100 rounded" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    // ── Enhancement 1: Compute Dynamic Probabilities ────────────────────────
    const getStageProb = (stage: string): number => {
        const { lead_entered = 0, opportunity_entered = 0, engagement_entered = 0, expected_order_entered = 0, sales_won = 0 } = historicalData || {};
        switch (stage.toLowerCase()) {
            case 'lead':
                return lead_entered > 0 ? (sales_won / lead_entered) : 0.0;
            case 'opportunity':
                return opportunity_entered > 0 ? (sales_won / opportunity_entered) : 0.0;
            case 'engagement':
                return engagement_entered > 0 ? (sales_won / engagement_entered) : 0.0;
            case 'expected order':
            case 'expected_order':
                return expected_order_entered > 0 ? (sales_won / expected_order_entered) : 0.0;
            case 'sales won':
            case 'sales_won':
                return 1.0;
            default:
                return 0.0;
        }
    };

    const processedData = data.map(item => {
        const serverProb = item.prob !== undefined ? item.prob : undefined;
        const rawProb = getStageProb(item.stage);
        const probPercent = serverProb !== undefined ? serverProb : Math.min(100, Math.max(0, Math.round(rawProb * 100)));
        
        let volume = 0;
        let stale = 0;
        let slaLimit = 30;
        const stageLower = item.stage.toLowerCase();
        if (stageLower === 'lead') {
            volume = historicalData?.lead_entered || 0;
            stale = staleCounts?.lead || 0;
            slaLimit = 14;
        } else if (stageLower === 'opportunity') {
            volume = historicalData?.opportunity_entered || 0;
            stale = staleCounts?.opportunity || 0;
            slaLimit = 30;
        } else if (stageLower === 'engagement') {
            volume = historicalData?.engagement_entered || 0;
            stale = staleCounts?.engagement || 0;
            slaLimit = 45;
        } else if (stageLower === 'expected order' || stageLower === 'expected_order') {
            volume = historicalData?.expected_order_entered || 0;
            stale = staleCounts?.expected_order || 0;
            slaLimit = 30;
        } else if (stageLower === 'sales won' || stageLower === 'sales_won') {
            volume = historicalData?.sales_won || 0;
            stale = 0;
        }

        return {
            ...item,
            prob: probPercent,
            weighted: item.weighted !== undefined ? item.weighted : Math.round(item.actual * (probPercent / 100)),
            isProbabilityEstimated,
            volume,
            stale,
            slaLimit
        };
    });

    const totalWeighted = processedData.reduce((acc, curr) => acc + curr.weighted, 0);

    // X-Axis Custom Tick to render probability elegantly below stage labels
    const CustomXAxisTick = (props: any) => {
        const { x, y, payload } = props;
        const stage = payload.value;
        const item = processedData.find(d => d.stage === stage);
        const probLabel = item ? `${item.prob}% Prob${item.isProbabilityEstimated ? ' (Est.)' : ''}` : '';
        return (
            <g transform={`translate(${x},${y})`}>
                <text x={0} y={0} dy={16} textAnchor="middle" fill="#64748b" className="text-[10px] font-bold">
                    {stage}
                </text>
                <text x={0} y={0} dy={28} textAnchor="middle" fill="#94a3b8" className="text-[9px] font-semibold italic">
                    {probLabel}
                </text>
            </g>
        );
    };

    // ── Enhancement 2: Student Pipeline Calculations ─────────────────────────
    const studentBookingRate = studentHistoricalData && (studentHistoricalData as any).bookingRate !== undefined
        ? (studentHistoricalData as any).bookingRate
        : (studentHistoricalData && studentHistoricalData.lead_entered > 0
            ? (studentHistoricalData.converted / studentHistoricalData.lead_entered)
            : 0.15); // default fallback booking rate of 15%

    const registeredNotBooked = studentData?.registration || 0;
    
    // Dynamically calculate average booking fee per student based on active bookings
    const totalBookingVolume = studentData?.booking || 0;
    const avgBookingFee = totalBookingVolume > 0 
        ? Math.round((studentData?.bookingRevenue || 0) / totalBookingVolume)
        : 3800;

    const studentChartData = [
        {
            stage: 'Lead',
            rawVolume: studentData?.lead || 0,
            projectedConverts: Math.round((studentData?.lead || 0) * studentBookingRate),
            returningRebookers: 0,
            prob: Math.round(studentBookingRate * 100),
            rawRevenue: studentData?.leadRevenue || 0,
            projectedRevenue: Math.round((studentData?.leadRevenue || 0) * studentBookingRate),
            avgBookingFee
        },
        {
            stage: 'Registered',
            rawVolume: studentData?.registration || 0,
            projectedConverts: Math.round((studentData?.registration || 0) * studentBookingRate),
            returningRebookers: 0,
            prob: Math.round(studentBookingRate * 100),
            rawRevenue: studentData?.registrationRevenue || 0,
            projectedRevenue: Math.round((studentData?.registrationRevenue || 0) * studentBookingRate),
            avgBookingFee
        },
        {
            stage: 'Booked',
            rawVolume: studentData?.booking || 0,
            projectedConverts: 0, // Booked is the conversion event itself
            returningRebookers: studentReturningRebookers,
            prob: 100,
            rawRevenue: studentData?.bookingRevenue || 0,
            projectedRevenue: studentData?.bookingRevenue || 0,
            avgBookingFee
        }
    ];

    const confirmedRevenue = studentData?.bookingRevenue || 0;
    const projectedRevenue = Math.round(registeredNotBooked * avgBookingFee * studentBookingRate);

    // ── Enhancement 3: Concentration Risk Calculations ───────────────────────
    const totalDealsValue = expectedOrderDeals?.reduce((sum, deal) => sum + deal.value, 0) || 0;
    const hasHighConcentrationRisk = expectedOrderDeals?.some(deal => 
        totalDealsValue > 0 && (deal.value / totalDealsValue) > 0.5
    ) || false;

    const maxDeal = expectedOrderDeals && expectedOrderDeals.length > 0 
        ? Math.max(...expectedOrderDeals.map(d => d.value)) 
        : 0;
    const maxDealPct = totalDealsValue > 0 ? Math.round((maxDeal / totalDealsValue) * 100) : 0;

    let riskText = "Low";
    let riskColor = "text-[#01a64e]";
    if (maxDealPct > 50) {
        riskText = "High";
        riskColor = "text-red-500";
    } else if (maxDealPct > 25) {
        riskText = "Moderate";
        riskColor = "text-amber-500";
    }

    const formatShortCurrency = (amount: number) => {
        if (amount >= 1000000) {
            return `KES ${(amount / 1000000).toFixed(1)}M`;
        } else if (amount >= 1000) {
            return `KES ${(amount / 1000).toFixed(0)}K`;
        }
        return `KES ${amount}`;
    };

    // ── Enhancement 4: Benchmark Calculations ─────────────────────────────────
    const targetPercent = quarterlyTarget && quarterlyTarget > 0 
        ? Math.round((totalWeighted / quarterlyTarget) * 100) 
        : 0;

    const totalRawValue = processedData.reduce((acc, curr) => acc + curr.actual, 0);

    return (
        <div className="space-y-6">
            {activeTab === 'organisation' ? (
                <div className="space-y-6">
                    {/* B2B summary metric cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        <Card className="border-0 shadow-sm bg-[#faf9f6]/95 p-6 ring-1 ring-black/[0.03] rounded-2xl">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[1.5px] mb-1">Weighted Forecast</p>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">{formatShortCurrency(totalWeighted)}</h3>
                            <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider">Probability-adjusted total</p>
                        </Card>
                        <Card className="border-0 shadow-sm bg-[#faf9f6]/95 p-6 ring-1 ring-black/[0.03] rounded-2xl">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[1.5px] mb-1">Pipeline Value</p>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">{formatShortCurrency(totalRawValue)}</h3>
                            <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider">Raw total all stages</p>
                        </Card>
                        <Card className="border-0 shadow-sm bg-[#faf9f6]/95 p-6 ring-1 ring-black/[0.03] rounded-2xl">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[1.5px] mb-1">Quarterly Target</p>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">{formatShortCurrency(quarterlyTarget || 0)}</h3>
                            <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider">{targetPercent}% of target reached</p>
                        </Card>
                        <Card className="border-0 shadow-sm bg-[#faf9f6]/95 p-6 ring-1 ring-black/[0.03] rounded-2xl">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[1.5px] mb-1">Concentration Risk</p>
                            <h3 className={`text-xl font-black tracking-tight ${riskColor}`}>{riskText}</h3>
                            <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider">
                                {maxDealPct > 0 ? `1 deal = ${maxDealPct}% of Exp. Order` : "No active expected orders"}
                            </p>
                        </Card>
                        <Card className="border-0 shadow-sm bg-[#faf9f6]/95 p-6 ring-1 ring-black/[0.03] rounded-2xl">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[1.5px] mb-1">Pipeline Velocity</p>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">{formatShortCurrency(pipelineVelocity)}/day</h3>
                            <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider">
                                Avg Cycle: {avgSalesCycleLength} days
                            </p>
                        </Card>
                    </div>

                    <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden ring-1 ring-black/[0.03]">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6">
                            <div>
                                <CardTitle className="text-sm font-black text-gray-900 uppercase tracking-tighter flex items-center gap-2">
                                    Revenue Forecasting
                                    <div className="p-1 bg-blue-50 rounded-full"><TrendingUp className="h-3 w-3 text-blue-600" /></div>
                                </CardTitle>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Weighted Pipeline Analysis</p>
                            </div>
                        </CardHeader>
                        <CardContent className="px-2 pb-6">
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={processedData} margin={{ top: 20, right: 30, left: 10, bottom: 15 }}>
                                        <defs>
                                            <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#004E98" stopOpacity={0.1}/>
                                                <stop offset="95%" stopColor="#004E98" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="weightedGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#004E98" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#004E98" stopOpacity={0.4}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                        <XAxis 
                                            dataKey="stage" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={<CustomXAxisTick />}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                            tickFormatter={(value) => `KES ${value / 1000000}M`}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar 
                                            dataKey="actual" 
                                            fill="#f1f5f9" 
                                            radius={[8, 8, 0, 0]} 
                                            barSize={40} 
                                        />
                                        <Bar 
                                            dataKey="weighted" 
                                            fill="url(#weightedGradient)" 
                                            radius={[8, 8, 0, 0]} 
                                            barSize={40} 
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="weighted" 
                                            fill="url(#actualGradient)" 
                                            stroke="#004E98" 
                                            strokeWidth={2}
                                        />
                                        {quarterlyTarget && (
                                            <ReferenceLine 
                                                y={quarterlyTarget} 
                                                stroke="#ef4444" 
                                                strokeDasharray="4 4" 
                                                label={{ value: 'Target', position: 'top', fill: '#ef4444', fontSize: 10, fontWeight: 700 }} 
                                            />
                                        )}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Probability Progress Indicators */}
                            <div className="grid grid-cols-5 gap-4 mt-6 px-4">
                                {processedData.map((item, idx) => (
                                    <div key={idx} className="flex flex-col gap-1">
                                        <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                                            <div 
                                                className="h-full bg-blue-600 transition-all duration-1000" 
                                                style={{ width: `${item.prob}%` }}
                                            />
                                        </div>
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mt-1">
                                            {item.prob}% Prob{item.isProbabilityEstimated ? ' (Est.)' : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Concentration Warning Banner */}
                            {hasHighConcentrationRisk && (
                                <div className="mt-6 mx-4 p-4 bg-amber-50/50 border border-amber-100 rounded-2xl flex items-center gap-3">
                                    <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                                    <p className="text-xs font-semibold text-amber-700">
                                        Concentration Warning: A single prospective partner account holds more than 50% of your active expected orders value. High client concentration exposure detected.
                                    </p>
                                </div>
                            )}

                            {/* Concentration Risk Section */}
                            {expectedOrderDeals && expectedOrderDeals.length > 0 && (
                                <div className="mt-8 pt-8 border-t border-gray-100 px-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                                Expected Order Deal Breakdown
                                                {hasHighConcentrationRisk && (
                                                    <Badge className="bg-red-50 text-red-600 border border-red-100 text-[10px] uppercase font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <AlertTriangle className="h-3 w-3 text-red-500" />
                                                        High concentration risk
                                                    </Badge>
                                                )}
                                            </h4>
                                            <p className="text-[10px] text-gray-400 mt-1">Detailed analysis of large transactions currently in review.</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        {expectedOrderDeals.map((deal, idx) => {
                                            const pct = totalDealsValue > 0 ? Math.round((deal.value / totalDealsValue) * 100) : 0;
                                            return (
                                                <div 
                                                    key={idx} 
                                                    className={`p-4 rounded-2xl border transition-all duration-300 ${
                                                        pct > 50 
                                                            ? 'bg-red-50/30 border-red-100 shadow-sm' 
                                                            : 'bg-slate-50/50 border-slate-100 hover:border-slate-200'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-[11px] font-black text-slate-700 truncate max-w-[120px] uppercase tracking-tight">
                                                            {deal.name}
                                                        </span>
                                                        <Badge variant="secondary" className={`${pct > 50 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'} border-none text-[9px] font-black`}>
                                                            {pct}% Share
                                                        </Badge>
                                                    </div>
                                                    <p className={`text-lg font-black tracking-tight mt-2 ${pct > 50 ? 'text-red-700' : 'text-[#004E98]'}`}>
                                                        {formatCurrency(deal.value)}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Student Metric Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border-none shadow-sm bg-white rounded-2xl p-6 ring-1 ring-black/[0.03]">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[2px] mb-1">Confirmed Revenue</p>
                            <h3 className="text-xl font-black text-[#01a64e] tracking-tight">{formatCurrency(confirmedRevenue)}</h3>
                            <p className="text-[10px] text-gray-500 mt-2 font-semibold">Booked students × dynamic pricing</p>
                        </Card>
                        <Card className="border-none shadow-sm bg-white rounded-2xl p-6 ring-1 ring-black/[0.03]">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[2px] mb-1">Projected Revenue</p>
                            <h3 className="text-xl font-black text-blue-600 tracking-tight">{formatCurrency(projectedRevenue)}</h3>
                            <p className="text-[10px] text-gray-500 mt-2 font-semibold">Registered not booked × average ticket × conversion</p>
                        </Card>
                        <Card className="border-none shadow-sm bg-white rounded-2xl p-6 ring-1 ring-black/[0.03]">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[2px] mb-1">Rebooking Rate</p>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">{studentRebookingRate}%</h3>
                            <p className="text-[10px] text-gray-500 mt-2 font-semibold">Versus the last registration sitting</p>
                        </Card>
                        <Card className={`border-none shadow-sm rounded-2xl p-6 ring-1 ring-black/[0.03] ${dormantStudentCount > 0 ? 'bg-red-50/20 border border-red-100' : 'bg-white'}`}>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[2px] mb-1">Dormant Students</p>
                            <h3 className={`text-xl font-black tracking-tight ${dormantStudentCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>{dormantStudentCount}</h3>
                            <p className="text-[10px] text-gray-500 mt-2 font-semibold">Exceeds 120-day CIC policy renewal cycle</p>
                        </Card>
                    </div>

                    <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden ring-1 ring-black/[0.03]">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6">
                            <div>
                                <CardTitle className="text-sm font-black text-gray-900 uppercase tracking-tighter flex items-center gap-2">
                                    Student Conversion Forecasting
                                    <div className="p-1 bg-[#185FA5]/10 rounded-full"><Users className="h-3 w-3 text-[#185FA5]" /></div>
                                </CardTitle>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Live Registration & Booking Conversion</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Sitting Cycle Dropdown */}
                                <Select
                                    value={selectedCycle}
                                    onValueChange={(val) => setSelectedCycle && setSelectedCycle(val)}
                                >
                                    <SelectTrigger className="w-[130px] h-8 text-[11px] font-bold uppercase tracking-wider rounded-xl bg-slate-50 border-slate-100 text-slate-700">
                                        <SelectValue placeholder="Cycle" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-slate-100 text-xs font-semibold text-slate-700">
                                        <SelectItem value="April">April Sitting</SelectItem>
                                        <SelectItem value="August">August Sitting</SelectItem>
                                        <SelectItem value="December">December Sitting</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Sitting Year Dropdown */}
                                <Select
                                    value={selectedCycleYear}
                                    onValueChange={(val) => setSelectedCycleYear && setSelectedCycleYear(val)}
                                >
                                    <SelectTrigger className="w-[90px] h-8 text-[11px] font-bold uppercase tracking-wider rounded-xl bg-slate-50 border-slate-100 text-slate-700">
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-slate-100 text-xs font-semibold text-slate-700">
                                        {Array.from({ length: 5 }, (_, i) => {
                                            const y = (new Date().getFullYear() - 2 + i).toString();
                                            return (
                                                <SelectItem key={y} value={y}>
                                                    {y}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent className="px-2 pb-6">
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={studentChartData} margin={{ top: 20, right: 30, left: 10, bottom: 15 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                        <XAxis 
                                            dataKey="stage" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                            dy={10}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend 
                                            verticalAlign="top" 
                                            height={36} 
                                            iconType="circle"
                                            wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                                        />
                                        <Bar 
                                            name="Raw Student Volume" 
                                            dataKey="rawVolume" 
                                            fill="#B5D4F4" 
                                            radius={[6, 6, 0, 0]} 
                                        />
                                        <Bar 
                                            name="Projected Converts" 
                                            dataKey="projectedConverts" 
                                            fill="#185FA5" 
                                            radius={[6, 6, 0, 0]} 
                                        />
                                        <Bar 
                                            name="Returning Rebookers" 
                                            dataKey="returningRebookers" 
                                            fill="#9FE1CB" 
                                            radius={[6, 6, 0, 0]} 
                                        />
                                        {bookingTarget && (
                                            <ReferenceLine 
                                                y={bookingTarget} 
                                                stroke="#ef4444" 
                                                strokeDasharray="4 4" 
                                                label={{ value: `Target: ${bookingTarget} Sits`, position: 'top', fill: '#ef4444', fontSize: 10, fontWeight: 700 }} 
                                            />
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>


                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
