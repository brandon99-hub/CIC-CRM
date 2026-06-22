import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  User,
  Users,
  Phone,
  Mail,
  Building2,
  Settings,
  FileText,
  Calendar,
  DollarSign,
  Target,
  AlertCircle,
  Plus,
  Filter,
  ArrowRight,
  Binoculars
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast"; // Changed from { toast } to { useToast }
import { ProspectFilters } from "./prospect-filters";
import { LostReasonModal } from "./lost-reason-modal";
import { MarketingPageHeader } from "./marketing-page-header";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";
import { DocumentAttachmentSection } from "./document-attachment-section";


interface Prospect {
  id: string;
  date: string;
  client: string;
  contactPerson: string;
  contactNumber: string;
  contactEmail: string;
  systemInPlace: string;
  needAvailability: string;
  currentVendor?: string;
  remarks?: string;
  revenue?: number;
  customerType?: string;
  stage: 'prospect' | 'lead' | 'expected_order' | 'sales_won' | 'lost' | 'opportunity' | 'engagement' | 'prospect_registration' | 'prospect_booking' | 'dormant';
  sectorId: string;
  bdId: string;
  marketerId?: string;
  createdAt: string;
  updatedAt: string;
  sectorName?: string;
  bdName?: string;
  bdEmail?: string;
  sourceCampaignId?: string;
}

interface Sector {
  id: string;
  name: string;
  description?: string;
}

interface ProspectsResponse {
  prospects: Prospect[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    totalPages: number; // Added for consistency with new query
  };
}

const prospectUpdateSchema = z.object({
  date: z.string().min(1, "Date is required"),
  client: z.string().min(1, "Client name is required"),
  contactPerson: z.string().min(1, "Contact person is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  contactEmail: z.string().min(1, "Contact email is required"),
  currentVendor: z.string().optional(),
  remarks: z.string().optional(),
  revenue: z.number().min(0, "Revenue cannot be negative").optional().or(z.nan().transform(() => undefined)),
  stage: z.enum(['prospect', 'lead', 'expected_order', 'sales_won', 'lost', 'opportunity', 'engagement', 'prospect_registration', 'prospect_booking', 'dormant']),
  sectorId: z.string().optional(),
  bdId: z.string().optional(),
  customerType: z.string().optional(),
  sourceCampaignId: z.string().optional(),
});

type ProspectUpdateData = z.infer<typeof prospectUpdateSchema>;

const stageColors: Record<Prospect['stage'], string> = {
  prospect: "bg-[#004E98]/10 text-[#004E98]",
  lead: "bg-[#01a64e]/10 text-[#006341]",
  expected_order: "bg-[#D0AC01]/10 text-[#bb8114]",
  sales_won: "bg-[#004E98]/10 text-[#004E98]",
  lost: "bg-red-100 text-red-800",
  opportunity: "bg-purple-100 text-purple-800",
  engagement: "bg-blue-100 text-blue-800",
  prospect_registration: "bg-indigo-100 text-indigo-800",
  prospect_booking: "bg-orange-100 text-orange-800",
  dormant: "bg-slate-100 text-slate-700",
};

const stageLabels: Record<Prospect['stage'], string> = {
  prospect: "Prospect",
  lead: "Lead",
  expected_order: "Expected Order",
  sales_won: "Sales Won",
  lost: "Lost",
  opportunity: "Opportunity",
  engagement: "Engagement",
  prospect_registration: "Prospect Registration",
  prospect_booking: "Prospect Booking",
  dormant: "Dormant Student",
};

interface MarketingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  permissions?: string[];
  bdType?: 'b2b' | 'b2c' | 'both';
}

