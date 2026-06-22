import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export function CapacityPlanning() {
    const { data, isLoading } = useQuery({
        queryKey: ["admin", "workforce", "capacity"],
        queryFn: async () => {
            const res = await apiRequest("/api/workforce/capacity/forecast");
            if (!res.ok) throw new Error("Failed to load capacity");
            return res.json();
        }
    });

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-[#004E98]" /></div>;

    // Use mock data until ML forecast is fully connected
    const chartData = (data && data.length > 0) ? data : [
        { date: 'Mon', required: 40, scheduled: 38, actual: 35 },
        { date: 'Tue', required: 45, scheduled: 45, actual: 42 },
        { date: 'Wed', required: 50, scheduled: 48, actual: 50 },
        { date: 'Thu', required: 42, scheduled: 45, actual: 45 },
        { date: 'Fri', required: 55, scheduled: 50, actual: 48 },
    ];

    return (
        <Card className="border-none shadow-sm ring-1 ring-gray-100">
            <CardHeader className="bg-gray-50/50 border-b">
                <CardTitle className="text-lg font-bold text-[#004E98] flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Capacity Planning (Required vs Scheduled vs Actual)
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar dataKey="required" name="Required Capacity" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="scheduled" name="Scheduled Agents" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="actual" name="Actual Attendance" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
