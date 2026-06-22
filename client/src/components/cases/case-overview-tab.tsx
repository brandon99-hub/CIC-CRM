import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { CaseOverview } from "@/components/cases/case-overview";
import { AcknowledgeModal, ResolveModal } from "@/components/cases/status-modals";
import { EscalationModal } from "@/components/cases/escalation-modal";

export function CaseOverviewTab({ 
    user, 
    onViewWorkspace, 
    userPerms 
}: { 
    user: any, 
    onViewWorkspace: (id: string) => void,
    userPerms?: { permissions: string[] }
}) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [kanbanSelectedId, setKanbanSelectedId] = useState<string | null>(null);
    const [kanbanModalType, setKanbanModalType] = useState<"acknowledge" | "resolve" | "escalate" | null>(null);
    const [isProcessingKanban, setIsProcessingKanban] = useState(false);

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ["cases", "stats"],
        queryFn: async () => {
            const res = await apiRequest("/api/cases/stats");
            return res.json();
        },
    });

    const { data: trends } = useQuery({
        queryKey: ["cases", "analytics", "trends"],
        queryFn: async () => {
            const res = await apiRequest("/api/cases/analytics/trends");
            return res.json();
        },
        enabled: !!userPerms?.permissions.includes("cases.view_volume_trends")
    });

    const { data: distribution } = useQuery({
        queryKey: ["cases", "analytics", "distribution"],
        queryFn: async () => {
            const res = await apiRequest("/api/cases/analytics/distribution");
            return res.json();
        },
        enabled: !!userPerms?.permissions.includes("cases.view_channel_dist")
    });

    const { data: hotspots } = useQuery({
        queryKey: ["cases", "analytics", "hotspots"],
        queryFn: async () => {
            const res = await apiRequest("/api/cases/analytics/hotspots");
            return res.json();
        },
        enabled: !!userPerms?.permissions.includes("cases.view_hotspots")
    });

    const { data: activity } = useQuery({
        queryKey: ["cases", "analytics", "activity"],
        queryFn: async () => {
            const res = await apiRequest("/api/cases/analytics/activity");
            return res.json();
        },
        enabled: !!userPerms?.permissions.includes("cases.view_activity")
    });

    const { data: breachedData } = useQuery({
        queryKey: ["cases", "analytics", "sla-breached"],
        queryFn: async () => {
            const res = await apiRequest("/api/cases/analytics/sla-breached");
            return res.json();
        },
    });

    const { data: kanbanData, isLoading: kanbanLoading } = useQuery({
        queryKey: ["cases", "kanban"],
        queryFn: async () => {
            const res = await apiRequest("/api/cases?limit=100");
            return res.json();
        },
    });

    const { data: depts } = useQuery({
        queryKey: ["admin", "departments"],
        queryFn: async () => {
            const res = await apiRequest("/api/admin/departments");
            const d = await res.json();
            return d.departments || d;
        },
    });

    const handleKanbanStatusChange = async (id: string, newStatus: string, currentStatus: string) => {
        setKanbanSelectedId(id);
        if (newStatus === "in_progress" && currentStatus === "open") setKanbanModalType("acknowledge");
        else if (newStatus === "resolved") setKanbanModalType("resolve");
        else if (newStatus === "escalated") setKanbanModalType("escalate");
        else {
            try {
                const res = await apiRequest(`/api/cases/${id}/status`, {
                    method: "PATCH",
                    body: JSON.stringify({ status: newStatus })
                });
                if (res.ok) {
                    toast({ title: "Status Updated", description: `Case status changed to ${newStatus.replace('_', ' ')}.` });
                    queryClient.invalidateQueries({ queryKey: ["cases", "list"] });
                    queryClient.invalidateQueries({ queryKey: ["cases", "kanban"] });
                    queryClient.invalidateQueries({ queryKey: ["cases", "stats"] });
                }
            } catch {
                toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
            }
        }
    };

    const handleKanbanAcknowledge = async (message: string) => {
        if (!kanbanSelectedId) return;
        setIsProcessingKanban(true);
        try {
            const res = await apiRequest(`/api/cases/${kanbanSelectedId}/status`, {
                method: "PATCH",
                body: JSON.stringify({ acknowledged: true, message })
            });
            if (res.ok) {
                toast({ title: "Case Acknowledged", description: "Case is now In Progress." });
                queryClient.invalidateQueries({ queryKey: ["cases", "kanban"] });
                queryClient.invalidateQueries({ queryKey: ["cases", "detail", kanbanSelectedId] });
                queryClient.invalidateQueries({ queryKey: ["cases", "stats"] });
                setKanbanModalType(null);
            }
        } finally { setIsProcessingKanban(false); }
    };

    const handleKanbanResolve = async (resolution: string, saveToKb: boolean, sopSteps: string[], rootCause: string) => {
        if (!kanbanSelectedId) return;
        setIsProcessingKanban(true);
        try {
            const res = await apiRequest(`/api/cases/${kanbanSelectedId}/status`, {
                method: "PATCH",
                body: JSON.stringify({
                    status: "resolved",
                    resolutionNotes: resolution,
                    saveToKb,
                    sopSteps,
                    rootCause
                })
            });
            if (res.ok) {
                toast({ title: "Case Resolved", description: "Resolution has been recorded." });
                queryClient.invalidateQueries({ queryKey: ["cases", "kanban"] });
                queryClient.invalidateQueries({ queryKey: ["cases", "detail", kanbanSelectedId] });
                queryClient.invalidateQueries({ queryKey: ["cases", "stats"] });
                setKanbanModalType(null);
            }
        } finally { setIsProcessingKanban(false); }
    };

    const handleKanbanEscalate = async (reason: string, deptId?: string) => {
        if (!kanbanSelectedId) return;
        setIsProcessingKanban(true);
        try {
            const res = await apiRequest(`/api/cases/${kanbanSelectedId}/escalate`, {
                method: "POST",
                body: JSON.stringify({ reason, departmentId: deptId })
            });
            if (res.ok) {
                toast({ title: "Case Escalated", description: "Case has been moved to escalated status." });
                queryClient.invalidateQueries({ queryKey: ["cases", "kanban"] });
                queryClient.invalidateQueries({ queryKey: ["cases", "detail", kanbanSelectedId] });
                queryClient.invalidateQueries({ queryKey: ["cases", "stats"] });
                setKanbanModalType(null);
            }
        } finally { setIsProcessingKanban(false); }
    };

    if (statsLoading) return null;

    return (
        <>
            <CaseOverview
                stats={stats}
                userName={user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user?.email}
                trends={trends?.trends}
                distribution={distribution}
                hotspots={hotspots?.hotspots}
                activity={activity?.activity}
                breachedCases={breachedData?.breachedCases}
                userPerms={userPerms}
                kanbanCases={kanbanData?.cases}
                isLoadingKanban={kanbanLoading}
                onStatusChange={handleKanbanStatusChange}
                onCaseClick={onViewWorkspace}
                currentUserId={user?.id}
            />

            <AcknowledgeModal
                open={kanbanModalType === "acknowledge"}
                onOpenChange={(open) => !open && setKanbanModalType(null)}
                onConfirm={handleKanbanAcknowledge}
                isProcessing={isProcessingKanban}
                channel={kanbanData?.cases?.find((c: any) => c.id === kanbanSelectedId)?.channel || "email"}
            />
            <ResolveModal
                open={kanbanModalType === "resolve"}
                onOpenChange={(open) => !open && setKanbanModalType(null)}
                onConfirm={handleKanbanResolve}
                isProcessing={isProcessingKanban}
                caseData={(() => {
                    const c = kanbanData?.cases?.find((c: any) => c.id === kanbanSelectedId);
                    if (!c) return undefined;
                    return {
                        caseNumber: c.caseNumber,
                        title: c.title,
                        description: c.description,
                        channel: c.channel
                    };
                })()}
            />
            <EscalationModal
                isOpen={kanbanModalType === "escalate"}
                onClose={() => setKanbanModalType(null)}
                caseId={kanbanSelectedId || ""}
                caseNumber={kanbanData?.cases?.find((c: any) => c.id === kanbanSelectedId)?.caseNumber || ""}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["cases"] });
                    setKanbanModalType(null);
                }}
                departments={depts || []}
            />
        </>
    );
}
