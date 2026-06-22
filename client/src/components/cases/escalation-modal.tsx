import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2, ArrowUpCircle, ShieldCheck, Building2, Info, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Department {
    id: string;
    name: string;
}

interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    activeCaseCount?: number;
}

interface EscalationModalProps {
    isOpen: boolean;
    onClose: () => void;
    caseId: string;
    caseNumber: string;
    onSuccess: () => void;
    departments: Department[];
}

export function EscalationModal({
    isOpen,
    onClose,
    caseId,
    caseNumber,
    onSuccess,
    departments
}: EscalationModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [fetchingUsers, setFetchingUsers] = useState(false);
    const [selectedDept, setSelectedDept] = useState<string>("");
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [reason, setReason] = useState("");
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        if (selectedDept) {
            fetchUsersUnderDept(selectedDept);
        } else {
            setUsers([]);
            setSelectedUser(null);
        }
    }, [selectedDept]);

    const fetchUsersUnderDept = async (deptId: string) => {
        setFetchingUsers(true);
        try {
            const token = localStorage.getItem("marketingToken");
            const res = await fetch(`/api/admin/users?departmentId=${deptId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(Array.isArray(data) ? data : (data.users || []));
            }
        } catch (error) {
            console.error("Failed to fetch users:", error);
        } finally {
            setFetchingUsers(false);
        }
    };

    const handleAutoEscalate = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("marketingToken");
            const res = await fetch(`/api/cases/${caseId}/escalate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    reason: "Escalated via pre-defined assignment rules."
                })
            });

            if (res.ok) {
                toast({
                    title: "Escalated via Rules",
                    description: `Case ${caseNumber} followed the escalation chain.`
                });
                onSuccess();
                onClose();
            } else {
                const error = await res.json();
                throw new Error(error.error || "Failed to escalate");
            }
        } catch (error: any) {
            toast({
                title: "Auto-Escalation Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleEscalate = async () => {
        if (!selectedDept || !selectedUser || !reason.trim()) {
            toast({
                title: "Missing Information",
                description: "Manual escalation requires selecting a department, an officer, and a reason.",
                variant: "destructive"
            });
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("marketingToken");
            
            // Use the dedicated escalation endpoint with manual overrides
            const res = await fetch(`/api/cases/${caseId}/escalate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    reason: `[MANUAL ESCALATION] ${reason}`,
                    targetUserId: selectedUser,
                    targetDeptId: selectedDept
                })
            });

            if (res.ok) {
                toast({
                    title: "Case Escalated",
                    description: `Case ${caseNumber} has been manually escalated.`
                });
                onSuccess();
                onClose();
            } else {
                const error = await res.json();
                throw new Error(error.error || "Failed to escalate case");
            }
        } catch (error: any) {
            toast({
                title: "Escalation Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[550px] p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden">
                <div className="p-6">
                    <DialogHeader>
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                            <ArrowUpCircle className="h-5 w-5 text-[#e55f00]" />
                            <DialogTitle className="text-xl font-bold text-gray-900">
                                Manual Case Escalation
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-gray-500 text-sm mt-3 font-medium">
                            Escalate <span className="text-[#004E98] font-bold">#{caseNumber}</span> using system rules or manual assignment.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <p className="text-[11px] font-black text-[#004E98] uppercase tracking-widest mb-1">Quick Escalation</p>
                            <p className="text-xs text-blue-700/70 font-medium">Bypass manual selection and use admin-defined rules.</p>
                        </div>
                        <Button 
                            variant="secondary" 
                            className="bg-[#004E98] hover:bg-[#004E98]/90 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 px-4"
                            onClick={handleAutoEscalate}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                            Escalate via Rules
                        </Button>
                    </div>

                    <div className="mt-6 flex items-center gap-3">
                        <div className="h-[1px] flex-1 bg-gray-100" />
                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Or Manual Selection</span>
                        <div className="h-[1px] flex-1 bg-gray-100" />
                    </div>

                    <div className="mt-6 space-y-5">
                        <div className="space-y-2">
                            <Label className="text-xs font-black text-gray-400 uppercase tracking-[1px] flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5" /> Target Department
                            </Label>
                            <Select value={selectedDept} onValueChange={setSelectedDept}>
                                <SelectTrigger className="h-11 border-gray-200">
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map((dept) => (
                                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-black text-gray-400 uppercase tracking-[1px] flex items-center gap-2">
                                <ShieldCheck className="h-3.5 w-3.5" /> Assign To Officer
                            </Label>
                            <SearchableSelect
                                options={users.map(u => ({
                                    id: u.id,
                                    label: `${u.firstName} ${u.lastName} (${u.activeCaseCount || 0})`
                                }))}
                                value={selectedUser}
                                onValueChange={setSelectedUser}
                                placeholder={fetchingUsers ? "Loading users..." : "Search officer..."}
                                disabled={!selectedDept || fetchingUsers}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-black text-gray-400 uppercase tracking-[1px] flex items-center gap-2">
                                <Info className="h-3.5 w-3.5" /> Reason for Escalation
                            </Label>
                            <Textarea
                                placeholder="Explain why this case is being escalated..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="min-h-[100px] border-gray-200 focus:ring-2 focus:ring-orange-500/10"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 gap-3">
                    <Button variant="ghost" onClick={onClose} className="font-bold text-gray-500 hover:text-gray-700">
                        Cancel
                    </Button>
                    <Button
                        className="bg-[#e55f00] hover:bg-[#c45200] px-8 h-11 font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-transform gap-2 min-w-[160px]"
                        disabled={loading || !selectedUser || !reason.trim()}
                        onClick={handleEscalate}
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <ArrowUpCircle className="h-4 w-4" />
                        )}
                        Manual Escalation
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
