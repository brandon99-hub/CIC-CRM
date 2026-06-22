import { useState, useCallback, useMemo } from "react";
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
  Building2,
  DollarSign,
  Calendar,
  FileText,
  User,
  Users,
  Phone,
  Mail,
  ArrowRight,
  Target,
  Plus,
  Filter
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { ExpectedOrdersFilters } from "./expected-orders-filters";
import { LostReasonModal } from "./lost-reason-modal";
import { MarketingPageHeader } from "./marketing-page-header";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";
import { DocumentAttachmentSection } from "./document-attachment-section";


interface ExpectedOrders {
  id: string;
  organisationName: string;
  sector: string;
  product: string;
  revenue: number;
  expectedQuarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  comments?: string;
  marketerId: string;
  createdAt: string;
  updatedAt: string;
  customerType?: string;
  sourceCampaignId?: string;
  marketerName?: string;
  marketerEmail?: string;
  contactPerson?: string;
  contactNumber?: string;
  contactEmail?: string;
}

interface ExpectedOrdersResponse {
  expectedOrders: ExpectedOrders[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const quarterColors = {
  Q1: "bg-[#004E98]/10 text-[#004E98]",
  Q2: "bg-[#01a64e]/10 text-[#006341]",
  Q3: "bg-[#D0AC01]/10 text-[#bb8114]",
  Q4: "bg-red-100 text-red-800",
};

const expectedOrdersUpdateSchema = z.object({
  organisationName: z.string().min(1, "Organisation name is required").max(200, "Organisation name too long"),
  sector: z.string().optional(),
  product: z.string().min(1, "Product is required").max(200, "Product name too long"),
  revenue: z.number().min(0).optional().or(z.nan().transform(() => undefined)),
  expectedQuarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  comments: z.string().optional(),
  marketerId: z.string().optional(),
  customerType: z.string().optional(),
  sourceCampaignId: z.string().optional(),
});

type ExpectedOrdersUpdateData = z.infer<typeof expectedOrdersUpdateSchema>;

interface MarketingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  permissions?: string[];
}

export interface MarketingExpectedOrdersTableProps {
  showMarketerInfo?: boolean;
  selectedMarketer?: string;
  onMarketerChange?: (marketerId: string) => void;
  currentUser?: MarketingUser;
  onAddClick?: () => void;
  customerTypeFilter?: string;
  onTabChange?: (tab: string) => void;
  activeTab?: string;
}

export function MarketingExpectedOrdersTable({
  showMarketerInfo = false,
  selectedMarketer = "",
  onMarketerChange,
  currentUser,
  onAddClick,
  customerTypeFilter,
  onTabChange,
  activeTab,
}: MarketingExpectedOrdersTableProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<{
    search?: string;
    year?: string;
    quarter?: string;
    marketerId?: string;
    sector?: string;
  }>({});

  // Queries
  const { data: expectedOrdersData, isLoading: loading } = useQuery<ExpectedOrdersResponse>({
    queryKey: ["marketing", "expected-orders", filters, currentPage, selectedMarketer, customerTypeFilter],
    queryFn: async () => {
      const token = localStorage.getItem("marketingToken");
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(filters.search && { search: filters.search }),
        ...(filters.year && { year: filters.year }),
        ...(filters.quarter && { quarter: filters.quarter }),
        ...(filters.marketerId && { marketerId: filters.marketerId }),
        ...(filters.sector && { sector: filters.sector }),
        ...((currentUser?.permissions?.includes("marketing.view_all") || currentUser?.permissions?.includes("admin.view")) && selectedMarketer && { marketerId: selectedMarketer }),
        ...(customerTypeFilter && { customerType: customerTypeFilter }),
      });

      const response = await fetch(`/api/marketing/expected-orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to load expected orders");
      return response.json();
    },
    staleTime: 300000,
  });

  const expectedOrders = expectedOrdersData?.expectedOrders || [];
  const pagination = expectedOrdersData?.pagination || { page: 1, limit: 10, total: 0, pages: 0 };

  const { data: marketingUsersData, isLoading: usersLoading } = useQuery<{ users: MarketingUser[] }>({
    queryKey: ["marketing", "users", "list"],
    queryFn: async () => {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/users?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to load marketing users");
      return response.json();
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

  // Edit functionality state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingExpectedOrder, setEditingExpectedOrder] = useState<ExpectedOrders | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isStageChangeOpen, setIsStageChangeOpen] = useState(false);
  const [stageChangeExpectedOrder, setStageChangeExpectedOrder] = useState<ExpectedOrders | null>(null);
  const [newStage, setNewStage] = useState<string>("");
  const [newRevenue, setNewRevenue] = useState<string>("");
  const [isLostReasonModalOpen, setIsLostReasonModalOpen] = useState(false);
  const [lostReasonData, setLostReasonData] = useState<{ expectedOrder: ExpectedOrders, stage: string, revenue?: string } | null>(null);

  // Form setup
  const { register, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm<ExpectedOrdersUpdateData>({
    resolver: zodResolver(expectedOrdersUpdateSchema),
  });

  // Mutations
  const editMutation = useMutation({
    mutationFn: async (data: ExpectedOrdersUpdateData) => {
      const token = localStorage.getItem("marketingToken");
      
      // Sanitize UUID fields (convert empty strings to null)
      const sanitizedData = {
        ...data,
        sourceCampaignId: data.sourceCampaignId === "" ? null : data.sourceCampaignId,
        marketerId: data.marketerId === "" ? null : data.marketerId,
        sector: data.sector === "" ? undefined : data.sector,
      };

      const res = await fetch(`/api/marketing/expected-orders/${editingExpectedOrder?.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(sanitizedData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update expected order");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Expected order updated successfully" });
      setIsEditOpen(false);
      setEditingExpectedOrder(null);
      reset();
      queryClient.invalidateQueries({ queryKey: ["marketing", "expected-orders"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const stageChangeMutation = useMutation({
    mutationFn: async ({ id, stage, revenue }: { id: string; stage: string; revenue: number }) => {
      const token = localStorage.getItem("marketingToken");
      const res = await fetch(`/api/marketing/expected-orders/${id}/stage`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stage, revenue }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to change stage");
      }
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: "Success", description: result.message || "Expected order stage changed successfully" });
      setIsStageChangeOpen(false);
      setStageChangeExpectedOrder(null);
      setNewStage("");
      setNewRevenue("");
      queryClient.invalidateQueries({ queryKey: ["marketing", "expected-orders"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "sales-won"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("marketingToken");
      const res = await fetch(`/api/marketing/expected-orders/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete expected order");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Expected order deleted successfully" });
      setIsDeleteDialogOpen(false);
      setOrderToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["marketing", "expected-orders"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const lostReasonMutation = useMutation({
    mutationFn: async ({ id, revenue, lostReason }: { id: string; revenue: number; lostReason: string }) => {
      const token = localStorage.getItem("marketingToken");
      const res = await fetch(`/api/marketing/expected-orders/${id}/stage`, {
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
        throw new Error(error.error || "Failed to mark expected order as lost");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Expected order marked as lost successfully" });
      setIsLostReasonModalOpen(false);
      setLostReasonData(null);
      queryClient.invalidateQueries({ queryKey: ["marketing", "expected-orders"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleFiltersChange = useCallback((newFilters: any) => {
    setFilters(newFilters);
    setCurrentPage(1);
  }, []);

  const confirmDelete = (id: string) => {
    setOrderToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!orderToDelete) return;
    deleteMutation.mutate(orderToDelete);
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

  const handleEdit = async (data: ExpectedOrdersUpdateData) => {
    editMutation.mutate(data);
  };

  const openEditDialog = (expectedOrder: ExpectedOrders) => {
    setEditingExpectedOrder(expectedOrder);
    setValue("organisationName", expectedOrder.organisationName);
    setValue("sector", expectedOrder.sector);
    setValue("product", expectedOrder.product);
    setValue("revenue", expectedOrder.revenue);
    setValue("expectedQuarter", expectedOrder.expectedQuarter);
    setValue("comments", expectedOrder.comments || "");
    setValue("marketerId", expectedOrder.marketerId || "");
    setValue("sourceCampaignId", expectedOrder.sourceCampaignId || "");
    setValue("customerType", expectedOrder.customerType || "institution");
    setIsEditOpen(true);
  };

  const openStageChangeDialog = (expectedOrder: ExpectedOrders) => {
    setStageChangeExpectedOrder(expectedOrder);
    setNewStage("sales_won");
    setNewRevenue(expectedOrder.revenue.toString());
    setIsStageChangeOpen(true);
  };

  const handleStageChange = async () => {
    if (!stageChangeExpectedOrder || !newStage) return;
    stageChangeMutation.mutate({
      id: stageChangeExpectedOrder.id,
      stage: newStage,
      revenue: parseFloat(newRevenue) || 0,
    });
  };

  const handleStageSelection = (stage: string, expectedOrder: ExpectedOrders) => {
    if (stage === 'lost') {
      // Open lost reason modal instead of stage change dialog
      setLostReasonData({
        expectedOrder,
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
      id: lostReasonData.expectedOrder.id,
      revenue: lostReasonData.revenue ? parseFloat(lostReasonData.revenue) : lostReasonData.expectedOrder.revenue,
      lostReason: reason,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy");
  };


  return (
    <div className="space-y-6">
      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Expected Order"
        description="Are you sure you want to delete this expected order? This action cannot be undone."
      />

      <MarketingPageHeader
        title="Expected Orders"
        subtitle="Manage and track upcoming orders and potential revenue."
        icon={Target}
        onSearchChange={(val) => handleFiltersChange({ ...filters, search: val })}
        searchValue={filters.search || ""}
        searchPlaceholder="Search expected orders by organization..."
        stackLayout={true}
        actionButton={onAddClick ? {
          label: "Add Order",
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

      {showFilters && (
        <ExpectedOrdersFilters
          onFiltersChange={handleFiltersChange}
          showMarketerInfo={showMarketerInfo}
        />
      )}

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="border-t">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="font-semibold text-gray-700">Organisation</TableHead>
                  <TableHead className="font-semibold text-gray-700">Marketer</TableHead>
                  <TableHead className="font-semibold text-gray-700">Contact Details</TableHead>
                  <TableHead className="font-semibold text-gray-700">Sector</TableHead>
                  <TableHead className="font-semibold text-gray-700">Revenue</TableHead>
                  <TableHead className="font-semibold text-gray-700">Expected Quarter</TableHead>
                  <TableHead className="font-semibold text-gray-700">Comments</TableHead>
                  <TableHead className="font-semibold text-gray-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="h-5 w-5 animate-spin text-[#004E98]" />
                        <span className="text-sm text-gray-500 font-medium">Loading expected orders...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : Array.isArray(expectedOrders) && expectedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      No expected orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  Array.isArray(expectedOrders) && expectedOrders.map((order: ExpectedOrders) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.organisationName}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-[#004E98]" />
                          <span className="text-sm font-medium text-gray-700">
                            {order.marketerName || 'Unknown'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {order.marketerEmail || ''}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-700">
                            {order.contactPerson || 'N/A'}
                          </div>
                          <div className="flex items-center text-xs text-gray-600">
                            <Phone className="h-3 w-3 mr-1" />
                            {order.contactNumber || 'N/A'}
                          </div>
                          <div className="flex items-center text-xs text-gray-600">
                            <Mail className="h-3 w-3 mr-1" />
                            {order.contactEmail || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{order.sector}</TableCell>
                      <TableCell>{formatCurrency(order.revenue)}</TableCell>
                      <TableCell>
                        <Badge className={quarterColors[order.expectedQuarter]}>
                          {order.expectedQuarter}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="max-w-[150px] cursor-help">
                                <p className="text-sm text-gray-700 truncate">
                                  {order.comments || 'No comments'}
                                </p>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-white p-4 shadow-xl border-gray-100 max-w-sm rounded-xl">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-[#004E98] font-bold text-xs uppercase tracking-wider">
                                  <FileText className="h-3 w-3" />
                                  Order Comments
                                </div>
                                <p className="text-sm text-gray-600 leading-relaxed italic">
                                  "{order.comments || 'No comments provided'}"
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center space-x-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-gray-100"
                                  onClick={() => openEditDialog(order)}
                                >
                                  <Edit className="h-4 w-4 text-gray-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-white p-2 shadow-lg border-gray-100 rounded-md">
                                <p className="text-xs font-medium text-gray-700">Edit Order</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-[#01a64e]/10"
                                  onClick={() => openStageChangeDialog(order)}
                                >
                                  <ArrowRight className="h-4 w-4 text-[#01a64e]" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-white p-2 shadow-lg border-gray-100 rounded-md">
                                <p className="text-xs font-medium text-[#01a64e]">Promote to Sales Won</p>
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
                                  onClick={() => confirmDelete(order.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-white p-2 shadow-lg border-gray-100 rounded-md">
                                <p className="text-xs font-medium text-red-600">Delete Order</p>
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
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === pagination.pages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Expected Orders Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-6">
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-gray-900">
              <div className="p-2 bg-[#004E98]/10 rounded-lg">
                <DollarSign className="h-6 w-6 text-[#004E98]" />
              </div>
              Edit Expected Order
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-base">
              Update the expected order information below. All fields marked with * are required.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(handleEdit, onInvalid)} className="space-y-8">
            {/* Organisation Information Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <div className="w-1 h-6 bg-[#004E98] rounded-full"></div>
                <h3 className="text-lg font-medium text-gray-900 font-bold uppercase tracking-tight">Organisation Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="organisationName" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#004E98]" />
                    Organisation Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="organisationName"
                    {...register("organisationName")}
                    placeholder="Enter organisation name"
                    className={`h-11 ${errors.organisationName ? "border-red-500" : "focus:border-[#004E98] focus:ring-[#004E98]"}`}
                  />
                  {errors.organisationName && (
                    <p className="text-sm text-red-500 italic font-medium">{errors.organisationName.message}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="sector" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#004E98]" />
                    Sector <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="sector"
                    {...register("sector")}
                    placeholder="Enter sector"
                    className={`h-11 ${errors.sector ? "border-red-500" : "focus:border-[#004E98] focus:ring-[#004E98]"}`}
                  />
                  {errors.sector && (
                    <p className="text-sm text-red-500 italic font-medium">{errors.sector.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Product & Financial Information Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <div className="w-1 h-6 bg-[#01a64e]/50 rounded-full"></div>
                <h3 className="text-lg font-medium text-gray-900 font-bold uppercase tracking-tight text-[#01a64e]">Product & Financials</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="product" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#01a64e]" />
                    Product <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="product"
                    {...register("product")}
                    placeholder="Enter product name"
                    className={`h-11 ${errors.product ? "border-red-500" : "focus:border-[#01a64e] focus:ring-[#01a64e]"}`}
                  />
                  {errors.product && (
                    <p className="text-sm text-red-500 italic font-medium">{errors.product.message}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="revenue" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-[#01a64e]" />
                    Expected Revenue (KES) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="revenue"
                    type="number"
                    step="0.01"
                    {...register("revenue", { valueAsNumber: true })}
                    placeholder="0.00"
                    className={`h-11 ${errors.revenue ? "border-red-500" : "focus:border-[#01a64e] focus:ring-[#01a64e]"}`}
                  />
                  {errors.revenue && (
                    <p className="text-sm text-red-500 italic font-medium">{errors.revenue.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="expectedQuarter" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#01a64e]" />
                  Expected Quarter <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={watch("expectedQuarter") || ""}
                  onValueChange={(value) => setValue("expectedQuarter", value as any)}
                >
                  <SelectTrigger className={`h-11 ${errors.expectedQuarter ? "border-red-500" : "focus:border-[#004E98] focus:ring-[#004E98]"}`}>
                    <SelectValue placeholder="Select expected quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#004E98]/10 text-[#004E98] text-xs">Q1</Badge>
                        <span>First Quarter</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Q2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#01a64e]/10 text-[#006341] text-xs">Q2</Badge>
                        <span>Second Quarter</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Q3">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#D0AC01]/10 text-[#bb8114] text-xs">Q3</Badge>
                        <span>Third Quarter</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Q4">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-100 text-red-800 text-xs">Q4</Badge>
                        <span>Fourth Quarter</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.expectedQuarter && (
                  <p className="text-sm text-red-500 italic font-medium">{errors.expectedQuarter.message}</p>
                )}
              </div>
            </div>

            {/* User Assignment Section (Admin Only) */}

            {(currentUser?.permissions?.includes("marketing.view_all") || currentUser?.permissions?.includes("admin.view")) && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                  <div className="w-1 h-6 bg-red-500 rounded-full"></div>
                  <h3 className="text-lg font-medium text-gray-900 font-bold uppercase tracking-tight text-red-500">User Assignment</h3>
                  <Badge variant="secondary" className="text-xs">Admin Only</Badge>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="marketerId" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <User className="h-4 w-4 text-red-500" />
                    Assigned User
                  </Label>
                  <Select
                    value={watch("marketerId") || ""}
                    onValueChange={(value) => setValue("marketerId", value || "")}
                    disabled={usersLoading}
                  >
                    <SelectTrigger className="h-11 focus:border-red-500 focus:ring-red-500">
                      <SelectValue placeholder={usersLoading ? "Loading users..." : "Select assigned user (optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(marketingUsers) && marketingUsers.map((user: MarketingUser) => (
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
                  <p className="text-xs text-gray-500 italic">
                    Change the user assigned to this expected order. Leave empty to keep current assignment.
                  </p>
                </div>
              </div>
            )}

            {/* Additional Information Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                <h3 className="text-lg font-medium text-gray-900 font-bold uppercase tracking-tight text-gray-600">Additional Information</h3>
              </div>

              <div className="space-y-3">
                <Label htmlFor="comments" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400" />
                  Comments
                </Label>
                <Textarea
                  id="comments"
                  {...register("comments")}
                  rows={4}
                  placeholder="Enter any additional comments or notes..."
                  className="resize-none focus:border-gray-500 focus:ring-gray-500"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="sourceCampaignId" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Target className="h-4 w-4 text-gray-400" />
                  Source Campaign <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                </Label>
                <Select
                  value={watch("sourceCampaignId") || ""}
                  onValueChange={(value) => setValue("sourceCampaignId", value === "none" ? "" : value)}
                >
                  <SelectTrigger className="h-11 focus:border-[#004E98] focus:ring-[#004E98]">
                    <SelectValue placeholder="Which campaign led to this order?" />
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

            {editingExpectedOrder && (
              <DocumentAttachmentSection
                entityId={editingExpectedOrder.id}
                entityType={(editingExpectedOrder as any).customerType === 'student' ? 'lead' : 'expected_order'}
                title="Order documents"
              />
            )}

            <DialogFooter className="flex justify-between items-center pt-6 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                <span className="text-red-500 font-bold">*</span> Required fields
              </div>
              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  className="h-11 px-6 min-w-[120px]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 px-8 bg-[#004E98] hover:bg-[#003d7a] shadow-lg shadow-[#004E98]/20 min-w-[180px]"
                >
                  {editMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Expected Order"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stage Change Dialog */}
      <Dialog open={isStageChangeOpen} onOpenChange={setIsStageChangeOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-3 pb-6 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#01A64E]/20 to-[#01A64E]/10 rounded-xl flex items-center justify-center">
                <Target className="h-6 w-6 text-[#01A64E]" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-gray-900">
                  Change Stage
                </DialogTitle>
                <DialogDescription className="text-gray-500 text-sm">
                  Update the sales pipeline stage for this expected order.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-6">

            {/* Stage Change Form */}
            <div className="bg-[#01a64e]/5 rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-2 pb-2 border-b border-[#01a64e]/20">
                <div className="w-1 h-6 bg-[#01a64e]/50 rounded-full"></div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <Target className="h-5 w-5 text-[#01a64e]" />
                  <span>New Stage</span>
                </h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newStage" className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                    <ArrowRight className="h-4 w-4" />
                    <span>Select New Stage</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={newStage}
                    onValueChange={(value) => handleStageSelection(value, stageChangeExpectedOrder!)}
                  >
                    <SelectTrigger className="h-11 border-gray-300 focus:border-[#01a64e] focus:ring-2 focus:ring-[#01a64e]/20 rounded-lg transition-all duration-200">
                      <SelectValue placeholder="Select new stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">
                        <div className="flex items-center space-x-2">
                          <Badge className="bg-[#D0AC01]/10 text-[#bb8114]">Lead</Badge>
                          <span className="text-sm text-gray-600">Move back to lead stage</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="opportunity">
                        <div className="flex items-center space-x-2">
                          <Badge className="bg-[#004E98]/10 text-[#004E98]">Opportunity</Badge>
                          <span className="text-sm text-gray-600">Move to opportunity stage</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="engagement">
                        <div className="flex items-center space-x-2">
                          <Badge className="bg-[#004E98]/10 text-[#004E98]">Engagement</Badge>
                          <span className="text-sm text-gray-600">Move to engagement stage</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="expected_order">
                        <div className="flex items-center space-x-2">
                          <Badge className="bg-[#004E98]/10 text-[#004E98]">Expected Order</Badge>
                          <span className="text-sm text-gray-600">Stay in expected order</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="sales_won">
                        <div className="flex items-center space-x-2">
                          <Badge className="bg-[#01a64e]/10 text-[#006341]">Sales Won</Badge>
                          <span className="text-sm text-gray-600">Project completed successfully</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="lost">
                        <div className="flex items-center space-x-2">
                          <Badge className="bg-red-100 text-red-800">Lost</Badge>
                          <span className="text-sm text-gray-600">Project was lost</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newRevenue" className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                    <DollarSign className="h-4 w-4" />
                    <span>Contract Amount (KES)</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="newRevenue"
                    type="number"
                    step="0.01"
                    value={newRevenue}
                    onChange={(e) => setNewRevenue(e.target.value)}
                    placeholder="Enter final contract amount"
                    className="h-11 border-gray-300 focus:border-[#01a64e] focus:ring-2 focus:ring-[#01a64e]/20 rounded-lg transition-all duration-200"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-3 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsStageChangeOpen(false)}
              disabled={isSubmitting}
              className="flex-1 h-11 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </Button>
            <Button
              onClick={handleStageChange}
              disabled={stageChangeMutation.isPending || !newStage || !newRevenue}
              className="flex-1 h-11 bg-gradient-to-r from-[#01a64e] to-[#006341] hover:from-[#006341] hover:to-[#004d31] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {stageChangeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Changing Stage...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Move to Selected Stage
                </>
              )}
            </Button>
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
          projectName={lostReasonData.expectedOrder.organisationName}
          projectRevenue={lostReasonData.revenue || lostReasonData.expectedOrder.revenue}
        />
      )}
    </div>
  );
}
