import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { EscalationChains } from "@/components/admin/escalation-chains";
import { Loader2 } from "lucide-react";

import {
  Role, ServiceCategory, SlaRule, EscalationChain, EscalationStep,
  SystemUser, Department
} from "@/types/admin";

interface KbEscalationsProps {
  canManage?: boolean;
  hideHeader?: boolean;
}

export function KbEscalations({ canManage = false }: KbEscalationsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [expandedChain, setExpandedChain] = useState<string | null>(null);
  const [chainModalOpen, setChainModalOpen] = useState(false);
  const [editingChain, setEditingChain] = useState<EscalationChain | null>(null);
  const [chainForm, setChainForm] = useState({
    name: "", serviceCategoryId: "", slaId: "", priority: "", description: "", assigneeUserId: "", escalateAfterMinutes: 30
  });

  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<EscalationStep | null>(null);
  const [stepChainId, setStepChainId] = useState<string>("");
  const [stepForm, setStepForm] = useState({
    assigneeDepartmentId: "", targetDepartmentId: "", assigneeRoleId: "", assigneeUserId: null as string | null,
    escalateAfterMinutes: 30, requiresConsent: false, gracePeriodMinutes: 0, notifyChannel: "email", description: ""
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handler = () => openChainModal();
    window.addEventListener("open-escalation-chain-modal", handler);
    return () => window.removeEventListener("open-escalation-chain-modal", handler);
  }, []);

  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["admin", "roles"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/roles");
      const d = await res.json();
      return Array.isArray(d.roles) ? d.roles : (Array.isArray(d) ? d : []);
    }
  });

  const { data: departments = [], isLoading: deptsLoading } = useQuery<Department[]>({
    queryKey: ["admin", "departments"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/departments");
      const d = await res.json();
      return Array.isArray(d.departments) ? d.departments : (Array.isArray(d) ? d : []);
    }
  });

  const { data: categories = [], isLoading: catsLoading } = useQuery<ServiceCategory[]>({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/service-categories");
      const d = await res.json();
      return Array.isArray(d.categories) ? d.categories : (Array.isArray(d) ? d : []);
    }
  });

  const { data: slaRules = [], isLoading: slaLoading } = useQuery<SlaRule[]>({
    queryKey: ["admin", "sla"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/sla-rules");
      const d = await res.json();
      return Array.isArray(d.slaRules) ? d.slaRules : (Array.isArray(d) ? d : []);
    }
  });

  const { data: chains = [], isLoading: chainsLoading } = useQuery<EscalationChain[]>({
    queryKey: ["admin", "escalation", "chains"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/escalation-chains");
      const d = await res.json();
      return Array.isArray(d.escalationChains) ? d.escalationChains : (Array.isArray(d) ? d : []);
    }
  });

  const { data: systemUsers = [], isLoading: usersLoading } = useQuery<SystemUser[]>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/users");
      const d = await res.json();
      return d.users || (Array.isArray(d) ? d : []);
    }
  });

  const { data: stepData = [], isLoading: stepsLoading } = useQuery<EscalationStep[]>({
    queryKey: ["admin", "escalation", "steps", expandedChain],
    queryFn: async () => {
      const res = await apiRequest(`/api/admin/escalation-steps/${expandedChain}`);
      const d = await res.json();
      return Array.isArray(d.escalationSteps) ? d.escalationSteps : (Array.isArray(d) ? d : []);
    },
    enabled: !!expandedChain,
  });

  const loading = rolesLoading || deptsLoading || catsLoading || slaLoading || chainsLoading || usersLoading;

  const getCatName = (id: string | null) => categories.find((c) => c.id === id)?.name || "—";
  const getRoleName = (id: string | null) => roles.find((r) => r.id === id)?.name || "—";
  const getSlaName = (id: string | null) => slaRules.find((s) => s.id === id)?.name || "—";
  const formatMinutes = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) {
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hrs}h ${mins}m` : `${hrs} hour${hrs > 1 ? "s" : ""}`;
    }
    const days = Math.floor(minutes / 1440);
    const remaining = minutes % 1440;
    if (remaining === 0) return `${days} day${days > 1 ? "s" : ""}`;
    return `${days}d ${formatMinutes(remaining)}`;
  };

  const toggleChainExpand = (chainId: string) => {
    if (expandedChain === chainId) { setExpandedChain(null); return; }
    setExpandedChain(chainId);
  };

  // ── Chain CRUD ──
  const openChainModal = (chain?: EscalationChain) => {
    if (chain) {
      setEditingChain(chain);
      setChainForm({
        name: chain.name, serviceCategoryId: chain.serviceCategoryId || "", slaId: chain.slaId || "", priority: chain.priority || "",
        description: chain.description || "", assigneeUserId: "", escalateAfterMinutes: 0
      });
    } else {
      setEditingChain(null);
      setChainForm({
        name: "", serviceCategoryId: "", slaId: "", priority: "", description: "", assigneeUserId: "", escalateAfterMinutes: 30
      });
    }
    setChainModalOpen(true);
  };

  const saveChain = async () => {
    setIsSaving(true);
    try {
      const url = editingChain ? `/api/admin/escalation-chains/${editingChain.id}` : "/api/admin/escalation-chains";
      const method = editingChain ? "PUT" : "POST";
      const res = await apiRequest(url, {
        method,
        body: JSON.stringify({
          name: chainForm.name,
          serviceCategoryId: chainForm.serviceCategoryId || null,
          slaId: chainForm.slaId || null,
          priority: chainForm.priority || null,
          description: chainForm.description || null,
          ...(editingChain ? {} : {
            assigneeUserId: chainForm.assigneeUserId || null,
            escalateAfterMinutes: Number(chainForm.escalateAfterMinutes)
          })
        })
      });
      if (res.ok) {
        toast({ title: "Success", description: `Escalation chain ${editingChain ? "updated" : "created"}.` });
        setChainModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["admin", "escalation"] });
      } else {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Error", description: d.message || "Failed to save chain.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save chain.", variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const deleteChain = async (id: string) => {
    if (!confirm("Are you sure you want to delete this escalation chain?")) return;
    try {
      const res = await apiRequest(`/api/admin/escalation-chains/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Success", description: "Chain deleted." });
        queryClient.invalidateQueries({ queryKey: ["admin", "escalation"] });
      } else { toast({ title: "Error", description: "Failed to delete chain.", variant: "destructive" }); }
    } catch { toast({ title: "Error", description: "Failed to delete chain.", variant: "destructive" }); }
  };

  // ── Step CRUD ──
  const openStepModal = (chainId: string, step?: EscalationStep) => {
    setStepChainId(chainId);
    if (step) {
      setEditingStep(step);
      setStepForm({
        assigneeDepartmentId: step.assigneeDepartmentId || "", targetDepartmentId: step.targetDepartmentId || "", assigneeRoleId: step.assigneeRoleId || "",
        assigneeUserId: step.assigneeUserId, escalateAfterMinutes: step.escalateAfterMinutes, requiresConsent: step.requiresConsent,
        gracePeriodMinutes: step.gracePeriodMinutes, notifyChannel: step.notifyChannel, description: step.description || ""
      });
    } else {
      setEditingStep(null);
      const chain = chains.find(c => c.id === chainId);
      let autoDeptId = "";
      if (chain) {
        const cat = categories.find(c => c.id === chain.serviceCategoryId);
        if (cat?.departmentId) {
          autoDeptId = cat.departmentId;
        } else if (chain.slaId) {
          const sla = slaRules.find(s => s.id === chain.slaId);
          const slaCat = categories.find(c => c.id === sla?.serviceCategoryId);
          if (slaCat?.departmentId) autoDeptId = slaCat.departmentId;
        }
      }
      setStepForm({
        assigneeDepartmentId: autoDeptId, targetDepartmentId: "", assigneeRoleId: "", assigneeUserId: null, escalateAfterMinutes: 30,
        requiresConsent: false, gracePeriodMinutes: 0, notifyChannel: "email", description: ""
      });
    }
    setStepModalOpen(true);
  };

  const saveStep = async () => {
    setIsSaving(true);
    try {
      const url = editingStep ? `/api/admin/escalation-steps/${editingStep.id}` : `/api/admin/escalation-chains/${stepChainId}/steps`;
      const method = editingStep ? "PUT" : "POST";
      const body = {
        assigneeDepartmentId: stepForm.assigneeDepartmentId || null,
        targetDepartmentId: stepForm.targetDepartmentId || null,
        assigneeRoleId: stepForm.assigneeRoleId || null,
        assigneeUserId: stepForm.assigneeUserId || null,
        escalateAfterMinutes: Number(stepForm.escalateAfterMinutes),
        requiresConsent: stepForm.requiresConsent,
        gracePeriodMinutes: Number(stepForm.gracePeriodMinutes),
        notifyChannel: stepForm.notifyChannel,
        description: stepForm.description || null
      };

      const res = await apiRequest(url, { method, body: JSON.stringify(body) });
      if (res.ok) {
        toast({ title: "Success", description: `Step ${editingStep ? "updated" : "added"}.` });
        setStepModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["admin", "escalation"] });
      } else {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Error", description: d.message || "Failed to save step.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save step.", variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const deleteStep = async (chainId: string, stepId: string) => {
    if (!confirm("Are you sure you want to remove this step?")) return;
    try {
      const res = await apiRequest(`/api/admin/escalation-steps/${stepId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Success", description: "Step deleted." });
        queryClient.invalidateQueries({ queryKey: ["admin", "escalation"] });
      } else { toast({ title: "Error", description: "Failed to delete step.", variant: "destructive" }); }
    } catch { toast({ title: "Error", description: "Failed to delete step.", variant: "destructive" }); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#004E98]" />
      </div>
    );
  }

  return (
    <EscalationChains
      hideHeader={true}
      chains={chains}
      roles={roles}
      categories={categories}
      expandedChain={expandedChain}
      getCatName={getCatName}
      getRoleName={getRoleName}
      getSlaName={getSlaName}
      formatMinutes={formatMinutes}
      onToggleChainExpand={toggleChainExpand}
      chainModalOpen={chainModalOpen}
      editingChain={editingChain}
      chainForm={chainForm}
      onChainFormChange={(f) => setChainForm({ ...chainForm, ...f })}
      onOpenChainModal={openChainModal}
      onSaveChain={saveChain}
      onDeleteChain={deleteChain}
      onCloseChainModal={() => setChainModalOpen(false)}
      stepModalOpen={stepModalOpen}
      stepForm={stepForm}
      onStepFormChange={(f) => setStepForm({ ...stepForm, ...f })}
      onOpenStepModal={openStepModal}
      onSaveStep={saveStep}
      onDeleteStep={deleteStep}
      onCloseStepModal={() => setStepModalOpen(false)}
      slaRules={slaRules}
      users={systemUsers}
      departments={departments}
      stepChainId={stepChainId}
      isSaving={isSaving}
      editingStep={editingStep}
      stepData={stepData}
      stepsLoading={stepsLoading}
      canManage={canManage}
    />
  );
}
