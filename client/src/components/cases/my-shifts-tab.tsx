import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

export function MyShiftsTab({ user }: { user: any }) {
    const { data: shiftsData, isLoading } = useQuery({
        queryKey: ["workforce", "shifts"],
        queryFn: async () => {
            const res = await apiRequest("/api/workforce/shifts");
            if (!res.ok) throw new Error("Failed to load shifts");
            return res.json();
        }
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-[#004E98]" />
            </div>
        );
    }

    const { shifts = [], userShifts = [] } = shiftsData || {};
    const myShifts = userShifts.filter((us: any) => us.userId === user?.id);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-[#004E98] tracking-tight">My Shifts</h2>
                    <p className="text-sm text-gray-500">View your upcoming assigned shifts and schedule.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myShifts.length === 0 ? (
                    <div className="col-span-full bg-gray-50 border border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-500">
                        <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-bold text-gray-900 mb-2">No Upcoming Shifts</h3>
                        <p className="text-sm">You do not have any shifts assigned at the moment.</p>
                    </div>
                ) : (
                    myShifts.map((us: any) => {
                        const shiftDef = shifts.find((s: any) => s.id === us.shiftId);
                        return (
                            <Card key={us.id} className="border-none shadow-sm ring-1 ring-gray-100 overflow-hidden">
                                <CardHeader className="bg-blue-50/50 border-b border-blue-100/50 pb-4">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg font-bold text-[#004E98]">
                                            {shiftDef?.name || "Standard Shift"}
                                        </CardTitle>
                                        <Badge variant={us.status === 'scheduled' ? 'default' : 'secondary'} className={us.status === 'scheduled' ? "bg-[#004E98]" : ""}>
                                            {us.status.toUpperCase()}
                                        </Badge>
                                    </div>
                                    <CardDescription className="flex items-center gap-2 mt-2 font-medium">
                                        <CalendarIcon className="h-4 w-4" />
                                        {format(new Date(us.date), "EEEE, MMMM do, yyyy")}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 text-sm">
                                            <div className="bg-blue-50 p-2 rounded-md">
                                                <Clock className="h-4 w-4 text-[#004E98]" />
                                            </div>
                                            <div>
                                                <p className="text-gray-500 font-medium text-xs uppercase tracking-wider">Time</p>
                                                <p className="font-bold text-gray-900">
                                                    {shiftDef ? `${shiftDef.startTime} - ${shiftDef.endTime}` : "TBD"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}

