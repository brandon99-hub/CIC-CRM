import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatLabel, statusColors, priorityColors, getDeadlineStatus } from "./case-utils";
import { Clock, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, XCircle, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";

interface SlaCase {
    id: string;
    caseNumber: string;
    title: string;
    status: string;
    priority: string;
    slaDeadline: string | null;
    slaResponseDeadline: string | null;
    slaBreached?: boolean;
    assignedTo?: string | null;
    assignedToName?: string;
    firstResponseAt?: string | null;
    resolvedAt?: string | null;
    createdAt: string;
    slaResponseMinutes?: number;
    slaResolutionMinutes?: number;
    tags?: any[];
}

interface SlaMonitorProps {
    onCaseClick: (id: string) => void;
    currentUserId?: string;
}

function DeadlineBadge({ deadline, completedAt, fallbackMinutes, createdAt }: {
    deadline: string | null; completedAt?: string | null; fallbackMinutes?: number; createdAt?: string
}) {
    const ds = getDeadlineStatus(deadline, completedAt, fallbackMinutes, createdAt);
    const color = ds.status === "breached" ? "text-red-600 bg-red-50 border-red-200"
        : ds.status === "approaching" ? "text-orange-600 bg-orange-50 border-orange-200"
            : ds.status === "completed" ? "text-green-600 bg-green-50 border-green-200"
                : ds.status === "none" ? "text-gray-400 bg-gray-50 border-gray-200"
                    : "text-[#004E98] bg-blue-50 border-blue-200";
    const Icon = ds.status === "breached" ? XCircle
        : ds.status === "completed" ? CheckCircle2
            : ds.status === "approaching" ? AlertTriangle : Clock;
    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-bold ${color} ${ds.status === "breached" ? "animate-pulse" : ""}`}>
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{ds.text}</span>
        </div>
    );
}

export function SlaMonitor({ onCaseClick, currentUserId }: SlaMonitorProps) {
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const { data: cases = [], isLoading: loading } = useQuery<SlaCase[]>({
        queryKey: ["cases", "sla-breached"],
        queryFn: async () => {
            const res = await apiRequest("/api/cases/analytics/sla-breached");
            const data = await res.json();
            return data.breachedCases || [];
        },
        staleTime: 1000 * 60, // 1 minute
    });

    // Classify each case by SLA status
    const classified = useMemo(() => {
        return cases.map(c => {
            const responseDs = getDeadlineStatus(c.slaResponseDeadline, c.firstResponseAt, c.slaResponseMinutes, c.createdAt);
            const resolutionDs = getDeadlineStatus(c.slaDeadline, c.resolvedAt, c.slaResolutionMinutes, c.createdAt);

            // A case is breached if either timer is breached
            const isBreached = responseDs.status === "breached" || resolutionDs.status === "breached";
            // A case is approaching if either timer is approaching (but none are breached)
            const isApproaching = !isBreached && (responseDs.status === "approaching" || resolutionDs.status === "approaching");

            let sortPriority = 2; // within
            if (isBreached) sortPriority = 0;
            else if (isApproaching) sortPriority = 1;

            return { ...c, responseDs, resolutionDs, isBreached, isApproaching, sortPriority };
        }).sort((a, b) => {
            // Primary sort: breached first, approaching second, within third
            if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
            // Secondary: by deadline (soonest first)
            const aDeadline = a.slaDeadline ? new Date(a.slaDeadline).getTime() : Infinity;
            const bDeadline = b.slaDeadline ? new Date(b.slaDeadline).getTime() : Infinity;
            return aDeadline - bDeadline;
        });
    }, [cases]);

    // Stats
    const breachedCount = classified.filter(c => c.isBreached).length;
    const approachingCount = classified.filter(c => c.isApproaching).length;
    const withinCount = classified.length - breachedCount - approachingCount;

    // Pagination
    const totalPages = Math.ceil(classified.length / pageSize);
    const paged = classified.slice((page - 1) * pageSize, page * pageSize);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Clock className="h-8 w-8 animate-spin text-[#004E98]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-red-500 bg-white shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Breached</CardTitle>
                        <XCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent><div className="text-3xl font-bold text-red-600">{breachedCount}</div></CardContent>
                </Card>
                <Card className="border-l-4 border-l-orange-500 bg-white shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Approaching SLA</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent><div className="text-3xl font-bold text-orange-600">{approachingCount}</div></CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500 bg-white shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Within SLA</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent><div className="text-3xl font-bold text-green-600">{withinCount}</div></CardContent>
                </Card>
            </div>

            {/* SLA Monitor Table */}
            <Card className="bg-white shadow-sm border-none ring-1 ring-gray-100">
                <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-3">
                    <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-[#004E98]" />
                        <CardTitle className="text-sm font-bold">SLA Compliance Monitor</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider bg-[#004E98]/5 border-[#004E98]/10 text-[#004E98] px-2 py-0.5">
                        {classified.length} Active Cases
                    </Badge>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/50">
                                <TableHead className="text-xs font-bold pl-6">Case</TableHead>
                                <TableHead className="text-xs font-bold">Priority</TableHead>
                                <TableHead className="text-xs font-bold">Status</TableHead>
                                <TableHead className="text-xs font-bold">Response</TableHead>
                                <TableHead className="text-xs font-bold">Resolution</TableHead>
                                <TableHead className="text-xs font-bold">Assigned To</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paged.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <CheckCircle2 className="h-8 w-8 text-green-300" />
                                            <span className="text-sm font-bold text-green-600">No active cases to monitor</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                            {paged.map(c => {
                                const rowBg = c.isBreached ? "bg-red-50/40 hover:bg-red-50/70"
                                    : c.isApproaching ? "bg-orange-50/30 hover:bg-orange-50/50"
                                        : "hover:bg-gray-50/50";
                                return (
                                    <TableRow key={c.id} className={`cursor-pointer ${rowBg}`} onClick={() => onCaseClick(c.id)}>
                                        <TableCell className="pl-6">
                                            <div className="space-y-0.5">
                                                <span className="text-[10px] font-black text-gray-400 tracking-tight">{c.caseNumber}</span>
                                                {currentUserId && c.assignedTo !== currentUserId && Array.isArray(c.tags) && c.tags.some((t: any) => t.id === currentUserId) && (
                                                    <div className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0 rounded-sm border border-emerald-100 uppercase tracking-tighter w-fit">
                                                        Collaborator
                                                    </div>
                                                )}
                                                <p className="text-xs font-semibold text-gray-800 line-clamp-1 max-w-[250px]">{c.title}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={`text-[10px] font-bold ${priorityColors[c.priority] || "bg-gray-100 text-gray-600"}`}>
                                                {formatLabel(c.priority)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={`text-[10px] font-bold ${statusColors[c.status] || "bg-gray-100 text-gray-600"}`}>
                                                {formatLabel(c.status)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <DeadlineBadge
                                                deadline={c.slaResponseDeadline}
                                                completedAt={c.firstResponseAt}
                                                fallbackMinutes={c.slaResponseMinutes}
                                                createdAt={c.createdAt}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <DeadlineBadge
                                                deadline={c.slaDeadline}
                                                completedAt={c.resolvedAt}
                                                fallbackMinutes={c.slaResolutionMinutes}
                                                createdAt={c.createdAt}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs font-semibold text-gray-700">{c.assignedToName || "Unassigned"}</span>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50/30">
                            <span className="text-xs text-muted-foreground">
                                Page {page} of {totalPages} — {classified.length} cases
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="h-8 px-3"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="h-8 px-3"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
