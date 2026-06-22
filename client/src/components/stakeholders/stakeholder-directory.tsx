import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Loader2, ChevronLeft, ChevronRight, HelpCircle, UserCircle, Download, Users, Settings2 } from "lucide-react";
import { STAKEHOLDER_TYPES, type Stakeholder } from "./stakeholder-types";
import { STAKEHOLDER_TYPE_COLORS, STAKEHOLDER_TYPE_ICONS } from "./stakeholder-type-colors";

const riskColors: Record<string, string> = { low: "bg-green-100 text-green-700", medium: "bg-amber-100 text-amber-700", high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700" };
const statusColors: Record<string, string> = { registered: "bg-green-100 text-green-700", dormant: "bg-gray-100 text-gray-700", suspended: "bg-red-100 text-red-700" };
const lifecycleColors: Record<string, string> = {
    // Shared / Default
    registered: "bg-emerald-100 text-emerald-700",
    suspended: "bg-orange-100 text-orange-700",
    dormant: "bg-slate-100 text-slate-700",
    
    // Students
    alumni: "bg-purple-100 text-purple-700",
    
    // Institutions
    inquiry: "bg-blue-100 text-blue-700",
    application_submitted: "bg-indigo-100 text-indigo-700",
    assessment_visit: "bg-amber-100 text-amber-700",
    under_review: "bg-orange-100 text-orange-700",
    accredited: "bg-emerald-100 text-emerald-700",
    renewal: "bg-teal-100 text-teal-700",
    lapsed: "bg-red-100 text-red-700"
};

interface StakeholderDirectoryProps {
    stakeholders: Stakeholder[]; loading: boolean;
    total: number; page: number; pageSize: number;
    searchQuery: string;
    filterType: string;
    filterLifecycle: string;
    onSearchChange: (query: string) => void;
    onTypeFilter: (type: string) => void;
    onLifecycleFilter: (lifecycle: string) => void;
    onPageChange: (page: number) => void;
    onViewProfile: (id: string) => void;
    onAddStakeholder: () => void;
}

function handleExportPDF() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const table = document.getElementById("stakeholder-directory-table");
    if (!table) return;
    printWindow.document.write(`
    <html>
      <head>
        <title>Stakeholders — CIC CRM</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          h1 { color: #004E98; font-size: 20px; margin-bottom: 4px; }
          p.sub { color: #666; font-size: 12px; margin-bottom: 16px; }
          table { border-collapse: collapse; width: 100%; font-size: 11px; }
          th { background: #004E98; color: white; padding: 8px 10px; text-align: left; }
          td { padding: 6px 10px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) td { background: #f7f9fc; }
        </style>
      </head>
      <body>
        <h1>Stakeholders</h1>
        <p class="sub">Exported on ${new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} — CIC CRM</p>
        ${table.outerHTML}
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
    </html>`);
    printWindow.document.close();
}

