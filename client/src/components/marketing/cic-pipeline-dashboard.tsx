import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, ShieldOff, UserCheck, Building, Phone, Info, Briefcase, Edit2, Trash2, Mail
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { MarketingPageHeader } from "./marketing-page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { DocumentAttachmentSection } from "./document-attachment-section";
import { useToast } from "@/hooks/use-toast";

// Helper to format currency
const formatKes = (amount: number | null | undefined) => {
  if (amount == null) return "—";
  return `KES ${amount.toLocaleString()}`;
};

const STAGES = [
  { id: "lead", label: "Leads", description: "Initial contact, qualification, and routing." },
  { id: "prospect", label: "Prospects", description: "Data collection, KYC, and initial assessment." },
  { id: "underwriting", label: "Underwriting", description: "Quotation, proposal generation, and underwriter review." },
  { id: "policy_issued", label: "Policy Issued", description: "Payment confirmed and policy active." },
  { id: "post_sale", label: "Terminal / Post Sale", description: "Renewals, dormancy, or lost deals." }
];

const REGIONS = {
  "Kenya": ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Nyeri", "Machakos", "Meru", "Thika", "Garissa", "Other"],
  "Uganda": ["Kampala", "Wakiso", "Mukono", "Jinja", "Mbarara", "Other"],
  "Malawi": ["Lilongwe", "Blantyre", "Zomba", "Mzuzu", "Other"],
  "South Sudan": ["Juba", "Malakal", "Wau", "Yei", "Other"],
};

