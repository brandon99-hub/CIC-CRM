import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GitBranch, Cpu, Settings, Activity, ShieldCheck, Code, ArrowRight, X, XCircle, UserCheck, Megaphone, ClipboardList, MessageSquare, History, TrendingUp } from "lucide-react";

import { ServiceCategory, WorkflowRule, SlaRule, EscalationChain, SystemUser } from "@/types/admin";

interface WorkflowRulesProps {
    workflows: WorkflowRule[];
    categories: ServiceCategory[];
    slaRules: SlaRule[];
    escalationChains: EscalationChain[];
    getCatName: (id: string | null) => string;
    priorityColors: Record<string, string>;
    triggerEvents: string[];
    roles: { id: string; name: string }[];
    users: SystemUser[];
    onToggleWfActive: (wf: WorkflowRule) => void;
    // Modal
    wfModalOpen: boolean;
    editingWf: WorkflowRule | null;
    wfForm: {
        name: string;
        description: string;
        triggerEvent: string;
        serviceCategoryId: string;
        priority: string;
        conditions: string;
        actions: string;
    };
    onWfFormChange: (form: WorkflowRulesProps["wfForm"]) => void;
    onOpenWfModal: (wf?: WorkflowRule) => void;
    onSaveWf: () => void;
    onDeleteWf: (id: string) => void;
    onCloseWfModal: () => void;
    isSaving?: boolean;
}

// ── Power-10 Mappings ────────────────────────────────────────────────────────

const POWER_10_TRIGGERS = [
    { id: "case_created", label: "Case Created", icon: Activity },
    { id: "case_status_changed", label: "Case Status Changed", icon: Settings },
    { id: "sla_milestone_failed", label: "SLA Milestone Failed", icon: XCircle },
    { id: "escalation_level_reached", label: "Escalation Level Reached", icon: ArrowRight },
    { id: "stakeholder_onboarded", label: "Stakeholder Onboarded", icon: UserCheck },
    { id: "campaign_sent", label: "Campaign Sent", icon: Megaphone },
    { id: "survey_response_received", label: "Survey Response Received", icon: ClipboardList },
    { id: "outbound_comm_sent", label: "Outbound Communication Sent", icon: MessageSquare },
    { id: "interaction_logged", label: "Interaction Logged", icon: History },
    { id: "stakeholder_score_changed", label: "Stakeholder Score Changed", icon: TrendingUp },
];

const CONDITION_FIELDS: Record<string, { label: string, type: 'select' | 'text' | 'number', options?: { value: string, label: string }[] }> = {
    priority: {
        label: "Priority",
        type: 'select',
        options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "critical", label: "Critical" }
        ]
    },
    channel: {
        label: "Origin Channel",
        type: 'select',
        options: [
            { value: "walk_in", label: "Walk-in" },
            { value: "email", label: "Email" },
            { value: "portal", label: "Student/Staff Portal" },
            { value: "phone", label: "Phone Call" },
            { value: "whatsapp", label: "WhatsApp" },
            { value: "sms", label: "SMS" }
        ]
    },
    stakeholder_type: {
        label: "Stakeholder Type",
        type: 'select',
        options: [
            { value: "student", label: "Student" },
            { value: "parent", label: "Parent/Guardian" },
            { value: "staff", label: "Staff Member" },
            { value: "corporate", label: "Corporate Partner" },
            { value: "alumnus", label: "Alumnus" }
        ]
    },
    case_status: {
        label: "Case Status",
        type: 'select',
        options: [
            { value: "open", label: "Open" },
            { value: "pending", label: "Pending" },
            { value: "in_progress", label: "In Progress" },
            { value: "resolved", label: "Resolved" },
            { value: "closed", label: "Closed" }
        ]
    },
    risk_profile: {
        label: "Risk Profile",
        type: 'select',
        options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" }
        ]
    },
    survey_satisfaction: {
        label: "Survey satisfaction",
        type: 'select',
        options: [
            { value: "1", label: "1 - Poor" },
            { value: "2", label: "2 - Fair" },
            { value: "3", label: "3 - Good" },
            { value: "4", label: "4 - Very Good" },
            { value: "5", label: "5 - Excellent" }
        ]
    },
    service_category_id: { label: "Service Specialty", type: 'select' }, // Options loaded from props
    department_id: { label: "Department Unit", type: 'select' }, // Options loaded from props
    title: { label: "Case Title", type: 'text' },
    description: { label: "Description", type: 'text' },
};

