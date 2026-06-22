import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, FolderTree, Info, Settings2, ShieldCheck, Briefcase, Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { Department, ServiceCategory } from "@/types/admin";

interface ServiceCategoriesProps {
    categories: ServiceCategory[];
    departments: Department[];
    getDeptName: (id: string | null) => string;
    priorityColors: Record<string, string>;
    // Modal
    catModalOpen: boolean;
    editingCat: ServiceCategory | null;
    catForm: { name: string; code: string; description: string; departmentId: string; defaultPriority: string };
    onCatFormChange: (form: { name: string; code: string; description: string; departmentId: string; defaultPriority: string }) => void;
    onOpenCatModal: (cat?: ServiceCategory) => void;
    onSaveCat: () => void;
    onDeleteCat: (id: string) => void;
    onCloseCatModal: () => void;
    isSaving?: boolean;
}

function renderEmptyState(entity: string) {
    return (
        <div className="text-center py-16 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200">
            <div className="bg-white p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <FolderTree className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-gray-600 font-medium text-lg">No {entity} found</p>
            <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">Create specialized categories to organize your service delivery and SLA rules effectively.</p>
            <Button variant="outline" onClick={() => (window as any).onOpenCatModal?.()} className="mt-6">
                <Plus className="h-4 w-4 mr-2" /> Add Your First Category
            </Button>
        </div>
    );
}

