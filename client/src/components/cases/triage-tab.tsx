import { useState, useEffect, useMemo } from "react";
import { apiRequest } from "@/lib/api-client";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, XCircle, Search, AlertCircle, User, Tag, ChevronLeft, ChevronRight, Eye, RefreshCw, FolderOpen, Settings2, Clock, Info, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface IntakeSignal {
    id: string;
    source: string;
    rawText: string;
    suggestedCategoryId: string | null;
    confidenceScore: number;
    status: string;
    mappedCaseId: string | null;
    processedBy: string | null;
    processedAt: string | null;
    createdAt: string;
    departmentName?: string;
    assignedUserName?: string;
}

interface UserItem {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    departmentId: string | null;
    activeCaseCount?: number;
}

interface CategoryItem {
    id: string;
    name: string;
    departmentId: string | null;
}

interface TriageTabProps {
    onRefreshCases: () => void;
}

const PAGE_SIZE = 10;

export function TriageTab({ onRefreshCases }: TriageTabProps) {
    const { toast } = useToast();
    const [signals, setSignals] = useState<IntakeSignal[]>([]);
    const [users, setUsers] = useState<UserItem[]>([]);
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState("pending");
    const [filterSource, setFilterSource] = useState("");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);

    // Signal Detail Modal
    const [selectedSignal, setSelectedSignal] = useState<IntakeSignal | null>(null);
    const [modalCategoryId, setModalCategoryId] = useState("");
    const [modalAssignedTo, setModalAssignedTo] = useState("");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sigRes, userRes, catRes] = await Promise.all([
                apiRequest("/api/triage/signals"),
                apiRequest("/api/admin/users"),
                apiRequest("/api/admin/service-categories"),
            ]);

            if (sigRes.ok) {
                const sigData = await sigRes.json();
                setSignals(Array.isArray(sigData) ? sigData : []);
            }
            if (userRes.ok) {
                const userData = await userRes.json();
                setUsers(Array.isArray(userData) ? userData : (userData.users || []));
            }
            if (catRes.ok) {
                const catData = await catRes.json();
                setCategories(Array.isArray(catData) ? catData : (catData.serviceCategories || []));
            }
        } catch (error) {
            console.error("Failed to load triage data", error);
        } finally {
            setLoading(false);
        }
    };

    // Filtered and paginated signals
    const filteredSignals = useMemo(() => {
        let result = signals;
        if (filterStatus) {
            result = result.filter(s => s.status === filterStatus);
        }
        if (filterSource) {
            result = result.filter(s => s.source === filterSource);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(s =>
                s.rawText.toLowerCase().includes(q) || s.source.toLowerCase().includes(q)
            );
        }
        return result;
    }, [signals, filterStatus, filterSource, searchQuery]);

    const totalPages = Math.ceil(filteredSignals.length / PAGE_SIZE) || 1;
    const paginatedSignals = filteredSignals.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );

    // Unique sources for source filter
    const uniqueSources = useMemo(() => {
        const uniqueSources = Array.from(new Set(signals.map(s => s.source).filter(Boolean)));
        return uniqueSources.sort();
    }, [signals]);

    const openSignalModal = (signal: IntakeSignal) => {
        setSelectedSignal(signal);
        setModalCategoryId(signal.suggestedCategoryId || "");
        setModalAssignedTo("");
    };

    const closeSignalModal = () => {
        setSelectedSignal(null);
        setModalCategoryId("");
        setModalAssignedTo("");
    };

    const handleMap = async (id: string, categoryId: string, assignedTo: string) => {
        if (!categoryId) {
            toast({ title: "Error", description: "Please select a category first.", variant: "destructive" });
            return;
        }

        setActionLoading(id);
        try {
            const res = await apiRequest(`/api/triage/signals/${id}/map`, {
                method: "POST",
                body: JSON.stringify({ categoryId, assignedTo: assignedTo || undefined })
            });

            if (res.ok) {
                toast({ title: "Mapped Successfully", description: "Signal has been promoted to a Case." });
                closeSignalModal();
                loadData();
                onRefreshCases();
            } else {
                toast({ title: "Error", description: "Failed to map signal.", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "An error occurred.", variant: "destructive" });
        } finally {
            setActionLoading(null);
        }
    };

    const handleIgnore = async (id: string) => {
        setActionLoading(id);
        try {
            const res = await apiRequest(`/api/triage/signals/${id}/ignore`, { method: "POST" });
            if (res.ok) {
                toast({ title: "Signal Ignored", description: "Signal has been archived." });
                closeSignalModal();
                loadData();
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to ignore signal.", variant: "destructive" });
        } finally {
            setActionLoading(null);
        }
    };

    const getConfidenceColor = (score: number) => {
        if (score > 80) return "bg-green-100 text-green-700 border-green-200";
        if (score > 40) return "bg-amber-100 text-amber-700 border-amber-200";
        return "bg-red-100 text-red-700 border-red-200";
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[#004E98]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#004E98]/10 p-3 rounded-lg flex-shrink-0">
                            <FolderOpen className="h-6 w-6 text-[#004E98]" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 leading-none">Intake Triage</h3>
                            <p className="text-sm text-gray-500 mt-2 flex items-center gap-1.5 font-medium">
                                Review and map raw signals to service categories
                            </p>
                        </div>
                    </div>
                </div>

                <div className="px-5 pb-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        <Select value={filterStatus || "all"} onValueChange={(v) => { setFilterStatus(v === "all" ? "" : v); setCurrentPage(1); }}>
                            <SelectTrigger className="w-[140px] h-10 border-gray-200 bg-white">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="mapped">Mapped</SelectItem>
                                <SelectItem value="ignored">Ignored</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filterSource || "all"} onValueChange={(v) => { setFilterSource(v === "all" ? "" : v); setCurrentPage(1); }}>
                            <SelectTrigger className="w-[140px] h-10 border-gray-200 bg-white">
                                <SelectValue placeholder="Source" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sources</SelectItem>
                                {uniqueSources.map(s => (
                                    <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="relative flex-1 min-w-[200px] xl:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search signals..."
                                className="pl-10 h-10 border-gray-200 focus:border-[#004E98] focus:ring-[#004E98] bg-white transition-all text-sm"
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full xl:w-auto mt-4 xl:mt-0">
                        <Button variant="outline" onClick={loadData} className="h-10 px-4 border-gray-200 text-gray-700 hover:bg-gray-50 transition-all text-sm font-medium">
                            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                        </Button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <Card className="border-gray-100 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-hidden">
                        <Table>
                            <TableHeader className="bg-gray-50/50">
                                <TableRow>
                                    <TableHead className="w-[120px]">Source</TableHead>
                                    <TableHead>Signal / Raw Text</TableHead>
                                    <TableHead className="w-[140px] text-center">Department</TableHead>
                                    <TableHead className="w-[140px] text-center">Officer</TableHead>
                                    <TableHead className="w-[120px] text-center">Status</TableHead>
                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedSignals.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-gray-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <AlertCircle className="h-8 w-8 opacity-20" />
                                                <p>No signals match your filters.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedSignals.map((signal) => (
                                        <TableRow key={signal.id} className={`${signal.status === 'mapped' ? 'bg-green-50/30' : ''} cursor-pointer hover:bg-gray-50`} onClick={() => openSignalModal(signal)}>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize bg-gray-50 text-gray-600 border-gray-200">
                                                    {signal.source.replace(/_/g, ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2 max-w-md">
                                                    {signal.rawText}
                                                </p>
                                                <span className="text-[10px] text-gray-400 mt-1 block">
                                                    Received: {new Date(signal.createdAt).toLocaleString()}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                                                    {signal.departmentName || "—"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-bold text-[#004E98] whitespace-nowrap">
                                                        {signal.assignedUserName || "—"}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {signal.status === 'pending' ? (
                                                    <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 text-[10px] uppercase font-bold px-2 py-0">Pending</Badge>
                                                ) : signal.status === 'mapped' ? (
                                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none text-[10px] uppercase font-bold px-2 py-0">Mapped</Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-gray-100 text-gray-500 text-[10px] uppercase font-bold px-2 py-0">Ignored</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 text-[#004E98] hover:text-[#003d7a] text-xs gap-1.5"
                                                    onClick={(e) => { e.stopPropagation(); openSignalModal(signal); }}
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                    View
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                            <p className="text-sm text-muted-foreground">
                                Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredSignals.length)} of {filteredSignals.length} signals
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                                    <ChevronLeft className="h-4 w-4" /> Previous
                                </Button>
                                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                                    Next <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Signal Detail Modal */}
            <Dialog open={!!selectedSignal} onOpenChange={(open) => { if (!open) closeSignalModal(); }}>
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

                            {selectedSignal && (
                                <div className="mt-8 space-y-8 bg-white">
                                    {/* Signal Source & Metadata */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 shadow-sm">
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[2px] mb-1">Channel</p>
                                            <div className="flex items-center gap-3">
                                                <Badge className="bg-[#004E98] text-white border-0 capitalize px-3 py-1 text-xs">
                                                    {selectedSignal.source.replace(/_/g, ' ')}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-inner flex flex-col justify-center">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-1">Ingestion Insights</p>
                                            <div className="flex items-center gap-4 text-xs font-bold text-gray-700">
                                                <div className="flex items-center gap-1.5 border-r pr-4">
                                                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                                                    {new Date(selectedSignal.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <AlertCircle className="h-3.5 w-3.5 text-gray-400" />
                                                    {selectedSignal.confidenceScore}% Match
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Signal Content */}
                                    <div className="space-y-3">
                                        <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <Info className="h-4 w-4 text-[#004E98]" /> Signal Content
                                        </Label>
                                        <div className="p-5 bg-gray-50/80 rounded-xl border border-gray-100 relative group overflow-hidden">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#004E98]/20 group-hover:bg-[#004E98] transition-colors" />
                                            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed italic italic-font-medium">
                                                "{selectedSignal.rawText}"
                                            </p>
                                        </div>
                                    </div>

                                    {/* Triage Controls */}
                                    {selectedSignal.status === 'pending' && (
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
                            )}
                        </div>
                        <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 gap-3">
                            <Button variant="ghost" onClick={closeSignalModal} className="font-semibold text-gray-500 hover:text-gray-700">Close Window</Button>
                            {selectedSignal?.status === 'pending' && (
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="outline"
                                        className="text-gray-400 border-gray-200 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all"
                                        disabled={!!actionLoading}
                                        onClick={() => selectedSignal && handleIgnore(selectedSignal.id)}
                                    >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Ignore
                                    </Button>
                                    <Button
                                        className="bg-[#004E98] hover:bg-[#003B73] px-10 h-11 font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform gap-2"
                                        disabled={!!actionLoading || !modalCategoryId}
                                        onClick={() => selectedSignal && handleMap(selectedSignal.id, modalCategoryId, modalAssignedTo)}
                                    >
                                        {actionLoading === selectedSignal?.id ? (
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
        </div>
    );
}
