import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { CaseList } from "@/components/cases/case-list";
import { CaseDetailView } from "@/components/cases/case-detail";

export function CaseListTab({ 
    userPerms, 
    onViewWorkspace, 
    onNewCaseOpen 
}: { 
    userPerms?: { permissions: string[] },
    onViewWorkspace: (id: string) => void,
    onNewCaseOpen: () => void
}) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [casesPage, setCasesPage] = useState(1);
    const casesLimit = 10;
    const [filterStatus, setFilterStatus] = useState("");
    const [filterPriority, setFilterPriority] = useState("");
    const [filterChannel, setFilterChannel] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
    const [commentText, setCommentText] = useState("");
    const [commentIsInternal, setCommentIsInternal] = useState(false);
    const [commentLoading, setCommentLoading] = useState(false);
    const [statusChangeOpen, setStatusChangeOpen] = useState(false);
    const [newStatus, setNewStatus] = useState("");
    const [assignOpen, setAssignOpen] = useState(false);
    const [assignTo, setAssignTo] = useState("");
    const [escalateToDeptOpen, setEscalateToDeptOpen] = useState(false);
    const [escalationReason, setEscalationReason] = useState("");

    const [newCaseOpen, setNewCaseOpen] = useState(false);
    const [newCaseForm, setNewCaseForm] = useState({
        title: "", description: "", priority: "medium", channel: "email",
        serviceCategoryId: "",
        contactName: "", contactEmail: "", contactPhone: "",
    });
    const [newCaseLoading, setNewCaseLoading] = useState(false);

    const { data: casesData, isLoading: casesLoading } = useQuery({
        queryKey: ["cases", "list", { filterStatus, filterPriority, filterChannel, searchQuery, casesPage }],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filterStatus) params.set("status", filterStatus);
            if (filterPriority) params.set("priority", filterPriority);
            if (filterChannel) params.set("channel", filterChannel);
            if (searchQuery) params.set("search", searchQuery);
            params.set("page", casesPage.toString());
            params.set("limit", casesLimit.toString());
            const res = await apiRequest(`/api/cases?${params}`);
            return res.json();
        },
    });

    const { data: selectedCase, isLoading: detailLoading } = useQuery({
        queryKey: ["cases", "detail", selectedCaseId],
        queryFn: async () => {
            const res = await apiRequest(`/api/cases/${selectedCaseId}`);
            return res.json();
        },
        enabled: !!selectedCaseId,
    });

    const { data: depts } = useQuery({
        queryKey: ["admin", "departments"],
        queryFn: async () => {
            const res = await apiRequest("/api/admin/departments");
            const d = await res.json();
            return d.departments || d;
        },
    });

    const { data: categories } = useQuery({
        queryKey: ["admin", "service-categories"],
        queryFn: async () => {
            const res = await apiRequest("/api/admin/service-categories");
            const d = await res.json();
            return d.serviceCategories || d;
        },
    });

    const createCase = async () => {
        if (!newCaseForm.title.trim()) { toast({ title: "Error", description: "Title is required.", variant: "destructive" }); return; }
        setNewCaseLoading(true);
        try {
            const res = await apiRequest("/api/cases", { method: "POST", body: JSON.stringify(newCaseForm) });
            if (res.ok) {
                toast({ title: "Success", description: "Case created successfully." });
                setNewCaseOpen(false);
                setNewCaseForm({ title: "", description: "", priority: "medium", channel: "email", serviceCategoryId: "", contactName: "", contactEmail: "", contactPhone: "" });
                queryClient.invalidateQueries({ queryKey: ["cases", "list"] });
                queryClient.invalidateQueries({ queryKey: ["cases", "stats"] });
                queryClient.invalidateQueries({ queryKey: ["cases", "kanban"] });
            } else {
                const d = await res.json().catch(() => ({}));
                toast({ title: "Error", description: d.message || "Failed to create case.", variant: "destructive" });
            }
        } catch { toast({ title: "Error", description: "Failed to create case.", variant: "destructive" }); }
        finally { setNewCaseLoading(false); }
    };

    const addComment = async () => {
        if (!commentText.trim() || !selectedCase) return;
        setCommentLoading(true);
        try {
            const res = await apiRequest(`/api/cases/${selectedCase.id}/comments`, { method: "POST", body: JSON.stringify({ content: commentText, isInternal: commentIsInternal }) });
            if (res.ok) {
                toast({ title: "Success", description: "Comment added." });
                setCommentText("");
                setCommentIsInternal(false);
                queryClient.invalidateQueries({ queryKey: ["cases", "detail", selectedCase.id] });
            }
            else toast({ title: "Error", description: "Failed to add comment.", variant: "destructive" });
        } catch { toast({ title: "Error", description: "Failed to add comment.", variant: "destructive" }); }
        finally { setCommentLoading(false); }
    };

    const performEscalation = async (reason: string, toDept: boolean) => {
        if (!selectedCase) return;
        try {
            const res = await apiRequest(`/api/cases/${selectedCase.id}/escalate`, {
                method: "POST",
                body: JSON.stringify({ reason })
            });
            if (res.ok) {
                toast({ title: "Success", description: "Case escalated and reason pinned." });
                setEscalateToDeptOpen(false);
                setEscalationReason("");
                queryClient.invalidateQueries({ queryKey: ["cases", "detail", selectedCase.id] });
                queryClient.invalidateQueries({ queryKey: ["cases", "stats"] });
                queryClient.invalidateQueries({ queryKey: ["cases", "kanban"] });
            } else {
                toast({ title: "Error", description: "Failed to escalate case.", variant: "destructive" });
            }
        } catch {
            toast({ title: "Error", description: "Failed to escalate case.", variant: "destructive" });
        }
    };

    const updateCaseStatus = async () => {
        if (!selectedCase || !newStatus) return;
        const res = await apiRequest(`/api/cases/${selectedCase.id}/status`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
        if (res.ok) {
            toast({ title: "Success", description: "Status updated." });
            setStatusChangeOpen(false);
            queryClient.invalidateQueries({ queryKey: ["cases", "detail", selectedCase.id] });
            queryClient.invalidateQueries({ queryKey: ["cases", "list"] });
            queryClient.invalidateQueries({ queryKey: ["cases", "stats"] });
            queryClient.invalidateQueries({ queryKey: ["cases", "kanban"] });
        }
        else toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    };

    const handleStatusChange = async (id: string, status: string) => {
        try {
            const res = await apiRequest(`/api/cases/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                toast({ title: "Status Updated", description: `Case status changed to ${status.replace('_', ' ')}.` });
                queryClient.invalidateQueries({ queryKey: ["cases", "list"] });
                queryClient.invalidateQueries({ queryKey: ["cases", "stats"] });
                queryClient.invalidateQueries({ queryKey: ["cases", "kanban"] });
            }
        } catch {
            toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
        }
    };

    const handleAssignUser = async (id: string, userId: string) => {
        try {
            const res = await apiRequest(`/api/cases/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ assignedTo: userId })
            });
            if (res.ok) {
                toast({ title: "Assignment Updated", description: "The case has been successfully assigned." });
                queryClient.invalidateQueries({ queryKey: ["cases", "list"] });
            } else {
                toast({ title: "Error", description: "Failed to assign user.", variant: "destructive" });
            }
        } catch {
            toast({ title: "Error", description: "Failed to assign user.", variant: "destructive" });
        }
    };

    const assignCase = async () => {
        if (!selectedCase || !assignTo.trim()) return;
        const res = await apiRequest(`/api/cases/${selectedCase.id}`, { method: "PUT", body: JSON.stringify({ assignedTo: assignTo }) });
        if (res.ok) {
            toast({ title: "Success", description: "Case assigned." });
            setAssignOpen(false);
            setAssignTo("");
            queryClient.invalidateQueries({ queryKey: ["cases", "detail", selectedCase.id] });
            queryClient.invalidateQueries({ queryKey: ["cases", "list"] });
        }
        else toast({ title: "Error", description: "Failed to assign case.", variant: "destructive" });
    };

    if (selectedCase) {
        return (
            <CaseDetailView
                selectedCase={selectedCase as any}
                commentText={commentText}
                commentIsInternal={commentIsInternal}
                commentLoading={commentLoading}
                statusChangeOpen={statusChangeOpen}
                newStatus={newStatus}
                assignOpen={assignOpen}
                assignTo={assignTo}
                onBack={() => setSelectedCaseId(null)}
                onCommentTextChange={setCommentText}
                onCommentInternalChange={setCommentIsInternal}
                onAddComment={addComment}
                onEscalate={() => { }} // Legacy
                onStatusChangeOpen={setStatusChangeOpen}
                onNewStatusChange={setNewStatus}
                onUpdateStatus={updateCaseStatus}
                onAssignOpen={setAssignOpen}
                onAssignToChange={setAssignTo}
                onAssignCase={assignCase}
                escalationReason={escalationReason}
                onEscalationReasonChange={setEscalationReason}
                escalateToDeptOpen={escalateToDeptOpen}
                onEscalateToDeptOpen={setEscalateToDeptOpen}
                onPerformEscalation={performEscalation}
                departments={depts || []}
            />
        );
    }

    return (
        <CaseList
            cases={casesData?.cases || []}
            loading={casesLoading}
            total={casesData?.total || 0}
            page={casesPage}
            limit={casesLimit}
            searchQuery={searchQuery}
            filterStatus={filterStatus}
            filterPriority={filterPriority}
            filterChannel={filterChannel}
            newCaseOpen={newCaseOpen}
            newCaseForm={newCaseForm}
            newCaseLoading={newCaseLoading}
            onSearchChange={setSearchQuery}
            onStatusFilter={setFilterStatus}
            onPriorityFilter={setFilterPriority}
            onChannelFilter={setFilterChannel}
            onPageChange={setCasesPage}
            onCaseClick={onViewWorkspace}
            onNewCaseOpen={onNewCaseOpen}
            onNewCaseClose={() => setNewCaseOpen(false)}
            onNewCaseFormChange={setNewCaseForm}
            serviceCategories={categories}
            departments={depts || []}
            onCreateCase={createCase}
            onStatusChange={handleStatusChange}
            onAssignUser={handleAssignUser}
            userPerms={userPerms}
        />
    );
}
