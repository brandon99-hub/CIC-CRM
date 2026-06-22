import { useState, useCallback, useMemo } from "react";
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
  Building2,
  DollarSign,
  Calendar,
  FileText,
  User,
  Users,
  Phone,
  Mail,
  Plus,
  Filter,
  TrendingUp,
  Target
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { SalesWonFilters } from "./sales-won-filters";
import { MarketingPageHeader } from "./marketing-page-header";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";
import { DocumentAttachmentSection } from "./document-attachment-section";


interface SalesWon {
  id: string;
  organisationName: string;
  sector: string;
  product: string;
  contractAmount: number;
  expectedQuarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  comments?: string;
  marketerId: string;
  marketerName?: string;
  marketerEmail?: string;
  contactPerson?: string;
  contactNumber?: string;
  contactEmail?: string;
  createdAt: string;
  updatedAt: string;
  customerType?: string;
}

interface SalesWonResponse {
  salesWon: SalesWon[];
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

const salesWonUpdateSchema = z.object({
  organisationName: z.string().min(1, "Organisation name is required").max(200, "Organisation name too long"),
  sector: z.string().optional(),
  product: z.string().min(1, "Product is required").max(200, "Product name too long"),
  contractAmount: z.number().min(0).optional().or(z.nan().transform(() => undefined)),
  expectedQuarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  comments: z.string().optional(),
  marketerId: z.string().optional(),
  customerType: z.string().optional(),
});

type SalesWonUpdateData = z.infer<typeof salesWonUpdateSchema>;

interface MarketingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  permissions?: string[];
  bdType?: 'b2b' | 'b2c' | 'both';
}

