import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
    ArrowLeft, Lock, Send, Loader2, Timer, Eye, Users, ArrowUpCircle, Briefcase,
} from "lucide-react";
import {
    STATUSES, priorityColors, statusColors, formatLabel, formatDateTime, getTimeRemaining,
} from "./case-utils";

/** Returns the valid next statuses based on the current status */
function getNextStatuses(currentStatus: string): string[] {
    const transitions: Record<string, string[]> = {
        open: ["in_progress", "escalated"],
        pending: ["in_progress", "escalated"],
        in_progress: ["resolved", "escalated"],
        escalated: ["in_progress", "resolved"],
        resolved: ["closed", "in_progress"],
        closed: [],
    };
    return transitions[currentStatus] || STATUSES.filter(s => s !== currentStatus);
}

interface CaseComment {
    id: string; caseId: string; userId: string; userName?: string;
    content: string; isInternal: boolean; createdAt: string;
}
interface CaseHistory {
    id: string; caseId: string; action: string; details: string;
    userId: string; userName?: string; createdAt: string;
}
interface CaseDetail {
    id: string; caseNumber: string; title: string; description: string;
    status: string; priority: string; channel: string;
    assignedTo: string | null; assignedToName?: string;
    serviceCategoryId: string | null; slaStatus: string;
    slaDeadline: string | null; responseDeadline: string | null;
    createdAt: string; updatedAt: string; createdBy: string | null; createdByName?: string;
    contactName?: string; contactEmail?: string; contactPhone?: string;
    comments: CaseComment[]; history: CaseHistory[];
    attachments: Array<{ id: string; fileName: string; fileUrl: string; createdAt: string }>;
}

interface CaseDetailProps {
    selectedCase: CaseDetail;
    commentText: string;
    commentIsInternal: boolean;
    commentLoading: boolean;
    statusChangeOpen: boolean;
    newStatus: string;
    assignOpen: boolean;
    assignTo: string;
    onBack: () => void;
    onCommentTextChange: (v: string) => void;
    onCommentInternalChange: (v: boolean) => void;
    onAddComment: () => void;
    onEscalate: () => void;
    onStatusChangeOpen: (v: boolean) => void;
    onNewStatusChange: (v: string) => void;
    onUpdateStatus: () => void;
    onAssignOpen: (v: boolean) => void;
    onAssignToChange: (v: string) => void;
    onAssignCase: () => void;
    // New Props for Escalation & Referral
    escalationReason: string;
    onEscalationReasonChange: (v: string) => void;
    escalateToDeptOpen: boolean;
    onEscalateToDeptOpen: (v: boolean) => void;
    onPerformEscalation: (reason: string, toDept: boolean) => void;
    departments: Array<{ id: string; name: string }>;
}

