import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, GitBranch, ShieldAlert, Activity, Info, Clock, UserCheck, MessageSquare, AlertTriangle, Layers, ArrowUpCircle } from "lucide-react";

import { Role, ServiceCategory, EscalationChain, EscalationStep, SlaRule, SystemUser, Department } from "@/types/admin";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface EscalationChainsProps {
    chains: EscalationChain[];
    roles: Role[];
    categories: ServiceCategory[];
    expandedChain: string | null;
    getCatName: (id: string | null) => string;
    getRoleName: (id: string | null) => string;
    getSlaName: (id: string | null) => string;
    formatMinutes: (minutes: number) => string;
    onToggleChainExpand: (id: string) => void;
    // Chain modal
    chainModalOpen: boolean;
    editingChain: EscalationChain | null;
    chainForm: { name: string; serviceCategoryId: string; slaId: string; priority: string; description: string; assigneeUserId: string; escalateAfterMinutes: number };
    onChainFormChange: (form: { name: string; serviceCategoryId: string; slaId: string; priority: string; description: string; assigneeUserId: string; escalateAfterMinutes: number }) => void;
    onOpenChainModal: (chain?: EscalationChain) => void;
    onSaveChain: () => void;
    onDeleteChain: (id: string) => void;
    onCloseChainModal: () => void;
    // Step modal
    stepModalOpen: boolean;
    stepForm: { assigneeDepartmentId: string; targetDepartmentId: string; assigneeRoleId: string; assigneeUserId: string | null; escalateAfterMinutes: number; requiresConsent: boolean; gracePeriodMinutes: number; notifyChannel: string; description: string };
    onStepFormChange: (form: Partial<{ assigneeDepartmentId: string; targetDepartmentId: string; assigneeRoleId: string; assigneeUserId: string | null; escalateAfterMinutes: number; requiresConsent: boolean; gracePeriodMinutes: number; notifyChannel: string; description: string }>) => void;
    onOpenStepModal: (chainId: string, step?: EscalationStep) => void;
    onSaveStep: () => void;
    onDeleteStep: (chainId: string, stepId: string) => void;
    onCloseStepModal: () => void;
    slaRules: SlaRule[];
    users: SystemUser[];
    departments: Department[];
    stepChainId: string;
    isSaving?: boolean;
    editingStep?: EscalationStep | null;
    stepData?: EscalationStep[];
    stepsLoading?: boolean;
    canManage?: boolean;
    hideHeader?: boolean;
}

function renderEmptyState(entity: string, onAdd: () => void) {
    return (
        <div className="text-center py-16 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200">
            <div className="bg-white p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                <GitBranch className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-gray-600 font-medium text-lg">No {entity} found</p>
            <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">Define multi-tier escalation protocols to ensure critical issues always find the right authority.</p>
            {onAdd && (
                <Button variant="outline" onClick={onAdd} className="mt-6 border-gray-200 hover:bg-white hover:border-[#004E98] hover:text-[#004E98] transition-all">
                    <Plus className="h-4 w-4 mr-2" /> Architect Your First Chain
                </Button>
            )}
        </div>
    );
}