export function ServiceCategories({
    categories,
    departments,
    getDeptName,
    priorityColors,
    catModalOpen,
    editingCat,
    catForm,
    onCatFormChange,
    onOpenCatModal,
    onSaveCat,
    onDeleteCat,
    onCloseCatModal,
    isSaving,
}: ServiceCategoriesProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const filteredCategories = categories.filter(cat =>
        cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cat.description || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredCategories.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedCategories = filteredCategories.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // Reset to page 1 when searching
    const handleSearchChange = (val: string) => {
        setSearchTerm(val);
        setCurrentPage(1);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-[#004E98]/10 p-3 rounded-lg">
                        <FolderTree className="h-6 w-6 text-[#004E98]" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 leading-none">Service Categories</h3>
                        <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-1.5">
                            <Settings2 className="h-3.5 w-3.5" /> Define and manage internal service classifications
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Filter by issue or code..."
                            value={searchTerm}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pl-9 h-10 bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                        />
                    </div>
                    <Button onClick={() => onOpenCatModal()} className="bg-[#004E98] hover:bg-[#004E98]/90 shadow-md transition-all hover:scale-[1.02]">
                        <Plus className="h-4 w-4 mr-2" />Add Category
                    </Button>
                </div>
            </div>

            {filteredCategories.length === 0 ? renderEmptyState(searchTerm ? "matching categories" : "service categories") : (
                <Card className="overflow-hidden border-gray-200 shadow-lg group">
                    <div className="overflow-x-auto">
                        <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                                <TableHead className="font-bold text-gray-700 py-4 pl-6">Issue category</TableHead>
                                <TableHead className="font-bold text-gray-700">Code</TableHead>
                                <TableHead className="hidden md:table-cell font-bold text-gray-700">Department</TableHead>
                                <TableHead className="font-bold text-gray-700">Description</TableHead>
                                <TableHead className="font-bold text-gray-700">Priority</TableHead>
                                <TableHead className="text-right pr-6 font-bold text-gray-700">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedCategories.map((cat) => (
                                <TableRow key={cat.id} className="hover:bg-gray-50/50 transition-colors group/row">
                                    <TableCell className="py-4 pl-6">
                                        <span className="font-semibold text-gray-900">{cat.name}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-mono text-[10px] letter-spacing-tight bg-white">
                                            {cat.code}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <div className="text-sm text-gray-600">
                                            {getDeptName(cat.departmentId)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-[200px]">
                                        <p className="text-sm text-gray-500 line-clamp-1 italic" title={cat.description || ""}>
                                            {cat.description || "No description provided."}
                                        </p>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={`${priorityColors[cat.defaultPriority] || "bg-gray-100 text-gray-700"} capitalize px-2.5 py-0.5 shadow-sm border-0`}>
                                            {cat.defaultPriority}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-4">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-[#004E98] hover:bg-blue-50" onClick={() => onOpenCatModal(cat)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50" onClick={() => onDeleteCat(cat.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </div>

                    {filteredCategories.length > ITEMS_PER_PAGE && (
                        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                            <p className="text-sm text-gray-500 font-medium">
                                Showing <span className="text-gray-900">{startIndex + 1}</span> to <span className="text-gray-900">{Math.min(startIndex + ITEMS_PER_PAGE, filteredCategories.length)}</span> of <span className="text-gray-900">{filteredCategories.length}</span> results
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="h-8 px-3 text-xs font-semibold"
                                >
                                    Previous
                                </Button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                        <Button
                                            key={page}
                                            variant={currentPage === page ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setCurrentPage(page)}
                                            className={`h-8 w-8 p-0 text-xs font-bold transition-all ${currentPage === page ? "bg-[#004E98] hover:bg-[#004E98]/90" : "hover:text-[#004E98] hover:bg-blue-50"}`}
                                        >
                                            {page}
                                        </Button>
                                    ))}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="h-8 px-3 text-xs font-semibold"
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* Category Modal */}
            <Dialog open={catModalOpen} onOpenChange={onCloseCatModal}>
                <DialogContent className="sm:max-w-[600px] p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden">
                    <div className="max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="p-6">
                            <DialogHeader>
                                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                    <FolderTree className="h-5 w-5 text-[#004E98]" />
                                    <DialogTitle className="text-2xl font-bold text-gray-900">
                                        {editingCat ? "Modify Category" : "New Service Category"}
                                    </DialogTitle>
                                </div>
                                <DialogDescription className="text-gray-500 text-sm mt-3">
                                    {editingCat ? "Update the core parameters for this service classification." : "Define a new category to streamline workflow routing and SLA management."}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mt-6 space-y-6 bg-white">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <Info className="h-4 w-4 text-[#004E98]" /> Category Name
                                        </Label>
                                        <Input
                                            value={catForm.name}
                                            onChange={(e) => onCatFormChange({ ...catForm, name: e.target.value })}
                                            placeholder="e.g. Exam Registration"
                                            className="border-gray-200 focus:ring-2 focus:ring-[#004E98]/20 transition-all h-11"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4 text-[#004E98]" /> Identification Code
                                        </Label>
                                        <Input
                                            value={catForm.code}
                                            onChange={(e) => onCatFormChange({ ...catForm, code: e.target.value })}
                                            placeholder="e.g. EXAM-REG"
                                            className="border-gray-200 focus:ring-2 focus:ring-[#004E98]/20 transition-all h-11 font-mono uppercase"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <Briefcase className="h-4 w-4 text-[#004E98]" /> Department
                                        </Label>
                                        <Select value={catForm.departmentId} onValueChange={(v: string) => onCatFormChange({ ...catForm, departmentId: v })}>
                                            <SelectTrigger className="h-11 border-gray-200"><SelectValue placeholder="Assign to department" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Independent (No Unit)</SelectItem>
                                                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <Settings2 className="h-4 w-4 text-[#004E98]" /> Default Service Priority
                                        </Label>
                                        <Select value={catForm.defaultPriority} onValueChange={(v: string) => onCatFormChange({ ...catForm, defaultPriority: v })}>
                                            <SelectTrigger className="h-11 border-gray-200"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="low">Low</SelectItem>
                                                <SelectItem value="medium">Medium</SelectItem>
                                                <SelectItem value="high">High</SelectItem>
                                                <SelectItem value="critical">Critical</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm font-bold text-gray-700">Detailed Description</Label>
                                    <Textarea
                                        value={catForm.description}
                                        onChange={(e) => onCatFormChange({ ...catForm, description: e.target.value })}
                                        placeholder="Provide context about what types of cases belong in this category..."
                                        className="border-gray-200 focus:ring-2 focus:ring-[#004E98]/20 transition-all min-h-[100px] resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 gap-3">
                            <Button variant="ghost" onClick={onCloseCatModal} disabled={isSaving} className="font-semibold text-gray-500 hover:text-gray-700">Discard Changes</Button>
                            <Button onClick={onSaveCat} disabled={isSaving} className="bg-[#004E98] hover:bg-[#003B73] px-10 h-11 font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform">
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {editingCat ? "Saving..." : "Creating..."}
                                    </>
                                ) : (
                                    editingCat ? "Save Updates" : "Create Category"
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
