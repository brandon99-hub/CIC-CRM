import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
    Plus, Pencil, Trash2, Clock, ShieldCheck,
    Search, Activity, AlertCircle, Info, Loader2,
    ChevronLeft, ChevronRight
} from "lucide-react";
import { useState, useCallback } from "react";

import { ServiceCategory, SlaRule } from "@/types/admin";

interface SlaRulesProps {
    slaRules: SlaRule[];
    categories: ServiceCategory[];
    getCatName: (id: string | null) => string;
    priorityColors: Record<string, string>;
    formatMinutes: (minutes: number) => string;
    // Modal
    slaModalOpen: boolean;
    editingSla: SlaRule | null;
    slaForm: {
        name: string;
        serviceCategoryId: string;
        priority: string;
        metricType: string;
        timeline: number;
        timelineUnit: string;
        responseTimeMinutes: number;
        businessHoursOnly: boolean;
        businessHoursStart?: string;
        businessHoursEnd?: string;
    };
    onSlaFormChange: (form: SlaRulesProps["slaForm"]) => void;
    onOpenSlaModal: (sla?: SlaRule) => void;
    onSaveSla: () => void;
    onDeleteSla: (id: string) => void;
    onCloseSlaModal: () => void;
}

function renderEmptyState(entity: string, onAdd: () => void) {
    return (
        <div className="text-center py-16 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200">
            <div className="bg-white p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                <Clock className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-gray-600 font-medium text-lg">No {entity} found</p>
            <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">Establish service level agreements to ensure timely response and resolution for your stakeholders.</p>
            <Button variant="outline" onClick={onAdd} className="mt-6 border-gray-200 hover:bg-white hover:border-[#004E98] hover:text-[#004E98] transition-all">
                <Plus className="h-4 w-4 mr-2" /> Define Your First SLA
            </Button>
        </div>
    );
}

