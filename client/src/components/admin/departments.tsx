import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Layers, ArrowLeft, Search, Building2, ChevronRight, Info, Settings2, ShieldCheck, Briefcase, Loader2 } from "lucide-react";
import { useState } from "react";
import { Department } from "@/types/admin";

interface DepartmentsProps {
    departments: Department[];
    getDeptName: (id: string | null) => string;
    // Navigation
    selectedParent: Department | null;
    onViewSubs: (dept: Department | null) => void;
    // Modal
    deptModalOpen: boolean;
    editingDept: Department | null;
    deptForm: { name: string; code: string; description: string; parentDepartmentId: string; isMarketingDepartment: boolean; handlesLeads: boolean; handlesB2c: boolean; handlesB2b: boolean; };
    onDeptFormChange: (form: { name: string; code: string; description: string; parentDepartmentId: string; isMarketingDepartment: boolean; handlesLeads: boolean; handlesB2c: boolean; handlesB2b: boolean; }) => void;
    onOpenDeptModal: (dept?: Department) => void;
    onSaveDept: () => void;
    onDeleteDept: (id: string) => void;
    onCloseDeptModal: () => void;
    isSaving?: boolean;
}

function renderEmptyState(selectedParent: Department | null, onOpenDeptModal: () => void) {
    return (
        <div className="text-center py-16 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200">
            <div className="bg-white p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Building2 className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-gray-600 font-medium text-lg">No {selectedParent ? "sub-" : ""}departments found</p>
            <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">
                {selectedParent
                    ? `Create sub-units within ${selectedParent.name} to refine your organizational structure.`
                    : "Establish your organizational departments to manage teams and service delivery."}
            </p>
            <Button variant="outline" onClick={onOpenDeptModal} className="mt-6">
                <Plus className="h-4 w-4 mr-2" /> Add Your First {selectedParent ? "Sub-dept" : "Department"}
            </Button>
        </div>
    );
}

