import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Plus, MoreVertical, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function QueueManagement() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editQueue, setEditQueue] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: "",
        departmentId: "",
        description: "",
        priorityOrder: 1
    });

    const { data, isLoading } = useQuery({
        queryKey: ["admin", "workforce", "queues-full"],
        queryFn: async () => {
            const [queuesRes, deptsRes] = await Promise.all([
                apiRequest("/api/workforce/queues"),
                apiRequest("/api/admin/departments")
            ]);
            if (!queuesRes.ok) throw new Error("Failed to load queues");
            const qData = await queuesRes.json();
            let dData = [];
            if (deptsRes.ok) {
                const json = await deptsRes.json();
                dData = Array.isArray(json) ? json : json.departments || [];
            }
            return { ...qData, departments: dData };
        }
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("/api/workforce/queues", { method: "POST", body: JSON.stringify(data) });
            if (!res.ok) throw new Error("Failed to create queue");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "workforce", "queues-full"] });
            setIsAddOpen(false);
            toast({ title: "Queue created successfully" });
        },
        onError: () => toast({ title: "Failed to create queue", variant: "destructive" })
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            const res = await apiRequest(`/api/workforce/queues/${id}`, { method: "PUT", body: JSON.stringify(data) });
            if (!res.ok) throw new Error("Failed to update queue");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "workforce", "queues-full"] });
            setEditQueue(null);
            toast({ title: "Queue updated successfully" });
        },
        onError: () => toast({ title: "Failed to update queue", variant: "destructive" })
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest(`/api/workforce/queues/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete queue");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "workforce", "queues-full"] });
            toast({ title: "Queue deleted successfully" });
        },
        onError: () => toast({ title: "Failed to delete queue", variant: "destructive" })
    });

    const handleSubmit = () => {
        if (!formData.name || !formData.departmentId) {
            toast({ title: "Please fill required fields", variant: "destructive" });
            return;
        }
        if (editQueue) {
            updateMutation.mutate({ id: editQueue.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const openEdit = (queue: any) => {
        setFormData({
            name: queue.name,
            departmentId: queue.departmentId,
            description: queue.description || "",
            priorityOrder: queue.priorityOrder
        });
        setEditQueue(queue);
    };

    const openAdd = () => {
        setFormData({ name: "", departmentId: "", description: "", priorityOrder: 1 });
        setIsAddOpen(true);
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-[#004E98]" /></div>;

    const queues = data?.queues || [];
    const userQueues = data?.userQueues || [];
    const departments = data?.departments || [];

    return (
        <Card className="border-none shadow-sm ring-1 ring-gray-100">
            <CardHeader className="bg-gray-50/50 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold text-[#004E98] flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Queue Management
                </CardTitle>
                <Button onClick={openAdd} size="sm" className="bg-[#004E98] hover:bg-[#003875]">
                    <Plus className="h-4 w-4 mr-2" /> Add Queue
                </Button>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {queues.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed">
                            No queues configured yet.
                        </div>
                    )}
                    {queues.map((q: any) => (
                        <div key={q.id} className="border p-5 rounded-xl shadow-sm bg-white hover:shadow-md transition-shadow relative">
                            <div className="absolute top-3 right-3">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => openEdit(q)}><Edit className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                                        <DropdownMenuItem className="text-red-600" onClick={() => {
                                            if (confirm("Are you sure you want to delete this queue? This will also remove staff queue assignments.")) {
                                                deleteMutation.mutate(q.id);
                                            }
                                        }}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <div className="flex flex-col items-start mb-3 pr-8">
                                <h3 className="font-bold text-gray-900">{q.name}</h3>
                                <span className="text-xs text-gray-500 font-medium">
                                    {departments.find((d: any) => d.id === q.departmentId)?.name || "Unknown Dept"}
                                </span>
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

                <Dialog open={isAddOpen || !!editQueue} onOpenChange={(open) => { if (!open) { setIsAddOpen(false); setEditQueue(null); } }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editQueue ? "Edit Queue" : "Create New Queue"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Queue Name *</Label>
                                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Claims Premium Queue" />
                            </div>
                            <div className="space-y-2">
                                <Label>Department *</Label>
                                <Select value={formData.departmentId} onValueChange={v => setFormData({ ...formData, departmentId: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments.map((d: any) => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Priority Order (1 = Highest)</Label>
                                <Input type="number" min="1" value={formData.priorityOrder} onChange={e => setFormData({ ...formData, priorityOrder: parseInt(e.target.value) || 1 })} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => { setIsAddOpen(false); setEditQueue(null); }}>Cancel</Button>
                            <Button onClick={handleSubmit} className="bg-[#004E98]">{editQueue ? "Save Changes" : "Create Queue"}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
