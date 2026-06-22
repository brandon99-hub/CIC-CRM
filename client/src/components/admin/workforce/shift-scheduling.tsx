import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar as CalendarIcon, Clock, Plus, MoreVertical, Edit, Trash2 } from "lucide-react";
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

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ShiftScheduling() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editShift, setEditShift] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: "",
        departmentId: "",
        startTime: "09:00",
        endTime: "17:00",
        daysOfWeek: [] as number[],
        requiredCapacity: 1
    });

    const { data, isLoading } = useQuery({
        queryKey: ["admin", "workforce", "shifts-full"],
        queryFn: async () => {
            const [shiftsRes, deptsRes] = await Promise.all([
                apiRequest("/api/workforce/shifts"),
                apiRequest("/api/admin/departments")
            ]);
            if (!shiftsRes.ok) throw new Error("Failed to load shifts");
            const sData = await shiftsRes.json();
            let dData = [];
            if (deptsRes.ok) {
                const json = await deptsRes.json();
                dData = Array.isArray(json) ? json : json.departments || [];
            }
            return { ...sData, departments: dData };
        }
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("/api/workforce/shifts", { method: "POST", body: JSON.stringify(data) });
            if (!res.ok) throw new Error("Failed to create shift");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "workforce", "shifts-full"] });
            setIsAddOpen(false);
            toast({ title: "Shift created successfully" });
        },
        onError: () => toast({ title: "Failed to create shift", variant: "destructive" })
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            const res = await apiRequest(`/api/workforce/shifts/${id}`, { method: "PUT", body: JSON.stringify(data) });
            if (!res.ok) throw new Error("Failed to update shift");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "workforce", "shifts-full"] });
            setEditShift(null);
            toast({ title: "Shift updated successfully" });
        },
        onError: () => toast({ title: "Failed to update shift", variant: "destructive" })
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest(`/api/workforce/shifts/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete shift");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "workforce", "shifts-full"] });
            toast({ title: "Shift deleted successfully" });
        },
        onError: () => toast({ title: "Failed to delete shift", variant: "destructive" })
    });

    const handleSubmit = () => {
        if (!formData.name || !formData.departmentId || formData.daysOfWeek.length === 0) {
            toast({ title: "Please fill required fields (Name, Dept, and Days)", variant: "destructive" });
            return;
        }
        if (editShift) {
            updateMutation.mutate({ id: editShift.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const openEdit = (shift: any) => {
        setFormData({
            name: shift.name,
            departmentId: shift.departmentId,
            startTime: shift.startTime,
            endTime: shift.endTime,
            daysOfWeek: shift.daysOfWeek || [],
            requiredCapacity: shift.requiredCapacity
        });
        setEditShift(shift);
    };

    const openAdd = () => {
        setFormData({ name: "", departmentId: "", startTime: "09:00", endTime: "17:00", daysOfWeek: [1,2,3,4,5], requiredCapacity: 1 });
        setIsAddOpen(true);
    };

    const toggleDay = (dayIndex: number) => {
        setFormData(prev => ({
            ...prev,
            daysOfWeek: prev.daysOfWeek.includes(dayIndex)
                ? prev.daysOfWeek.filter(d => d !== dayIndex)
                : [...prev.daysOfWeek, dayIndex].sort()
        }));
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-[#004E98]" /></div>;

    const shifts = data?.shifts || [];
    const userShifts = data?.userShifts || [];
    const departments = data?.departments || [];

    return (
        <Card className="border-none shadow-sm ring-1 ring-gray-100">
            <CardHeader className="bg-gray-50/50 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold text-[#004E98] flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    Shift Scheduling
                </CardTitle>
                <Button onClick={openAdd} size="sm" className="bg-[#004E98] hover:bg-[#003875]">
                    <Plus className="h-4 w-4 mr-2" /> Add Shift
                </Button>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {shifts.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed">
                            No shifts configured yet.
                        </div>
                    )}
                    {shifts.map((s: any) => (
                        <div key={s.id} className="border p-4 rounded-xl shadow-sm bg-white hover:shadow-md transition-shadow relative">
                            <div className="absolute top-3 right-3">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => openEdit(s)}><Edit className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                                        <DropdownMenuItem className="text-red-600" onClick={() => {
                                            if (confirm("Are you sure you want to delete this shift? This will also remove staff shift assignments.")) {
                                                deleteMutation.mutate(s.id);
                                            }
                                        }}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <h3 className="font-bold text-gray-900 flex justify-between pr-8">
                                {s.name}
                            </h3>
                            <span className="text-xs text-gray-500 font-medium block mb-2">
                                {departments.find((d: any) => d.id === s.departmentId)?.name || "Unknown Dept"}
                            </span>
                            <p className="text-sm text-gray-700 mt-1 flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-md border border-gray-100">
                                <Clock className="h-4 w-4 text-[#004E98]" /> <span className="font-semibold">{s.startTime} - {s.endTime}</span>
                            </p>
                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-xs font-medium text-gray-500">
                                <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-md">
                                    Assignments: <span className="font-bold">{userShifts.filter((us: any) => us.shiftId === s.id).length}</span>
                                </span>
                                <span>Days: {(s.daysOfWeek || []).map((d: number) => DAYS[d].substring(0,3)).join(", ")}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <Dialog open={isAddOpen || !!editShift} onOpenChange={(open) => { if (!open) { setIsAddOpen(false); setEditShift(null); } }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editShift ? "Edit Shift" : "Create New Shift"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Shift Name *</Label>
                                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Claims Morning Shift" />
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
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Time *</Label>
                                    <Input type="time" value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Time *</Label>
                                    <Input type="time" value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Required Capacity</Label>
                                <Input type="number" min="1" value={formData.requiredCapacity} onChange={e => setFormData({ ...formData, requiredCapacity: parseInt(e.target.value) || 1 })} />
                            </div>
                            <div className="space-y-2">
                                <Label className="mb-2 block">Working Days *</Label>
                                <div className="flex flex-wrap gap-2">
                                    {DAYS.map((day, idx) => (
                                        <div key={idx} className="flex items-center space-x-2 border rounded-md px-3 py-2 bg-gray-50">
                                            <input 
                                                type="checkbox"
                                                id={`day-${idx}`} 
                                                checked={formData.daysOfWeek.includes(idx)} 
                                                onChange={() => toggleDay(idx)} 
                                                className="w-4 h-4 text-[#004E98] border-gray-300 rounded focus:ring-[#004E98]"
                                            />
                                            <label htmlFor={`day-${idx}`} className="text-sm font-medium cursor-pointer">
                                                {day.substring(0,3)}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => { setIsAddOpen(false); setEditShift(null); }}>Cancel</Button>
                            <Button onClick={handleSubmit} className="bg-[#004E98]">{editShift ? "Save Changes" : "Create Shift"}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
