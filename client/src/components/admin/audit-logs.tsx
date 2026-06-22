import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { History, Shield, Filter, Search, User, Globe, Activity, Eye, FileText, X, Cpu, Monitor, Clock, Terminal } from "lucide-react";

import { AuditLog } from "@/types/admin";

interface AuditLogsProps {
    auditLogs: AuditLog[];
    auditPage: number;
    auditTotalPages: number;
    auditModule: string;
    auditAction: string;
    onModuleChange: (v: string) => void;
    onActionChange: (v: string) => void;
    onClearFilters: () => void;
    onPageChange: (delta: number) => void;
}

function ForensicModal({ log, isOpen, onClose }: { log: AuditLog | null, isOpen: boolean, onClose: () => void }) {
    if (!log) return null;
    const meta = log.rawMetadata || {};

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl bg-white border-0 shadow-2xl rounded-2xl p-0 overflow-hidden">
                <div className="bg-[#004E98] p-6 text-white relative">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <Terminal className="h-6 w-6 text-blue-200" />
                            <div>
                                <DialogTitle className="text-2xl font-black">Forensic Log Intelligence</DialogTitle>
                                <DialogDescription className="text-blue-100 font-medium opacity-80 mt-1">
                                    Detailed machine audit and connectivity fingerprinting for this event
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="max-h-[80vh] overflow-y-auto custom-scrollbar">
                    <div className="p-8 space-y-8">
                        {/* Core Audit Specs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 border-b border-gray-100 pb-8">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Clock className="h-3 w-3" /> Event Temporal Info
                                </h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500">Date & Time</span>
                                        <span className="font-black text-gray-900">{new Date(log.timestamp).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500">Action Context</span>
                                        <div className="flex gap-2">
                                            <Badge className="bg-[#004E98] text-white text-[9px] font-black uppercase px-2 py-0">{log.action}</Badge>
                                            <Badge variant="outline" className="text-[9px] font-bold text-gray-400 uppercase px-2 py-0">{log.module}</Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <User className="h-3 w-3" /> Committed By
                                </h4>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <p className="text-sm font-black text-gray-900 leading-none">{log.userName || "System"}</p>
                                    <p className="text-xs text-blue-500 font-bold mt-1.5 underline underline-offset-2 decoration-blue-200">{log.userEmail}</p>
                                </div>
                            </div>
                        </div>

                        {/* Activity Narrative */}
                        <div className="space-y-4 border-b border-gray-100 pb-8">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <FileText className="h-3 w-3" /> Activity Description
                            </h4>
                            <div className="bg-blue-50/30 p-5 rounded-2xl border border-blue-50 relative group">
                                <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#004E98] rounded-r shadow-[0_0_10px_rgba(0,78,152,0.3)]" />
                                <p className="text-sm text-gray-800 font-medium leading-relaxed pl-2 italic">
                                    {typeof log.details === 'string' ? (
                                        log.details.split("'").map((part, i) => (
                                            i % 2 === 1 ? <span key={i} className="font-black text-[#004E98] not-italic">'{part}'</span> : part
                                        ))
                                    ) : "No narrative recorded"}
                                </p>
                            </div>
                        </div>

                        {/* Technical Fingerprinting */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Globe className="h-3 w-3" /> Connectivity Details
                                </h4>
                                <div className="space-y-2.5">
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">IP Address</span>
                                        <span className="text-[11px] font-black text-[#004E98]">{log.ipAddress || "Internal"}</span>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Hostname / FQDN</span>
                                        <span className="text-[11px] font-black text-emerald-600 truncate max-w-[150px]">{meta.hostname || "Unresolved"}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Shield className="h-3 w-3" /> Device Intelligence
                                </h4>
                                <div className="space-y-2.5">
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Device / Machine ID</span>
                                        <span className="text-[10px] font-mono font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{meta.deviceId || "STABLE-SID-001"}</span>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Operating System</span>
                                        <span className="text-[11px] font-black text-gray-700">{log.machineInfo || "Detected Client"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Full User Agent */}
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Monitor className="h-3 w-3" /> User Agent
                            </h4>
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                <p className="text-[10px] font-mono text-slate-400 leading-relaxed break-all select-all">
                                    {log.rawMetadata?.userAgent || "No user-agent string captured"}
                                </p>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end pb-4">
                            <Button onClick={onClose} className="bg-[#004E98] hover:bg-[#003B73] text-white font-black rounded-xl px-10 h-11 shadow-lg shadow-blue-500/20">
                                Dismiss Analysis
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function renderEmptyState(entity: string) {
    return (
        <div className="text-center py-20 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200">
            <div className="bg-white p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <History className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-gray-600 font-medium text-lg">No {entity} recorded</p>
            <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">All administrative actions and system events will be captured here for compliance and forensic analysis.</p>
        </div>
    );
}

export function AuditLogs({
    auditLogs,
    auditPage,
    auditTotalPages,
    auditModule,
    auditAction,
    onModuleChange,
    onActionChange,
    onClearFilters,
    onPageChange,
}: AuditLogsProps) {
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    return (
        <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#004E98]/10 p-3 rounded-lg">
                            <History className="h-6 w-6 text-[#004E98]" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 leading-none">System Intelligence</h3>
                            <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-1.5 font-medium">
                                <Shield className="h-3.5 w-3.5 text-[#01a64e]" /> Forensic Audit Trail & Governance Log
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-gray-50">
                    <div className="flex items-center gap-2 bg-gray-100/50 p-1 rounded-lg border border-gray-100">
                        <Select value={auditModule || "all"} onValueChange={onModuleChange}>
                            <SelectTrigger className="w-[160px] h-9 border-0 bg-transparent focus:ring-0 shadow-none font-bold text-xs"><SelectValue placeholder="Module" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Every Module</SelectItem>
                                <SelectItem value="roles">Roles & Access</SelectItem>
                                <SelectItem value="departments">Org Structure</SelectItem>
                                <SelectItem value="categories">Service Meta</SelectItem>
                                <SelectItem value="sla">SLA Policies</SelectItem>
                                <SelectItem value="escalation">Escalation</SelectItem>
                                <SelectItem value="workflows">Workflows</SelectItem>
                                <SelectItem value="integrations">Integrations</SelectItem>
                                <SelectItem value="auth">Security/Auth</SelectItem>
                                <SelectItem value="marketing">Marketing Pipeline</SelectItem>
                                <SelectItem value="cases">Case Management</SelectItem>
                                <SelectItem value="admin">Administration</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="w-px h-4 bg-gray-200" />
                        <Select value={auditAction || "all"} onValueChange={onActionChange}>
                            <SelectTrigger className="w-[140px] h-9 border-0 bg-transparent focus:ring-0 shadow-none font-bold text-xs"><SelectValue placeholder="Action" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Any Action</SelectItem>
                                <SelectItem value="create">Internal Creation</SelectItem>
                                <SelectItem value="update">System Update</SelectItem>
                                <SelectItem value="delete">Record Removal</SelectItem>
                                <SelectItem value="login">User Authentication</SelectItem>
                                <SelectItem value="logout">User Termination</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {(auditModule || auditAction) && (auditModule !== "all" || auditAction !== "all") && (
                        <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-gray-400 hover:text-red-500 h-9 font-bold text-xs gap-2">
                            <X className="h-3.5 w-3.5" /> Reset Filters
                        </Button>
                    )}
                </div>
            </div>

            {auditLogs.length === 0 ? renderEmptyState("audit logs") : (
                <Card className="overflow-hidden border-gray-200 shadow-lg">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80 border-b border-gray-100">
                                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-[#004E98] py-5 pl-6">Date & time</TableHead>
                                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-[#004E98]">Committed By</TableHead>
                                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-[#004E98] hidden md:table-cell">Action Context</TableHead>
                                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-[#004E98]">Activity Description</TableHead>
                                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-[#004E98] text-right pr-6">Forensics</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {auditLogs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-blue-50/20 transition-colors border-b border-gray-50 last:border-0 group">
                                        <TableCell className="py-5 pl-6">
                                            <div className="space-y-0.5">
                                                <p className="font-black text-gray-900 text-xs">{new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                <p className="text-[10px] text-blue-500 font-bold tracking-tighter uppercase">
                                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-bold text-gray-800 text-xs leading-none">{log.userName || "System Service"}</p>
                                                {log.userEmail && <p className="text-[10px] text-gray-400 font-medium mt-1">{log.userEmail}</p>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            <div className="flex flex-col gap-1.5">
                                                <Badge className={`w-fit px-2 py-0.5 rounded text-[9px] font-black tracking-widest border-0 shadow-sm ${log.action === "create" ? "bg-emerald-500 text-white" :
                                                        log.action === "update" ? "bg-[#004E98] text-white" :
                                                            log.action === "delete" ? "bg-rose-500 text-white" :
                                                                log.action === "login" || log.action === "logout" ? "bg-amber-400 text-white" :
                                                                    "bg-slate-400 text-white"
                                                    }`}>
                                                    {log.action.toUpperCase()}
                                                </Badge>
                                                <Badge variant="outline" className="w-fit text-[9px] font-bold text-slate-400 border-slate-100 bg-slate-50/50 uppercase tracking-tighter">
                                                    {log.module}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-[450px]">
                                                <p className="text-xs font-medium text-gray-700 leading-relaxed whitespace-pre-wrap">
                                                    {typeof log.details === 'string' ? (
                                                        // Highlight bold parts (entity names usually in quotes)
                                                        log.details.split("'").map((part, i) => (
                                                            i % 2 === 1 ? <span key={i} className="font-black text-gray-900 bg-yellow-50 px-1 rounded">'{part}'</span> : part
                                                        ))
                                                    ) : "No narrative available"}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => setSelectedLog(log)}
                                                className="h-9 w-9 bg-gray-50 hover:bg-white hover:shadow-md border border-gray-100 text-gray-400 hover:text-[#004E98] rounded-xl transition-all"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            {auditTotalPages > 1 && (
                <div className="flex items-center justify-between px-2 pt-4 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Page <span className="text-[#004E98] font-black underline underline-offset-4">{auditPage}</span> of {auditTotalPages}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={auditPage <= 1}
                            onClick={() => onPageChange(-1)}
                            className="h-9 px-6 font-black text-xs uppercase tracking-widest border-gray-200 hover:bg-[#004E98] hover:text-white transition-all rounded-xl"
                        >
                            Back
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={auditPage >= auditTotalPages}
                            onClick={() => onPageChange(1)}
                            className="h-9 px-6 font-black text-xs uppercase tracking-widest border-gray-200 hover:bg-[#004E98] hover:text-white transition-all rounded-xl"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}

            <ForensicModal 
                log={selectedLog} 
                isOpen={!!selectedLog} 
                onClose={() => setSelectedLog(null)} 
            />
        </div>
    );
}