export function Departments({
    departments,
    getDeptName,
    selectedParent,
    onViewSubs,
    deptModalOpen,
    editingDept,
    deptForm,
    onDeptFormChange,
    onOpenDeptModal,
    onSaveDept,
    onDeleteDept,
    onCloseDeptModal,
    isSaving = false,
}: DepartmentsProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const displayDepts = departments.filter(d => {
        const matchesParent = selectedParent ? d.parentDepartmentId === selectedParent.id : !d.parentDepartmentId || d.parentDepartmentId === "none";
        const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.code.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesParent && matchesSearch;
    });

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#004E98]/10 p-3 rounded-lg">
                            <Building2 className="h-6 w-6 text-[#004E98]" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 leading-none">
                                {selectedParent ? `Sub-departments of ${selectedParent.name}` : "Department Management"}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-1.5 font-medium">
                                <Settings2 className="h-3.5 w-3.5 text-gray-400" />
                                {selectedParent ? "Configure hierarchical business units" : "Structure your organizational service layers"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search departments..."
                                className="pl-10 h-10 border-gray-200 focus:ring-2 focus:ring-[#004E98]/10 transition-all bg-gray-50/50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        {selectedParent && (
                            <Button variant="ghost" size="sm" onClick={() => onViewSubs(null)} className="text-gray-500 hover:bg-gray-100">
                                <ArrowLeft className="h-4 w-4 mr-2" /> Back
                            </Button>
                        )}
                        <Button onClick={() => onOpenDeptModal()} className="bg-[#004E98] hover:bg-[#004E98]/90 shadow-md transition-all hover:scale-[1.02] active:scale-95 font-bold">
                            <Plus className="h-4 w-4 mr-2" /> Add {selectedParent ? "Sub-department" : "Department"}
                        </Button>
                    </div>
                </div>
            </div>

            {displayDepts.length === 0 && searchQuery === "" ? renderEmptyState(selectedParent, () => onOpenDeptModal()) : (
                <Card className="overflow-hidden border-gray-200 shadow-lg group">
                    <div className="overflow-x-auto">
                        <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80 border-b border-gray-100">
                                <TableHead className="font-bold text-gray-700 py-5 pl-6">Name</TableHead>
                                <TableHead className="font-bold text-gray-700">Code</TableHead>
                                <TableHead className="hidden md:table-cell font-bold text-gray-700">Description</TableHead>
                                {!selectedParent && <TableHead className="hidden lg:table-cell font-bold text-gray-700 text-center">Structure</TableHead>}
                                <TableHead className="text-right pr-6 font-bold text-gray-700">Management</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayDepts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center bg-white">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <Search className="h-10 w-10 mb-3 opacity-20" />
                                            <p className="text-lg font-medium text-gray-600">No matching departments found</p>
                                            <p className="text-sm italic">Adjust your search parameters and try again.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : displayDepts.map((dept) => {
                                const subCount = departments.filter(d => d.parentDepartmentId === dept.id).length;
                                return (
                                    <TableRow key={dept.id} className="hover:bg-gray-50/30 transition-colors border-b border-gray-50 last:border-0 group/row">
                                        <TableCell className="py-5 pl-6">
                                            <span className="font-bold text-gray-900">{dept.name}</span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono text-[11px] bg-white border-gray-200">
                                                {dept.code}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell max-w-[250px]">
                                            <p className="text-sm text-gray-500 line-clamp-1 italic" title={dept.description || ""}>
                                                {dept.description || "No description provided."}
                                            </p>
                                        </TableCell>
                                        {!selectedParent && (
                                            <TableCell className="hidden lg:table-cell text-center">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 gap-1.5 hover:bg-[#004E98]/10 hover:text-[#004E98] hover:border-[#004E98]/20 bg-white shadow-sm font-bold text-xs"
                                                    onClick={() => onViewSubs(dept)}
                                                >
                                                    <Layers className="h-3 w-3" />
                                                    {subCount} Sub-units
                                                </Button>
                                            </TableCell>
                                        )}
                                        <TableCell className="text-right pr-6">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-gray-400 hover:text-[#004E98] hover:bg-blue-50 transition-colors"
                                                    onClick={() => onOpenDeptModal(dept)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                    onClick={() => onDeleteDept(dept.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            {/* Department Modal */}
            <Dialog open={deptModalOpen} onOpenChange={onCloseDeptModal}>
                <DialogContent className="sm:max-w-[500px] p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden">
                    <div className="max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="p-6">
                            <DialogHeader>
                                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                    <Building2 className="h-5 w-5 text-[#004E98]" />
                                    <DialogTitle className="text-2xl font-bold text-gray-900">
                                        {editingDept ? "Modify Unit" : selectedParent ? "New Sub-department" : "New Department"}
                                    </DialogTitle>
                                </div>
                                <DialogDescription className="text-gray-500 text-sm mt-3">
                                    {editingDept ? "Update organizational unit parameters." : "Configure a new unit within your organizational hierarchy."}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mt-6 space-y-6 bg-white">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <Info className="h-4 w-4 text-[#004E98]" /> Name
                                        </Label>
                                        <Input
                                            value={deptForm.name}
                                            onChange={(e) => onDeptFormChange({ ...deptForm, name: e.target.value })}
                                            placeholder="e.g. Finance"
                                            className="border-gray-200 focus:ring-2 focus:ring-[#004E98]/20 transition-all h-11"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4 text-[#004E98]" /> Code
                                        </Label>
                                        <Input
                                            value={deptForm.code}
                                            onChange={(e) => onDeptFormChange({ ...deptForm, code: e.target.value })}
                                            placeholder="e.g. FIN"
                                            className="border-gray-200 focus:ring-2 focus:ring-[#004E98]/20 transition-all h-11 font-mono uppercase"
                                        />
                                    </div>
                                </div>

                                {selectedParent && (
                                    <div className="p-4 bg-gray-50 rounded-xl flex items-center gap-4 border border-gray-100 shadow-inner">
                                        <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center text-[#004E98] shadow-sm border border-gray-100">
                                            <Briefcase className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">Primary Parent Unit</p>
                                            <p className="text-base text-gray-900 font-bold">{selectedParent.name}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label className="text-sm font-bold text-gray-700">Mission & Responsibilities</Label>
                                    <Textarea
                                        value={deptForm.description}
                                        onChange={(e) => onDeptFormChange({ ...deptForm, description: e.target.value })}
                                        placeholder="Describe the unit's core function and objectives..."
                                        className="border-gray-200 focus:ring-2 focus:ring-[#004E98]/20 transition-all min-h-[120px] resize-none"
                                    />
                                </div>
                                
                                {/* Pipeline Roles Configuration */}
                                <div className="p-5 border rounded-xl bg-gray-50/50 space-y-4">
                                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4 pb-2 border-b">
                                        <Briefcase className="h-4 w-4 text-[#004E98]" /> Pipeline Roles
                                    </h4>
                                    
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="font-semibold text-gray-800">Marketing Department</Label>
                                            <p className="text-xs text-gray-500 mt-0.5 max-w-[280px]">
                                                Only one department can hold this role. Designates ownership of leads on the marketing dashboard.
                                            </p>
                                        </div>
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                id="isMarketing"
                                                checked={deptForm.isMarketingDepartment}
                                                onChange={(e) => {
                                                    // In a real implementation we'd warn about conflict, for now just toggle
                                                    onDeptFormChange({ ...deptForm, isMarketingDepartment: e.target.checked });
                                                }}
                                                className="h-5 w-5 rounded border-gray-300 text-[#004E98] focus:ring-[#004E98]"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="font-semibold text-gray-800">Handles Leads</Label>
                                        </div>
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={deptForm.handlesLeads}
                                                onChange={(e) => onDeptFormChange({ ...deptForm, handlesLeads: e.target.checked })}
                                                className="h-5 w-5 rounded border-gray-300 text-[#004E98] focus:ring-[#004E98]"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <label className="flex items-center gap-3 p-3 bg-white border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={deptForm.handlesB2c}
                                                onChange={(e) => onDeptFormChange({ ...deptForm, handlesB2c: e.target.checked })}
                                                className="h-4 w-4 rounded border-gray-300 text-[#004E98] focus:ring-[#004E98]"
                                            />
                                            <span className="text-sm font-medium text-gray-700">B2C Pipeline</span>
                                        </label>
                                        <label className="flex items-center gap-3 p-3 bg-white border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={deptForm.handlesB2b}
                                                onChange={(e) => onDeptFormChange({ ...deptForm, handlesB2b: e.target.checked })}
                                                className="h-4 w-4 rounded border-gray-300 text-[#004E98] focus:ring-[#004E98]"
                                            />
                                            <span className="text-sm font-medium text-gray-700">B2B Pipeline</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 gap-3">
                            <Button variant="ghost" onClick={onCloseDeptModal} className="font-semibold text-gray-500 hover:text-gray-700">Discard</Button>
                            <Button
                                onClick={onSaveDept}
                                disabled={isSaving}
                                className="bg-[#004E98] hover:bg-[#003B73] px-10 h-11 font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
                            >
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingDept ? "Save Changes" : "Confirm Creation"}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
