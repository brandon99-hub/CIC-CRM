import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    Users, 
    Target, 
    BarChart3, 
    ArrowUpRight,
    Loader2,
    RefreshCw
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    Cell,
    PieChart,
    Pie
} from "recharts";
import { cn } from "@/lib/utils";

interface ROIMetrics {
    budget: number;
    actualCost: number;
    totalRevenue: number;
    roi: number;
    counts: {
        clicks: number;
        leads: number;
        prospects: number;
        salesWon: number;
    };
    conversionRate: number;
    ctr: number;
}

interface CampaignROIData {
    campaignId: string;
    campaignName: string;
    metrics: ROIMetrics;
}

export function CampaignROIDashboard({ campaignId }: { campaignId: string }) {
    const token = localStorage.getItem("marketingToken");

    const { data, isLoading, isError, refetch } = useQuery<CampaignROIData>({
        queryKey: ["marketing", "campaign", campaignId, "roi"],
        queryFn: async () => {
            const res = await fetch(`/api/campaigns/${campaignId}/roi`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to fetch ROI data");
            return res.json();
        },
        enabled: !!campaignId
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="h-8 w-8 text-[#004E98] animate-spin" />
                <p className="text-sm font-medium text-gray-500">Calculating ROI metrics...</p>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="bg-red-50 p-4 rounded-full mb-4">
                    <BarChart3 className="h-8 w-8 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Unable to load data</h3>
                <p className="text-sm text-gray-500 max-w-xs mx-auto mt-2">
                    We couldn't calculate the ROI for this campaign. Please ensure the campaign ID is valid and has associated financial data.
                </p>
                <Button variant="outline" onClick={() => refetch()} className="mt-6 rounded-xl">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                </Button>
            </div>
        );
    }

    const { metrics } = data;
    const isPositiveROI = metrics.roi >= 0;

    const pipelineData = [
        { name: "Clicks", value: metrics.counts.clicks, fill: "#94a3b8" },
        { name: "Leads", value: metrics.counts.leads, fill: "#004E98" },
        { name: "Prospects", value: metrics.counts.prospects, fill: "#D0AC01" },
        { name: "Sales Won", value: metrics.counts.salesWon, fill: "#01a64e" }
    ];

    const financialComparison = [
        { name: "Cost", value: metrics.actualCost || metrics.budget, fill: "#6b7280" },
        { name: "Revenue", value: metrics.totalRevenue, fill: "#01a64e" }
    ];

    const formatKES = (val: number) => {
        return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(val);
    };

    return (
        <div className="space-y-6">
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Card className="rounded-[2rem] border-gray-100 shadow-sm overflow-hidden bg-gradient-to-br from-[#004E98]/5 to-transparent">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-[#004E98] rounded-xl">
                                <DollarSign className="h-5 w-5 text-white" />
                            </div>
                            <Badge variant={isPositiveROI ? "default" : "destructive"} className="rounded-lg text-[10px] font-black tracking-widest uppercase">
                                {isPositiveROI ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                                {metrics.roi}% ROI
                            </Badge>
                        </div>
                        <div>
                            <p className="text-2xl font-black text-gray-900 tracking-tight">{formatKES(metrics.totalRevenue)}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Attributed Revenue</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-gray-100 shadow-sm">
                    <CardContent className="p-6">
                        <div className="p-2 bg-slate-100 rounded-xl w-fit mb-4 text-slate-600">
                             <BarChart3 className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-gray-900 tracking-tight">{metrics.counts.clicks}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Interactions (Clicks)</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-gray-100 shadow-sm overflow-hidden bg-gradient-to-br from-[#01a64e]/5 to-transparent">
                    <CardContent className="p-6">
                        <div className="p-2 bg-[#01a64e] rounded-xl w-fit mb-4">
                            <Users className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-gray-900 tracking-tight">{metrics.counts.salesWon}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Conversions</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-gray-100 shadow-sm">
                    <CardContent className="p-6">
                        <div className="p-2 bg-[#D0AC01] rounded-xl w-fit mb-4">
                            <TrendingUp className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-gray-900 tracking-tight">{metrics.ctr}%</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#D0AC01] mt-1">CTR (Click to Lead)</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-gray-100 shadow-sm">
                    <CardContent className="p-6">
                        <div className="p-2 bg-slate-900 rounded-xl w-fit mb-4">
                            <TrendingUp className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-gray-900 tracking-tight">{metrics.conversionRate}%</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Lead Conversion Rate</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="rounded-[2rem] border-gray-100 shadow-sm overflow-hidden">
                    <CardHeader className="p-6 border-b bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-[#004E98]" />
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-900">Lead Attribution Pipeline</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={pipelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} 
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} 
                                    />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                                        cursor={{ fill: '#f8fafc' }}
                                    />
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                                        {pipelineData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-gray-100 shadow-sm overflow-hidden">
                    <CardHeader className="p-6 border-b bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <ArrowUpRight className="h-4 w-4 text-[#01a64e]" />
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-900">Cost vs. Revenue Analysis</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 flex items-center">
                        <div className="h-[250px] w-1/2">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={financialComparison}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {financialComparison.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-1/2 space-y-4 pl-6">
                            {financialComparison.map((item) => (
                                <div key={item.name} className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.fill }} />
                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{item.name}</span>
                                    </div>
                                    <p className="text-lg font-black text-gray-900">{formatKES(item.value)}</p>
                                </div>
                            ))}
                            <div className="pt-2 border-t border-gray-100">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Net Outcome</span>
                                </div>
                                <p className={cn("text-lg font-black", isPositiveROI ? "text-[#01a64e]" : "text-red-600")}>
                                    {formatKES(metrics.totalRevenue - (metrics.actualCost || metrics.budget))}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
