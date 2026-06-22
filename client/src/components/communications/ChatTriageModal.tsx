import { useState, useEffect } from "react";
import { apiRequest } from "../../lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { FolderOpen, Clock, AlertCircle, Info, Settings2, ShieldCheck, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatTriageModalProps {
    signalId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    categories: any[];
    users: any[];
}

export function ChatTriageModal({ signalId, isOpen, onClose, onSuccess, categories, users }: ChatTriageModalProps) {
    const { toast } = useToast();
    const [signal, setSignal] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    
    const [modalCategoryId, setModalCategoryId] = useState("");
    const [modalAssignedTo, setModalAssignedTo] = useState("");

    useEffect(() => {
        if (isOpen && signalId) {
            loadSignal();
        } else {
            setSignal(null);
            setModalCategoryId("");
            setModalAssignedTo("");
        }
    }, [isOpen, signalId]);

    const loadSignal = async () => {
        setLoading(true);
        try {
            // We just need the single signal details
            const res = await apiRequest(`/api/triage/signals/${signalId}`);
            if (res.ok) {
                const data = await res.json();
                setSignal(data.signal);
                setModalCategoryId(data.signal?.suggestedCategoryId || "");
            }
        } catch (err) {
            console.error("Failed to load signal", err);
        } finally {
            setLoading(false);
        }
    };

    const handleMap = async () => {
        if (!modalCategoryId) {
            toast({ title: "Error", description: "Please select a category first.", variant: "destructive" });
            return;
        }

        setActionLoading(true);
        try {
            const res = await apiRequest(`/api/triage/signals/${signalId}/map`, {
                method: "POST",
                body: JSON.stringify({ categoryId: modalCategoryId, assignedTo: modalAssignedTo || undefined })
            });

            if (res.ok) {
                toast({ title: "Mapped Successfully", description: "Signal has been converted to a Case." });
                onSuccess();
                onClose();
            } else {
                toast({ title: "Error", description: "Failed to map signal.", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "An error occurred.", variant: "destructive" });
        } finally {
            setActionLoading(false);
        }
    };

    const handleIgnore = async () => {
        setActionLoading(true);
        try {
            const res = await apiRequest(`/api/triage/signals/${signalId}/ignore`, { method: "POST" });
            if (res.ok) {
                toast({ title: "Signal Ignored", description: "Signal has been archived." });
                onSuccess();
                onClose();
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to ignore signal.", variant: "destructive" });
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-[650px] p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden">
                <div className="max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="p-6">
                        <DialogHeader>
                            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                <FolderOpen className="h-5 w-5 text-[#004E98]" />
                                <DialogTitle className="text-2xl font-bold text-gray-900">
                                    Case Details
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-gray-500 text-sm mt-3">
                                Review the inbound signal, assign it to a service category and route it to an officer for management.
                            </DialogDescription>
                        </DialogHeader>

                        {loading ? (
                            <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-[#004E98]"/></div>
                        ) : signal ? (
                            <div className="mt-8 space-y-8 bg-white">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 shadow-sm">
                                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-[2px] mb-1">Channel</p>
                                        <div className="flex items-center gap-3">
                                            <Badge className="bg-[#004E98] text-white border-0 capitalize px-3 py-1 text-xs">
                                                {signal.source?.replace(/_/g, ' ')}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-inner flex flex-col justify-center">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-1">Ingestion Insights</p>
                                        <div className="flex items-center gap-4 text-xs font-bold text-gray-700">
                                            <div className="flex items-center gap-1.5 border-r pr-4">
                                                <Clock className="h-3.5 w-3.5 text-gray-400" />
                                                {new Date(signal.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <AlertCircle className="h-3.5 w-3.5 text-gray-400" />
                                                {signal.confidenceScore}% Match
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        <Info className="h-4 w-4 text-[#004E98]" /> Signal Content
                                    </Label>
                                    <div className="p-5 bg-gray-50/80 rounded-xl border border-gray-100 relative group overflow-hidden">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#004E98]/20 group-hover:bg-[#004E98] transition-colors" />
                                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed italic font-medium">
                                            "{signal.rawText}"
                                        </p>
                                    </div>
                                </div>

                                {signal.status === 'pending' && (
                                    <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-6">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-[2px] border-b pb-3 mb-2">Triage & Routing</h4>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                                    <Settings2 className="h-4 w-4 text-[#004E98]" /> Service Category
                                                </Label>
                                                <Select value={modalCategoryId} onValueChange={setModalCategoryId}>
                                                    <SelectTrigger className="h-11 border-gray-200 focus:ring-2 focus:ring-[#004E98]/10 transition-all">
                                                        <SelectValue placeholder="Select Category" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {categories.map(c => (
                                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                                    <ShieldCheck className="h-4 w-4 text-[#004E98]" /> Assign Officer
                                                </Label>
                                                <SearchableSelect
                                                    options={users
                                                        .filter(u => {
                                                            if (!modalCategoryId) return true;
                                                            const category = categories.find(c => c.id === modalCategoryId);
                                                            return !category?.departmentId || u.departmentId === category.departmentId;
                                                        })
                                                        .map(u => ({ id: u.id, label: `${u.firstName} ${u.lastName} (${u.activeCaseCount || 0})` }))
                                                    }
                                                    value={modalAssignedTo || null}
                                                    onValueChange={(v) => setModalAssignedTo(v || "")}
                                                    placeholder="Search officer..."
                                                    className="h-11"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p>Error loading signal.</p>
                        )}
                    </div>
                    <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 gap-3">
                        <Button variant="ghost" onClick={onClose} className="font-semibold text-gray-500 hover:text-gray-700">Close Window</Button>
                        {signal?.status === 'pending' && (
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    className="text-gray-400 border-gray-200 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all"
                                    disabled={actionLoading}
                                    onClick={handleIgnore}
                                >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Ignore
                                </Button>
                                <Button
                                    className="bg-[#004E98] hover:bg-[#003B73] px-10 h-11 font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform gap-2"
                                    disabled={actionLoading || !modalCategoryId}
                                    onClick={handleMap}
                                >
                                    {actionLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                                    ) : (
                                        <CheckCircle className="h-4 w-4 text-white" />
                                    )}
                                    Convert to Case
                                </Button>
                            </div>
                        )}
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