export interface MarketingSalesWonTableProps {
  showMarketerInfo?: boolean;
  selectedMarketer?: string;
  onMarketerChange?: (marketerId: string) => void;
  currentUser?: MarketingUser;
  onAddClick?: () => void;
  customerTypeFilter?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function MarketingSalesWonTable({
  showMarketerInfo = false,
  selectedMarketer = "",
  onMarketerChange,
  currentUser,
  onAddClick,
  customerTypeFilter,
  activeTab,
  onTabChange,
}: MarketingSalesWonTableProps) {
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
  const { data: salesWonData, isLoading: loading } = useQuery<SalesWonResponse>({
    queryKey: ["marketing", "sales-won", filters, currentPage, selectedMarketer, customerTypeFilter],
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

      const response = await fetch(`/api/marketing/sales-won?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to load sales won records");
      return response.json();
    },
    staleTime: 300000,
  });

  const salesWon = salesWonData?.salesWon || [];
  const pagination = salesWonData?.pagination || { page: 1, limit: 10, total: 0, pages: 0 };

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

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingSalesWon, setEditingSalesWon] = useState<SalesWon | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [salesWonToDelete, setSalesWonToDelete] = useState<string | null>(null);

  // Form setup
  const { register, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm<SalesWonUpdateData>({
    resolver: zodResolver(salesWonUpdateSchema),
  });

  // Mutations
  const editMutation = useMutation({
    mutationFn: async (data: SalesWonUpdateData) => {
      const token = localStorage.getItem("marketingToken");
      
      // Sanitize UUID fields (convert empty strings to null)
      const sanitizedData = {
        ...data,
        marketerId: data.marketerId === "" ? null : data.marketerId,
        sourceCampaignId: (data as any).sourceCampaignId === "" ? null : (data as any).sourceCampaignId,
      };

      const res = await fetch(`/api/marketing/sales-won/${editingSalesWon?.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(sanitizedData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update sales won record");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Sales won record updated successfully" });
      setIsEditOpen(false);
      setEditingSalesWon(null);
      reset();
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
      const res = await fetch(`/api/marketing/sales-won/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete sales won record");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Sales won record deleted successfully" });
      setIsDeleteDialogOpen(false);
      setSalesWonToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["marketing", "sales-won"] });
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
    setSalesWonToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!salesWonToDelete) return;
    deleteMutation.mutate(salesWonToDelete);
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

  const handleEdit = async (data: SalesWonUpdateData) => {
    editMutation.mutate(data);
  };

  const openEditDialog = (salesWon: SalesWon) => {
    setEditingSalesWon(salesWon);
    setValue("organisationName", salesWon.organisationName);
    setValue("sector", salesWon.sector);
    setValue("product", salesWon.product);
    setValue("contractAmount", salesWon.contractAmount);
    setValue("expectedQuarter", salesWon.expectedQuarter);
    setValue("comments", salesWon.comments || "");
    setValue("marketerId", salesWon.marketerId || "");
    setValue("customerType", salesWon.customerType || "institution");
    setIsEditOpen(true);
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
        title="Delete Sales Won Record"
        description="Are you sure you want to delete this sales won record? This action cannot be undone."
      />

      <MarketingPageHeader
        title="Won"
        subtitle="Review and manage successfully closed sales contracts."
        icon={TrendingUp}
        onSearchChange={(val) => handleFiltersChange({ ...filters, search: val })}
        searchValue={filters.search || ""}
        searchPlaceholder="Search sales won by organization..."
        stackLayout={true}
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
        <SalesWonFilters
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
                  <TableHead className="font-semibold text-gray-700">Contract Amount</TableHead>
                  <TableHead className="font-semibold text-gray-700">Quarter</TableHead>
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
                        <span className="text-sm text-gray-500 font-medium">Loading sales won records...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : Array.isArray(salesWon) && salesWon.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No sales won records found
                    </TableCell>
                  </TableRow>
                ) : (
                  Array.isArray(salesWon) && salesWon.map((sale: SalesWon) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">{sale.organisationName}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-[#004E98]" />
                          <span className="text-sm font-medium text-gray-700">
                            {sale.marketerName || 'Unknown'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {sale.marketerEmail || ''}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-700">
                            {sale.contactPerson || 'N/A'}
                          </div>
                          <div className="flex items-center text-xs text-gray-600">
                            <Phone className="h-3 w-3 mr-1" />
                            {sale.contactNumber || 'N/A'}
                          </div>
                          <div className="flex items-center text-xs text-gray-600">
                            <Mail className="h-3 w-3 mr-1" />
                            {sale.contactEmail || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">
                            {sale.sector || 'No sector'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(sale.contractAmount)}</TableCell>
                      <TableCell>
                        <Badge className={quarterColors[sale.expectedQuarter]}>
                          {sale.expectedQuarter}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="max-w-[150px] cursor-help">
                                <p className="text-sm text-gray-700 truncate">
                                  {sale.comments || 'No comments'}
                                </p>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-white p-4 shadow-xl border-gray-100 max-w-sm rounded-xl">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-[#0b8a4f] font-bold text-xs uppercase tracking-wider">
                                  <FileText className="h-3 w-3" />
                                  Sale Comments
                                </div>
                                <p className="text-sm text-gray-600 leading-relaxed italic">
                                  "{sale.comments || 'No comments provided'}"
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
                                  onClick={() => openEditDialog(sale)}
                                >
                                  <Edit className="h-4 w-4 text-gray-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-white p-2 shadow-lg border-gray-100 rounded-md">
                                <p className="text-xs font-medium text-gray-700">Edit Sale Record</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => confirmDelete(sale.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-white p-2 shadow-lg border-gray-100 rounded-md">
                                <p className="text-xs font-medium text-red-600">Delete Sale Record</p>
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

      {/* Edit Sales Won Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-6">
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-gray-900">
              <div className="p-2 bg-[#01a64e]/10 rounded-lg">
                <DollarSign className="h-6 w-6 text-[#01a64e]" />
              </div>
              Edit Sales Won Record
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-base">
              Update the sales won information below. All fields marked with * are required.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(handleEdit, onInvalid)} className="space-y-8">
            {/* Organisation Information Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                <div className="w-1 h-6 bg-[#01a64e]/50 rounded-full"></div>
                <h3 className="text-lg font-medium text-gray-900 font-bold uppercase tracking-tight text-[#01a64e]">Organisation Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="organisationName" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#01a64e]" />
                    Organisation Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="organisationName"
                    {...register("organisationName")}
                    placeholder="Enter organisation name"
                    className={`h-11 ${errors.organisationName ? "border-red-500" : "focus:border-[#01a64e] focus:ring-[#01a64e]"}`}
                  />
                  {errors.organisationName && (
                    <p className="text-sm text-red-500 italic font-medium">{errors.organisationName.message}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="sector" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#01a64e]" />
                    Sector <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="sector"
                    {...register("sector")}
                    placeholder="Enter sector"
                    className={`h-11 ${errors.sector ? "border-red-500" : "focus:border-[#01a64e] focus:ring-[#01a64e]"}`}
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
                <div className="w-1 h-6 bg-[#01a64e] rounded-full"></div>
                <h3 className="text-lg font-medium text-gray-900 font-bold uppercase tracking-tight text-[#006341]">Product & Financial Details</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="product" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#006341]" />
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
                  <Label htmlFor="contractAmount" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-[#006341]" />
                    Contract Amount (KES) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contractAmount"
                    type="number"
                    step="0.01"
                    {...register("contractAmount", { valueAsNumber: true })}
                    placeholder="0.00"
                    className={`h-11 ${errors.contractAmount ? "border-red-500" : "focus:border-[#01a64e] focus:ring-[#01a64e]"}`}
                  />
                  {errors.contractAmount && (
                    <p className="text-sm text-red-500 italic font-medium">{errors.contractAmount.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="expectedQuarter" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#006341]" />
                  Expected Quarter <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={watch("expectedQuarter") || ""}
                  onValueChange={(value) => setValue("expectedQuarter", value as any)}
                >
                  <SelectTrigger className={`h-11 ${errors.expectedQuarter ? "border-red-500" : "focus:border-[#01a64e] focus:ring-[#01a64e]"}`}>
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
                    Change the user assigned to this sales won record. Leave empty to keep current assignment.
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
            </div>

            {editingSalesWon && (
              <DocumentAttachmentSection 
                entityId={editingSalesWon.id} 
                entityType={(editingSalesWon as any).customerType === 'student' ? 'lead' : 'sales_won'} 
                title="Contract documents"
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
                  disabled={editMutation.isPending}
                  className="h-11 px-8 bg-[#01a64e] hover:bg-[#006341] shadow-lg shadow-[#01a64e]/20 min-w-[160px]"
                >
                  {editMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Sales Won"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