export function StakeholderDirectory({
    stakeholders,
    loading,
    total,
    page,
    pageSize,
    searchQuery,
    filterType,
    filterLifecycle,
    onSearchChange,
    onTypeFilter,
    onLifecycleFilter,
    onPageChange,
    onViewProfile,
    onAddStakeholder
}: StakeholderDirectoryProps) {
    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-4">
            {/* ── Header card — matches Case Management All Cases pattern ── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#004E98]/10 p-3 rounded-lg flex-shrink-0">
                            <Users className="h-6 w-6 text-[#004E98]" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 leading-none">Stakeholders</h3>
                            <p className="text-sm text-gray-500 mt-2 flex items-center gap-1.5 font-medium">
                                Browse and manage registered CIC CRM stakeholders
                            </p>
                        </div>
                    </div>
                </div>

                <div className="px-5 pb-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        <Select value={filterType} onValueChange={(v) => { onTypeFilter(v); onPageChange(1); }}>
                            <SelectTrigger className="w-[140px] h-10 border-gray-200 bg-white">
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {STAKEHOLDER_TYPES.map((t) => (
                                    <SelectItem key={t} value={t} className="capitalize">
                                        {t.split('_').join(' ')}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filterLifecycle} onValueChange={(v) => { onLifecycleFilter(v); onPageChange(1); }}>
                            <SelectTrigger className="w-[160px] h-10 border-gray-200 bg-white">
                                <SelectValue placeholder="Lifecycle" />
                            </SelectTrigger>
                            <SelectContent position="popper">
                                <SelectItem value="all">All Stages</SelectItem>
                                <SelectItem value="lead">Lead</SelectItem>
                                <SelectItem value="prospect">Prospect</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="renewal">In Renewal</SelectItem>
                                <SelectItem value="lapsed">Lapsed/Dormant</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                <SelectItem value="suspended">Suspended</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="relative flex-1 min-w-[200px] xl:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search by name, email, org..."
                                className="pl-10 h-10 border-gray-200 focus:border-[#004E98] focus:ring-[#004E98] bg-white transition-all"
                                value={searchQuery}
                                onChange={(e) => { onSearchChange(e.target.value); onPageChange(1); }}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full xl:w-auto mt-2 xl:mt-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportPDF}
                            className="h-10 border-gray-200 text-gray-600 hover:bg-gray-50 gap-2 font-semibold flex-1 xl:flex-none"
                        >
                            <Download className="h-4 w-4" />
                            Export PDF
                        </Button>
                        <Button
                            onClick={onAddStakeholder}
                            className="h-10 bg-[#004E98] hover:bg-[#004E98]/90 shadow-md transition-all hover:scale-[1.02] active:scale-95 font-bold flex-1 xl:flex-none"
                        >
                            <Plus className="h-4 w-4 mr-2" /> Add Stakeholder
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Table ── */}
            <Card>
                <CardContent className="p-0">
                    <Table id="stakeholder-directory-table">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="hidden md:table-cell">Organization</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="hidden md:table-cell">Email</TableHead>
                                <TableHead className="hidden lg:table-cell">Phone</TableHead>
                                <TableHead>Lifecycle</TableHead>
                                <TableHead>Engagement</TableHead>
                                <TableHead>Risk</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={9} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto" style={{ color: "#004E98" }} /></TableCell></TableRow>
                            ) : stakeholders.length === 0 ? (
                                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No stakeholders found</TableCell></TableRow>
                            ) : stakeholders.map((s) => {
                                const TypeIcon = STAKEHOLDER_TYPE_ICONS[s.type] || HelpCircle;
                                const fullName = `${s.firstName || ""} ${s.lastName || ""}`.trim() || s.name || "—";
                                const score = s.engagementScore || 0;
                                const barColor = score >= 70 ? "#01a64e" : score >= 40 ? "#D0AC01" : "#e55f00";
                                const isAggregated = (s as any).isAggregated;
                                
                                return (
                                    <TableRow 
                                        key={s.id}
                                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                                        onClick={() => onViewProfile(s.id)}
                                    >
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span>{fullName}</span>
                                                {isAggregated && <span className="text-[10px] text-gray-400 font-medium">Group Representative</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-sm text-gray-600 font-semibold">{s.organization || "—"}</TableCell>
                                        <TableCell>
                                            <Badge className={STAKEHOLDER_TYPE_COLORS[s.type] || "bg-gray-100 text-gray-700"}>
                                                <TypeIcon className="h-3 w-3 mr-1" />{s.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-sm text-gray-600">{s.email || "—"}</TableCell>
                                        <TableCell className="hidden lg:table-cell text-sm text-gray-600">{s.phone || "—"}</TableCell>
                                        <TableCell><Badge className={lifecycleColors[(s as any).aggregatedLifecycle || s.lifecycleStage] || "bg-gray-100 text-gray-700 capitalize"}>{(s as any).aggregatedLifecycle || s.lifecycleStage || "registered"}</Badge></TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-14 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(score, 100)}%`, backgroundColor: barColor }} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-semibold w-7 text-right tabular-nums">{score}</span>
                                                    {isAggregated && <span className="text-[8px] text-gray-400 font-bold uppercase leading-none">Agg</span>}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-0.5">
                                                <Badge className={`${riskColors[s.riskLevel] || "bg-gray-100 text-gray-700"} uppercase text-[9px] font-black`}>{s.riskLevel}</Badge>
                                                {isAggregated && <span className="text-[8px] text-gray-400 font-bold uppercase text-center leading-none">Aggregated</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onViewProfile(s.id);
                                                }}
                                                className="h-8 gap-1.5 text-xs font-semibold border-[#004E98]/20 text-[#004E98] hover:bg-[#004E98]/5 hover:border-[#004E98]/40"
                                            >
                                                <UserCircle className="h-3.5 w-3.5" />
                                                Profile
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 bg-white border border-gray-100 rounded-xl shadow-sm mt-4">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-500">
                            Showing <span className="text-gray-900 font-bold">{Math.min((page - 1) * pageSize + 1, total)}</span> to <span className="text-gray-900 font-bold">{Math.min(page * pageSize, total)}</span> of <span className="text-gray-900 font-bold">{total}</span> stakeholders
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => onPageChange(page - 1)}
                            className="h-9 px-3 border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all font-semibold"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                        </Button>
                        <div className="flex items-center gap-1 mx-2">
                            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                                const p = i + 1;
                                return (
                                    <Button
                                        key={p}
                                        variant={page === p ? "default" : "ghost"}
                                        size="sm"
                                        className={`h-9 w-9 p-0 font-bold transition-all ${page === p ? "bg-[#004E98] text-white shadow-md shadow-[#004E98]/20" : "text-gray-500 hover:bg-gray-100"}`}
                                        onClick={() => onPageChange(p)}
                                    >
                                        {p}
                                    </Button>
                                );
                            })}
                            {totalPages > 5 && <span className="text-gray-400 px-1 font-bold">...</span>}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => onPageChange(page + 1)}
                            className="h-9 px-3 border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all font-semibold"
                        >
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
