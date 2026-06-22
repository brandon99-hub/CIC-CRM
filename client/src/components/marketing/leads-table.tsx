import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Edit,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  Target,
  ArrowRight,
  Calendar,
  Building2,
  User,
  Phone,
  Mail,
  DollarSign,
  FileText,
  Settings
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { Binoculars } from "lucide-react";
import { LeadsFilters } from "./leads-filters";
import { LostReasonModal } from "./lost-reason-modal";
import { MarketingPageHeader } from "./marketing-page-header";
import { DocumentAttachmentSection } from "./document-attachment-section";


interface Lead {
  id: string;
  date: string;
  client: string;
  contactPerson: string;
  contactNumber: string;
  contactEmail: string;
  customerType?: string;
  remarks?: string;
  revenue?: string | number;
  stage: 'prospect' | 'lead' | 'expected_order' | 'sales_won' | 'lost' | 'opportunity' | 'engagement' | 'prospect_registration' | 'prospect_booking' | 'dormant';
  bdId: string;
  marketerId?: string;
  sectorId?: string;
  sharedWithBdId?: string;
  sharedWithMarketerId?: string;
  revenueSplit?: string | number;
  sourceCampaignId?: string;
  createdAt: string;
  updatedAt: string;
  bdName?: string;
  bdEmail?: string;
  sectorName?: string;
}