const ACTION_TYPES: Record<string, { label: string, paramType: 'select' | 'text' }> = {
    set_escalation_chain: { label: "Set Escalation Chain", paramType: 'select' },
    apply_sla_rule: { label: "Enforce SLA Rule", paramType: 'select' },
    reassign_to_role: { label: "Reassign to Role", paramType: 'select' },
    reassign_to_user: { label: "Assign to Expert User", paramType: 'select' },
    reassign_department: { label: "Re-Route Department", paramType: 'select' },
    set_priority: { label: "Set Priority", paramType: 'select' },
    add_case_tag: { label: "Append Status Tag", paramType: 'text' },
    send_notification: { label: "Execute Email Outreach", paramType: 'text' },
    promote_escalation: { label: "Promote Escalation Level", paramType: 'text' }, // simple param
    close_entity: { label: "Close Entity/Case", paramType: 'text' }, // no param usually
};

function renderEmptyState(entity: string, onAdd: () => void) {
    return (
        <div className="text-center py-16 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200">
            <div className="bg-white p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                <GitBranch className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-gray-600 font-medium text-lg">No {entity} defined</p>
            <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">Automate your service desk operations by defining logical triggers and conditional actions.</p>
            <Button variant="outline" onClick={onAdd} className="mt-6 border-gray-200 hover:bg-white hover:border-[#004E98] hover:text-[#004E98] transition-all">
                <Plus className="h-4 w-4 mr-2" /> Orchestrate Your First Workflow
            </Button>
        </div>
    );
}