export interface MarketingProspectsTableProps {
  showMarketerInfo?: boolean;
  selectedMarketer?: string;
  onMarketerChange?: (marketerId: string) => void;
  currentUser?: MarketingUser;
  onAddClick?: () => void;
  customerTypeFilter?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

interface Filters {
  search?: string;
  year?: string;
  quarter?: string;
  bdId?: string;
  sectorId?: string;
  stage?: string;
  marketer?: string; // Added for consistency with new query
  dateFrom?: string; // Added for consistency with new query
  dateTo?: string; // Added for consistency with new query
  sector?: string; // Added for consistency with new query
}

export function MarketingProspectsTable({
  showMarketerInfo = false,
  selectedMarketer,
  onMarketerChange,
  currentUser,
  onAddClick,
  customerTypeFilter,
  activeTab,
  onTabChange,
}: MarketingProspectsTableProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filters, setFilters] = useState<Filters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [isStageChangeOpen, setIsStageChangeOpen] = useState(false);
  const [stageChangeProspect, setStageChangeProspect] = useState<Prospect | null>(null);
  const [newStage, setNewStage] = useState("");
  const [newRevenue, setNewRevenue] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [prospectToDelete, setProspectToDelete] = useState<string | null>(null);
  const [isLostReasonModalOpen, setIsLostReasonModalOpen] = useState(false);
  const [lostReasonData, setLostReasonData] = useState<{
    prospect: Prospect;
    stage: string;
    revenue?: string; // Changed to optional
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ProspectUpdateData>({
    resolver: zodResolver(prospectUpdateSchema),
  });

  // Queries
  const { data: prospectsData, isLoading: loading, error: prospectsError } = useQuery<ProspectsResponse>({
    queryKey: ["marketing", "prospects", filters, currentPage, selectedMarketer, customerTypeFilter],
    queryFn: async () => {
      const token = localStorage.getItem("marketingToken");
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.sectorId) params.append("sectorId", filters.sectorId);
      if (filters.bdId) params.append("bdId", filters.bdId);
      if (filters.stage) params.append("stage", filters.stage);
      if (filters.year) params.append("year", filters.year);
      if (filters.quarter) params.append("quarter", filters.quarter);
      if ((currentUser?.permissions?.includes("marketing.view_all") || currentUser?.permissions?.includes("admin.view")) && selectedMarketer) {
        params.append("bdId", selectedMarketer);
      }
      if (customerTypeFilter) params.append("customerType", customerTypeFilter);
      params.append("page", currentPage.toString());
      params.append("limit", "10");

      const res = await fetch(`/api/marketing/prospects?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load prospects");
      return res.json();
    },
    staleTime: 300000, // 5 minutes
  });

  const prospects = prospectsData?.prospects || [];
  const totalPages = prospectsData?.pagination?.totalPages || 1;
  const isStudentPipeline = activeTab === "students" || customerTypeFilter === "student";

  const { data: sectorsData } = useQuery<{ sectors: Sector[] }>({
    queryKey: ["marketing", "sectors", "list"],
    queryFn: async () => {
      const token = localStorage.getItem("marketingToken");
      const res = await fetch("/api/marketing/sectors", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load sectors");
      return res.json();
    },
    staleTime: 600000, // 10 minutes
  });

  const sectors = sectorsData?.sectors || [];

  const { data: marketingUsersData, isLoading: usersLoading } = useQuery<{ users: MarketingUser[] }>({
    queryKey: ["marketing", "users", "list"],
    queryFn: async () => {
      const token = localStorage.getItem("marketingToken");
      const res = await fetch("/api/marketing/users?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load marketing users");
      return res.json();
    },
    enabled: !!(currentUser?.permissions?.includes("marketing.view_all") || currentUser?.permissions?.includes("admin.view")),
    staleTime: 600000,
  });

  const marketingUsers = marketingUsersData?.users || [];

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

  // Mutations
  const editMutation = useMutation({
    mutationFn: async (data: ProspectUpdateData) => {
      const token = localStorage.getItem("marketingToken");
      
      // Sanitize UUID fields (convert empty strings to null)
      const sanitizedData = {
        ...data,
        sectorId: data.sectorId === "" ? null : data.sectorId,
        bdId: data.bdId === "" ? null : data.bdId,
        sourceCampaignId: data.sourceCampaignId === "" ? null : data.sourceCampaignId,
      };

      const res = await fetch(`/api/marketing/prospects/${editingProspect?.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(sanitizedData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update prospect");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Prospect updated successfully" });
      setIsEditOpen(false);
      setEditingProspect(null);
      reset();
      queryClient.invalidateQueries({ queryKey: ["marketing", "prospects"] });
      // Also invalidate stats if they exist in dashboard
      queryClient.invalidateQueries({ queryKey: ["marketing", "stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const stageChangeMutation = useMutation({
    mutationFn: async ({ id, stage, revenue }: { id: string; stage: string; revenue?: number }) => {
      const token = localStorage.getItem("marketingToken");
      const res = await fetch(`/api/marketing/prospects/${id}/stage`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stage, revenue }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update prospect stage");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Prospect stage updated successfully" });
      setIsStageChangeOpen(false);
      setStageChangeProspect(null);
      setNewStage("");
      setNewRevenue("");
      queryClient.invalidateQueries({ queryKey: ["marketing", "prospects"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "leads"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("marketingToken");
      const res = await fetch(`/api/marketing/prospects/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete prospect");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Prospect deleted successfully" });
      setIsDeleteDialogOpen(false);
      setProspectToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["marketing", "prospects"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const lostReasonMutation = useMutation({
    mutationFn: async ({ id, revenue, lostReason }: { id: string; revenue?: number; lostReason: string }) => {
      const token = localStorage.getItem("marketingToken");
      const res = await fetch(`/api/marketing/prospects/${id}/stage`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stage: 'lost',
          revenue,
          lostReason,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to mark prospect as lost");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Prospect marked as lost successfully" });
      setIsLostReasonModalOpen(false);
      setLostReasonData(null);
      queryClient.invalidateQueries({ queryKey: ["marketing", "prospects"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleFiltersChange = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  }, []);


  const handleEdit = async (data: ProspectUpdateData) => {
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
    if (!stageChangeProspect || !newStage) return;
    stageChangeMutation.mutate({
      id: stageChangeProspect.id,
      stage: newStage,
      revenue: newRevenue ? parseFloat(newRevenue) : undefined
    });
  };

  const confirmDelete = (prospectId: string) => {
    setProspectToDelete(prospectId);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!prospectToDelete) return;
    deleteMutation.mutate(prospectToDelete);
  };

  const openEditDialog = (prospect: Prospect) => {
    setEditingProspect(prospect);
    // Fix date formatting - handle both ISO string and date string formats
    const dateValue = prospect.date.includes('T')
      ? prospect.date.split('T')[0]
      : prospect.date.split(' ')[0];
    setValue("date", dateValue);
    setValue("client", prospect.client);
    setValue("contactPerson", prospect.contactPerson);
    setValue("contactNumber", prospect.contactNumber);
    setValue("contactEmail", prospect.contactEmail);
    setValue("currentVendor", prospect.currentVendor || "");
    setValue("remarks", prospect.remarks || "");
    setValue("revenue", prospect.revenue || 0);
    setValue("stage", prospect.stage);
    setValue("sectorId", prospect.sectorId || "");
    setValue("bdId", prospect.marketerId || prospect.bdId || "");
    setValue("sourceCampaignId", prospect.sourceCampaignId || "");
    setValue("customerType", prospect.customerType || "institution");
    setIsEditOpen(true);
  };

  const openStageChangeDialog = (prospect: Prospect) => {
    setStageChangeProspect(prospect);
    setNewRevenue(typeof prospect.revenue === 'string' ? prospect.revenue : prospect.revenue?.toString() || "");
    setNewStage(prospect.stage);
    setIsStageChangeOpen(true);
  };

  const handleStageSelection = (stage: string, prospect: Prospect) => {
    if (stage === 'lost') {
      // Open lost reason modal instead of stage change dialog
      setLostReasonData({
        prospect,
        stage: 'lost',
        revenue: newRevenue
      });
      setIsLostReasonModalOpen(true);
      setIsStageChangeOpen(false);
    } else {
      // Continue with normal stage change
      setNewStage(stage);
    }
  };

  const handleLostReasonSubmit = async (reason: string) => {
    if (!lostReasonData) return;
    lostReasonMutation.mutate({
      id: lostReasonData.prospect.id,
      revenue: lostReasonData.revenue ? parseFloat(lostReasonData.revenue) : undefined,
      lostReason: reason
    });
  };



  return (
    <div className="space-y-6">
      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Prospect"
        description="Are you sure you want to delete this prospect? This action cannot be undone."
      />

      <MarketingPageHeader
        title="Prospects"
        subtitle="Track and manage potential clients and opportunities."
        icon={Binoculars}
        onSearchChange={(val) => handleFiltersChange({ ...filters, search: val })}
        searchValue={filters.search || ""}
        searchPlaceholder="Search prospects by client name..."
        stackLayout={true}
        actionButton={onAddClick ? {
          label: "Add Prospect",
          icon: Plus,
          onClick: onAddClick
        } : undefined}
      >
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className={`h-10 ${showFilters ? 'bg-gray-100 border-[#004E98] text-[#004E98]' : 'border-gray-200'}`}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </MarketingPageHeader>

      {(!currentUser?.bdType || currentUser.bdType === 'both') && (
        <div className="mb-6 px-4">
          <div className="flex items-center space-x-1 bg-gray-100/50 p-1 rounded-xl w-fit border border-gray-200/50 shadow-sm backdrop-blur-sm">
            <Button
              variant={activeTab === "students" ? "default" : "ghost"}
              size="sm"
              onClick={() => onTabChange?.("students")}
              className={cn(
                "rounded-lg px-6 font-bold transition-all duration-300",
                activeTab === "students" 
                  ? "bg-[#004E98] text-white shadow-md shadow-blue-900/20" 
                  : "text-gray-500 hover:text-gray-900 hover:bg-white"
              )}
            >
              Students
            </Button>
            <Button
              variant={activeTab === "business" ? "default" : "ghost"}
              size="sm"
              onClick={() => onTabChange?.("business")}
              className={cn(
                "rounded-lg px-6 font-bold transition-all duration-300",
                activeTab === "business" 
                  ? "bg-[#004E98] text-white shadow-md shadow-blue-900/20" 
                  : "text-gray-500 hover:text-gray-900 hover:bg-white"
              )}
            >
              Business
            </Button>
          </div>
        </div>
      )}

      {showFilters && (
        <ProspectFilters
          onFiltersChange={handleFiltersChange}
          showMarketerInfo={showMarketerInfo}
        />
      )}

      {/* Prospects Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="border-t">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#004E98]" />
          </div>
        ) : prospects.length === 0 ? (
          <div className="text-center py-12 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
            <div className="bg-white p-3 rounded-full w-fit mx-auto mb-4 shadow-sm border border-gray-100">
              <User className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No prospects found</h3>
            <p className="text-gray-500">
              {filters.search ? "No prospects match your search criteria." : "Get started by adding your first prospect."}
            </p>
          </div>
        ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="font-semibold text-gray-700">Date</TableHead>
                    <TableHead className="font-semibold text-gray-700">Client</TableHead>
                    <TableHead className="font-semibold text-gray-700">Marketer</TableHead>
                    {!isStudentPipeline && <TableHead className="font-semibold text-gray-700">Contact Person</TableHead>}
                    <TableHead className="font-semibold text-gray-700">Contact Info</TableHead>
                    <TableHead className="font-semibold text-gray-700">Stage</TableHead>
                    <TableHead className="font-semibold text-gray-700">Revenue</TableHead>
                    {!isStudentPipeline && <TableHead className="font-semibold text-gray-700">Sector</TableHead>}
                    <TableHead className="font-semibold text-gray-700">Remarks</TableHead>
                    <TableHead className="text-center font-semibold text-gray-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(prospects) && prospects.map((prospect: Prospect) => (
                    <TableRow key={prospect.id}>
                      <TableCell className="text-gray-600">
                        {format(new Date(prospect.date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">{prospect.client}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-[#004E98]" />
                          <span className="text-sm font-medium text-gray-700">
                            {prospect.bdName || 'Unknown'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {prospect.bdEmail || ''}
                        </div>
                      </TableCell>
                      {!isStudentPipeline && (
                        <TableCell>
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-2 text-gray-400" />
                            {prospect.contactPerson}
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            <Phone className="h-3 w-3 mr-1 text-gray-400" />
                            {prospect.contactNumber}
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail className="h-3 w-3 mr-1 text-gray-400" />
                            {prospect.contactEmail}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={stageColors[prospect.stage]}>
                          {stageLabels[prospect.stage]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {prospect.revenue ? `KSH ${prospect.revenue.toLocaleString()}` : "N/A"}
                      </TableCell>
                      {!isStudentPipeline && (
                        <TableCell>
                          <div className="flex items-center">
                            <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                            {prospect.sectorName || "Unknown"}
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="max-w-[150px] cursor-help">
                                <p className="text-sm text-gray-700 truncate">
                                  {prospect.remarks || 'No remarks'}
                                </p>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-white p-4 shadow-xl border-gray-100 max-w-sm rounded-xl">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-[#004E98] font-bold text-xs uppercase tracking-wider">
                                  <FileText className="h-3 w-3" />
                                  Prospect Remarks
                                </div>
                                <p className="text-sm text-gray-600 leading-relaxed italic">
                                  "{prospect.remarks || 'No remarks provided'}"
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center space-x-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-gray-100"
                                  onClick={() => openEditDialog(prospect)}
                                >
                                  <Edit className="h-4 w-4 text-gray-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-white p-2 shadow-lg border-gray-100 rounded-md">
                                <p className="text-xs font-medium">Edit Prospect</p>
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
                                  onClick={() => openStageChangeDialog(prospect)}
                                >
                                  <ArrowRight className="h-4 w-4 text-[#004E98]" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-white p-2 shadow-lg border-gray-100 rounded-md">
                                <p className="text-xs font-medium text-[#004E98]">Promote to Lead</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => confirmDelete(prospect.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-white p-2 shadow-lg border-gray-100 rounded-md">
                                <p className="text-xs font-medium text-red-600">Delete Prospect</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#004E98]/10 rounded-lg">
                <Edit className="h-5 w-5 text-[#004E98]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-gray-900">Edit Prospect</DialogTitle>
                <DialogDescription className="text-gray-600">
                  Update the prospect information and details.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleEdit, onInvalid)} className="space-y-6">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <div className="w-1 h-6 bg-[#004E98] rounded-full"></div>
                <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-date" className="text-sm font-medium text-gray-700 flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                    Date <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="edit-date"
                    type="date"
                    {...register("date")}
                    className={`h-11 focus:border-[#004E98] focus:ring-[#004E98] ${errors.date ? "border-red-500" : ""}`}
                  />
                  {errors.date && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.date.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-client" className="text-sm font-medium text-gray-700 flex items-center">
                    <Building2 className="h-4 w-4 mr-2 text-gray-500" />
                    Client Name <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="edit-client"
                    {...register("client")}
                    className={`h-11 focus:border-[#004E98] focus:ring-[#004E98] ${errors.client ? "border-red-500" : ""}`}
                    placeholder="Enter client name"
                  />
                  {errors.client && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.client.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Information Section */}

            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <div className="w-1 h-6 bg-[#01a64e]/50 rounded-full"></div>
                <h3 className="text-lg font-medium text-gray-900">Contact Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-contactPerson" className="text-sm font-medium text-gray-700 flex items-center">
                    <User className="h-4 w-4 mr-2 text-gray-500" />
                    Contact Person <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="edit-contactPerson"
                    {...register("contactPerson")}
                    className={`h-11 focus:border-[#004E98] focus:ring-[#004E98] ${errors.contactPerson ? "border-red-500" : ""}`}
                    placeholder="Enter contact person name"
                  />
                  {errors.contactPerson && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.contactPerson.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-contactNumber" className="text-sm font-medium text-gray-700 flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-gray-500" />
                    Contact Number <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="edit-contactNumber"
                    {...register("contactNumber")}
                    className={`h-11 focus:border-[#004E98] focus:ring-[#004E98] ${errors.contactNumber ? "border-red-500" : ""}`}
                    placeholder="Enter contact number"
                  />
                  {errors.contactNumber && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.contactNumber.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-contactEmail" className="text-sm font-medium text-gray-700 flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-gray-500" />
                  Contact Email <span className="text-red-500 ml-1">*</span>
                </Label>
                <Input
                  id="edit-contactEmail"
                  type="email"
                  {...register("contactEmail")}
                  className={`h-11 focus:border-[#004E98] focus:ring-[#004E98] ${errors.contactEmail ? "border-red-500" : ""}`}
                  placeholder="Enter contact email"
                />
                {errors.contactEmail && (
                  <p className="text-sm text-red-500 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.contactEmail.message}
                  </p>
                )}
              </div>
            </div>


            {/* Business Information Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <div className="w-1 h-6 bg-[#e55f00] rounded-full"></div>
                <h3 className="text-lg font-medium text-gray-900">Business Information</h3>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="edit-sectorId" className="text-sm font-medium text-gray-700 flex items-center">
                      <Target className="h-4 w-4 mr-2 text-gray-500" />
                      Sector <span className="text-gray-400 ml-1">(Optional)</span>
                    </Label>
                    <Select
                      value={watch("sectorId") || ""}
                      onValueChange={(value) => setValue("sectorId", value || "")}
                    >
                      <SelectTrigger className="h-11 focus:border-[#004E98] focus:ring-[#004E98]">
                        <SelectValue placeholder="Select sector (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(sectors) && sectors.map((sector: Sector) => (
                          <SelectItem key={sector.id} value={sector.id}>
                            {sector.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.sectorId && (
                      <p className="text-sm text-red-500 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.sectorId.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-revenue" className="text-sm font-medium text-gray-700 flex items-center">
                      <DollarSign className="h-4 w-4 mr-2 text-gray-500" />
                      Revenue (KSH) <span className="text-gray-400 ml-1">(Optional)</span>
                    </Label>
                    <Input
                      id="edit-revenue"
                      type="number"
                      step="0.01"
                      {...register("revenue", { valueAsNumber: true })}
                      className={`h-11 focus:border-[#004E98] focus:ring-[#004E98] ${errors.revenue ? "border-red-500" : ""}`}
                      placeholder="0.00 (optional)"
                    />
                    {errors.revenue && (
                      <p className="text-sm text-red-500 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.revenue.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* User Assignment Section (Admin Only) */}
            {(currentUser?.permissions?.includes("marketing.view_all") || currentUser?.permissions?.includes("admin.view")) && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                  <div className="w-1 h-6 bg-red-500 rounded-full"></div>
                  <h3 className="text-lg font-medium text-gray-900">User Assignment</h3>
                  <Badge variant="secondary" className="text-xs">Admin Only</Badge>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-bdId" className="text-sm font-medium text-gray-700 flex items-center">
                    <User className="h-4 w-4 mr-2 text-gray-500" />
                    Assigned User <span className="text-gray-400 ml-1">(Optional)</span>
                  </Label>
                  <Select
                    value={watch("bdId") || ""}
                    onValueChange={(value) => setValue("bdId", value || "")}
                    disabled={usersLoading}
                  >
                    <SelectTrigger className="h-11 focus:border-[#004E98] focus:ring-[#004E98]">
                      <SelectValue placeholder={usersLoading ? "Loading users..." : "Select assigned user (optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(marketingUsers) && marketingUsers.map((user: MarketingUser) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center space-x-2">
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
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.bdId.message}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Change the user assigned to this prospect. Leave empty to keep current assignment.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-gray-50/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-[#004E98] rounded-full"></div>
                Stakeholder Classification
              </h3>
              <div className="space-y-3">
                <Label htmlFor="customerType" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#004E98]" />
                  Stakeholder Type
                </Label>
                <Select
                  value={watch("customerType")}
                  onValueChange={(value) => setValue("customerType", value as any)}
                >
                  <SelectTrigger className="h-11 focus:border-[#004E98]">
                    <SelectValue placeholder="Select stakeholder type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-100 shadow-2xl">
                    <SelectItem value="student">Student (Individual)</SelectItem>
                    <SelectItem value="institution">Institution (Partner)</SelectItem>
                    <SelectItem value="organization">Organization (Partner)</SelectItem>
                    <SelectItem value="employer">Employer (Partner)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

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
                    <SelectValue placeholder="Which campaign led to this prospect?" />
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
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <div className="w-1 h-6 bg-[#004E98] rounded-full"></div>
                <h3 className="text-lg font-medium text-gray-900">Additional Information</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-remarks" className="text-sm font-medium text-gray-700 flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-gray-500" />
                  Remarks <span className="text-gray-400 ml-1">(Optional)</span>
                </Label>
                <Textarea
                  id="edit-remarks"
                  {...register("remarks")}
                  className={`resize-none focus:border-[#004E98] focus:ring-[#004E98] ${errors.remarks ? "border-red-500" : ""}`}
                  placeholder="Enter any additional remarks (optional)"
                  rows={3}
                />
                {errors.remarks && (
                  <p className="text-sm text-red-500 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.remarks.message}
                  </p>
                )}
              </div>
            </div>

            {editingProspect && (
              <DocumentAttachmentSection 
                entityId={editingProspect.id} 
                entityType={(editingProspect as any).customerType === 'student' ? 'lead' : 'prospect'} 
                title="Prospect attachments"
              />
            )}

            <DialogFooter className="flex justify-between items-center pt-6 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                <span className="text-red-500">*</span> Required fields
              </div>
              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  className="h-11 px-6"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="h-11 px-8 bg-[#004E98] hover:bg-[#003d7a]"
                >
                  {editMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Prospect"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stage Change Dialog */}
      <Dialog open={isStageChangeOpen} onOpenChange={setIsStageChangeOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#01a64e]/10 rounded-lg">
                <Settings className="h-5 w-5 text-[#01a64e]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-gray-900">Change Prospect Stage</DialogTitle>
                <DialogDescription className="text-gray-600">
                  Update the stage and revenue for this prospect.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4">

            {/* Stage Selection */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <div className="w-1 h-6 bg-[#004E98] rounded-full"></div>
                <h3 className="text-lg font-medium text-gray-900">Stage Update</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stage" className="text-sm font-medium text-gray-700 flex items-center">
                    <Target className="h-4 w-4 mr-2 text-gray-500" />
                    New Stage <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Select value={newStage} onValueChange={(value) => handleStageSelection(value, stageChangeProspect!)}>
                    <SelectTrigger className="h-11 focus:border-[#004E98] focus:ring-[#004E98]">
                      <SelectValue placeholder="Select new stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      {stageChangeProspect?.customerType === 'student' ? (
                        <>
                          <SelectItem value="prospect_registration">Prospect Registration</SelectItem>
                          <SelectItem value="prospect_booking">Prospect Booking</SelectItem>
                          <SelectItem value="dormant">Dormant</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="opportunity">Opportunity</SelectItem>
                          <SelectItem value="engagement">Engagement</SelectItem>
                          <SelectItem value="expected_order">Expected Order</SelectItem>
                          <SelectItem value="sales_won">Sales Won</SelectItem>
                        </>
                      )}
                      <SelectItem value="lost" className="text-red-600">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="revenue" className="text-sm font-medium text-gray-700 flex items-center">
                    <DollarSign className="h-4 w-4 mr-2 text-gray-500" />
                    Revenue (KSH) <span className="text-gray-400 ml-1">(Optional)</span>
                  </Label>
                  <Input
                    id="revenue"
                    type="number"
                    step="0.01"
                    value={newRevenue}
                    onChange={(e) => setNewRevenue(e.target.value)}
                    className="h-11 focus:border-[#004E98] focus:ring-[#004E98]"
                    placeholder="Enter revenue amount (optional)"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center pt-6 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              <span className="text-red-500">*</span> Required fields
            </div>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => setIsStageChangeOpen(false)}
                className="h-11 px-6"
              >
                Cancel
              </Button>
              <Button
                onClick={handleStageChange}
                disabled={stageChangeMutation.isPending || !newStage}
                className="h-11 px-8 bg-[#01a64e] hover:bg-[#006341]"
              >
                {stageChangeMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
                ) : (
                  "Update Stage"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lost Reason Modal */}
      {lostReasonData && (
        <LostReasonModal
          isOpen={isLostReasonModalOpen}
          onClose={() => {
            setIsLostReasonModalOpen(false);
            setLostReasonData(null);
          }}
          onSubmit={handleLostReasonSubmit}
          projectName={lostReasonData.prospect.client}
          projectRevenue={lostReasonData.revenue || lostReasonData.prospect.revenue}
        />
      )}
    </div>
  );
}