export function SlaRules({
    slaRules,
    categories,
    getCatName,
    priorityColors,
    formatMinutes,
    slaModalOpen,
    editingSla,
    slaForm,
    onSlaFormChange,
    onOpenSlaModal,
    onSaveSla,
    onDeleteSla,
    onCloseSlaModal,
}: SlaRulesProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            await onSaveSla();
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredRules = slaRules.filter(rule =>
        rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCatName(rule.serviceCategoryId).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredRules.length / itemsPerPage);
    const paginatedRules = filteredRules.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-[#004E98]/10 p-3 rounded-lg">
                        <Clock className="h-6 w-6 text-[#004E98]" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 leading-none">SLA Rules</h3>
                        <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-1.5 font-medium">
                            <Activity className="h-3.5 w-3.5 text-[#D0AC01]" /> Service Level Agreements & Commitment Rules
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Filter by name or category..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-10 bg-gray-50/50 border-gray-200 focus:bg-white transition-all transition-all duration-200"
                        />
                    </div>
                    <Button onClick={() => onOpenSlaModal()} className="bg-[#004E98] hover:bg-[#003B73] shadow-md transition-all hover:scale-[1.02] font-bold">
                        <Plus className="h-4 w-4 mr-2" />Add SLA Rule
                    </Button>
                </div>
            </div>

            {filteredRules.length === 0 ? renderEmptyState(searchTerm ? "matching rules" : "SLA rules", onOpenSlaModal) : (
                <Card className="overflow-hidden border-gray-200 shadow-lg group">
                    <div className="overflow-x-auto">
                        <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                                <TableHead className="font-bold text-gray-700 py-4 pl-6">Commitment Name</TableHead>
                                <TableHead className="font-bold text-gray-700 hidden md:table-cell">Operation Category</TableHead>
                                <TableHead className="font-bold text-gray-700">Priority</TableHead>
                                <TableHead className="font-bold text-gray-700">Performance Targets</TableHead>
                                <TableHead className="font-bold text-gray-700">Governance</TableHead>
                                <TableHead className="font-bold text-gray-700 text-right pr-6">Management</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedRules.map((sla) => (
                                <TableRow key={sla.id} className="hover:bg-gray-50/50 transition-colors group/row">
                                    <TableCell className="py-4 pl-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100 italic font-black text-[#004E98] text-[10px]">
                                                SLA
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-900 truncate">{sla.name}</p>
                                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">Agreement ID: {sla.id.substring(0, 8)}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell font-medium text-gray-600">
                                        {getCatName(sla.serviceCategoryId)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-0 shadow-sm ${priorityColors[sla.priority] || "bg-gray-100 text-gray-700"}`}>
                                            {sla.priority}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter w-16">Metric</span>
                                                <Badge variant="outline" className="text-emerald-700 bg-emerald-50/50 border-emerald-100 font-bold px-1 py-0 uppercase text-[9px]">
                                                    {sla.metricType.replace('_', ' ')}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter w-16">Target</span>
                                                <Badge variant="outline" className="text-[#004E98] bg-blue-50/50 border-blue-100 font-bold px-1 py-0 text-[9px]">
                                                    {sla.timeline} {sla.timelineUnit}
                                                </Badge>
                                            </div>
                                            {(sla.responseTimeMinutes || 0) > 0 && (
                                                <div className="flex items-center gap-2 mt-1 border-t border-gray-100 pt-1">
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter w-16">Response</span>
                                                    <Badge variant="outline" className="text-orange-700 bg-orange-50/50 border-orange-100 font-bold px-1 py-0 text-[9px]">
                                                        {formatMinutes(sla.responseTimeMinutes || 0)}
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${sla.isActive ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-gray-300"}`} />
                                                <span className={`text-[11px] font-bold ${sla.isActive ? 'text-gray-700' : 'text-gray-400'}`}>{sla.isActive ? 'Productive' : 'Inactive'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium italic">
                                                {sla.businessHoursOnly ? 'Institutional Hours' : '24/7 Monitoring'}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 group-hover/row:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => onOpenSlaModal(sla)}
                                                className="h-8 w-8 text-gray-500 hover:text-[#004E98] hover:bg-blue-50 border border-transparent hover:border-blue-100"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => onDeleteSla(sla.id)}
                                                className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 bg-gray-50/50 border-t border-gray-100">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                Page {currentPage} of {totalPages} ({filteredRules.length} committing rules)
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="h-8 w-8 p-0 border-gray-200"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="h-8 w-8 p-0 border-gray-200"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* SLA Modal */}
            <Dialog open={slaModalOpen} onOpenChange={onCloseSlaModal}>
                <DialogContent className="sm:max-w-[600px] p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="p-8 pb-4">
                        <DialogHeader>
                            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                <Clock className="h-5 w-5 text-[#004E98]" />
                                <DialogTitle className="text-2xl font-bold text-gray-900">
                                    {editingSla ? "Refine Agreement" : "Establish New SLA"}
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-gray-500 text-sm mt-3">
                                Define precision-based performance benchmarks for service delivery
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-8 pt-6 space-y-8 bg-white">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="col-span-2 space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Agreement Name</Label>
                                <Input
                                    value={slaForm.name}
                                    onChange={(e) => onSlaFormChange({ ...slaForm, name: e.target.value })}
                                    placeholder="e.g., Premier Support Response Rule"
                                    className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Service Category</Label>
                                <Select value={slaForm.serviceCategoryId} onValueChange={(v: string) => onSlaFormChange({ ...slaForm, serviceCategoryId: v })}>
                                    <SelectTrigger className="h-11 bg-gray-50/50 border-gray-200"><SelectValue placeholder="Target Category" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="any">Global Policy (Any)</SelectItem>
                                        {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Urgency Preference</Label>
                                <Select value={slaForm.priority} onValueChange={(v: string) => onSlaFormChange({ ...slaForm, priority: v })}>
                                    <SelectTrigger className="h-11 bg-gray-50/50 border-gray-200"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="critical">Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50/50 space-y-6">
                            <h4 className="text-[10px] font-bold text-[#004E98] uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                                <AlertCircle className="h-3 w-3" /> Time-Based Benchmarks
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold text-gray-700">Target Metric</Label>
                                    <Select value={slaForm.metricType} onValueChange={(v: string) => onSlaFormChange({ ...slaForm, metricType: v })}>
                                        <SelectTrigger className="w-full h-10 border-gray-200 bg-white"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="response_time">Response Time</SelectItem>
                                            <SelectItem value="resolution_time">Resolution Time</SelectItem>
                                            <SelectItem value="processing_time">Processing Time</SelectItem>
                                            <SelectItem value="delivery_time">Delivery Time</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-xs font-bold text-gray-700">Target Timeline</Label>
                                    <div className="flex gap-2">
                                        <Input type="number" min={1} value={slaForm.timeline} onChange={(e) => onSlaFormChange({ ...slaForm, timeline: parseInt(e.target.value) || 1 })} className="h-10 w-20 bg-white border-gray-200" />
                                        <Select value={slaForm.timelineUnit} onValueChange={(v: string) => onSlaFormChange({ ...slaForm, timelineUnit: v })}>
                                            <SelectTrigger className="flex-1 h-10 border-gray-200 bg-white"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="seconds">Seconds</SelectItem>
                                                <SelectItem value="minutes">Minutes</SelectItem>
                                                <SelectItem value="hours">Hours</SelectItem>
                                                <SelectItem value="working days">Working Days</SelectItem>
                                                <SelectItem value="calendar days">Calendar Days</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-3 sm:col-span-2 border-t border-gray-200 pt-4 mt-2">
                                    <Label className="text-xs font-bold text-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                                        <span>Initial Response Time Limit</span>
                                        <span className="text-[10px] text-gray-400 font-normal">Optional: For inbound channels only</span>
                                    </Label>
                                    <div className="flex gap-2 items-center">
                                        <Input type="number" min={0} value={slaForm.responseTimeMinutes} onChange={(e) => onSlaFormChange({ ...slaForm, responseTimeMinutes: parseInt(e.target.value) || 0 })} placeholder="Mins" className="h-10 w-24 bg-white border-gray-200" />
                                        <span className="text-sm text-gray-500 font-medium">minutes</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 p-4 rounded-xl bg-blue-50/30 border border-blue-100 transition-all">
                            <div className="flex items-center group cursor-pointer" onClick={() => onSlaFormChange({ ...slaForm, businessHoursOnly: !slaForm.businessHoursOnly })}>
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${slaForm.businessHoursOnly ? 'bg-[#004E98] border-[#004E98]' : 'bg-white border-gray-300'}`}>
                                    {slaForm.businessHoursOnly && <Plus className="h-3 w-3 text-white" />}
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm font-bold text-gray-700">Business hours only</p>
                                </div>
                            </div>
                            {slaForm.businessHoursOnly && (
                                <div className="flex items-center gap-4 mt-2 pt-4 border-t border-blue-100/50">
                                    <div className="space-y-1.5 flex-1">
                                        <Label className="text-xs font-bold text-gray-700">Start Time</Label>
                                        <Input 
                                            type="time" 
                                            value={slaForm.businessHoursStart || "08:00"} 
                                            onChange={(e) => onSlaFormChange({ ...slaForm, businessHoursStart: e.target.value })}
                                            className="h-10 bg-white border-gray-200" 
                                        />
                                    </div>
                                    <div className="space-y-1.5 flex-1">
                                        <Label className="text-xs font-bold text-gray-700">End Time</Label>
                                        <Input 
                                            type="time" 
                                            value={slaForm.businessHoursEnd || "17:00"} 
                                            onChange={(e) => onSlaFormChange({ ...slaForm, businessHoursEnd: e.target.value })}
                                            className="h-10 bg-white border-gray-200" 
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 gap-3">
                        <Button variant="outline" onClick={onCloseSlaModal} className="px-6 font-bold" disabled={isSubmitting}>Discard Changes</Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSubmitting}
                            className="bg-[#004E98] hover:bg-[#003B73] text-white px-8 font-bold shadow-lg shadow-blue-500/10 active:scale-[0.98] transition-all min-w-[140px]"
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {isSubmitting ? "Processing..." : (editingSla ? "Save Final Updates" : "Issue Policy")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
