import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar as CalendarIcon, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export function ShiftScheduling() {
    const { data, isLoading } = useQuery({
        queryKey: ["admin", "workforce", "shifts"],
        queryFn: async () => {
            const res = await apiRequest("/api/workforce/shifts");
            if (!res.ok) throw new Error("Failed to load shifts");
            return res.json();
        }
    });

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-[#004E98]" /></div>;

    const shifts = data?.shifts || [];
    const userShifts = data?.userShifts || [];

    return (
        <Card className="border-none shadow-sm ring-1 ring-gray-100">
            <CardHeader className="bg-gray-50/50 border-b">
                <CardTitle className="text-lg font-bold text-[#004E98] flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    Shift Scheduling
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {shifts.map((s: any) => (
                        <div key={s.id} className="border p-4 rounded-xl shadow-sm bg-white hover:shadow-md transition-shadow">
                            <h3 className="font-bold text-gray-900 flex justify-between">
                                {s.name}
                                <Badge variant={s.isActive ? "default" : "secondary"}>
                                    {s.isActive ? "ACTIVE" : "INACTIVE"}
                                </Badge>
                            </h3>
                            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {s.startTime} - {s.endTime} ({s.timezone})
                            </p>
                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-xs font-medium text-gray-500">
                                <span>Assignments: <span className="text-[#004E98] font-bold">{userShifts.filter((us: any) => us.shiftId === s.id).length}</span></span>
                                <span>Days: {s.daysOfWeek.map((d: number) => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]).join(", ")}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