export function CICPipelineDashboard({
  pipelineMode: externalPipelineMode,
  setPipelineMode: externalSetPipelineMode,
  user,
  onAddLead
}: {
  pipelineMode: "B2C" | "B2B";
  setPipelineMode: (m: "B2C" | "B2B") => void;
  user: any;
  onAddLead: () => void;
}) {
  const [activeStage, setActiveStage] = useState<string>("lead");
  
  const bdType = user?.role === 'admin' ? 'both' : (user?.bdType || "both");
  const defaultSubTab = bdType === "b2c" ? "b2c" : "b2b";
  const [activeSubTab, setActiveSubTab] = useState<"b2c" | "b2b">(defaultSubTab);

  const [pipelineSearch, setPipelineSearch] = useState("");
  const [pipelineSort, setPipelineSort] = useState("newest");
  const [pipelinePage, setPipelinePage] = useState(1);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const token = () => localStorage.getItem("marketingToken");

  useEffect(() => {
    if (bdType === "b2c") setActiveSubTab("b2c");
    if (bdType === "b2b") setActiveSubTab("b2b");
  }, [bdType]);

  const { data: pipelineData, isLoading: pipelineLoading } = useQuery({
    queryKey: ['cic', 'pipeline', activeStage, activeSubTab, pipelineSearch, pipelineSort, pipelinePage],
    queryFn: async () => {
      let fetchPipelineType = activeSubTab;
      if (activeStage === "lead" || activeStage === "policy_issued") {
        fetchPipelineType = bdType === "both" ? "all" : bdType;
      }

      const params = new URLSearchParams({
        pipeline_type: fetchPipelineType,
        stage: activeStage,
        ...(pipelineSearch && { search: pipelineSearch }),
        ...(pipelineSort && { sort: pipelineSort }),
        page: String(pipelinePage),
        limit: '50',
      });
      const res = await fetch(`/api/cic/pipeline?${params}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) return { leads: [], total: 0, marketingDeptConfigured: false, summary: { leadsByStage: {} } };
      return res.json();
    },
    staleTime: 60_000,
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string, stage: string }) => {
      const res = await fetch(`/api/marketing/pipeline/${id}/stage`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`
        },
        body: JSON.stringify({ stage })
      });
      if (!res.ok) throw new Error("Failed to update stage");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Stage Updated", description: "The lead has been moved." });
      queryClient.invalidateQueries({ queryKey: ['cic', 'pipeline'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update stage.", variant: "destructive" });
    }
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/marketing/pipeline/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!res.ok) throw new Error("Failed to delete lead");
    },
    onSuccess: () => {
      toast({ title: "Lead Deleted", description: "The lead has been removed." });
      queryClient.invalidateQueries({ queryKey: ['cic', 'pipeline'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete lead.", variant: "destructive" });
    }
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await fetch(`/api/marketing/pipeline/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update lead");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Lead Updated", description: "The lead details have been saved." });
      setEditingLead(null);
      queryClient.invalidateQueries({ queryKey: ['cic', 'pipeline'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update lead stage.", variant: "destructive" });
    }
  });

  const { data: sectorsData } = useQuery({
    queryKey: ['marketing', 'sectors'],
    queryFn: async () => {
      const res = await fetch('/api/marketing/sectors', {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.sectors || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: usersData } = useQuery({
    queryKey: ['marketing', 'users'],
    queryFn: async () => {
      const res = await fetch('/api/marketing/users', {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.users || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const assignUserMutation = useMutation({
    mutationFn: async ({ id, assignedToUserId }: { id: string, assignedToUserId: string }) => {
      const res = await fetch(`/api/marketing/pipeline/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ assignedToUserId }),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User Assigned", description: "The lead assignment has been updated." });
      queryClient.invalidateQueries({ queryKey: ['cic', 'pipeline'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not assign user.", variant: "destructive" });
    }
  });

  const leads = pipelineData?.leads || [];

  const leadsByStage = pipelineData?.summary?.leadsByStage || {};

  const showSubTabs = (activeStage === "prospect" || activeStage === "underwriting" || activeStage === "post_sale") && bdType === "both";
  const isB2CView = (activeStage === "lead" || activeStage === "policy_issued") ? false : activeSubTab === "b2c";

  const getStageOptions = (isB2c: boolean) => {
    if (isB2c) {
      return [
        { value: "lead", label: "Lead" },
        { value: "prospect", label: "Prospect" },
        { value: "quote_underwriting", label: "Quote & Underwriting" },
        { value: "policy_issued", label: "Policy Issued" },
        { value: "dormant", label: "Dormant" },
      ];
    } else {
      return [
        { value: "lead", label: "Lead" },
        { value: "prospect", label: "Prospect" },
        { value: "proposal_underwriting", label: "Proposal & Underwriting" },
        { value: "policy_issued", label: "Policy Issued" },
        { value: "active", label: "Active Scheme" },
      ];
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <MarketingPageHeader
        title="Pipeline Centers"
        subtitle="Manage leads, prospects, underwriting, and policies across B2C and B2B."
        icon={Briefcase}
        searchValue={pipelineSearch}
        onSearchChange={(v) => { setPipelineSearch(v); setPipelinePage(1); }}
        actionButton={{
          label: "New Lead",
          onClick: onAddLead,
          icon: Plus
        }}
      />

      {/* Tabs matching campaigns page design */}
      <div className="flex items-center justify-between mb-4 border-b border-gray-200 bg-transparent px-6 pt-2">
        <div className="bg-transparent h-12 gap-8 border-none p-0 flex">
          {STAGES.map(stage => {
            const isActive = activeStage === stage.id;
            return (
              <button 
                key={stage.id}
                className={`rounded-none border-b-2 px-2 h-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors ${isActive ? "border-[#004E98] text-[#004E98] bg-transparent shadow-none" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                onClick={() => setActiveStage(stage.id)}
              >
                {stage.label}
                {leadsByStage && (
                  <span className={`ml-1 py-0.5 px-2 rounded-full text-xs ${isActive ? "bg-blue-50 text-[#004E98]" : "bg-gray-100 text-gray-500"}`}>
                    {leadsByStage[stage.id] || 0}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

        {showSubTabs && (
          <div className="px-6 py-3 border-b border-gray-100 bg-white flex gap-2">
            <button
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${activeSubTab === "b2c" ? "bg-[#004E98] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              onClick={() => setActiveSubTab("b2c")}
            >
              B2C Individual
            </button>
            <button
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${activeSubTab === "b2b" ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              onClick={() => setActiveSubTab("b2b")}
            >
              B2B Corporate
            </button>
          </div>
        )}

        <div className="p-6 bg-gray-50/30 min-h-[400px]">
          {pipelineLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#004E98] mb-4" />
              Loading pipeline...
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShieldOff className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-500 font-semibold">
                No leads found in this stage.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50/80 border-b border-gray-100">
                  <TableRow>
                    <TableHead className="font-bold text-gray-700 py-4 pl-6">Name / Organisation</TableHead>
                    
                    {activeStage === "lead" && (
                      <>
                        <TableHead className="font-bold text-gray-700">Contact</TableHead>
                        <TableHead className="font-bold text-gray-700">Product</TableHead>
                        <TableHead className="font-bold text-gray-700">Source</TableHead>
                        <TableHead className="font-bold text-gray-700">County</TableHead>
                      </>
                    )}

                      {activeStage === "prospect" && isB2CView && (
                        <>
                          <TableHead className="font-bold text-gray-700">ID Number</TableHead>
                          <TableHead className="font-bold text-gray-700">Cover Type</TableHead>
                          <TableHead className="font-bold text-gray-700">Employer</TableHead>
                          <TableHead className="font-bold text-gray-700">Next of Kin</TableHead>
                          <TableHead className="font-bold text-gray-700 text-center">Dependants</TableHead>
                          <TableHead className="font-bold text-gray-700 text-right">Est. Premium</TableHead>
                        </>
                      )}

                      {activeStage === "prospect" && !isB2CView && (
                        <>
                          <TableHead className="font-bold text-gray-700">Sector</TableHead>
                          <TableHead className="font-bold text-gray-700">Members</TableHead>
                          <TableHead className="font-bold text-gray-700">KRA PIN (Org)</TableHead>
                          <TableHead className="font-bold text-gray-700">Existing Insurer</TableHead>
                          <TableHead className="font-bold text-gray-700 text-right">Est. Premium</TableHead>
                        </>
                      )}

                      {activeStage === "underwriting" && isB2CView && (
                        <>
                          <TableHead className="font-bold text-gray-700">Sum Insured</TableHead>
                          <TableHead className="font-bold text-gray-700 text-center">Medical History</TableHead>
                          <TableHead className="font-bold text-gray-700 text-right">Quoted Premium</TableHead>
                          <TableHead className="font-bold text-gray-700">Decision</TableHead>
                          <TableHead className="font-bold text-gray-700">Decision Date</TableHead>
                        </>
                      )}

                      {activeStage === "underwriting" && !isB2CView && (
                        <>
                          <TableHead className="font-bold text-gray-700">Loss Ratio</TableHead>
                          <TableHead className="font-bold text-gray-700">Industry Risk</TableHead>
                          <TableHead className="font-bold text-gray-700 text-center">FCL Applicable</TableHead>
                          <TableHead className="font-bold text-gray-700">Decision</TableHead>
                          <TableHead className="font-bold text-gray-700">Decision Date</TableHead>
                        </>
                      )}

                      {activeStage === "policy_issued" && (
                        <>
                          <TableHead className="font-bold text-gray-700">Product</TableHead>
                          <TableHead className="font-bold text-gray-700">Cover Type</TableHead>
                          <TableHead className="font-bold text-gray-700">Premium</TableHead>
                          <TableHead className="font-bold text-gray-700">Start Date</TableHead>
                          <TableHead className="font-bold text-gray-700">End Date</TableHead>
                        </>
                      )}

                      {activeStage === "post_sale" && isB2CView && (
                        <>
                          <TableHead className="font-bold text-gray-700">Dormant Since</TableHead>
                          <TableHead className="font-bold text-gray-700">Lapse Reason</TableHead>
                          <TableHead className="font-bold text-gray-700">Campaign Status</TableHead>
                        </>
                      )}

                      {activeStage === "post_sale" && !isB2CView && (
                        <>
                          <TableHead className="font-bold text-gray-700">Active Members</TableHead>
                          <TableHead className="font-bold text-gray-700">Last Premium</TableHead>
                          <TableHead className="font-bold text-gray-700">Renewal Due</TableHead>
                        </>
                      )}

                      <TableHead className="font-bold text-gray-700">Assigned</TableHead>
                      <TableHead className="font-bold text-gray-700 w-48">Stage Settings</TableHead>
                      <TableHead className="font-bold text-gray-700 w-24 text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead: any) => {
                      const isB2CLead = lead.pipelineType === "b2c" || (!lead.organisationName && lead.contactName);
                      return (
                      <TableRow key={lead.leadId} className="hover:bg-blue-50/30 transition-colors">
                        <TableCell className="py-4 pl-6">
                          <div className="flex items-center gap-3">
                            {/* Icon Removed */}
                            <div>
                              <div className="flex flex-col">
                                <h4 className="font-black text-gray-900 line-clamp-1">
                                  {isB2CLead ? (lead.contactName || "—") : (lead.organisationName || "—")}
                                </h4>
                                {!isB2CLead && lead.primaryContactName && (
                                  <span className="text-xs text-gray-500 font-medium line-clamp-1 flex items-center gap-1">
                                    <UserCheck className="w-3 h-3" /> {lead.primaryContactName}
                                  </span>
                                )}
                              </div>
                              {lead.daysInCurrentStage > 0 && (
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{lead.daysInCurrentStage} days in stage</span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {activeStage === "lead" && (
                          <>
                            <TableCell>
                              <div className="flex flex-col gap-1 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                                  <span>{lead.phone || "—"}</span>
                                </div>
                                {lead.email && (
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                                    <span>{lead.email}</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-bold text-gray-700">{lead.productLine || lead.schemeType || "—"}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-gray-600">{lead.sourceChannel || "—"}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-gray-600">{lead.county || "—"}</span>
                            </TableCell>
                          </>
                        )}

                        {activeStage === "prospect" && isB2CView && (
                          <>
                            <TableCell className="text-sm text-gray-700">{lead.nationalIdNumber || "—"}</TableCell>
                            <TableCell className="text-sm text-gray-700">{lead.coverType || "—"}</TableCell>
                            <TableCell className="text-sm text-gray-700">{lead.employerName || "—"}</TableCell>
                            <TableCell className="text-sm text-gray-700">{lead.nextOfKinName || "—"}</TableCell>
                            <TableCell className="text-sm text-gray-700 text-center">{lead.dependantsCount ?? "—"}</TableCell>
                            <TableCell className="text-sm font-black text-emerald-600 text-right">{formatKes(lead.sumInsuredEstimateKes)}</TableCell>
                          </>
                        )}

                        {activeStage === "prospect" && !isB2CView && (
                          <>
                            <TableCell className="text-sm text-gray-700">{lead.sectorIndustry || "—"}</TableCell>
                            <TableCell className="text-sm text-gray-700">{lead.totalLives || "—"}</TableCell>
                            <TableCell className="text-sm text-gray-700">{lead.kraPinOrg || "—"}</TableCell>
                            <TableCell className="text-sm text-gray-700">{lead.existingInsurer || "—"}</TableCell>
                            <TableCell className="text-sm font-black text-emerald-600 text-right">{formatKes(lead.groupPremiumEstimateKes)}</TableCell>
                          </>
                        )}

                        {activeStage === "underwriting" && isB2CView && (
                          <>
                            <TableCell className="text-sm font-black text-gray-900">{formatKes(lead.sumInsuredConfirmedKes)}</TableCell>
                            <TableCell className="text-center">
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${lead.medicalHistoryFlag ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
                                {lead.medicalHistoryFlag ? "Flagged" : "Clear"}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm font-black text-emerald-600 text-right">{formatKes(lead.quotedPremiumKes)}</TableCell>
                            <TableCell>
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${lead.underwritingDecision === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                {lead.underwritingDecision || "Pending"}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">{lead.dateOfUnderwritingDecision ? new Date(lead.dateOfUnderwritingDecision).toLocaleDateString() : "—"}</TableCell>
                          </>
                        )}

                        {activeStage === "underwriting" && !isB2CView && (
                          <>
                            <TableCell className="text-sm text-gray-700">{lead.priorLossRatio || "—"}</TableCell>
                            <TableCell className="text-sm text-gray-700">
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${lead.industryRiskRating === 'High' ? 'bg-red-100 text-red-700' : lead.industryRiskRating === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {lead.industryRiskRating || "Low"}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {lead.fclApplicable ? <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-bold">Yes</span> : <span className="text-gray-400 font-medium text-xs">No</span>}
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${lead.underwritingDecision === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                {lead.underwritingDecision || "Pending"}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">{lead.dateOfUnderwritingDecision ? new Date(lead.dateOfUnderwritingDecision).toLocaleDateString() : "—"}</TableCell>
                          </>
                        )}

                        {activeStage === "policy_issued" && (
                          <>
                            <TableCell className="text-sm font-bold text-gray-700">{lead.productLine || lead.schemeType || "—"}</TableCell>
                            <TableCell className="text-sm text-gray-700">{lead.coverType || "—"}</TableCell>
                            <TableCell className="text-sm font-black text-emerald-600">{formatKes(lead.quotedPremiumKes || lead.groupPremiumEstimateKes)}</TableCell>
                            <TableCell className="text-sm text-gray-700">{lead.policyStartDate ? new Date(lead.policyStartDate).toLocaleDateString() : "—"}</TableCell>
                            <TableCell className="text-sm text-gray-700">{lead.policyEndDate ? new Date(lead.policyEndDate).toLocaleDateString() : "—"}</TableCell>
                          </>
                        )}

                        {activeStage === "post_sale" && isB2CView && (
                          <>
                            <TableCell className="text-sm text-gray-700">{lead.dormantSinceDate ? new Date(lead.dormantSinceDate).toLocaleDateString() : "—"}</TableCell>
                            <TableCell>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-sm text-gray-700 line-clamp-1 max-w-[150px] cursor-help underline decoration-dotted">
                                      {lead.lapseReason || "—"}
                                    </span>
                                  </TooltipTrigger>
                                  {lead.lapseReason && (
                                    <TooltipContent className="bg-white text-gray-900 border border-gray-200 shadow-lg p-3 max-w-sm">
                                      {lead.lapseReason}
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="text-sm text-gray-700">{lead.renewalCampaignStatus || "—"}</TableCell>
                          </>
                        )}

                        {activeStage === "post_sale" && !isB2CView && (
                          <>
                            <TableCell className="text-sm text-gray-700">{lead.totalLives || "—"}</TableCell>
                            <TableCell className="text-sm font-black text-emerald-600">{formatKes(lead.outstandingPremiumKes)}</TableCell>
                            <TableCell className="text-sm text-gray-700">{lead.renewalDueDate ? new Date(lead.renewalDueDate).toLocaleDateString() : "—"}</TableCell>
                          </>
                        )}

                        <TableCell>
                          <Select
                            value={lead.assignedToUserId || "unassigned"}
                            onValueChange={(val) => {
                              if (val !== "unassigned") {
                                assignUserMutation.mutate({ id: lead.id, assignedToUserId: val });
                              }
                            }}
                          >
                            <SelectTrigger className="w-[140px] text-xs font-medium border-gray-200 bg-white">
                              <SelectValue placeholder="Unassigned">
                                {lead.assignedToUserId && usersData?.find((u: any) => u.id === lead.assignedToUserId) 
                                  ? `${usersData.find((u: any) => u.id === lead.assignedToUserId).firstName} ${usersData.find((u: any) => u.id === lead.assignedToUserId).lastName}` 
                                  : "Unassigned"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned" className="text-gray-500 italic">Unassigned</SelectItem>
                              {usersData?.map((u: any) => (
                                <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        <TableCell>
                          <Select 
                            value={lead.pipelineStage} 
                            onValueChange={(val) => updateStageMutation.mutate({ id: lead.leadId, stage: val })}
                          >
                            <SelectTrigger className="h-8 text-xs font-semibold bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getStageOptions(isB2CLead).map(t => (
                                <SelectItem key={t.value} value={t.value} className="text-xs font-semibold">
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingLead(lead)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Lead"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => setDeleteCandidateId(lead.leadId)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Lead"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
          )}
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteCandidateId} onOpenChange={(open) => !open && setDeleteCandidateId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-gray-600">
            Are you sure you want to delete this lead? This action cannot be undone.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCandidateId(null)}>Cancel</Button>
            <Button 
              disabled={deleteLeadMutation.isPending}
              variant="destructive"
              onClick={() => {
                if (deleteCandidateId) {
                  deleteLeadMutation.mutate(deleteCandidateId, {
                    onSuccess: () => setDeleteCandidateId(null)
                  });
                }
              }}
            >
              {deleteLeadMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Lead Dialog */}
      <Dialog open={!!editingLead} onOpenChange={(open) => !open && setEditingLead(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Pipeline Item</DialogTitle>
          </DialogHeader>
          {editingLead && (
            <div className="py-4">
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="grid gap-6 p-1">
                  {/* Name section */}
                  {editingLead.pipelineType === 'b2b' || editingLead.organisationName ? (
                    <div className="grid gap-2">
                      <div className="grid gap-2">
                        <Label htmlFor="organisationName">Organisation Name</Label>
                        <Input 
                          id="organisationName" 
                          defaultValue={editingLead.organisationName || editingLead.contactName} 
                          onChange={(e) => setEditingLead({...editingLead, organisationName: e.target.value})} 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="primaryContactName">Primary Contact Name</Label>
                        <Input 
                          id="primaryContactName" 
                          defaultValue={editingLead.primaryContactName || ''} 
                          onChange={(e) => setEditingLead({...editingLead, primaryContactName: e.target.value})} 
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input 
                          id="firstName" 
                          defaultValue={editingLead.contactName?.split(' ')[0] || editingLead.firstName || ''} 
                          onChange={(e) => setEditingLead({...editingLead, firstName: e.target.value})} 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input 
                          id="lastName" 
                          defaultValue={editingLead.contactName?.split(' ').slice(1).join(' ') || editingLead.lastName || ''} 
                          onChange={(e) => setEditingLead({...editingLead, lastName: e.target.value})} 
                        />
                      </div>
                    </div>
                  )}

                  {/* Contact section */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input 
                        id="phone" 
                        defaultValue={editingLead.phone || ''} 
                        onChange={(e) => setEditingLead({...editingLead, phone: e.target.value})} 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        type="email"
                        defaultValue={editingLead.email || ''} 
                        onChange={(e) => setEditingLead({...editingLead, email: e.target.value})} 
                      />
                    </div>
                  </div>

                  {/* Region section */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="country">Country</Label>
                      <Select 
                        value={editingLead.country || "Kenya"} 
                        onValueChange={(val) => setEditingLead({...editingLead, country: val, county: ''})}
                      >
                        <SelectTrigger id="country">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(REGIONS).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="county">Region/County</Label>
                      <Select 
                        value={editingLead.county || ""} 
                        onValueChange={(val) => setEditingLead({...editingLead, county: val})}
                      >
                        <SelectTrigger id="county">
                          <SelectValue placeholder="Select region" />
                        </SelectTrigger>
                        <SelectContent>
                          {(REGIONS[editingLead.country as keyof typeof REGIONS] || REGIONS["Kenya"]).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Source & Product Line - Global */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="sourceChannel">Source Channel</Label>
                      <Select 
                        value={editingLead.sourceChannel || ""} 
                        onValueChange={(val) => setEditingLead({...editingLead, sourceChannel: val})}
                      >
                        <SelectTrigger id="sourceChannel">
                          <SelectValue placeholder="Select channel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="agent">Agent / Broker</SelectItem>
                          <SelectItem value="social_media">Social Media</SelectItem>
                          <SelectItem value="walk_in">Walk-in</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="productLine">Product Line</Label>
                      <Select 
                        value={editingLead.productLine || editingLead.schemeType || ""} 
                        onValueChange={(val) => setEditingLead({...editingLead, productLine: val})}
                      >
                        <SelectTrigger id="productLine">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="motor">Motor</SelectItem>
                          <SelectItem value="life">Life</SelectItem>
                          <SelectItem value="medical">Medical</SelectItem>
                          <SelectItem value="property">Property</SelectItem>
                          <SelectItem value="marine">Marine</SelectItem>
                          <SelectItem value="pension">Pension</SelectItem>
                          <SelectItem value="micro_insurance">Micro Insurance</SelectItem>
                          <SelectItem value="group_life">Group Life</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {activeStage === "prospect" && isB2CView && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="nationalIdNumber">National ID / Passport</Label>
                          <Input 
                            id="nationalIdNumber" 
                            defaultValue={editingLead.nationalIdNumber || ''} 
                            onChange={(e) => setEditingLead({...editingLead, nationalIdNumber: e.target.value})} 
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="kraPin">KRA PIN</Label>
                          <Input 
                            id="kraPin" 
                            defaultValue={editingLead.kraPin || ''} 
                            onChange={(e) => setEditingLead({...editingLead, kraPin: e.target.value})} 
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="dateOfBirth">Date of Birth</Label>
                          <Input 
                            id="dateOfBirth" 
                            type="date"
                            defaultValue={editingLead.dateOfBirth || ''} 
                            onChange={(e) => setEditingLead({...editingLead, dateOfBirth: e.target.value})} 
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="gender">Gender</Label>
                          <Select 
                            value={editingLead.gender || ""} 
                            onValueChange={(val) => setEditingLead({...editingLead, gender: val})}
                          >
                            <SelectTrigger id="gender">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="residentialAddress">Residential Address / Building</Label>
                        <Input 
                          id="residentialAddress" 
                          defaultValue={editingLead.residentialAddress || editingLead.physicalAddress || ''} 
                          onChange={(e) => setEditingLead({...editingLead, residentialAddress: e.target.value, physicalAddress: e.target.value})} 
                        />
                      </div>
                      {(editingLead.productLine?.toLowerCase() === 'motor' || editingLead.schemeType?.toLowerCase() === 'motor') && (
                        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="grid gap-2">
                            <Label htmlFor="vehicleRegistration">Vehicle Registration</Label>
                            <Input 
                              id="vehicleRegistration" 
                              placeholder="e.g. KCA 123A"
                              defaultValue={editingLead.vehicleRegistration || ''} 
                              onChange={(e) => setEditingLead({...editingLead, vehicleRegistration: e.target.value})} 
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="vehicleMakeModelYear">Make / Model / Year</Label>
                            <Input 
                              id="vehicleMakeModelYear" 
                              placeholder="e.g. Toyota Axio 2018"
                              defaultValue={editingLead.vehicleMakeModelYear || ''} 
                              onChange={(e) => setEditingLead({...editingLead, vehicleMakeModelYear: e.target.value})} 
                            />
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="coverType">Cover Type</Label>
                          <Input 
                            id="coverType" 
                            defaultValue={editingLead.coverType || ''} 
                            onChange={(e) => setEditingLead({...editingLead, coverType: e.target.value})} 
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="sumInsuredConfirmedKes">Est. Premium (KES)</Label>
                          <Input 
                            id="sumInsuredConfirmedKes" 
                            defaultValue={editingLead.sumInsuredConfirmedKes || editingLead.sumInsuredEstimateKes || ''} 
                            onChange={(e) => setEditingLead({...editingLead, sumInsuredConfirmedKes: e.target.value})} 
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {activeStage === "prospect" && !isB2CView && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="registrationNumber">Cert. of Incorporation</Label>
                          <Input 
                            id="registrationNumber" 
                            defaultValue={editingLead.registrationNumber || ''} 
                            onChange={(e) => setEditingLead({...editingLead, registrationNumber: e.target.value})} 
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="kraPinOrg">KRA PIN (Org)</Label>
                          <Input 
                            id="kraPinOrg" 
                            defaultValue={editingLead.kraPinOrg || ''} 
                            onChange={(e) => setEditingLead({...editingLead, kraPinOrg: e.target.value})} 
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="sectorIndustry">Sector / Industry</Label>
                        <Select 
                          value={editingLead.sectorIndustry || ""} 
                          onValueChange={(val) => setEditingLead({...editingLead, sectorIndustry: val})}
                        >
                          <SelectTrigger id="sectorIndustry">
                            <SelectValue placeholder="Select sector" />
                          </SelectTrigger>
                          <SelectContent>
                            {sectorsData?.map((sec: any) => (
                              <SelectItem key={sec.id} value={sec.name}>{sec.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="physicalAddressOrg">Physical Address</Label>
                        <Input 
                          id="physicalAddressOrg" 
                          defaultValue={editingLead.physicalAddressOrg || ''} 
                          onChange={(e) => setEditingLead({...editingLead, physicalAddressOrg: e.target.value})} 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="existingInsurer">Existing Insurer</Label>
                          <Input 
                            id="existingInsurer" 
                            defaultValue={editingLead.existingInsurer || ''} 
                            onChange={(e) => setEditingLead({...editingLead, existingInsurer: e.target.value})} 
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="existingPremiumKes">Existing Premium (KES)</Label>
                          <Input 
                            id="existingPremiumKes" 
                            defaultValue={editingLead.existingPremiumKes || ''} 
                            onChange={(e) => setEditingLead({...editingLead, existingPremiumKes: e.target.value})} 
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="sumInsuredConfirmedKes">Quoted Premium (KES)</Label>
                        <Input 
                          id="sumInsuredConfirmedKes" 
                          defaultValue={editingLead.sumInsuredConfirmedKes || editingLead.sumInsuredEstimateKes || ''} 
                          onChange={(e) => setEditingLead({...editingLead, sumInsuredConfirmedKes: e.target.value})} 
                        />
                      </div>
                    </>
                  )}

                  {activeStage === "underwriting" && (
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="quotedPremiumKes">Quoted Premium (KES)</Label>
                        <Input 
                          id="quotedPremiumKes" 
                          defaultValue={editingLead.quotedPremiumKes || ''} 
                          onChange={(e) => setEditingLead({...editingLead, quotedPremiumKes: e.target.value})} 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="underwritingDecision">Decision</Label>
                        <Select 
                          value={editingLead.underwritingDecision || "pending"} 
                          onValueChange={(val) => setEditingLead({...editingLead, underwritingDecision: val})}
                        >
                          <SelectTrigger id="underwritingDecision">
                            <SelectValue placeholder="Select decision" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="referred">Referred</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {!isB2CView && (
                        <>
                          <div className="grid gap-2">
                            <Label htmlFor="priorLossRatio">Prior Loss Ratio</Label>
                            <Input 
                              id="priorLossRatio" 
                              defaultValue={editingLead.priorLossRatio || ''} 
                              onChange={(e) => setEditingLead({...editingLead, priorLossRatio: e.target.value})} 
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="yearsOfClaimsHistory">Claims History (Years)</Label>
                            <Input 
                              id="yearsOfClaimsHistory" 
                              type="number"
                              defaultValue={editingLead.yearsOfClaimsHistory || ''} 
                              onChange={(e) => setEditingLead({...editingLead, yearsOfClaimsHistory: parseInt(e.target.value) || 0})} 
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="industryRiskRating">Industry Risk Rating</Label>
                            <Input 
                              id="industryRiskRating" 
                              defaultValue={editingLead.industryRiskRating || ''} 
                              onChange={(e) => setEditingLead({...editingLead, industryRiskRating: e.target.value})} 
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {activeStage === "policy_issued" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="policyStartDateProposed">Start Date</Label>
                        <Input 
                          id="policyStartDateProposed" 
                          type="date"
                          defaultValue={editingLead.policyStartDateProposed ? new Date(editingLead.policyStartDateProposed).toISOString().split('T')[0] : ''} 
                          onChange={(e) => setEditingLead({...editingLead, policyStartDateProposed: new Date(e.target.value).toISOString()})} 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="policyEndDateProposed">Expiry Date</Label>
                        <Input 
                          id="policyEndDateProposed" 
                          type="date"
                          defaultValue={editingLead.policyEndDateProposed ? new Date(editingLead.policyEndDateProposed).toISOString().split('T')[0] : ''} 
                          onChange={(e) => setEditingLead({...editingLead, policyEndDateProposed: new Date(e.target.value).toISOString()})} 
                        />
                      </div>
                    </div>
                  )}

                  {/* Notes / Remarks section */}
                  <div className="grid gap-2">
                    <Label htmlFor="notes">Remarks / Notes</Label>
                    <Textarea 
                      id="notes" 
                      placeholder="Add any specific requirements, observations, or follow-up notes here..."
                      defaultValue={editingLead.notes || editingLead.remarks || ''} 
                      onChange={(e) => setEditingLead({...editingLead, notes: e.target.value})}
                      className="min-h-[100px]"
                    />
                  </div>

                  {/* Attachments Section */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <DocumentAttachmentSection 
                      entityId={editingLead.leadId} 
                      entityType="cic_lead"
                      title="Pipeline Documents" 
                    />
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLead(null)}>Cancel</Button>
            <Button 
              disabled={updateLeadMutation.isPending}
              onClick={() => {
                if (editingLead) {
                  updateLeadMutation.mutate({ 
                    id: editingLead.leadId, 
                    data: {
                      firstName: editingLead.firstName,
                      lastName: editingLead.lastName,
                      organisationName: editingLead.organisationName,
                      phone: editingLead.phone,
                      email: editingLead.email,
                      country: editingLead.country,
                      county: editingLead.county,
                      sourceChannel: editingLead.sourceChannel,
                      productLine: editingLead.productLine,
                      nationalIdNumber: editingLead.nationalIdNumber,
                      coverType: editingLead.coverType,
                      sumInsuredConfirmedKes: editingLead.sumInsuredConfirmedKes,
                      orgType: editingLead.orgType,
                      sectorIndustry: editingLead.sectorIndustry,
                      totalMemberCount: editingLead.totalMemberCount,
                      quotedPremiumKes: editingLead.quotedPremiumKes,
                      underwritingDecision: editingLead.underwritingDecision,
                      priorLossRatio: editingLead.priorLossRatio,
                      yearsOfClaimsHistory: editingLead.yearsOfClaimsHistory,
                      industryRiskRating: editingLead.industryRiskRating,
                      policyStartDateProposed: editingLead.policyStartDateProposed,
                      policyEndDateProposed: editingLead.policyEndDateProposed,
                      primaryContactName: editingLead.primaryContactName,
                      notes: editingLead.notes,
                    } 
                  });
                }
              }}
              style={{ background: "#004E98" }}
            >
              {updateLeadMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
