import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Loader2, ChevronLeft, ChevronRight, FolderOpen, Settings2, MessageSquare } from "lucide-react";
import {
    STATUSES, PRIORITIES, CHANNELS,
    statusColors, priorityColors, slaStatusColors,
    formatLabel, formatDate, getTimeRemaining,
} from "./case-utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotebookModal } from "./notebook-modal";
import { AcknowledgeModal, ResolveModal } from "./status-modals";
import { EscalationModal } from "./escalation-modal";
import { useState, useEffect } from "react";

interface CaseItem {
    id: string;
    caseNumber: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    channel: string;
    assignedTo: string | null;
    assignedToName?: string | null;
    assignedToEmail?: string | null;
    assignedToActiveCases?: number | null;
    departmentName?: string | null;
    categoryName?: string | null;
    serviceCategoryId: string | null;
    stakeholderId?: string | null;
    stakeholderName?: string | null;
    registrationNumber?: string | null;
    slaDeadline: string | null;
    slaResponseDeadline: string | null;
    slaMetricType?: string | null;
    slaResponseMinutes?: number;
    slaTimeline?: number;
    slaTimelineUnit?: string;
    createdAt: string;
    updatedAt: string;
    slaBreached?: boolean;
    assignedAt?: string | null;
    assignedDepartment?: string | null;
    tags?: any[];
}

interface NewCaseForm {
    title: string;
    description: string;
    priority: string;
    channel: string;
    serviceCategoryId: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
}

interface CaseListProps {
    cases: CaseItem[];
    serviceCategories?: any[];
    departments?: any[];
    loading: boolean;
    total: number;
    page: number;
    limit: number;
    searchQuery: string;
    filterStatus: string;
    filterPriority: string;
    filterChannel: string;
    newCaseOpen: boolean;
    newCaseForm: NewCaseForm;
    newCaseLoading: boolean;
    onSearchChange: (v: string) => void;
    onStatusFilter: (v: string) => void;
    onPriorityFilter: (v: string) => void;
    onChannelFilter: (v: string) => void;
    onPageChange: (p: number) => void;
    onCaseClick: (id: string) => void;
    onNewCaseOpen: () => void;
    onNewCaseClose: () => void;
    onNewCaseFormChange: (form: NewCaseForm) => void;
    onCreateCase: () => void;
    onStatusChange?: (id: string, status: string) => void;
    onAssignUser?: (caseId: string, userId: string) => void;
    userPerms?: { permissions: string[] };
}