export function WorkflowRules({
    workflows,
    categories,
    slaRules,
    escalationChains,
    getCatName,
    priorityColors,
    triggerEvents,
    onToggleWfActive,
    wfModalOpen,
    editingWf,
    wfForm,
    onWfFormChange,
    onOpenWfModal,
    onSaveWf,
    onDeleteWf,
    onCloseWfModal,
    roles,
    users,
    isSaving,
}: WorkflowRulesProps) {
    const parseJSON = (str: string, fallback: any) => {
        try {
            if (!str) return fallback;
            const parsed = JSON.parse(str);
            return parsed;
        } catch { return fallback; }
    };

    const getConditionSummary = (wf: WorkflowRule) => {
        const conds = Array.isArray(wf.conditions) ? wf.conditions : parseJSON(wf.conditions as unknown as string, []);
        if (conds.length === 0) return "Global (All cases)";

        return conds.map((c: any) => {
            const field = CONDITION_FIELDS[c.field]?.label || c.field;
            const op = c.operator === 'eq' ? 'is' : c.operator === 'neq' ? 'is not' : 'contains';
            let val = c.value;
            if (c.field === 'service_category_id') val = categories.find(cat => cat.id === c.value)?.name || c.value;
            if (c.field === 'department_id') val = `Dept: ${c.value}`;

            return `${field} ${op} "${val}"`;
        }).join(" AND ");
    };

    const getActionSummary = (wf: WorkflowRule) => {
        const acts = Array.isArray(wf.actions) ? wf.actions : parseJSON(wf.actions as unknown as string, []);
        if (acts.length === 0) return "No actions";

        return acts.map((a: any) => {
            const def = ACTION_TYPES[a.type]?.label || a.type;
            let detail = "";
            if (a.type === 'set_priority') detail = `: ${a.params?.priority || "medium"}`;
            if (a.type === 'send_notification') detail = `: "${a.params?.value || a.params?.message || ""}"`;
            if (a.type === 'set_escalation_chain') detail = `: ${escalationChains.find(c => c.id === a.params?.chainId)?.name || "Chain"}`;

            return `${def}${detail}`;
        }).join(", ");
    };

    const rawConditions = parseJSON(wfForm.conditions, []);
    const conditions: any[] = Array.isArray(rawConditions) ? rawConditions : [];

    const rawActions = parseJSON(wfForm.actions, []);
    const actions: any[] = Array.isArray(rawActions) ? rawActions : [];

    const updateConditions = (newConditions: any[]) => {
        onWfFormChange({ ...wfForm, conditions: JSON.stringify(newConditions) });
    };

    const updateActions = (newActions: any[]) => {
        onWfFormChange({ ...wfForm, actions: JSON.stringify(newActions) });
    };

    const addCondition = () => {
        updateConditions([...conditions, { field: "priority", operator: "eq", value: "high" }]);
    };

    const removeCondition = (index: number) => {
        updateConditions(conditions.filter((_, i) => i !== index));
    };

    const addAction = () => {
        updateActions([...actions, { type: "set_priority", params: { priority: "medium" } }]);
    };

    const removeAction = (index: number) => {
        updateActions(actions.filter((_, i) => i !== index));
    };

    // Filter fields based on trigger event prefix
    const getFilteredFields = () => {
        const trigger = wfForm.triggerEvent;
        const allFields = Object.keys(CONDITION_FIELDS);

        if (trigger.startsWith('case_') || trigger === 'escalation_level_reached' || trigger === 'sla_milestone_failed') {
            return allFields.filter(f => ['priority', 'channel', 'service_category_id', 'department_id', 'case_status', 'title', 'description'].includes(f));
        }
        if (trigger.startsWith('stakeholder_')) {
            return allFields.filter(f => ['stakeholder_type', 'risk_profile', 'department_id'].includes(f));
        }
        if (trigger === 'survey_response_received') {
            return allFields.filter(f => ['survey_satisfaction', 'service_category_id'].includes(f));
        }
        return allFields;
    };
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-amber-100/50 p-3 rounded-lg border border-amber-100">
                        <GitBranch className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 leading-none">Workflow Rules</h3>
                        <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-1.5 font-medium">
                            <Cpu className="h-3.5 w-3.5 text-[#004E98]" /> Behavioral Triggers & Operational Logic
                        </p>
                    </div>
                </div>
                <Button onClick={() => onOpenWfModal()} className="bg-[#004E98] hover:bg-[#003B73] shadow-md transition-all hover:scale-[1.02] font-bold">
                    <Plus className="h-4 w-4 mr-2" />Add Workflow Rule
                </Button>
            </div>

            {workflows.length === 0 ? renderEmptyState("workflow rules", onOpenWfModal) : (
                <Card className="overflow-hidden border-gray-200 shadow-xl bg-white">
                    <div className="overflow-x-auto">
                        <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80 border-b border-gray-100">
                                <TableHead className="font-bold text-gray-700 py-5 pl-6">Workflow Rules</TableHead>
                                <TableHead className="font-bold text-gray-700">Condition</TableHead>
                                <TableHead className="font-bold text-gray-700 hidden md:table-cell">Context</TableHead>
                                <TableHead className="font-bold text-gray-700 hidden lg:table-cell">Urgency</TableHead>
                                <TableHead className="font-bold text-gray-700">Action</TableHead>
                                <TableHead className="font-bold text-gray-700 pr-6 text-right">Management</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {workflows.map((wf) => (
                                <TableRow key={wf.id} className="hover:bg-gray-50/30 transition-colors border-b border-gray-50 last:border-0 group">
                                    <TableCell className="py-5 pl-6">
                                        <div>
                                            <p className="font-bold text-gray-900">{wf.name}</p>
                                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter mt-0.5 max-w-[200px] truncate">
                                                {wf.description || "Automated system protocol"}
                                            </p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1 max-w-[250px]">
                                            <p className="text-[10px] text-gray-500 font-bold leading-tight line-clamp-2 italic">
                                                {getConditionSummary(wf)}
                                            </p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <div className="flex items-center gap-2" title="Links this rule to a specific Service Category's cases">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                            <p className="text-xs font-bold text-gray-600">{getCatName(wf.serviceCategoryId)}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        {wf.priority ? (
                                            <Badge className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter border-0 shadow-sm ${wf.priority === 'critical' ? 'bg-rose-500 text-white' :
                                                wf.priority === 'high' ? 'bg-amber-400 text-white' :
                                                    'bg-[#004E98] text-white'
                                                }`}>
                                                {wf.priority}
                                            </Badge>
                                        ) : <span className="text-[10px] text-gray-300 italic font-medium">Universal</span>}
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-[10px] text-gray-500 font-medium max-w-[150px] truncate" title={getActionSummary(wf)}>
                                            {getActionSummary(wf)}
                                        </p>
                                    </TableCell>
                                    <TableCell className="pr-6 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" onClick={() => onToggleWfActive(wf)} className={`h-8 w-8 transition-colors ${wf.isActive ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50'}`}>
                                                {wf.isActive ? <XCircle className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => onOpenWfModal(wf)} className="h-8 w-8 text-gray-400 hover:text-[#004E98] hover:bg-blue-50 transition-colors">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => onDeleteWf(wf.id)} className="h-8 w-8 text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            {/* Workflow Modal */}
            <Dialog open={wfModalOpen} onOpenChange={onCloseWfModal}>
                <DialogContent className="max-w-2xl p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="p-8 pb-4">
                        <DialogHeader>
                            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                <GitBranch className="h-5 w-5 text-[#004E98]" />
                                <DialogTitle className="text-2xl font-bold text-gray-900">
                                    {editingWf ? "Refine Automation Logic" : "Orchestrate New Protocol"}
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-gray-500 text-sm mt-3">
                                Configure event-driven behavioral triggers and conditional processing
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-8 pt-6 space-y-6 bg-white">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="col-span-2 space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Protocol Identifier</Label>
                                <Input
                                    value={wfForm.name}
                                    onChange={(e) => onWfFormChange({ ...wfForm, name: e.target.value })}
                                    placeholder="e.g. Critical Support Automatic Assignment"
                                    className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white font-bold"
                                />
                            </div>

                            <div className="col-span-2 space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Operational Summary</Label>
                                <Textarea
                                    value={wfForm.description}
                                    onChange={(e) => onWfFormChange({ ...wfForm, description: e.target.value })}
                                    placeholder="Describe the logic and impact of this automation..."
                                    className="resize-none bg-gray-50/50 focus:bg-white border-gray-200"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Trigger Event Matrix</Label>
                                <Select value={wfForm.triggerEvent} onValueChange={(v: string) => onWfFormChange({ ...wfForm, triggerEvent: v })}>
                                    <SelectTrigger className="h-11 bg-gray-50/50 border-gray-200"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {POWER_10_TRIGGERS.map((te) => {
                                            const Icon = te.icon;
                                            return (
                                                <SelectItem key={te.id} value={te.id}>
                                                    <div className="flex items-center gap-2">
                                                        <Icon className="h-3.5 w-3.5 text-gray-400" />
                                                        <span>{te.label}</span>
                                                    </div>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Operational Importance</Label>
                                <Select value={wfForm.priority} onValueChange={(v: string) => onWfFormChange({ ...wfForm, priority: v })}>
                                    <SelectTrigger className="h-11 bg-gray-50/50 border-gray-200"><SelectValue placeholder="Implicit Priority" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="any">Standard Protocol</SelectItem>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="critical">Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="col-span-2 space-y-4 pt-2">
                                <div className="flex items-center justify-between mb-1 pl-1">
                                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Logic Filters (Conditions)</Label>
                                    <Button variant="ghost" size="sm" onClick={addCondition} className="h-7 text-[10px] font-bold text-[#004E98] hover:bg-blue-50">
                                        <Plus className="h-3 w-3 mr-1" /> Add Condition
                                    </Button>
                                </div>
                                <div className="space-y-3">
                                    {conditions.length === 0 && (
                                        <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-[10px] text-gray-400">
                                            No conditions defined. Rule will trigger for all cases matching the event.
                                        </div>
                                    )}
                                    {conditions.map((c, idx) => (
                                        <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100 animate-in fade-in slide-in-from-top-1">
                                            <Select value={c.field} onValueChange={(v: string) => {
                                                const newC = [...conditions];
                                                newC[idx].field = v;
                                                newC[idx].value = "";
                                                updateConditions(newC);
                                            }}>
                                                <SelectTrigger className="h-9 w-40 text-xs font-bold bg-white border-gray-200"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {getFilteredFields().map(f => (
                                                        <SelectItem key={f} value={f}>{CONDITION_FIELDS[f].label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Select value={c.operator} onValueChange={(v: string) => {
                                                const newC = [...conditions];
                                                newC[idx].operator = v;
                                                updateConditions(newC);
                                            }}>
                                                <SelectTrigger className="h-9 w-28 text-xs bg-white border-gray-200"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="eq">Equals</SelectItem>
                                                    <SelectItem value="neq">Not Equals</SelectItem>
                                                    <SelectItem value="contains">Contains</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            {(() => {
                                                const fieldDef = CONDITION_FIELDS[c.field];
                                                if (fieldDef?.type === 'select') {
                                                    let options = fieldDef.options || [];
                                                    if (c.field === 'service_category_id') options = categories.map(cat => ({ value: cat.id, label: cat.name }));
                                                    if (c.field === 'department_id') {
                                                        const depts = Array.from(new Set(categories.map(cat => cat.departmentId).filter(Boolean)));
                                                        // This assumes we don't have a direct department list, but usually we do in props. 
                                                        // I'll check admin-dashboard.tsx to see if departments are passed.
                                                        // For now, let's use what we have.
                                                        options = depts.map(id => ({ value: id!, label: `Dept: ${id}` }));
                                                    }

                                                    return (
                                                        <Select value={c.value} onValueChange={(v: string) => {
                                                            const newC = [...conditions];
                                                            newC[idx].value = v;
                                                            updateConditions(newC);
                                                        }}>
                                                            <SelectTrigger className="h-9 flex-1 text-xs bg-white border-gray-200"><SelectValue placeholder="Select Value" /></SelectTrigger>
                                                            <SelectContent>
                                                                {options.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    );
                                                }
                                                return (
                                                    <Input
                                                        value={c.value}
                                                        onChange={(e) => {
                                                            const newC = [...conditions];
                                                            newC[idx].value = e.target.value;
                                                            updateConditions(newC);
                                                        }}
                                                        placeholder="Enter criteria..."
                                                        className="h-9 flex-1 text-xs bg-white border-gray-200"
                                                    />
                                                );
                                            })()}

                                            <Button variant="ghost" size="icon" onClick={() => removeCondition(idx)} className="h-8 w-8 text-gray-400 hover:text-rose-600">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="col-span-2 space-y-4">
                                <div className="flex items-center justify-between mb-1 pl-1">
                                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Execution Pipeline (Actions)</Label>
                                    <Button variant="ghost" size="sm" onClick={addAction} className="h-7 text-[10px] font-bold text-emerald-600 hover:bg-emerald-50">
                                        <Plus className="h-3 w-3 mr-1" /> Add Action
                                    </Button>
                                </div>
                                <div className="space-y-3">
                                    {actions.length === 0 && (
                                        <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-[10px] text-gray-400">
                                            No actions defined.
                                        </div>
                                    )}
                                    {actions.map((a, idx) => (
                                        <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100 animate-in fade-in slide-in-from-top-1">
                                            <Select value={a.type} onValueChange={(v: string) => {
                                                const newA = [...actions];
                                                newA[idx].type = v;
                                                // Initialize params based on type
                                                if (v === "reassign_to_role") newA[idx].params = { roleId: "" };
                                                else if (v === "reassign_to_user") newA[idx].params = { userId: "" };
                                                else if (v === "reassign_department") newA[idx].params = { departmentId: "" };
                                                else if (v === "set_priority") newA[idx].params = { priority: "medium" };
                                                else if (v === "set_escalation_chain") newA[idx].params = { chainId: "" };
                                                else if (v === "apply_sla_rule") newA[idx].params = { slaId: "" };
                                                else newA[idx].params = { value: "" };
                                                updateActions(newA);
                                            }}>
                                                <SelectTrigger className="h-9 w-44 text-xs font-bold bg-white border-gray-200"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(ACTION_TYPES).map(([id, def]) => (
                                                        <SelectItem key={id} value={id}>{def.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            {a.type === "reassign_to_role" && (
                                                <Select value={a.params.roleId} onValueChange={(v: string) => {
                                                    const newA = [...actions];
                                                    newA[idx].params.roleId = v;
                                                    updateActions(newA);
                                                }}>
                                                    <SelectTrigger className="h-9 flex-1 text-xs bg-white border-gray-200"><SelectValue placeholder="Select Role" /></SelectTrigger>
                                                    <SelectContent>
                                                        {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            )}

                                            {a.type === "reassign_to_user" && (
                                                <Select value={a.params.userId} onValueChange={(v: string) => {
                                                    const newA = [...actions];
                                                    newA[idx].params.userId = v;
                                                    updateActions(newA);
                                                }}>
                                                    <SelectTrigger className="h-9 flex-1 text-xs bg-white border-gray-200"><SelectValue placeholder="Select User" /></SelectTrigger>
                                                    <SelectContent>
                                                        {users.map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            )}

                                            {a.type === "reassign_department" && (
                                                <Select value={a.params.departmentId} onValueChange={(v: string) => {
                                                    const newA = [...actions];
                                                    newA[idx].params.departmentId = v;
                                                    updateActions(newA);
                                                }}>
                                                    <SelectTrigger className="h-9 flex-1 text-xs bg-white border-gray-200"><SelectValue placeholder="Select Department" /></SelectTrigger>
                                                    <SelectContent>
                                                        {Array.from(new Set(categories.map(cat => cat.departmentId).filter(Boolean))).map(id => (
                                                            <SelectItem key={id} value={id!}>{`Dept: ${id}`}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}

                                            {a.type === "set_escalation_chain" && (
                                                <Select value={a.params.chainId} onValueChange={(v: string) => {
                                                    const newA = [...actions];
                                                    newA[idx].params.chainId = v;
                                                    updateActions(newA);
                                                }}>
                                                    <SelectTrigger className="h-9 flex-1 text-xs bg-white border-gray-200"><SelectValue placeholder="Select Chain" /></SelectTrigger>
                                                    <SelectContent>
                                                        {escalationChains.map(chain => <SelectItem key={chain.id} value={chain.id}>{chain.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            )}

                                            {a.type === "apply_sla_rule" && (
                                                <Select value={a.params.slaId} onValueChange={(v: string) => {
                                                    const newA = [...actions];
                                                    newA[idx].params.slaId = v;
                                                    updateActions(newA);
                                                }}>
                                                    <SelectTrigger className="h-9 flex-1 text-xs bg-white border-gray-200"><SelectValue placeholder="Select SLA" /></SelectTrigger>
                                                    <SelectContent>
                                                        {slaRules.map(sla => <SelectItem key={sla.id} value={sla.id}>{sla.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            )}

                                            {a.type === "set_priority" && (
                                                <Select value={a.params.priority} onValueChange={(v: string) => {
                                                    const newA = [...actions];
                                                    newA[idx].params.priority = v;
                                                    updateActions(newA);
                                                }}>
                                                    <SelectTrigger className="h-9 flex-1 text-xs bg-white border-gray-200"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="low">Low</SelectItem>
                                                        <SelectItem value="medium">Medium</SelectItem>
                                                        <SelectItem value="high">High</SelectItem>
                                                        <SelectItem value="critical">Critical</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}

                                            {["add_case_tag", "send_notification", "promote_escalation", "close_entity"].includes(a.type) && (
                                                <Input
                                                    value={a.params?.value || a.params?.message || ""}
                                                    onChange={(e) => {
                                                        const newA = [...actions];
                                                        newA[idx].params = { ...newA[idx].params, value: e.target.value };
                                                        updateActions(newA);
                                                    }}
                                                    placeholder={a.type === "add_case_tag" ? "Tag name..." : "Value/Message..."}
                                                    className="h-9 flex-1 text-xs bg-white border-gray-200"
                                                />
                                            )}

                                            <Button variant="ghost" size="icon" onClick={() => removeAction(idx)} className="h-8 w-8 text-gray-400 hover:text-rose-600">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex gap-3 items-start">
                            <ShieldCheck className="h-5 w-5 text-[#004E98] mt-0.5" />
                            <div>
                                <h5 className="text-[11px] font-bold text-gray-900 uppercase">Automation Guardrails</h5>
                                <p className="text-[10px] text-gray-500 font-medium leading-relaxed mt-1">
                                    Ensure JSON syntax integrity. Invalid logic will prevent the rule from initializing and may disrupt related service desk operations.
                                </p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 gap-3">
                        <Button variant="outline" onClick={onCloseWfModal} className="px-6 font-bold border-gray-200" disabled={isSaving}>Discard</Button>
                        <Button onClick={onSaveWf} disabled={isSaving} className="bg-[#004E98] hover:bg-[#003B73] text-white px-8 font-bold shadow-lg shadow-blue-500/10 transition-all active:scale-[0.98]">
                            {isSaving ? (
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Syncing...</span>
                                </div>
                            ) : (editingWf ? "Commit Logic" : "Deploy Protocol")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
