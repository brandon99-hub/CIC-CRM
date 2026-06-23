import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, ShieldOff, UserCheck, Building, Phone, Info, Briefcase
} from "lucide-react";
import { MarketingPageHeader } from "./marketing-page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  { id: "policy_issued", label: "Policy Issued", description: "Converted policies and active covers." },
  { id: "post_sale", label: "Post-Sale", description: "Renewals, active schemes, and dormant policies." }
];

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
  
  const bdType = user?.bdType || "b2b";
  const defaultSubTab = bdType === "b2c" ? "b2c" : "b2b";
  const [activeSubTab, setActiveSubTab] = useState<"b2c" | "b2b">(defaultSubTab);

  const [pipelineSearch, setPipelineSearch] = useState("");
  const [pipelineSort, setPipelineSort] = useState("newest");
  const [pipelinePage, setPipelinePage] = useState(1);
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
      toast({ title: "Error", description: "Could not update lead stage.", variant: "destructive" });
    }
  });

  const leads = pipelineData?.leads || [];

  const leadsByStage = leads.reduce((acc: any, lead: any) => {
    let uStage = "lead";
    if (lead.pipelineStage === "lead") uStage = "lead";
    else if (lead.pipelineStage === "prospect") uStage = "prospect";
    else if (lead.pipelineStage === "quote_underwriting" || lead.pipelineStage === "proposal_underwriting") uStage = "underwriting";
    else if (lead.pipelineStage === "policy_issued") uStage = "policy_issued";
    else if (lead.pipelineStage === "active" || lead.pipelineStage === "dormant") uStage = "post_sale";
    
    acc[uStage] = (acc[uStage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
                {leadsByStage[stage.id] !== undefined && (
                  <span className={`ml-1 py-0.5 px-2 rounded-full text-xs ${isActive ? "bg-blue-50 text-[#004E98]" : "bg-gray-100 text-gray-500"}`}>
                    {leadsByStage[stage.id]}
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
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50/80 border-b border-gray-100">
                    <TableRow>
                      <TableHead className="font-bold text-gray-700 py-4 pl-6">Name / Organisation</TableHead>
                      
                      {activeStage === "lead" && (
                        <>
                          <TableHead className="font-bold text-gray-700">Pipeline</TableHead>
                          <TableHead className="font-bold text-gray-700">Product</TableHead>
                          <TableHead className="font-bold text-gray-700">Contact</TableHead>
                        </>
                      )}

                      {activeStage === "prospect" && isB2CView && (
                        <>
                          <TableHead className="font-bold text-gray-700">ID Number</TableHead>
                          <TableHead className="font-bold text-gray-700">Cover Type</TableHead>
                          <TableHead className="font-bold text-gray-700">Est. Premium</TableHead>
                        </>
                      )}

                      {activeStage === "prospect" && !isB2CView && (
                        <>
                          <TableHead className="font-bold text-gray-700">Sector</TableHead>
                          <TableHead className="font-bold text-gray-700">Members</TableHead>
                          <TableHead className="font-bold text-gray-700">Est. Premium</TableHead>
                        </>
                      )}

                      {activeStage === "underwriting" && isB2CView && (
                        <>
                          <TableHead className="font-bold text-gray-700">Quoted Premium</TableHead>
                          <TableHead className="font-bold text-gray-700">Decision</TableHead>
                          <TableHead className="font-bold text-gray-700">Decision Date</TableHead>
                        </>
                      )}

                      {activeStage === "underwriting" && !isB2CView && (
                        <>
                          <TableHead className="font-bold text-gray-700">Loss Ratio</TableHead>
                          <TableHead className="font-bold text-gray-700">Decision</TableHead>
                          <TableHead className="font-bold text-gray-700">Decision Date</TableHead>
                        </>
                      )}

                      {activeStage === "policy_issued" && (
                        <>
                          <TableHead className="font-bold text-gray-700">Product</TableHead>
                          <TableHead className="font-bold text-gray-700">Premium</TableHead>
                          <TableHead className="font-bold text-gray-700">Start Date</TableHead>
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

                      <TableHead className="font-bold text-gray-700 w-48">Stage Settings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead: any) => {
                      const isB2CLead = lead.pipelineType === "b2c" || (!lead.organisationName && lead.contactName);
                      return (
                      <TableRow key={lead.leadId} className="hover:bg-blue-50/30 transition-colors">
                        <TableCell className="py-4 pl-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                              {isB2CLead ? <UserCheck className="w-4 h-4 text-blue-600" /> : <Building className="w-4 h-4 text-blue-600" />}
                            </div>
                            <div>
                              <h4 className="font-black text-gray-900 line-clamp-1">
                                {isB2CLead ? lead.contactName : lead.organisationName}
                              </h4>
                              {lead.daysInCurrentStage > 0 && (
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{lead.daysInCurrentStage} days in stage</span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {activeStage === "lead" && (
                          <>
                            <TableCell>
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{isB2CLead ? "B2C" : "B2B"}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-bold text-gray-700">{lead.productLine || lead.schemeType || "—"}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="w-3.5 h-3.5" />
                                <span>{lead.phone || "—"}</span>
                              </div>
                            </TableCell>
                          </>
                        )}

                        {activeStage === "prospect" && isB2CView && (
                          <>
                            <TableCell className="text-sm text-gray-700">{lead.nationalIdNumber || "—"}</TableCell>
                            <TableCell className="text-sm text-gray-700">{lead.coverType || "—"}</TableCell>
                            <TableCell className="text-sm font-black text-emerald-600">{formatKes(lead.sumInsuredEstimateKes)}</TableCell>
                          </>
                        )}

                        {activeStage === "prospect" && !isB2CView && (
                          <>
                            <TableCell className="text-sm text-gray-700">{lead.sectorIndustry || "—"}</TableCell>
                            <TableCell className="text-sm text-gray-700">{lead.totalLives || "—"}</TableCell>
                            <TableCell className="text-sm font-black text-emerald-600">{formatKes(lead.groupPremiumEstimateKes)}</TableCell>
                          </>
                        )}

                        {activeStage === "underwriting" && isB2CView && (
                          <>
                            <TableCell className="text-sm font-black text-emerald-600">{formatKes(lead.quotedPremiumKes)}</TableCell>
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
                            <TableCell className="text-sm font-black text-emerald-600">{formatKes(lead.quotedPremiumKes || lead.groupPremiumEstimateKes)}</TableCell>
                            <TableCell className="text-sm text-gray-700">{lead.policyStartDate ? new Date(lead.policyStartDate).toLocaleDateString() : "—"}</TableCell>
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
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