export function CaseList({
    cases, serviceCategories = [], departments = [], loading, total, page, limit, searchQuery, filterStatus, filterPriority, filterChannel,
    newCaseOpen, newCaseForm, newCaseLoading,
    onSearchChange, onStatusFilter, onPriorityFilter, onChannelFilter, onPageChange,
    onCaseClick, onNewCaseOpen, onNewCaseClose, onNewCaseFormChange, onCreateCase, onStatusChange, onAssignUser,
    userPerms
}: CaseListProps) {
    const totalPages = Math.ceil(total / limit) || 1;

    // Mixed logic for status modals
    const [pendingStatus, setPendingStatus] = useState<{ id: string, status: string, caseNumber?: string } | null>(null);
    const [showAckModal, setShowAckModal] = useState(false);
    const [showResolveModal, setShowResolveModal] = useState(false);
    const [showEscalationModal, setShowEscalationModal] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleStatusSelect = (id: string, newStatus: string, currentStatus: string) => {
        if (newStatus === currentStatus) return;

        const caseItem = cases.find(c => c.id === id);

        if (newStatus === "in_progress" && currentStatus === "open") {
            setPendingStatus({ id, status: newStatus });
            setShowAckModal(true);
        } else if (newStatus === "resolved") {
            setPendingStatus({ id, status: newStatus });
            setShowResolveModal(true);
        } else if (newStatus === "escalated") {
            setPendingStatus({ id, status: newStatus, caseNumber: caseItem?.caseNumber });
            setShowEscalationModal(true);
        } else {
            onStatusChange?.(id, newStatus);
        }
    };

    const generatePDF = async () => {
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");

        const doc = new jsPDF();
        const timestamp = new Date().toLocaleString();

        // Branding & Header
        try {
            // Using a simple rectangle as a separator/branding horizontal bar if image fails
            doc.setFillColor(0, 78, 152);
            doc.rect(0, 0, 210, 8, 'F');
            
            // Add Logo if available (assumes public/logo.png)
            doc.addImage("/logo.png", "PNG", 14, 15, 25, 25);
        } catch (e) {
            console.warn("Logo failed to load for PDF:", e);
        }

        doc.setFontSize(24);
        doc.setTextColor(0, 78, 152); // KASNEB Blue
        doc.setFont("helvetica", "bold");
        doc.text("KASNEB CRM", 45, 25);

        doc.setFontSize(10);
        doc.setTextColor(120);
        doc.setFont("helvetica", "normal");
        doc.text("Professional Support Management System", 45, 32);

        doc.setDrawColor(230, 230, 230);
        doc.line(14, 45, 196, 45);

        doc.setFontSize(14);
        doc.setTextColor(60);
        doc.setFont("helvetica", "bold");
        doc.text("OFFICIAL CASE MANAGEMENT REPORT", 14, 55);

        doc.setFontSize(9);
        doc.setTextColor(130);
        doc.setFont("helvetica", "normal");
        doc.text(`Reference ID: KNB-REP-${Date.now().toString().slice(-6)}`, 14, 62);
        doc.text(`Generated on: ${timestamp}`, 14, 67);
        doc.text(`Exporter: ${JSON.parse(localStorage.getItem("marketingUser") || "{}").email || "System"}`, 14, 72);

        const tableColumn = ["Case #", "Title", "Department", "Assignee", "Status", "Priority", "Created"];
        const tableRows = cases.map(c => [
            c.caseNumber,
            c.registrationNumber ? `${c.registrationNumber} - ${c.stakeholderName}` : (c.stakeholderName || c.title),
            c.departmentName || "Unassigned",
            c.assignedToName || "Unassigned",
            formatLabel(c.status),
            formatLabel(c.priority),
            formatDate(c.createdAt)
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 80,
            theme: 'striped',
            headStyles: { 
                fillColor: [0, 78, 152],
                fontSize: 10,
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: { 
                fontSize: 9,
                textColor: [50, 50, 50]
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { top: 80 },
        });

        // Footer
        const pageCount = (doc as any).getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount} | KASNEB CRM Confidential`, 105, 285, { align: "center" });
        }

        doc.save(`KASNEB_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const confirmAcknowledge = async (message: string) => {
        if (!pendingStatus) return;
        setIsUpdating(true);
        try {
            const token = localStorage.getItem("marketingToken");
            // 1. Post comment
            await fetch(`/api/cases/${pendingStatus.id}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ content: message, isInternal: false })
            });
            // 2. Update status
            onStatusChange?.(pendingStatus.id, pendingStatus.status);
        } finally {
            setIsUpdating(false);
            setPendingStatus(null);
        }
    };

    const confirmResolve = async (resolution: string) => {
        if (!pendingStatus) return;
        setIsUpdating(true);
        try {
            const token = localStorage.getItem("marketingToken");
            // Update status with resolution
            const res = await fetch(`/api/cases/${pendingStatus.id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status: "resolved", resolution })
            });
            if (res.ok) {
                onStatusChange?.(pendingStatus.id, "resolved");
            }
        } finally {
            setIsUpdating(false);
            setPendingStatus(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#004E98]/10 p-3 rounded-lg flex-shrink-0">
                            <FolderOpen className="h-6 w-6 text-[#004E98]" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 leading-none">All Cases</h3>
                            <p className="text-sm text-gray-500 mt-2 flex items-center gap-1.5 font-medium">
                                Manage and resolve customer support cases
                            </p>
                        </div>
                    </div>
                </div>

                <div className="px-5 pb-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        <Select value={filterStatus || "all"} onValueChange={(v) => { onStatusFilter(v === "all" ? "" : v); onPageChange(1); }}>
                            <SelectTrigger className="w-[140px] h-10 border-gray-200 bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                {STATUSES.map((s) => <SelectItem key={s} value={s}>{formatLabel(s)}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filterPriority || "all"} onValueChange={(v) => { onPriorityFilter(v === "all" ? "" : v); onPageChange(1); }}>
                            <SelectTrigger className="w-[140px] h-10 border-gray-200 bg-white"><SelectValue placeholder="Priority" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Priorities</SelectItem>
                                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{formatLabel(p)}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filterChannel || "all"} onValueChange={(v) => { onChannelFilter(v === "all" ? "" : v); onPageChange(1); }}>
                            <SelectTrigger className="w-[140px] h-10 border-gray-200 bg-white"><SelectValue placeholder="Channel" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Channels</SelectItem>
                                {CHANNELS.map((ch) => <SelectItem key={ch} value={ch}>{formatLabel(ch)}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <div className="relative flex-1 min-w-[200px] xl:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search by case #, title or requester..."
                                className="pl-10 h-10 border-gray-200 focus:border-[#004E98] focus:ring-[#004E98] bg-white transition-all"
                                value={searchQuery}
                                onChange={(e) => { onSearchChange(e.target.value); onPageChange(1); }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full xl:w-auto">
                        <Button
                            variant="outline"
                            onClick={generatePDF}
                            className="h-10 px-4 border-gray-200 text-gray-700 hover:bg-gray-50 transition-all text-sm font-medium"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            Export
                        </Button>
                        {userPerms?.permissions.includes("cases.create") && (
                            <Button onClick={onNewCaseOpen} className="h-10 px-4 bg-[#004E98] hover:bg-[#003d7a] text-white shadow-sm transition-all text-sm font-medium">
                                <Plus className="h-4 w-4 mr-2" /> New Case
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Case #</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Assigned User</TableHead>
                                <TableHead>SLA Rules</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TooltipProvider>
                            <TableBody>
                                {cases.length === 0 && (
                                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{loading ? "Loading cases..." : "No cases found"}</TableCell></TableRow>
                                )}
                                {cases.map((c) => {
                                    const formatMinutes = (m?: number) => {
                                        if (!m) return "—";
                                        if (m >= 1440) {
                                            const days = m / 1440;
                                            return `${Number.isInteger(days) ? days : days.toFixed(1)} days`;
                                        }
                                        if (m >= 60) {
                                            const hrs = m / 60;
                                            return `${Number.isInteger(hrs) ? hrs : hrs.toFixed(1)} hrs`;
                                        }
                                        return `${m} mins`;
                                    };

                                    return (
                                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                                            <TableCell className="font-semibold text-[#004E98] whitespace-nowrap">
                                                <div className="flex flex-col gap-1">
                                                    <span>{c.caseNumber}</span>
                                                    {(() => {
                                                        const currentUserId = JSON.parse(localStorage.getItem("marketingUser") || "{}").id;
                                                        const isCollaborator = currentUserId !== c.assignedTo && Array.isArray(c.tags) && c.tags.some((t: any) => t.id === currentUserId);
                                                        return isCollaborator ? (
                                                            <Badge variant="outline" className="text-[8px] py-0 h-4 bg-emerald-50 border-emerald-100 text-emerald-600 font-black w-fit uppercase tracking-tighter">
                                                                Collaborator
                                                            </Badge>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-[180px]">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="truncate font-black text-gray-900 hover:text-[#004E98] transition-colors cursor-help">
                                                            {c.registrationNumber ? `${c.registrationNumber} - ` : ""}{c.stakeholderName || c.title}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="bg-white p-4 shadow-2xl border-gray-100 max-w-sm rounded-2xl ring-1 ring-black/5">
                                                        <div className="space-y-4">
                                                            <div className="space-y-3">
                                                                <div className="flex items-center gap-2 text-[#004E98] font-black text-[10px] uppercase tracking-[0.1em]">
                                                                    <MessageSquare className="h-3.5 w-3.5" />
                                                                    Original Communication
                                                                </div>
                                                                <div className="relative pl-4 space-y-2">
                                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#004E98]/10 rounded-full" />
                                                                    <p className="text-sm text-gray-700 leading-normal font-medium italic">
                                                                        "{c.description || 'No original text available'}"
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                                                                <span className="text-[9px] font-bold text-gray-400">Received via {formatLabel(c.channel)}</span>
                                                                <Badge variant="outline" className="text-[8px] font-black border-[#004E98]/20 text-[#004E98] py-0 h-4 uppercase tracking-tighter">
                                                                    {c.caseNumber}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell className="text-sm">{c.departmentName || "—"}</TableCell>
                                            <TableCell className="text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                                                <UserAssignmentSelect
                                                    caseId={c.id}
                                                    currentUserId={c.assignedTo || ""}
                                                    initialUserName={c.assignedToName}
                                                    initialUserEmail={c.assignedToEmail}
                                                    initialUserActiveCases={c.assignedToActiveCases}
                                                    departmentId={c.assignedDepartment || ""}
                                                    onAssign={(uid) => onAssignUser?.(c.id, uid)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col leading-tight">
                                                    {c.slaResponseMinutes != null && (
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Response Time</span>
                                                            <span className="text-xs font-black text-[#004E98]">{formatMinutes(c.slaResponseMinutes)}</span>
                                                        </div>
                                                    )}
                                                    <div className={`flex flex-col ${c.slaResponseMinutes != null ? 'mt-2' : ''}`}>
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                                                            {c.slaMetricType ? c.slaMetricType.replace('_', ' ') : 'Target'}
                                                        </span>
                                                        <span className="text-xs font-black text-gray-600">
                                                            {c.slaTimeline && c.slaTimelineUnit ? `${c.slaTimeline} ${c.slaTimelineUnit}` : "—"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Select value={c.status} onValueChange={(v) => handleStatusSelect(c.id, v, c.status)}>
                                                    <SelectTrigger className={`h-8 w-[130px] border-none shadow-none font-bold ${statusColors[c.status]}`}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {STATUSES.map(s => <SelectItem key={s} value={s}>{formatLabel(s)}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell><Badge className={priorityColors[c.priority]}>{formatLabel(c.priority)}</Badge></TableCell>
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex justify-end gap-1">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#004E98] hover:bg-[#004E98]/10" onClick={() => onCaseClick(c.id)}>
                                                                <FolderOpen className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Know Your Customer</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <NotebookModal caseItem={c}>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:bg-gray-100">
                                                                    <Settings2 className="h-4 w-4" />
                                                                </Button>
                                                            </NotebookModal>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Case Actions</TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </TooltipProvider>
                    </Table>
                </CardContent>
            </Card>

            <div className="flex items-center justify-between px-2 py-4">
                <p className="text-sm text-muted-foreground font-medium">
                    Showing <span className="font-bold text-gray-900">{(page - 1) * limit + 1}</span> to <span className="font-bold text-gray-900">{Math.min(page * limit, total)}</span> of <span className="font-bold text-gray-900">{total}</span> cases
                </p>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="h-9 px-4 font-bold transition-all hover:bg-gray-50 active:scale-95">
                        <ChevronLeft className="h-4 w-4 mr-1.5" /> Previous
                    </Button>
                    <div className="flex items-center gap-1 mx-2">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                            <Button
                                key={p}
                                variant={p === page ? "default" : "ghost"}
                                size="sm"
                                onClick={() => onPageChange(p)}
                                className={`h-8 w-8 p-0 font-bold transition-all ${p === page ? "bg-[#004E98] shadow-md scale-110" : "hover:bg-gray-100"}`}
                            >
                                {p}
                            </Button>
                        ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="h-9 px-4 font-bold transition-all hover:bg-gray-50 active:scale-95">
                        Next <ChevronRight className="h-4 w-4 ml-1.5" />
                    </Button>
                </div>
            </div>

            <Dialog open={newCaseOpen} onOpenChange={(o) => { if (!o) onNewCaseClose(); }}>
                <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="p-6 bg-white border-b relative">
                        <div className="flex items-center gap-4">
                            <div className="bg-[#004E98]/10 p-3 rounded-xl">
                                <Plus className="h-6 w-6 text-[#004E98]" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-bold text-gray-900">Create New Case</DialogTitle>
                                <DialogDescription className="text-gray-500 mt-1 font-medium">
                                    Fill in the details to create a new support case and initiate the workflow.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <ScrollArea className="max-h-[60vh]">
                        <div className="p-8 space-y-8 bg-gray-50/30">
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700">Case Title *</Label>
                                        <Input
                                            value={newCaseForm.title}
                                            onChange={(e) => onNewCaseFormChange({ ...newCaseForm, title: e.target.value })}
                                            placeholder="Brief summary of the issue"
                                            className="h-11 border-gray-200 focus:ring-2 focus:ring-[#004E98]/10 transition-all bg-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700">Service Category *</Label>
                                        <Select value={newCaseForm.serviceCategoryId} onValueChange={(v) => onNewCaseFormChange({ ...newCaseForm, serviceCategoryId: v })}>
                                            <SelectTrigger className="h-11 border-gray-200 bg-white">
                                                <SelectValue placeholder="Select a category to apply SLA rules" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {serviceCategories.map((cat) => (
                                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700">Detailed Description</Label>
                                        <div className="relative group">
                                            <Textarea
                                                value={newCaseForm.description}
                                                onChange={(e) => onNewCaseFormChange({ ...newCaseForm, description: e.target.value })}
                                                placeholder="Provide as much context as possible..."
                                                rows={4}
                                                className="border-gray-200 focus:ring-2 focus:ring-[#004E98]/10 transition-all resize-none bg-white pr-10"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700">Priority</Label>
                                        <Select value={newCaseForm.priority} onValueChange={(v) => onNewCaseFormChange({ ...newCaseForm, priority: v })}>
                                            <SelectTrigger className="h-11 border-gray-200 bg-white"><SelectValue /></SelectTrigger>
                                            <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{formatLabel(p)}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700">Inbound Channel</Label>
                                        <Select value={newCaseForm.channel} onValueChange={(v) => onNewCaseFormChange({ ...newCaseForm, channel: v })}>
                                            <SelectTrigger className="h-11 border-gray-200 bg-white"><SelectValue /></SelectTrigger>
                                            <SelectContent>{CHANNELS.map((ch) => <SelectItem key={ch} value={ch}>{formatLabel(ch)}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-100">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-4">Stakeholder Information</h4>
                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold text-gray-700">Full Name</Label>
                                            <Input value={newCaseForm.contactName} onChange={(e) => onNewCaseFormChange({ ...newCaseForm, contactName: e.target.value })} placeholder="Student or Guest name" className="h-11 border-gray-200 bg-white" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-bold text-gray-700">Email Address</Label>
                                                <Input value={newCaseForm.contactEmail} onChange={(e) => onNewCaseFormChange({ ...newCaseForm, contactEmail: e.target.value })} placeholder="email@example.com" type="email" className="h-11 border-gray-200 bg-white" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-sm font-bold text-gray-700">Mobile Number</Label>
                                                <Input value={newCaseForm.contactPhone} onChange={(e) => onNewCaseFormChange({ ...newCaseForm, contactPhone: e.target.value })} placeholder="+254..." className="h-11 border-gray-200 bg-white" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="p-6 bg-white border-t flex justify-end gap-3">
                        <Button variant="ghost" onClick={onNewCaseClose} className="font-bold text-gray-500 hover:bg-gray-100">Cancel</Button>
                        <Button
                            onClick={onCreateCase}
                            disabled={newCaseLoading}
                            className="bg-[#01a64e] hover:bg-[#01a64e]/90 text-white font-bold px-8 h-11 shadow-lg shadow-green-100 transition-all hover:scale-[1.02] active:scale-95"
                        >
                            {newCaseLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Initialize Case
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AcknowledgeModal
                open={showAckModal}
                onOpenChange={setShowAckModal}
                onConfirm={confirmAcknowledge}
                isProcessing={isUpdating}
                channel={cases.find(c => c.id === pendingStatus?.id)?.channel || "email"}
            />
            <ResolveModal
                open={showResolveModal}
                onOpenChange={setShowResolveModal}
                onConfirm={confirmResolve}
                isProcessing={isUpdating}
            />
            <EscalationModal
                isOpen={showEscalationModal}
                onClose={() => setShowEscalationModal(false)}
                caseId={pendingStatus?.id || ""}
                caseNumber={pendingStatus?.caseNumber || ""}
                departments={departments}
                onSuccess={() => onStatusChange?.(pendingStatus?.id || "", "escalated")}
            />
        </div>
    );
}

function UserAssignmentSelect({ caseId, currentUserId, initialUserName, initialUserEmail, initialUserActiveCases, departmentId, onAssign }: { caseId: string, currentUserId: string, initialUserName?: string | null, initialUserEmail?: string | null, initialUserActiveCases?: number | null, departmentId: string, onAssign: (uid: string) => void }) {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (open && users.length === 0 && departmentId) {
            const fetchUsers = async () => {
                setLoading(true);
                try {
                    const token = localStorage.getItem("marketingToken");
                    const res = await fetch(`/api/admin/users?departmentId=${departmentId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setUsers(data.users || []);
                    }
                } catch (err) {
                    console.error("Failed to fetch users for department:", err);
                } finally {
                    setLoading(false);
                }
            };
            fetchUsers();
        }
    }, [open, departmentId, users.length]);

    const activeUser = users.find(u => u.id === currentUserId);

    return (
        <Select value={currentUserId || "unassigned"} onValueChange={(v) => onAssign(v === "unassigned" ? "" : v)} onOpenChange={setOpen}>
            <SelectTrigger className="h-8 border-none shadow-none font-medium hover:bg-gray-100 p-2 rounded-md transition-colors w-full">
                <SelectValue placeholder="Assign User" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="unassigned" className="font-bold text-gray-400 italic">Unassigned</SelectItem>
                
                {/* Fallback for initial state before users are loaded */}
                {currentUserId && !activeUser && initialUserName && (
                    <SelectItem value={currentUserId} disabled className="hidden">
                        <div className="flex flex-col">
                            <div className="flex items-center justify-between gap-4">
                                <span className="font-bold text-xs">{initialUserName}</span>
                                {initialUserActiveCases != null && (
                                    <Badge variant="secondary" className="text-[10px] bg-blue-50 text-[#004E98] border-none px-1.5 h-4 font-black">
                                        {initialUserActiveCases}
                                    </Badge>
                                )}
                            </div>
                            {initialUserEmail && (
                                <span className="text-[10px] text-gray-400 leading-none mt-0.5">{initialUserEmail}</span>
                            )}
                        </div>
                    </SelectItem>
                )}

                {loading ? (
                    <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin text-[#004E98]" />
                    </div>
                ) : (
                    users.map(u => (
                        <SelectItem key={u.id} value={u.id}>
                            <div className="flex flex-col">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="font-bold text-xs">{u.firstName} {u.lastName}</span>
                                    <Badge variant="secondary" className="text-[10px] bg-blue-50 text-[#004E98] border-none px-1.5 h-4 font-black">
                                        {u.activeCaseCount || 0}
                                    </Badge>
                                </div>
                                <span className="text-[10px] text-gray-400 leading-none mt-0.5">{u.email}</span>
                            </div>
                        </SelectItem>
                    ))
                )}
            </SelectContent>
        </Select>
    );
}