export function CaseDetailView({
    selectedCase, commentText, commentIsInternal, commentLoading,
    statusChangeOpen, newStatus, assignOpen, assignTo,
    onBack, onCommentTextChange, onCommentInternalChange, onAddComment,
    onEscalate, onStatusChangeOpen, onNewStatusChange, onUpdateStatus,
    onAssignOpen, onAssignToChange, onAssignCase,
    // New Props
    escalationReason, onEscalationReasonChange, escalateToDeptOpen,
    onEscalateToDeptOpen, onPerformEscalation, departments,
}: CaseDetailProps) {
    const sla = getTimeRemaining(selectedCase.slaDeadline);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back to Cases</Button>
                <span className="text-lg font-semibold">{selectedCase.caseNumber}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main column */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="text-lg">{selectedCase.title}</CardTitle>
                                    <p className="text-sm text-muted-foreground mt-1">Created {formatDateTime(selectedCase.createdAt)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Badge className={priorityColors[selectedCase.priority]}>{formatLabel(selectedCase.priority)}</Badge>
                                    <Badge className={statusColors[selectedCase.status]}>{formatLabel(selectedCase.status)}</Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm whitespace-pre-wrap">{selectedCase.description || "No description provided."}</p>
                            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                                <div><span className="text-muted-foreground">Channel:</span><span className="ml-2 font-medium">{formatLabel(selectedCase.channel)}</span></div>
                                <div><span className="text-muted-foreground">Assigned To:</span><span className="ml-2 font-medium">{selectedCase.assignedToName || selectedCase.assignedTo || "Unassigned"}</span></div>
                                {selectedCase.contactName && <div><span className="text-muted-foreground">Contact:</span><span className="ml-2 font-medium">{selectedCase.contactName}</span></div>}
                                {selectedCase.contactEmail && <div><span className="text-muted-foreground">Email:</span><span className="ml-2 font-medium">{selectedCase.contactEmail}</span></div>}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Comments */}
                    <Card>
                        <CardHeader><CardTitle className="text-base">Comments</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {(selectedCase.comments || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>}
                            {(selectedCase.comments || []).map((comment) => (
                                <div key={comment.id} className={`p-3 rounded-lg border ${comment.isInternal ? "bg-yellow-50 border-yellow-200" : "bg-white"}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{comment.userName || "User"}</span>
                                            {comment.isInternal && <Badge variant="outline" className="text-xs flex items-center gap-1"><Lock className="h-3 w-3" /> Internal</Badge>}
                                        </div>
                                        <span className="text-xs text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                                </div>
                            ))}
                            <div className="border-t pt-4 space-y-3">
                                <Textarea placeholder="Add a comment..." value={commentText} onChange={(e) => onCommentTextChange(e.target.value)} rows={3} />
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={commentIsInternal} onChange={(e) => onCommentInternalChange(e.target.checked)} className="rounded" />
                                        <Lock className="h-3 w-3" /> Internal note
                                    </label>
                                    <Button size="sm" onClick={onAddComment} disabled={!commentText.trim() || commentLoading} style={{ backgroundColor: "#004E98" }}>
                                        {commentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        <span className="ml-1">Send</span>
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Timeline */}
                    <Card>
                        <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
                        <CardContent>
                            {(selectedCase.history || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No history available</p>}
                            <div className="space-y-4">
                                {(selectedCase.history || []).map((entry) => (
                                    <div key={entry.id} className="flex gap-3">
                                        <div className="flex flex-col items-center"><div className="w-2 h-2 rounded-full bg-[#004E98] mt-2" /><div className="w-px flex-1 bg-gray-200" /></div>
                                        <div className="pb-4">
                                            <p className="text-sm font-medium">{entry.action}</p>
                                            <p className="text-xs text-muted-foreground">{entry.details}</p>
                                            <p className="text-xs text-muted-foreground mt-1">{entry.userName || "System"} · {formatDateTime(entry.createdAt)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar column */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="text-base">SLA Status</CardTitle></CardHeader>
                        <CardContent>
                            <div className={`p-3 rounded-lg text-center ${sla.status === "breached" ? "bg-red-50 border border-red-200" : sla.status === "approaching" ? "bg-yellow-50 border border-yellow-200" : "bg-green-50 border border-green-200"}`}>
                                <Timer className={`h-8 w-8 mx-auto mb-2 ${sla.status === "breached" ? "text-red-600" : sla.status === "approaching" ? "text-yellow-600" : "text-green-600"}`} />
                                <p className={`text-lg font-bold ${sla.status === "breached" ? "text-red-600" : sla.status === "approaching" ? "text-yellow-600" : "text-green-600"}`}>{sla.text}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {sla.status === "breached" ? "SLA has been breached" : sla.status === "approaching" ? "SLA deadline approaching" : "Within SLA target"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            <Button className="w-full" variant="outline" size="sm" onClick={() => { onNewStatusChange(selectedCase.status); onStatusChangeOpen(true); }}>
                                <Eye className="h-4 w-4 mr-1" /> Change Status
                            </Button>
                            <Button className="w-full" variant="outline" size="sm" onClick={() => onAssignOpen(true)}>
                                <Users className="h-4 w-4 mr-1" /> Assign
                            </Button>
                            <Button className="w-full text-white" size="sm" style={{ backgroundColor: "#e55f00" }} onClick={() => onEscalateToDeptOpen(true)}>
                                <ArrowUpCircle className="h-4 w-4 mr-1" /> Escalate/Refer
                            </Button>
                        </CardContent>
                    </Card>

                    {selectedCase.slaStatus === "breached" && (
                        <Card className="border-red-200 bg-red-50">
                            <CardContent className="pt-6">
                                <p className="text-sm font-semibold text-red-600 mb-2">SLA Breach Detected</p>
                                <p className="text-xs text-red-500 mb-4">This case has exceeded its SLA. Please resolve immediately or escalate to the relevant department.</p>
                                <Button className="w-full bg-red-600 hover:bg-red-700 text-white" size="sm" onClick={() => onEscalateToDeptOpen(true)}>
                                    Process Escalation
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {selectedCase.attachments?.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle className="text-base">Attachments</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {selectedCase.attachments.map((att) => (
                                        <a key={att.id} href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#004E98] hover:underline">
                                            <Briefcase className="h-4 w-4" />{att.fileName}
                                        </a>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Status change dialog */}
            <Dialog open={statusChangeOpen} onOpenChange={onStatusChangeOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Change Case Status</DialogTitle><DialogDescription>Update the status for {selectedCase.caseNumber}</DialogDescription></DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Current Status</Label>
                            <Badge className={`${statusColors[selectedCase.status]} ml-2`}>{formatLabel(selectedCase.status)}</Badge>
                        </div>
                        <div>
                            <Label>New Status</Label>
                            <Select value={newStatus} onValueChange={onNewStatusChange}>
                                <SelectTrigger><SelectValue placeholder="Select new status" /></SelectTrigger>
                                <SelectContent>
                                    {getNextStatuses(selectedCase.status).map((s) => <SelectItem key={s} value={s}>{formatLabel(s)}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onStatusChangeOpen(false)}>Cancel</Button>
                        <Button onClick={onUpdateStatus} disabled={!newStatus || newStatus === selectedCase.status} style={{ backgroundColor: "#004E98" }}>Update</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assign dialog */}
            <Dialog open={assignOpen} onOpenChange={onAssignOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Assign Case</DialogTitle><DialogDescription>Assign {selectedCase.caseNumber} to a user</DialogDescription></DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Assign To (User ID or Name)</Label>
                            <Input value={assignTo} onChange={(e) => onAssignToChange(e.target.value)} placeholder="Enter user ID or name" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onAssignOpen(false)}>Cancel</Button>
                        <Button onClick={onAssignCase} style={{ backgroundColor: "#004E98" }}>Assign</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Escalation / Referral Dialog */}
            <Dialog open={escalateToDeptOpen} onOpenChange={onEscalateToDeptOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Escalate or Refer Case</DialogTitle>
                        <DialogDescription>Move this case to a different department or escalate to a supervisor.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Reason for Escalation (Mandatory)</Label>
                            <Textarea
                                placeholder="Provide context on why this is being moved/escalated..."
                                value={escalationReason}
                                onChange={(e) => onEscalationReasonChange(e.target.value)}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground italic">Note: This will be pinned as an internal comment for the new assignee.</p>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={() => onEscalateToDeptOpen(false)}>Cancel</Button>
                        <Button
                            disabled={!escalationReason.trim()}
                            onClick={() => onPerformEscalation(escalationReason, true)}
                            style={{ backgroundColor: "#e55f00" }}
                        >
                            Escalate to Dept
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