export function EscalationChains(props: EscalationChainsProps) {
    const {
        chains,
        roles,
        categories,
        expandedChain,
        getCatName,
        getRoleName,
        getSlaName,
        formatMinutes,
        onToggleChainExpand,
        chainModalOpen,
        editingChain,
        chainForm,
        onChainFormChange,
        onOpenChainModal,
        onSaveChain,
        onDeleteChain,
        onCloseChainModal,
        stepModalOpen,
        stepForm,
        onStepFormChange,
        onOpenStepModal,
        onSaveStep,
        onDeleteStep,
        onCloseStepModal,
        slaRules,
        users,
        departments,
        stepChainId,
        isSaving = false,
        stepData = [],
        stepsLoading = false,
        canManage = true,
        hideHeader = false,
    } = props;
    return (
        <div className="space-y-6">
            {!hideHeader && (
                <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#004E98]/10 p-3 rounded-lg">
                        <ArrowUpCircle className="h-6 w-6 text-[#004E98]" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 leading-none">Escalation Framework</h3>
                        <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-1.5 font-medium">
                            <ShieldAlert className="h-3.5 w-3.5 text-rose-500" /> Operational Redundancy & Critical Protocols
                        </p>
                    </div>
                </div>
                {canManage && (
                    <Button onClick={() => onOpenChainModal()} className="bg-[#004E98] hover:bg-[#003B73] shadow-md transition-all hover:scale-[1.02] font-bold">
                        <Plus className="h-4 w-4 mr-2" />Construct New Chain
                    </Button>
                )}
            </div>
            )}

            {chains.length === 0 ? renderEmptyState("escalation chains", canManage ? onOpenChainModal : undefined as any) : (
                <div className="grid gap-4">
                    {chains.map((chain) => (
                        <Card key={chain.id} className={`overflow-hidden transition-all duration-300 border-gray-100 group/chain ${expandedChain === chain.id ? 'ring-2 ring-[#004E98]/10 shadow-xl' : 'hover:shadow-md hover:border-blue-100'}`}>
                            <div
                                className={`flex items-center justify-between p-5 cursor-pointer transition-colors ${expandedChain === chain.id ? 'bg-blue-50/30' : 'bg-white'}`}
                                onClick={() => onToggleChainExpand(chain.id)}
                            >
                                <div className="flex items-center gap-5">
                                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all ${expandedChain === chain.id ? 'bg-[#004E98] text-white shadow-lg' : 'bg-blue-50 text-[#004E98] group-hover/chain:bg-blue-100'}`}>
                                        <ArrowUpCircle className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">{chain.name}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[10px] font-bold text-[#004E98] border-blue-100 bg-blue-50/50">
                                                {chain.slaId ? getSlaName(chain.slaId) : getCatName(chain.serviceCategoryId)}
                                            </Badge>
                                            <span className="text-gray-300 text-xs">•</span>
                                            <p className="text-[11px] text-gray-500 font-medium">
                                                {chain.steps?.length ?? 0} Steps Defined
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex gap-1 opacity-0 group-hover/chain:opacity-100 transition-opacity pr-2">
                                        {canManage && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => { e.stopPropagation(); onOpenChainModal(chain); }}
                                                    className="h-8 w-8 text-gray-400 hover:text-[#004E98] hover:bg-white"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => { e.stopPropagation(); onDeleteChain(chain.id); }}
                                                    className="h-8 w-8 text-gray-400 hover:text-rose-600 hover:bg-white"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                    <div className={`transition-transform duration-300 ${expandedChain === chain.id ? 'rotate-180 text-[#004E98]' : 'text-gray-300'}`}>
                                        <ChevronDown className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>

                            {expandedChain === chain.id && (
                                <div className="p-6 bg-gray-50/30 border-t border-gray-100 animate-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-2">
                                            <Activity className="h-4 w-4 text-[#004E98]" />
                                            <h4 className="font-bold text-sm text-gray-900 uppercase tracking-widest">Protocol Execution Steps</h4>
                                        </div>
                                        {canManage && (
                                            <Button size="sm" onClick={() => onOpenStepModal(chain.id)} className="h-9 bg-[#004E98] text-white font-bold hover:bg-[#003B73]">
                                                <Plus className="h-3.5 w-3.5 mr-1.5" />Append Tier
                                            </Button>
                                        )}
                                    </div>

                                    {stepsLoading ? (
                                        <div className="flex justify-center p-8 bg-white rounded-xl border border-gray-100">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#004E98]"></div>
                                        </div>
                                    ) : stepData.length === 0 ? (
                                        <div className="bg-white p-8 rounded-xl border border-dashed border-gray-200 text-center">
                                            <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                                            <p className="text-gray-400 text-xs font-medium">No escalation logic defined yet. Add steps to activate this chain.</p>
                                        </div>
                                    ) : (
                                        <div className="relative pl-8 space-y-6 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-blue-200 before:to-gray-100">
                                            {stepData.sort((a: EscalationStep, b: EscalationStep) => a.stepOrder - b.stepOrder).map((step: EscalationStep, idx: number) => (
                                                <div key={step.id} className="relative group/step">
                                                    <div className={`absolute left-[-25px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 transition-colors z-10 ${idx === 0 ? 'bg-[#004E98] border-[#004E98]' : 'bg-white border-blue-200'}`} />
                                                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-blue-100 flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-10 w-10 rounded-lg bg-gray-50 flex items-center justify-center text-xs font-black text-gray-400 border border-gray-100">
                                                                T{step.stepOrder}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-sm font-bold text-gray-900">
                                                                        {step.assigneeUserId ? (users.find(u => u.id === step.assigneeUserId)?.firstName + ' ' + users.find(u => u.id === step.assigneeUserId)?.lastName) :
                                                                            step.assigneeRoleId ? getRoleName(step.assigneeRoleId) : "Unassigned Authority"}
                                                                    </p>
                                                                    <Badge className="bg-blue-50 text-[#004E98] border-0 text-[9px] font-black uppercase">
                                                                        {step.notifyChannel}
                                                                    </Badge>
                                                                    {step.requiresConsent && (
                                                                        <Badge className="bg-amber-50 text-amber-700 border-amber-100 text-[9px] font-black uppercase">
                                                                            Consent Req.
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter bg-gray-100 px-1.5 py-0.5 rounded">
                                                                        {departments.find(d => d.id === step.assigneeDepartmentId)?.name || 'Default'}
                                                                        {step.targetDepartmentId && (
                                                                            <>
                                                                                <ChevronRight className="h-2 w-2 inline mx-1 text-gray-400" />
                                                                                <span className="text-[#004E98]">{departments.find(d => d.id === step.targetDepartmentId)?.name}</span>
                                                                            </>
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500 font-medium">
                                                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Escalate in {formatMinutes(step.escalateAfterMinutes)}</span>
                                                                    <span className="text-gray-300">|</span>
                                                                    <span className="flex items-center gap-1 italic">{step.description || "Automatic escalation trigger"}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover/step:opacity-100 transition-opacity">
                                                            {canManage && (
                                                                <>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => onOpenStepModal(chain.id, step)}
                                                                        className="h-8 w-8 text-gray-400 hover:text-[#004E98]"
                                                                    >
                                                                        <Pencil className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => onDeleteStep(chain.id, step.id)}
                                                                        className="h-8 w-8 text-gray-300 hover:text-rose-600"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}

            {/* Escalation Chain Modal */}
            <Dialog open={chainModalOpen} onOpenChange={onCloseChainModal}>
                <DialogContent className="sm:max-w-[600px] p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="p-8 pb-4">
                        <DialogHeader>
                            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                <GitBranch className="h-5 w-5 text-[#004E98]" />
                                <DialogTitle className="text-2xl font-bold text-gray-900">
                                    {editingChain ? "Refine Chain Architecture" : "Design Escalation Path"}
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-gray-500 text-sm mt-3">
                                Configure redundant operational layers and trigger points
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-8 pt-6 space-y-6 bg-white">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="col-span-2 space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Chain Designation</Label>
                                <Input
                                    value={chainForm.name}
                                    onChange={(e) => onChainFormChange({ ...chainForm, name: e.target.value })}
                                    placeholder="e.g. Critical Support Escalation"
                                    className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">SLA Integration</Label>
                                <Select value={chainForm.slaId} onValueChange={(v: string) => onChainFormChange({ ...chainForm, slaId: v })}>
                                    <SelectTrigger className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white"><SelectValue placeholder="Select SLA Rule" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Specific SLA (Manual Only)</SelectItem>
                                        {slaRules.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name} ({s.priority.toUpperCase()})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Trigger Urgency</Label>
                                <Select value={chainForm.priority} onValueChange={(v: string) => onChainFormChange({ ...chainForm, priority: v })}>
                                    <SelectTrigger className="h-11 bg-gray-50/50 border-gray-200"><SelectValue placeholder="Any Priority" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="any">Implicit (Any)</SelectItem>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="critical">Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-2 space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Governance Description</Label>
                                <Textarea
                                    value={chainForm.description}
                                    onChange={(e) => onChainFormChange({ ...chainForm, description: e.target.value })}
                                    className="min-h-[100px] bg-gray-50/50 focus:bg-white border-gray-200 resize-none"
                                />
                            </div>

                            {!editingChain && (
                                <div className="col-span-2 space-y-6 pt-6 border-t border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Initial Escalation Tier (Tier 1)</h4>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Auto-Escalate To</Label>
                                            <Select value={chainForm.assigneeUserId || "none"} onValueChange={(v: string) => onChainFormChange({ ...chainForm, assigneeUserId: v === "none" ? "" : v })}>
                                                <SelectTrigger className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white"><SelectValue placeholder="Select User" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Assign to Any in Role</SelectItem>
                                                    {(() => {
                                                        const linkedSla = slaRules.find(s => s.id === chainForm.slaId);
                                                        const linkedCategory = categories.find(c => c.id === linkedSla?.serviceCategoryId);
                                                        const deptId = linkedCategory?.departmentId;

                                                        // Fix: If no SLA/Dept is resolved, return empty to encourage SLA selection first
                                                        const filteredUsers = deptId ? users.filter(u => u.departmentId === deptId) : [];

                                                        return filteredUsers.map((u) => (
                                                            <SelectItem key={u.id} value={u.id}>
                                                                {u.firstName} {u.lastName}
                                                            </SelectItem>
                                                        ));
                                                    })()}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Escalation Timer (Minutes)</Label>
                                            <Input
                                                type="number"
                                                value={chainForm.escalateAfterMinutes}
                                                onChange={(e) => onChainFormChange({ ...chainForm, escalateAfterMinutes: parseInt(e.target.value) || 0 })}
                                                className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white"
                                                placeholder="e.g. 30"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 gap-3">
                        <Button variant="outline" onClick={onCloseChainModal} className="px-6 font-bold" disabled={isSaving}>Discard Changes</Button>
                        <Button onClick={onSaveChain} disabled={isSaving} className="bg-[#004E98] hover:bg-[#003B73] text-white px-8 font-bold shadow-lg shadow-blue-500/10 transition-all active:scale-[0.98]">
                            {isSaving ? "Saving..." : (editingChain ? "Save Framework" : "Deploy Chain")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Escalation Step Modal */}
            <Dialog open={stepModalOpen} onOpenChange={onCloseStepModal}>
                <DialogContent className="sm:max-w-[700px] p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden max-h-[90vh] flex flex-col">
                    <div className="p-8 pb-4">
                        <DialogHeader>
                            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                <UserCheck className="h-5 w-5 text-[#004E98]" />
                                <DialogTitle className="text-xl font-bold text-gray-900">
                                    {props.editingStep ? "Refine Escalation Tier" : "Append Escalation Tier"}
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-gray-500 text-sm mt-3">
                                {props.editingStep ? "Adjust parameters for this operational layer" : "Define the next level of authority and notification channel"}
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-6 space-y-6 bg-white">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Current Department</Label>
                                <Select value={stepForm.assigneeDepartmentId} onValueChange={(v: string) => onStepFormChange({ assigneeDepartmentId: v })}>
                                    <SelectTrigger className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white transition-all"><SelectValue placeholder="Select Dept" /></SelectTrigger>
                                    <SelectContent>
                                        {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Target Department (Optional)</Label>
                                <Select value={stepForm.targetDepartmentId || "none"} onValueChange={(v: string) => onStepFormChange({ targetDepartmentId: v === "none" ? "" : v, assigneeUserId: null })}>
                                    <SelectTrigger className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white transition-all"><SelectValue placeholder="Select Dept" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Same as current</SelectItem>
                                        {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="col-span-2 space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Individual Assignee</Label>
                                <SearchableSelect
                                    options={(() => {
                                        const deptId = stepForm.targetDepartmentId || stepForm.assigneeDepartmentId;
                                        const filteredUsers = deptId ? users.filter(u => u.departmentId === deptId) : [];
                                        const baseOptions = [{ id: "none", label: "Assign to Any in Dept" }];
                                        const userOptions = filteredUsers.map(u => ({ id: u.id, label: `${u.firstName} ${u.lastName}` }));
                                        return [...baseOptions, ...userOptions];
                                    })()}
                                    value={stepForm.assigneeUserId || "none"}
                                    onValueChange={(v) => onStepFormChange({ assigneeUserId: v === "none" ? null : v })}
                                    placeholder="Search for an expert..."
                                    searchPlaceholder="Find assistant..."
                                    className="h-11 shadow-sm"
                                />
                                <p className="text-[10px] text-gray-400 font-medium ml-1">
                                    {stepForm.targetDepartmentId ? "Filtering experts in " + departments.find(d => d.id === stepForm.targetDepartmentId)?.name : "Showing experts in " + (departments.find(d => d.id === stepForm.assigneeDepartmentId)?.name || 'default department')}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">SLA Breach Window</Label>
                                <div className="relative group">
                                    <Input
                                        type="number"
                                        min={1}
                                        value={stepForm.escalateAfterMinutes}
                                        onChange={(e) => onStepFormChange({ ...stepForm, escalateAfterMinutes: parseInt(e.target.value) || 0 })}
                                        className="h-11 bg-gray-50/50 border-gray-200 pr-12 focus:bg-white font-bold transition-all"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 group-focus-within:text-[#004E98]">MINS</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Dispatch Via</Label>
                                <Select value={stepForm.notifyChannel} onValueChange={(v: string) => onStepFormChange({ ...stepForm, notifyChannel: v })}>
                                    <SelectTrigger className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white transition-all"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="email">Institutional Email</SelectItem>
                                        <SelectItem value="sms">SMS Gateway</SelectItem>
                                        <SelectItem value="in_app">Platform Alert</SelectItem>
                                        <SelectItem value="all">Omnichannel Dispatch</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100/50 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${stepForm.requiresConsent ? 'bg-[#004E98] text-white' : 'bg-white text-gray-300 border border-gray-100'}`}>
                                    <ShieldAlert className="h-5 w-5" />
                                </div>
                                <div className="flex-1 flex items-center justify-between">
                                    <div>
                                        <Label htmlFor="requiresConsent" className="text-sm font-bold text-gray-900 cursor-pointer">Protocol Consent</Label>
                                        <p className="text-[10px] text-gray-500 font-medium">Require manual approval before shift</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        id="requiresConsent"
                                        checked={stepForm.requiresConsent}
                                        onChange={(e) => onStepFormChange({ ...stepForm, requiresConsent: e.target.checked })}
                                        className="h-5 w-5 rounded-md border-gray-300 text-[#004E98] focus:ring-[#004E98] transition-all cursor-pointer"
                                    />
                                </div>
                            </div>

                            {stepForm.requiresConsent && (
                                <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                                    <Label className="text-[10px] font-bold text-[#004E98] uppercase tracking-widest ml-1">Grace Period Window</Label>
                                    <div className="relative mt-1.5">
                                        <Input
                                            type="number"
                                            min={0}
                                            value={stepForm.gracePeriodMinutes}
                                            onChange={(e) => onStepFormChange({ ...stepForm, gracePeriodMinutes: parseInt(e.target.value) || 0 })}
                                            className="h-10 bg-white border-blue-200 focus:border-[#004E98] font-bold transition-all pr-12"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-400">MINS</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Operational Context</Label>
                            <Input
                                value={stepForm.description}
                                onChange={(e) => onStepFormChange({ ...stepForm, description: e.target.value })}
                                placeholder="e.g., Transfer to Regional Lead for oversight"
                                className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white transition-all font-medium"
                            />
                        </div>

                        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
                            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                            <p className="text-[10px] text-amber-800 leading-relaxed font-bold">
                                Tiers execute sequentially. Level T{editingChain ? (chains.find(c => c.id === editingChain.id)?.steps?.length ?? 0) + 1 : 2} triggers only if previous tiers remain unresolved.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 gap-3">
                        <Button variant="outline" onClick={onCloseStepModal} className="px-6 font-bold border-gray-200 hover:bg-white transition-all" disabled={isSaving}>Cancel</Button>
                        <Button onClick={onSaveStep} disabled={isSaving} className="bg-[#004E98] hover:bg-[#003B73] text-white px-8 font-bold shadow-lg shadow-blue-500/10 transition-all active:scale-95">
                            {isSaving ? "Saving..." : (props.editingStep ? "Update Tier" : "Append Tier")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
