import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, CheckCircle2, Loader2, AlertCircle, FolderOpen, Clock, Info, Settings2, Plus, X, BookOpen } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface AcknowledgeModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (message: string, resolveImmediately?: boolean, resolutionData?: any) => Promise<void>;
    isProcessing: boolean;
    channel: string;
    templates?: any[];
}

export function AcknowledgeModal({ open, onOpenChange, onConfirm, isProcessing, channel, templates = [] }: AcknowledgeModalProps) {
    const [message, setMessage] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
    const [resolveImmediately, setResolveImmediately] = useState(false);
    const [resolutionData, setResolutionData] = useState<any>(null);

    // Templates based on channel
    const defaultMessages: Record<string, string> = {
        email: "Dear Stakeholder, thank you for reaching out. We have received your case and our team is currently reviewing the details. We will get back to you shortly.",
        phone: "Confirmed receipt of call. Case initiated and assigned for immediate action.",
        student_portal: "Your request has been received via the portal. We are processing it and will provide an update soon.",
        default: "Case received and acknowledged. We are working on a resolution."
    };

    useEffect(() => {
        if (open) {
            setMessage(defaultMessages[channel] || defaultMessages.default);
            setSelectedTemplateId("none");
            setResolveImmediately(false);
            setResolutionData(null);
        }
    }, [open, channel]);

    const handleTemplateSelect = (id: string) => {
        setSelectedTemplateId(id);
        if (id === "none") {
            setMessage(defaultMessages[channel] || defaultMessages.default);
            setResolutionData(null);
            setResolveImmediately(false);
            return;
        }

        const template = templates.find(t => t.id === id);
        if (template) {
            setMessage(template.initialResponse || template.content || "");
            setResolutionData({
                resolutionNotes: template.resolutionSummary || template.content,
                rootCause: template.rootCause || "",
                sopSteps: template.sopSteps || []
            });
            if (template.resolutionSummary) {
                setResolveImmediately(true);
            }
        }
    };

    const handleConfirm = async () => {
        if (!message.trim()) return;
        await onConfirm(message, resolveImmediately, resolutionData);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px] bg-white rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
                <div className="max-h-[85vh] overflow-y-auto custom-scrollbar">
                    <div className="p-8">
                    <DialogHeader className="mb-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                                <MessageSquare className="h-6 w-6 text-[#004E98]" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black text-gray-900 tracking-tight">Respond to Case</DialogTitle>
                                <DialogDescription className="text-sm font-medium text-gray-500">
                                    Send an initial response to move this case to <span className="text-[#004E98] font-bold">In Progress</span>.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Template Selector */}
                        {templates.length > 0 && (
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#004E98] ml-1 flex items-center gap-2">
                                    <BookOpen className="h-3 w-3" /> Select Resolution DNA Blueprint
                                </label>
                                <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                                    <SelectTrigger className="h-12 bg-gray-50/50 border-gray-100 rounded-xl px-4 font-bold text-xs focus:ring-2 focus:ring-[#004E98]/10 transition-all">
                                        <SelectValue placeholder="Use a pre-defined template..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-gray-100 shadow-2xl">
                                        <SelectItem value="none" className="font-bold py-2 text-gray-400 italic">No Template (Manual Response)</SelectItem>
                                        <Separator className="my-1" />
                                        {templates.map(t => (
                                            <SelectItem key={t.id} value={t.id} className="font-bold py-3 transition-colors focus:bg-blue-50 focus:text-[#004E98]">
                                                {t.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Response Message</label>
                            <Textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Type your response here..."
                                className="min-h-[140px] text-sm font-medium border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all rounded-xl resize-none p-4"
                            />
                        </div>

                        {selectedTemplateId !== "none" && resolutionData && (
                            <div className={cn(
                                "p-5 rounded-2xl border transition-all flex items-center justify-between gap-6",
                                resolveImmediately ? "bg-emerald-50/50 border-emerald-100 shadow-sm" : "bg-gray-50 border-gray-100"
                            )}>
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "h-10 w-10 rounded-xl flex items-center justify-center transition-all shadow-sm",
                                        resolveImmediately ? "bg-emerald-500 text-white rotate-[360deg]" : "bg-gray-200 text-gray-400"
                                    )}>
                                        <CheckCircle2 className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className={cn("text-xs font-black uppercase tracking-tight", resolveImmediately ? "text-emerald-700" : "text-gray-500")}>
                                            Auto-Resolve on Response
                                        </p>
                                        <p className="text-[10px] font-bold text-gray-400 italic">
                                            The template contains the final resolution summary
                                        </p>
                                    </div>
                                </div>
                                <Switch 
                                    checked={resolveImmediately}
                                    onCheckedChange={setResolveImmediately}
                                    className="data-[state=checked]:bg-emerald-600 shadow-lg shadow-emerald-100"
                                />
                            </div>
                        )}

                        <Alert className="bg-blue-50/50 border-blue-100/50 rounded-xl py-3">
                            <AlertCircle className="h-4 w-4 text-[#004E98]" />
                            <AlertDescription className="text-[11px] font-bold text-[#004E98]/80 leading-tight">
                                This message will be recorded in the case history and sent to the stakeholder via <span className="uppercase">{channel.replace('_', ' ')}</span>.
                            </AlertDescription>
                        </Alert>
                    </div>

                    <DialogFooter className="mt-8 gap-3 sm:gap-0">
                        <Button
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 sm:flex-none text-xs font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl h-11"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={isProcessing || !message.trim()}
                            className={cn(
                                "flex-1 sm:flex-none h-11 px-8 font-black rounded-xl shadow-lg transition-all uppercase tracking-tighter text-[11px] min-w-[140px]",
                                resolveImmediately ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200" : "bg-[#004E98] hover:bg-[#004E98]/90 text-white shadow-blue-200"
                            )}
                        >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                            {resolveImmediately ? "Respond & Resolve" : "Send Response"}
                        </Button>
                    </DialogFooter>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface ResolveModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (resolution: string, saveToKb: boolean, sopSteps: string[], rootCause: string) => Promise<void>;
    isProcessing: boolean;
    templates?: any[];
    caseData?: {
        caseNumber: string;
        title: string;
        description?: string;
        channel: string;
        categoryName?: string;
        departmentName?: string;
    };
}

export function ResolveModal({ open, onOpenChange, onConfirm, isProcessing, caseData, templates = [] }: ResolveModalProps) {
    const [resolution, setResolution] = useState("");
    const [rootCause, setRootCause] = useState("");
    const [saveToKb, setSaveToKb] = useState(false);
    const [sopSteps, setSopSteps] = useState<string[]>([""]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");

    useEffect(() => {
        if (open) {
            setResolution("");
            setRootCause("");
            setSaveToKb(false);
            setSopSteps([""]);
            setSelectedTemplateId("none");
        }
    }, [open]);

    const handleTemplateSelect = (id: string) => {
        setSelectedTemplateId(id);
        if (id === "none") {
            setResolution("");
            setRootCause("");
            setSopSteps([""]);
            return;
        }

        const template = templates.find(t => t.id === id);
        if (template) {
            setResolution(template.resolutionSummary || template.content || "");
            setRootCause(template.rootCause || "");
            setSopSteps(template.sopSteps?.length > 0 ? template.sopSteps : [""]);
        }
    };

    const handleAddStep = () => setSopSteps([...sopSteps, ""]);
    const handleRemoveStep = (index: number) => setSopSteps(sopSteps.filter((_, i) => i !== index));
    const handleStepChange = (index: number, val: string) => {
        const newSteps = [...sopSteps];
        newSteps[index] = val;
        setSopSteps(newSteps);
    };

    const handleConfirm = async () => {
        if (!resolution.trim() || !rootCause.trim()) return;
        // Filter out empty steps
        const finalSteps = sopSteps.filter(s => s.trim() !== "");
        await onConfirm(resolution, saveToKb, finalSteps, rootCause);
        onOpenChange(false);
        setResolution("");
        setRootCause("");
        setSaveToKb(false);
        setSopSteps([""]);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[650px] p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden">
                <div className="max-h-[85vh] overflow-y-auto custom-scrollbar">
                    <div className="p-6 text-left">
                        <DialogHeader className="text-left">
                            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                <DialogTitle className="text-2xl font-bold text-gray-900 text-left">
                                    Resolve Case
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-gray-500 text-sm mt-3 font-medium text-left">
                                Provide resolution details and optionally save as a <span className="text-emerald-600 font-bold uppercase tracking-tighter">Case Template</span>.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="mt-8 space-y-8 bg-white text-left">
                            {/* Template Selector */}
                            {templates.length > 0 && (
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#004E98] ml-1 flex items-center gap-2">
                                        <BookOpen className="h-3 w-3" /> Select Resolution DNA Blueprint
                                    </label>
                                    <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                                        <SelectTrigger className="h-12 bg-gray-50/50 border-gray-100 rounded-xl px-4 font-bold text-xs">
                                            <SelectValue placeholder="Use a pre-defined template..." />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-gray-100 shadow-2xl">
                                            <SelectItem value="none" className="font-bold py-2 text-gray-400 italic">No Template (Manual Resolution)</SelectItem>
                                            <Separator className="my-1" />
                                            {templates.map(t => (
                                                <SelectItem key={t.id} value={t.id} className="font-bold py-3 transition-colors focus:bg-blue-50 focus:text-[#004E98]">
                                                    {t.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}


                            {/* Original Communication / Context */}
                            {caseData?.description && (
                                <div className="space-y-3 text-left">
                                    <Label className="text-[10px] font-black uppercase tracking-[2px] text-gray-400 flex items-center gap-2 ml-1">
                                        <Info className="h-3 w-3" /> Original Communication
                                    </Label>
                                    <div className="p-5 bg-gray-50/80 rounded-xl border border-gray-100 relative group overflow-hidden text-left">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-200 group-hover:bg-emerald-600 transition-colors" />
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed italic font-medium">
                                            "{caseData.description}"
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Root Cause Analysis Input */}
                            <div className="space-y-3 text-left">
                                <Label className="text-[10px] font-black uppercase tracking-[2px] text-amber-700 flex items-center gap-2 ml-1">
                                    <AlertCircle className="h-3 w-3" /> Root Cause Analysis
                                </Label>
                                <Textarea
                                    value={rootCause}
                                    onChange={(e) => setRootCause(e.target.value)}
                                    placeholder="Identify the underlying cause (Policy, Human, System, etc.)..."
                                    className="min-h-[100px] text-sm font-medium border-amber-100 bg-amber-50/10 focus:bg-white focus:ring-2 focus:ring-amber-100 transition-all rounded-xl resize-none p-4"
                                />
                                <p className="text-[9px] font-bold text-amber-600/60 uppercase tracking-tight ml-1 italic">
                                    Explain why this occurred to prevent future recurrence.
                                </p>
                            </div>

                            {/* Resolution Summary Input */}
                            <div className="space-y-3 text-left">
                                <Label className="text-[10px] font-black uppercase tracking-[2px] text-emerald-900 flex items-center gap-2 ml-1">
                                    <MessageSquare className="h-3 w-3" /> Resolution Summary
                                </Label>
                                <Textarea
                                    value={resolution}
                                    onChange={(e) => setResolution(e.target.value)}
                                    placeholder="Describe how the issue was resolved..."
                                    className="min-h-[140px] text-sm font-medium border-emerald-100 bg-emerald-50/10 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all rounded-xl resize-none p-4"
                                />
                            </div>

                            {/* Template & SOP Section */}
                            <div className="p-6 bg-white rounded-2xl border border-emerald-100/50 shadow-sm space-y-6 text-left">
                                <div className="flex items-center justify-between border-b border-emerald-50 pb-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <BookOpen className="h-4 w-4 text-emerald-600" />
                                            <h4 className="text-xs font-black text-emerald-900 uppercase tracking-[2px]">Case DNA Template</h4>
                                        </div>
                                        <p className="text-[9px] font-bold text-emerald-700/60 uppercase">Save as a reusable resolution blueprint</p>
                                    </div>
                                    <Switch
                                        checked={saveToKb}
                                        onCheckedChange={setSaveToKb}
                                        className="data-[state=checked]:bg-emerald-500"
                                    />
                                </div>

                                {saveToKb && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 text-left">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black uppercase tracking-[2px] text-emerald-700/50 ml-1">Resolution SOP (Steps)</label>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleAddStep}
                                                className="h-6 text-[9px] font-black uppercase text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 gap-1"
                                            >
                                                <Plus className="h-3 w-3" /> Add Step
                                            </Button>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            {sopSteps.map((step, idx) => (
                                                <div key={idx} className="flex gap-2">
                                                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-100/50 text-emerald-700 text-[10px] font-black border border-emerald-100 shrink-0">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="relative flex-1">
                                                        <Input
                                                            value={step}
                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                                const newSteps = [...sopSteps];
                                                                newSteps[idx] = e.target.value;
                                                                setSopSteps(newSteps);
                                                            }}
                                                            placeholder={`Step ${idx + 1}...`}
                                                            className="h-9 text-xs font-semibold bg-white border-emerald-100 focus:bg-white transition-all pr-8 rounded-lg"
                                                        />
                                                        {sopSteps.length > 1 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleRemoveStep(idx)}
                                                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-gray-400 hover:text-red-500 rounded-lg"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-start gap-3 px-1 text-left">
                                <AlertCircle className="h-3.5 w-3.5 text-gray-400 mt-0.5" />
                                <p className="text-[10px] font-bold text-gray-400 leading-relaxed uppercase tracking-tight">
                                    Resolving this case will stop SLA timers and notify the stakeholder.
                                </p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 gap-3 mt-4">
                        <Button 
                            variant="ghost" 
                            onClick={() => onOpenChange(false)} 
                            className="font-black text-gray-400 uppercase tracking-widest text-[10px] hover:text-gray-600 hover:bg-gray-100 h-11 px-8 rounded-xl"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={isProcessing || !resolution.trim()}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg shadow-emerald-200 transition-all uppercase tracking-tighter text-[11px] min-w-[160px] h-11"
                        >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            Resolve & Save
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface EscalateModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (categoryId: string, assignedTo: string) => Promise<void>;
    isProcessing: boolean;
    categories: any[];
    users: any[];
    signalContent?: string;
    channel?: string;
}

export function EscalateModal({ open, onOpenChange, onConfirm, isProcessing, categories, users, signalContent, channel }: EscalateModalProps) {
    const [categoryId, setCategoryId] = useState("");
    const [assignedTo, setAssignedTo] = useState("");

    useEffect(() => {
        if (open) {
            setCategoryId("");
            setAssignedTo("");
        }
    }, [open]);

    const handleConfirm = async () => {
        if (!categoryId) return;
        await onConfirm(categoryId, assignedTo === "unassigned" ? "" : assignedTo);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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

                        <div className="mt-8 space-y-8 bg-white text-left">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 shadow-sm">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[2px] mb-1">Channel</p>
                                    <div className="flex items-center gap-3">
                                        <Badge className="bg-[#004E98] text-white border-0 capitalize px-3 py-1 text-xs">
                                            {channel?.replace(/_/g, ' ') || "Omnichannel"}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {signalContent && (
                                <div className="space-y-3 text-left">
                                    <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        <Info className="h-4 w-4 text-[#004E98]" /> Signal Content
                                    </Label>
                                    <div className="p-5 bg-gray-50/80 rounded-xl border border-gray-100 relative group overflow-hidden">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#004E98]/20 group-hover:bg-[#004E98] transition-colors" />
                                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed italic font-medium">
                                            "{signalContent}"
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-6">
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-[2px] border-b pb-3 mb-2">Triage & Routing</h4>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <Settings2 className="h-4 w-4 text-[#004E98]" /> Service Category
                                        </Label>
                                        <Select value={categoryId} onValueChange={setCategoryId}>
                                            <SelectTrigger className="h-11 border-gray-200 focus:ring-2 focus:ring-[#004E98]/10 transition-all">
                                                <SelectValue placeholder="Select Category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map((c: any) => (
                                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <Settings2 className="h-4 w-4 text-[#004E98]" /> Assign Officer
                                        </Label>
                                        <Select value={assignedTo} onValueChange={setAssignedTo}>
                                            <SelectTrigger className="h-11 border-gray-200 focus:ring-2 focus:ring-[#004E98]/10 transition-all">
                                                <SelectValue placeholder="Select Officer..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                                {users
                                                    .filter((u: any) => {
                                                        if (!categoryId) return true;
                                                        const category = categories.find((c: any) => c.id === categoryId);
                                                        return !category?.departmentId || u.departmentId === category.departmentId;
                                                    })
                                                    .map((u: any) => (
                                                        <SelectItem key={u.id} value={u.id}>
                                                            {u.firstName} {u.lastName}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 gap-3">
                        <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-semibold text-gray-500 hover:text-gray-700">Close Window</Button>
                        <Button
                            className="bg-[#004E98] hover:bg-[#003B73] px-10 h-11 font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform gap-2"
                            disabled={isProcessing || !categoryId}
                            onClick={handleConfirm}
                        >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <CheckCircle2 className="h-4 w-4 text-white" />}
                            Convert to Case
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
