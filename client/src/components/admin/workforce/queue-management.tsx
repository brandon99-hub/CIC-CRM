import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function QueueManagement() {
    const { data, isLoading } = useQuery({
        queryKey: ["admin", "workforce", "queues"],
        queryFn: async () => {
            const res = await apiRequest("/api/workforce/queues");
            if (!res.ok) throw new Error("Failed to load queues");
            return res.json();
        }
    });

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-[#004E98]" /></div>;

    const queues = data?.queues || [];
    const userQueues = data?.userQueues || [];

    return (
        <Card className="border-none shadow-sm ring-1 ring-gray-100">
            <CardHeader className="bg-gray-50/50 border-b">
                <CardTitle className="text-lg font-bold text-[#004E98] flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Queue Management
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {queues.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed">
                            No queues configured yet.
                        </div>
                    )}
                    {queues.map((q: any) => (
                        <div key={q.id} className="border p-5 rounded-xl shadow-sm bg-white hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="font-bold text-gray-900">{q.name}</h3>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    {q.routingStrategy}
                                </Badge>
                            </div>
                            <p className="text-sm text-gray-500 mb-5 leading-relaxed line-clamp-2">{q.description || "No description provided."}</p>
                            <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs font-medium text-gray-500">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-orange-400"></span> Priority: {q.priorityOrder}
                                </span>
                                <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-md">
                                    <Users className="h-3 w-3" />
                                    Agents: <span className="text-gray-900 font-bold">{userQueues.filter((uq: any) => uq.queueId === q.id).length}</span>
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