interface LeadsResponse {
  leads: Lead[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const stageColors = {
  prospect: "bg-[#004E98]/10 text-[#004E98]",
  lead: "bg-[#D0AC01]/10 text-[#bb8114]",
  expected_order: "bg-[#004E98]/10 text-[#004E98]",
  sales_won: "bg-[#01a64e]/10 text-[#006341]",
  lost: "bg-red-100 text-red-800",
  opportunity: "bg-purple-100 text-purple-800",
  engagement: "bg-blue-100 text-blue-800",
  prospect_registration: "bg-indigo-100 text-indigo-800",
  prospect_booking: "bg-orange-100 text-orange-800",
  dormant: "bg-slate-100 text-slate-700",
};

const leadUpdateSchema = z.object({
  date: z.string().min(1, "Date is required"),
  client: z.string().min(1, "Client name is required"),
  contactPerson: z.string().min(1, "Contact person is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  contactEmail: z.string().min(1, "Contact email is required"),
  remarks: z.string().optional(),
  revenue: z.number().min(0, "Revenue cannot be negative").optional().or(z.nan().transform(() => undefined)),
  customerType: z.string().min(1, "Stakeholder type is required"),
  bdId: z.string().optional(),
  sourceCampaignId: z.string().optional(),
});

type LeadUpdateData = z.infer<typeof leadUpdateSchema>;

interface MarketingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  permissions?: string[];
}

interface MarketingLeadsTableProps {
  showMarketerInfo?: boolean;
  selectedMarketer?: string;
  onMarketerChange?: (marketerId: string) => void;
  currentUser?: MarketingUser;
  onAddClick?: () => void;
}

export function MarketingLeadsTable({
  showMarketerInfo = false,
  selectedMarketer = "",
  onMarketerChange,
  currentUser,
  onAddClick
}: MarketingLeadsTableProps) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    search?: string;
    year?: string;
    quarter?: string;
    bdId?: string;
    marketerId?: string;
  }>({});
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);

  // Modal states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isStageChangeOpen, setIsStageChangeOpen] = useState(false);
  const [stageChangeLead, setStageChangeLead] = useState<Lead | null>(null);
  const [newStage, setNewStage] = useState<string>("");
  const [newRevenue, setNewRevenue] = useState<string>("");
  const [isLostReasonModalOpen, setIsLostReasonModalOpen] = useState(false);
  const [lostReasonData, setLostReasonData] = useState<{ lead: Lead, stage: string, revenue?: string } | null>(null);

  // Form setup
  const { register, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm<LeadUpdateData>({
    resolver: zodResolver(leadUpdateSchema),
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    // Get user info from localStorage
    const userData = localStorage.getItem("marketingUser");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleFiltersChange = useCallback((newFilters: {
    search?: string;
    year?: string;
    quarter?: string;
    bdId?: string;
    marketerId?: string;
  }) => {
    setFilters(newFilters);
  }, []);

  const memoizedFilters = useMemo(() => filters, [
    filters.search,
    filters.year,
    filters.quarter,
    filters.bdId,
    filters.marketerId
  ]);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: leadsData, isLoading: leadsLoading } = useQuery<LeadsResponse>({
    queryKey: ["marketing", "leads", { page, memoizedFilters, selectedMarketer }],
    queryFn: async () => {
      const token = localStorage.getItem("marketingToken");
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...(filters.search && { search: filters.search }),
        ...(filters.year && { year: filters.year }),
        ...(filters.quarter && { quarter: filters.quarter }),
        ...(filters.bdId && { bdId: filters.bdId }),
        ...(filters.marketerId && { marketerId: filters.marketerId }),
        ...(selectedMarketer && { marketerId: selectedMarketer }),
      });

      const response = await fetch(`/api/marketing/leads?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to load leads");
      return response.json();
    },
    staleTime: 300000,
  });

  const { data: marketingUsersData, isLoading: usersLoading } = useQuery<{ users: MarketingUser[] }>({
    queryKey: ["marketing", "users", "list"],
    queryFn: async () => {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/users?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to load users");
      return response.json();
    },
    enabled: !!(currentUser?.permissions?.includes("marketing.view_all") || currentUser?.permissions?.includes("admin.view")),
    staleTime: 600000,
  });

  const leads = leadsData?.leads || [];
  const pagination = leadsData?.pagination || { page: 1, limit: 10, total: 0, pages: 0 };
  const marketingUsers = marketingUsersData?.users || [];
  const loading = leadsLoading;

  const { data: campaignsData } = useQuery<{ campaigns: any[] }>({
    queryKey: ["marketing", "campaigns", "list-simple"],
    queryFn: async () => {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/campaigns?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to load campaigns");
      return response.json();
    },
    staleTime: 600000,
  });

  const campaignsList = campaignsData?.campaigns || [];

  // ── Mutations ─────────────────────────────────────────────────────────────
  const editMutation = useMutation({
    mutationFn: async (data: LeadUpdateData) => {
      const token = localStorage.getItem("marketingToken");
      
      // Data Scrubbing: Backend expects UUID or null, not empty string
      const scrubbedData = {
        ...data,
        sourceCampaignId: data.sourceCampaignId === "" ? null : data.sourceCampaignId,
        // Ensure customerType is strictly one of the allowed enums
        customerType: data.customerType || "student"
      };

      const response = await fetch(`/api/marketing/leads/${editingLead?.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(scrubbedData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update lead");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Lead updated successfully" });
      setIsEditOpen(false);
      setEditingLead(null);
      reset();
      queryClient.invalidateQueries({ queryKey: ["marketing", "leads"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/prospects/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete lead");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Lead deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["marketing", "leads"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const stageChangeMutation = useMutation({
    mutationFn: async ({ id, stage, revenue }: { id: string, stage: string, revenue?: number }) => {
      const token = localStorage.getItem("marketingToken");
      const isPromotingToProspect = ['prospect', 'opportunity', 'engagement', 'prospect_registration', 'prospect_booking'].includes(stage);
      let url = `/api/marketing/leads/${id}/stage`;
      let method = "PUT";

      if (isPromotingToProspect) {
        url = `/api/marketing/leads/${id}/promote`;
        method = "POST";
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stage, revenue }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update lead stage");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Lead stage updated successfully" });
      setIsStageChangeOpen(false);
      setStageChangeLead(null);
      setNewStage("");
      setNewRevenue("");
      queryClient.invalidateQueries({ queryKey: ["marketing", "leads"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "prospects"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const lostReasonMutation = useMutation({
    mutationFn: async ({ id, revenue, lostReason }: { id: string, revenue?: number, lostReason: string }) => {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/prospects/${id}/stage`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stage: 'lost', revenue, lostReason }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to mark lead as lost");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Lead marked as lost successfully" });
      setIsLostReasonModalOpen(false);
      setLostReasonData(null);
      queryClient.invalidateQueries({ queryKey: ["marketing", "leads"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    deleteMutation.mutate(id);
  };

  const handleEdit = async (data: LeadUpdateData) => {
    editMutation.mutate(data);
  };

  const onInvalid = (errs: any) => {
    console.error("Validation Errors:", errs);
    const errorMessages = Object.entries(errs)
      .map(([field, error]: [string, any]) => `${field}: ${error.message}`)
      .join(", ");

    toast({
      title: "Validation Error",
      description: `Please check: ${errorMessages}`,
      variant: "destructive",
    });
  };

  const handleStageChange = async () => {
    if (!stageChangeLead || !newStage) return;
    stageChangeMutation.mutate({
      id: stageChangeLead.id,
      stage: newStage,
      revenue: newRevenue ? parseFloat(newRevenue) : undefined,
    });
  };

  const handleStageSelection = (stage: string, lead: Lead) => {
    if (stage === 'lost') {
      setLostReasonData({
        lead,
        stage: 'lost',
        revenue: newRevenue
      });
      setIsLostReasonModalOpen(true);
      setIsStageChangeOpen(false);
    } else {
      setNewStage(stage);
    }
  };

  const handleLostReasonSubmit = async (reason: string) => {
    if (!lostReasonData) return;
    lostReasonMutation.mutate({
      id: lostReasonData.lead.id,
      revenue: lostReasonData.revenue ? parseFloat(lostReasonData.revenue) : undefined,
      lostReason: reason,
    });
  };

  const openEditDialog = (lead: Lead) => {
    setEditingLead(lead);
    const dateValue = lead.date.includes('T')
      ? lead.date.split('T')[0]
      : lead.date.split(' ')[0];
    setValue("date", dateValue);
    setValue("client", lead.client);
    setValue("contactPerson", lead.contactPerson);
    setValue("contactNumber", lead.contactNumber);
    setValue("contactEmail", lead.contactEmail);
    setValue("remarks", lead.remarks || "");
    setValue("revenue", typeof lead.revenue === 'string' ? parseFloat(lead.revenue) : lead.revenue || 0);
    setValue("customerType", lead.customerType || "student");
    setValue("bdId", lead.marketerId || lead.bdId || "");
    setValue("sourceCampaignId", lead.sourceCampaignId || "");
    setIsEditOpen(true);
  };

  const openStageChangeDialog = (lead: Lead) => {
    setStageChangeLead(lead);
    setNewRevenue(typeof lead.revenue === 'string' ? lead.revenue : lead.revenue?.toString() || "");
    setNewStage(lead.stage);
    setIsStageChangeOpen(true);
  };

  const formatCurrency = (amount?: string | number) => {
    if (!amount) return "N/A";
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount)) return "N/A";
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(numericAmount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy");
  };


  return (
    <div className="space-y-6">
      <MarketingPageHeader
        title="Leads"
        subtitle="Manage qualified leads and interested clients triaged from cases."
        icon={Users}
        onSearchChange={(val) => handleFiltersChange({ ...filters, search: val })}
        searchValue={filters.search || ""}
        searchPlaceholder="Search leads by client name..."
        stackLayout={true}
        actionButton={onAddClick ? {
          label: "Add Lead",
          icon: Users,
          onClick: onAddClick
        } : undefined}
      >
        <LeadsFilters
          onFiltersChange={handleFiltersChange}
          showMarketerInfo={showMarketerInfo}
        />
      </MarketingPageHeader>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="border-t">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  {user?.role === 'admin' && showMarketerInfo && (
                    <TableHead className="font-semibold text-gray-700">Marketer</TableHead>
                  )}
                  <TableHead className="font-semibold text-gray-700">Date</TableHead>
                  <TableHead className="font-semibold text-gray-700">Client</TableHead>
                  <TableHead className="font-semibold text-gray-700">Contact Details</TableHead>
                  <TableHead className="font-semibold text-gray-700">Revenue</TableHead>
                  <TableHead className="font-semibold text-gray-700">Remarks</TableHead>
                  <TableHead className="font-semibold text-gray-700">Stage</TableHead>
                  <TableHead className="font-semibold text-gray-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                     <TableCell colSpan={(user?.permissions?.includes("marketing.view_all") || user?.permissions?.includes("admin.view")) && showMarketerInfo ? 8 : 7} className="text-center py-12">
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="h-5 w-5 animate-spin text-[#004E98]" />
                        <span className="text-sm text-gray-500 font-medium">Loading leads...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : Array.isArray(leads) && leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={(user?.permissions?.includes("marketing.view_all") || user?.permissions?.includes("admin.view")) && showMarketerInfo ? 8 : 7} className="text-center py-12">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <Users className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">No leads found</p>
                        <p className="text-sm text-gray-400">Start by adding your first lead</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow key={lead.id} className="hover:bg-gray-50/50">
                      {(user?.permissions?.includes("marketing.view_all") || user?.permissions?.includes("admin.view")) && showMarketerInfo && (
                        <TableCell className="font-medium text-gray-900">
                          <div>
                            <p className="text-sm font-semibold">{lead.bdName || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{lead.bdEmail || ''}</p>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="font-medium text-gray-900">{formatDate(lead.date)}</TableCell>
                      <TableCell className="font-semibold text-gray-900">{lead.client}</TableCell>
                      <TableCell className="max-w-xs truncate text-gray-600">
                        <div className="space-y-1">
                          <div className="font-medium">{lead.contactPerson}</div>
                          <div className="text-sm text-gray-500">{lead.contactNumber}</div>
                          <div className="text-sm text-gray-500">{lead.contactEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">{formatCurrency(lead.revenue)}</TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="max-w-[150px] cursor-help">
                                <p className="text-sm text-gray-700 truncate">
                                  {lead.remarks || 'No remarks'}
                                </p>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-white p-4 shadow-xl border-gray-100 max-w-sm rounded-xl">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-[#004E98] font-bold text-xs uppercase tracking-wider">
                                  <FileText className="h-3 w-3" />
                                  Lead Remarks
                                </div>
                                <p className="text-sm text-gray-600 leading-relaxed italic">
                                  "{lead.remarks || 'No remarks provided'}"
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${stageColors[lead.stage]} font-medium`}>
                          {lead.stage.replace("_", " ").toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-gray-100"
                                  onClick={() => openEditDialog(lead)}
                                >
                                  <Edit className="h-4 w-4 text-gray-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-[#004E98]/10"
                                  onClick={() => openStageChangeDialog(lead)}
                                >
                                  <ArrowRight className="h-4 w-4 text-[#004E98]" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Promote</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-red-50 text-red-500 hover:text-red-600"
                                  onClick={() => handleDelete(lead.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} results
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.pages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Lead Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-6">
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-gray-900">
              <div className="p-2 bg-[#004E98]/10 rounded-lg">
                <Edit className="h-6 w-6 text-[#004E98]" />
              </div>
              Edit Lead Information
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-base">
              Update the lead details and contact information below. All fields marked with * are required.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(handleEdit, onInvalid)} className="space-y-6">
            {/* Basic Information Section */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-[#004E98] rounded-full"></div>
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="date" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date *
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    {...register("date")}
                    className={`h-11 ${errors.date ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-[#004E98] focus:ring-[#004E98]"}`}
                  />
                  {errors.date && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                      {errors.date.message}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="client" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Client Name *
                  </Label>
                  <Input
                    id="client"
                    {...register("client")}
                    placeholder="Enter client name"
                    className={`h-11 ${errors.client ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-[#004E98] focus:ring-[#004E98]"}`}
                  />
                  {errors.client && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                      {errors.client.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Stakeholder Identity Section */}
            <div className="bg-amber-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-[#bb8114] rounded-full"></div>
                Stakeholder Identity
              </h3>
              <div className="space-y-3">
                <Label htmlFor="customerType" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Stakeholder Type *
                </Label>
                <Select
                  value={watch("customerType") || ""}
                  onValueChange={(value) => setValue("customerType", value)}
                >
                  <SelectTrigger className={`h-11 ${errors.customerType ? "border-red-500 focus:border-red-500" : "focus:border-[#004E98]"}`}>
                    <SelectValue placeholder="Select stakeholder type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student (Individual)</SelectItem>
                    <SelectItem value="institution">Institution (Partner)</SelectItem>
                    <SelectItem value="organization">Organization (Partner)</SelectItem>
                    <SelectItem value="employer">Employer (Partner)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.customerType && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.customerType.message}
                  </p>
                )}
                <p className="text-xs text-gray-500">Categorizing the stakeholder ensures they follow the correct pipeline stages.</p>
              </div>
            </div>


            {/* Contact Information Section */}
            <div className="bg-[#004E98]/5 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-[#004E98] rounded-full"></div>
                Contact Information
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="contactPerson" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Contact Person *
                  </Label>
                  <Input
                    id="contactPerson"
                    {...register("contactPerson")}
                    placeholder="Enter contact person name"
                    className={`h-11 ${errors.contactPerson ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-[#004E98] focus:ring-[#004E98]"}`}
                  />
                  {errors.contactPerson && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                      {errors.contactPerson.message}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="contactNumber" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Contact Number *
                  </Label>
                  <Input
                    id="contactNumber"
                    {...register("contactNumber")}
                    placeholder="Enter phone number"
                    className={`h-11 ${errors.contactNumber ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-[#004E98] focus:ring-[#004E98]"}`}
                  />
                  {errors.contactNumber && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                      {errors.contactNumber.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Label htmlFor="contactEmail" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Contact Email *
                </Label>
                <Input
                  id="contactEmail"
                  type="email"
                  {...register("contactEmail")}
                  placeholder="Enter email address"
                  className={`h-11 ${errors.contactEmail ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-[#004E98] focus:ring-[#004E98]"}`}
                />
                {errors.contactEmail && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.contactEmail.message}
                  </p>
                )}
              </div>
            </div>

            {/* Financial Information Section */}
            <div className="bg-[#01a64e]/5 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-[#01a64e]/50 rounded-full"></div>
                Financial Information
              </h3>
              <div className="space-y-3">
                <Label htmlFor="revenue" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Revenue (KES)
                </Label>
                <Input
                  id="revenue"
                  type="number"
                  step="0.01"
                  {...register("revenue", { valueAsNumber: true })}
                  placeholder="Enter revenue amount"
                  className={`h-11 ${errors.revenue ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-[#01a64e] focus:ring-[#01a64e]"}`}
                />
                {errors.revenue && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.revenue.message}
                  </p>
                )}
              </div>
            </div>

            {(currentUser?.permissions?.includes("marketing.view_all") || currentUser?.permissions?.includes("admin.view")) && (
              <div className="bg-red-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="w-1 h-6 bg-red-500 rounded-full"></div>
                  User Assignment
                  <Badge variant="secondary" className="text-xs">Admin Only</Badge>
                </h3>
                <div className="space-y-3">
                  <Label htmlFor="bdId" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Assigned User
                  </Label>
                  <Select
                    value={watch("bdId") || ""}
                    onValueChange={(value) => setValue("bdId", value || "")}
                    disabled={usersLoading}
                  >
                    <SelectTrigger className="h-11 focus:border-red-500 focus:ring-red-500">
                      <SelectValue placeholder={usersLoading ? "Loading users..." : "Select assigned user (optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      {marketingUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{user.firstName} {user.lastName}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.bdId && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                      {errors.bdId.message}
                    </p>
                  )}
                <p className="text-xs text-gray-500">
                  Change the user assigned to this lead. Leave empty to keep current assignment.
                </p>
              </div>
            </div>
          )}

          <div className="bg-blue-50/50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-[#004E98] rounded-full"></div>
              Campaign Attribution
            </h3>
            <div className="space-y-3">
              <Label htmlFor="sourceCampaignId" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Target className="h-4 w-4 text-[#004E98]" />
                Source Campaign <span className="text-gray-400 font-normal ml-1">(Optional)</span>
              </Label>
              <Select
                value={watch("sourceCampaignId") || ""}
                onValueChange={(value) => setValue("sourceCampaignId", value === "none" ? "" : value)}
              >
                <SelectTrigger className="h-11 focus:border-[#004E98] focus:ring-[#004E98]">
                  <SelectValue placeholder="Which campaign led to this lead?" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-100 shadow-2xl">
                  <SelectItem value="none">None / Direct</SelectItem>
                  {campaignsList.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.channel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-gray-400 italic">Linking this helps track the campaign's return on investment.</p>
            </div>
          </div>

            {/* Additional Information Section */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-gray-500 rounded-full"></div>
                Additional Information
              </h3>
              <div className="space-y-3">
                <Label htmlFor="remarks" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Remarks
                </Label>
                <Textarea
                  id="remarks"
                  {...register("remarks")}
                  rows={4}
                  placeholder="Enter any additional remarks or notes..."
                  className="focus:border-gray-500 focus:ring-gray-500"
                />
              </div>
            </div>

            {editingLead && (
              <DocumentAttachmentSection
                entityId={editingLead.id}
                entityType="lead"
                title="Lead attachments"
              />
            )}

            <DialogFooter className="pt-6 border-t border-gray-200">
              <div className="flex gap-3 w-full">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  className="flex-1 h-11"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="flex-1 h-11 bg-[#004E98] hover:bg-[#003d7a]"
                >
                  {editMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating Lead...
                    </>
                  ) : (
                    <>
                      <Edit className="mr-2 h-4 w-4" />
                      Update Lead
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stage Change Dialog */}
      <Dialog open={isStageChangeOpen} onOpenChange={setIsStageChangeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-6">
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-gray-900">
              <div className="p-2 bg-[#004E98]/10 rounded-lg">
                <Target className="h-6 w-6 text-[#004E98]" />
              </div>
              Change Lead Stage
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-base">
              Update the stage for <strong className="text-gray-900">{stageChangeLead?.client}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Current Stage Display */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Current Stage:</span>
                <Badge className={`${stageColors[stageChangeLead?.stage || 'prospect']} font-medium px-3 py-1`}>
                  {(stageChangeLead?.stage || 'prospect').replace("_", " ").toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Stage Selection */}
            <div className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="newStage" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  New Stage *
                </Label>
                <Select value={newStage} onValueChange={(value) => handleStageSelection(value, stageChangeLead!)}>
                  <SelectTrigger className="h-11 focus:border-[#004E98] focus:ring-[#004E98]">
                    <SelectValue placeholder="Select new stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#D0AC01]/10 text-[#bb8114] text-xs">LEAD</Badge>
                        <span>Qualified Lead</span>
                      </div>
                    </SelectItem>
                    {stageChangeLead?.customerType === 'student' ? (
                      <>
                        <SelectItem value="prospect_registration">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-indigo-100 text-indigo-800 text-xs">REGISTRATION</Badge>
                            <span>Prospect Registration</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="prospect_booking">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-orange-100 text-orange-800 text-xs">BOOKING</Badge>
                            <span>Prospect Booking</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="dormant">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-slate-100 text-slate-700 text-xs">DORMANT</Badge>
                            <span>Dormant Student</span>
                          </div>
                        </SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="opportunity">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-purple-100 text-purple-800 text-xs">OPPORTUNITY</Badge>
                            <span>Initial prospect</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="engagement">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-[#004E98]/10 text-[#004E98] text-xs">ENGAGEMENT</Badge>
                            <span>Active engagement</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="expected_order">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-[#004E98]/10 text-[#004E98] text-xs">EXPECTED ORDER</Badge>
                            <span>Expected order</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="sales_won">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-[#01a64e]/10 text-[#006341] text-xs">SALES WON</Badge>
                            <span>Project won</span>
                          </div>
                        </SelectItem>
                      </>
                    )}
                    <SelectItem value="lost">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-100 text-red-800 text-xs">LOST</Badge>
                        <span>Project lost</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="newRevenue" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Revenue (KES) - Optional
                </Label>
                <Input
                  id="newRevenue"
                  type="number"
                  step="0.01"
                  value={newRevenue}
                  onChange={(e) => setNewRevenue(e.target.value)}
                  placeholder="Enter revenue amount"
                  className="h-11 focus:border-[#004E98] focus:ring-[#004E98]"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-6 border-t border-gray-200">
            <div className="flex gap-3 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsStageChangeOpen(false)}
                className="flex-1 h-11"
              >
                Cancel
              </Button>
              <Button
                onClick={handleStageChange}
                disabled={stageChangeMutation.isPending || !newStage}
                className="flex-1 h-11 bg-[#004E98] hover:bg-[#003d7a]"
              >
                {stageChangeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Update Stage
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lost Reason Modal */}
      {
        lostReasonData && (
          <LostReasonModal
            isOpen={isLostReasonModalOpen}
            onClose={() => {
              setIsLostReasonModalOpen(false);
              setLostReasonData(null);
            }}
            onSubmit={handleLostReasonSubmit}
            projectName={lostReasonData.lead.client}
            projectRevenue={lostReasonData.revenue || lostReasonData.lead.revenue}
          />
        )
      }
    </div >
  );
}
