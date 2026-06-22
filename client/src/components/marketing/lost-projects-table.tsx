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
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
  Phone,
  Mail,
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Eye,
  Filter,
  X,
  FileText,
  TrendingDown,
  XCircle,
  Target
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MarketingPageHeader } from "./marketing-page-header";
import { ArrowRight } from "lucide-react";

interface LostProject {
  id: string;
  organisationName: string;
  sector: string;
  product: string;
  revenue?: string | number;
  expectedQuarter: string;
  comments?: string;
  marketerId: string;
  contactPerson?: string;
  contactNumber?: string;
  contactEmail?: string;
  lostReason: string;
  lostDate: string;
  canRevive: boolean;
  sourceCampaignId?: string;
  createdAt: string;
  updatedAt: string;
  marketerName?: string;
  marketerEmail?: string;
}

interface Sector {
  id: string;
  name: string;
  description?: string;
}

interface MarketingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isSystem?: boolean;
}

interface LostProjectsResponse {
  lostProjects: LostProject[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface LostProjectsTableProps {
  showMarketerInfo?: boolean;
  selectedMarketer?: string;
  onMarketerChange?: (marketerId: string) => void;
}

export function LostProjectsTable({
  showMarketerInfo = false,
  selectedMarketer = "",
  onMarketerChange
}: LostProjectsTableProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"b2b" | "b2c">("b2b");

  // Filter states
  const [filters, setFilters] = useState({
    search: "",
    year: new Date().getFullYear().toString(),
    quarter: "all",
    marketerId: selectedMarketer || "all",
    sectorId: "all",
  });

  // Queries
  const { data: lostProjectsData, isLoading: loading } = useQuery<LostProjectsResponse>({
    queryKey: ["marketing", "lost-projects", filters, currentPage],
    queryFn: async () => {
      const token = localStorage.getItem("marketingToken");
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', limit.toString());
      if (filters.search) params.append('search', filters.search);
      if (filters.year) params.append('year', filters.year);
      if (filters.quarter && filters.quarter !== "all") params.append('quarter', filters.quarter);
      if (filters.marketerId && filters.marketerId !== "all") params.append('marketerId', filters.marketerId);
      if (filters.sectorId && filters.sectorId !== "all") params.append('sectorId', filters.sectorId);

      const response = await fetch(`/api/marketing/lost-projects?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch lost projects');
      return response.json();
    },
    staleTime: 300000,
  });

  const lostProjects = lostProjectsData?.lostProjects || [];
  const totalPages = lostProjectsData?.totalPages || 1;
  const totalCount = lostProjectsData?.totalCount || 0;

  // Query for dormant students (B2C)
  const { data: dormantStudentsData, isLoading: dormantLoading } = useQuery({
    queryKey: ["marketing", "dormant-students", filters.search, filters.marketerId, currentPage],
    queryFn: async () => {
      const token = localStorage.getItem("marketingToken");
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', limit.toString());
      if (filters.search) params.append('search', filters.search);
      if (filters.marketerId && filters.marketerId !== "all") params.append('marketerId', filters.marketerId);

      const response = await fetch(`/api/marketing/dormant-students?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch dormant students');
      return response.json();
    },
    enabled: activeTab === "b2c",
    staleTime: 300000,
  });

  const dormantStudents = dormantStudentsData?.dormantStudents || [];
  const dormantTotalPages = dormantStudentsData?.totalPages || 1;
  const dormantTotalCount = dormantStudentsData?.totalCount || 0;

  const reviveDormantMutation = useMutation({
    mutationFn: async ({ studentId }: { studentId: string }) => {
      const token = localStorage.getItem("marketingToken");
      const res = await fetch("/api/marketing/kanban/update-stage", {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id: studentId, newStatus: "prospect_booking", currentStatus: "prospect_registration" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to log booking");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Booking Logged", description: "The student has successfully booked the sitting and is restored to active status!" });
      queryClient.invalidateQueries({ queryKey: ["marketing", "dormant-students"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "prospects"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "stats"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const { data: sectorsData } = useQuery<{ sectors: Sector[] }>({
    queryKey: ["marketing", "sectors", "list"],
    queryFn: async () => {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/sectors", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to load sectors");
      return response.json();
    },
    staleTime: 600000,
  });

  const sectors = sectorsData?.sectors || [];

  const { data: marketersData } = useQuery<{ users: MarketingUser[] }>({
    queryKey: ["marketing", "users", "list"],
    queryFn: async () => {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/users?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to load marketers");
      return response.json();
    },
    enabled: showMarketerInfo,
    staleTime: 600000,
  });

  const marketers = marketersData?.users || [];
  
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

  const campaigns = campaignsData?.campaigns || [];

  const hasActiveFilters = useMemo(() => {
    return !!(filters.search ||
      (filters.year && filters.year !== new Date().getFullYear().toString()) ||
      (filters.quarter && filters.quarter !== "all") ||
      (filters.marketerId && filters.marketerId !== "all") ||
      (filters.sectorId && filters.sectorId !== "all"));
  }, [filters]);

  // Modal states
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReviveModalOpen, setIsReviveModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<LostProject | null>(null);
  const [editReason, setEditReason] = useState('');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const quarters = [
    { value: 'Q1', label: 'Q1 (Jan-Mar)' },
    { value: 'Q2', label: 'Q2 (Apr-Jun)' },
    { value: 'Q3', label: 'Q3 (Jul-Sep)' },
    { value: 'Q4', label: 'Q4 (Oct-Dec)' },
  ];

  const formatCurrency = (amount: string | number | undefined) => {
    if (amount === undefined || amount === null) return "KES 0";
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return "KES 0";
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy");
  };

  // Mutations
  const reviveMutation = useMutation({
    mutationFn: async ({ projectId, stage }: { projectId: string; stage: string }) => {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/lost-projects/${projectId}/revive`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stage }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revive project');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Project revived successfully" });
      setIsReviveModalOpen(false);
      setSelectedProject(null);
      queryClient.invalidateQueries({ queryKey: ["marketing", "lost-projects"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "prospects"] });
      queryClient.invalidateQueries({ queryKey: ["marketing", "stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const editReasonMutation = useMutation({
    mutationFn: async ({ projectId, lostReason }: { projectId: string; lostReason: string }) => {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/lost-projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lostReason }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update reason');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Lost reason updated successfully" });
      setIsEditModalOpen(false);
      setSelectedProject(null);
      setEditReason('');
      queryClient.invalidateQueries({ queryKey: ["marketing", "lost-projects"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleReviveProject = async (projectId: string, stage: string = 'prospect') => {
    reviveMutation.mutate({ projectId, stage });
  };

  const handleEditReason = async () => {
    if (!selectedProject || !editReason.trim()) return;
    editReasonMutation.mutate({ projectId: selectedProject.id, lostReason: editReason.trim() });
  };

  const openViewModal = (project: LostProject) => {
    setSelectedProject(project);
    setIsViewModalOpen(true);
  };

  const openEditModal = (project: LostProject) => {
    setSelectedProject(project);
    setEditReason(project.lostReason);
    setIsEditModalOpen(true);
  };

  const openReviveModal = (project: LostProject) => {
    setSelectedProject(project);
    setIsReviveModalOpen(true);
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      year: new Date().getFullYear().toString(),
      quarter: "all",
      marketerId: selectedMarketer || "all",
      sectorId: "all",
    });
    setCurrentPage(1);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.year && filters.year !== new Date().getFullYear().toString()) count++;
    if (filters.quarter && filters.quarter !== "all") count++;
    if (filters.marketerId && filters.marketerId !== "all" && filters.marketerId !== selectedMarketer) count++;
    if (filters.sectorId && filters.sectorId !== "all") count++;
    return count;
  };


  return (
    <div className="space-y-6">
      <MarketingPageHeader
        title="Lost Projects"
        subtitle="Manage and review projects that were not won. Identify reasons and potential for future revival."
        icon={XCircle}
        onSearchChange={(val) => {
          setFilters(prev => ({ ...prev, search: val }));
          setCurrentPage(1);
        }}
        searchValue={filters.search}
        searchPlaceholder="Search by organization or reason..."
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
        <Card className="border-gray-200 shadow-none bg-gray-50/30">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Year Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
                  <Calendar className="h-3 w-3 mr-1.5 text-[#004E98]" />
                  Year
                </label>
                <Select
                  value={filters.year}
                  onValueChange={(val) => {
                    setFilters(prev => ({ ...prev, year: val }));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 bg-white border-gray-200">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quarter Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quarter</label>
                <Select
                  value={filters.quarter}
                  onValueChange={(val) => {
                    setFilters(prev => ({ ...prev, quarter: val }));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 bg-white border-gray-200">
                    <SelectValue placeholder="All quarters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All quarters</SelectItem>
                    {quarters.map((q) => (
                      <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sector Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
                  <Building2 className="h-3 w-3 mr-1.5 text-[#004E98]" />
                  Sector
                </label>
                <Select
                  value={filters.sectorId}
                  onValueChange={(val) => {
                    setFilters(prev => ({ ...prev, sectorId: val }));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 bg-white border-gray-200">
                    <SelectValue placeholder="All sectors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sectors</SelectItem>
                    {Array.isArray(sectors) && sectors.map((sector: Sector) => (
                      <SelectItem key={sector.id} value={sector.id}>
                        {sector.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Marketer Filter */}
              {showMarketerInfo && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
                    <User className="h-3 w-3 mr-1.5 text-[#004E98]" />
                    Marketer
                  </label>
                  <Select
                    value={filters.marketerId}
                    onValueChange={(val) => {
                      setFilters(prev => ({ ...prev, marketerId: val }));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-10 bg-white border-gray-200">
                      <SelectValue placeholder="All marketers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All marketers</SelectItem>
                      {Array.isArray(marketers) && marketers.map((m: MarketingUser) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.firstName} {m.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Clear Filters */}
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="h-10 text-gray-500 hover:text-red-500 hover:bg-red-50 font-bold text-xs uppercase"
                  disabled={!hasActiveFilters}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="px-4 mb-4">
        <div className="flex items-center space-x-1 bg-gray-100/50 p-1 rounded-xl w-fit border border-gray-200/50 shadow-sm backdrop-blur-sm">
          <Button
            variant={activeTab === "b2b" ? "default" : "ghost"}
            size="sm"
            onClick={() => { setActiveTab("b2b"); setCurrentPage(1); }}
            className={cn(
              "rounded-lg px-6 font-bold transition-all duration-300",
              activeTab === "b2b" 
                ? "bg-[#004E98] text-white shadow-md shadow-blue-900/20" 
                : "text-gray-500 hover:text-gray-900 hover:bg-white"
            )}
          >
            Lost Business Projects
          </Button>
          <Button
            variant={activeTab === "b2c" ? "default" : "ghost"}
            size="sm"
            onClick={() => { setActiveTab("b2c"); setCurrentPage(1); }}
            className={cn(
              "rounded-lg px-6 font-bold transition-all duration-300",
              activeTab === "b2c" 
                ? "bg-[#004E98] text-white shadow-md shadow-blue-900/20" 
                : "text-gray-500 hover:text-gray-900 hover:bg-white"
            )}
          >
            Dormant Students (120+ Days)
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="border-t">
            {activeTab === "b2b" ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="font-semibold text-gray-700">Organization</TableHead>
                    {showMarketerInfo && <TableHead className="font-semibold text-gray-700">Marketer</TableHead>}
                    <TableHead className="font-semibold text-gray-700">Contact Details</TableHead>
                    <TableHead className="font-semibold text-gray-700">Sector</TableHead>
                    <TableHead className="font-semibold text-gray-700">Revenue</TableHead>
                    <TableHead className="font-semibold text-gray-700">Lost Date</TableHead>
                    <TableHead className="font-semibold text-gray-700">Reason (Preview)</TableHead>
                    <TableHead className="font-semibold text-gray-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={showMarketerInfo ? 8 : 7} className="h-24 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="h-5 w-5 animate-spin text-[#004E98]" />
                          <span className="text-sm text-gray-500">Loading lost projects...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : lostProjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={showMarketerInfo ? 8 : 7} className="h-24 text-center text-gray-500">
                        <div className="flex flex-col items-center space-y-2">
                          <AlertTriangle className="h-8 w-8 text-gray-300" />
                          <p>No lost projects found</p>
                          <p className="text-sm text-gray-400">Try adjusting your filters</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    Array.isArray(lostProjects) && lostProjects.map((project: LostProject) => (
                      <TableRow key={project.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-2">
                            <Building2 className="h-4 w-4 text-gray-500" />
                            <span>{project.organisationName}</span>
                          </div>
                        </TableCell>
                        {showMarketerInfo && (
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <User className="h-4 w-4 text-gray-500" />
                              <div>
                                <p className="font-medium">{project.marketerName}</p>
                                <p className="text-xs text-gray-500">{project.marketerEmail}</p>
                              </div>
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="space-y-1">
                            {project.contactPerson && (
                              <div className="flex items-center space-x-2 text-sm">
                                <User className="h-3 w-3 text-gray-400" />
                                <span>{project.contactPerson}</span>
                              </div>
                            )}
                            {project.contactNumber && (
                              <div className="flex items-center space-x-2 text-sm">
                                <Phone className="h-3 w-3 text-gray-400" />
                                <span>{project.contactNumber}</span>
                              </div>
                            )}
                            {project.contactEmail && (
                              <div className="flex items-center space-x-2 text-sm">
                                <Mail className="h-3 w-3 text-gray-400" />
                                <span className="truncate max-w-[150px]">{project.contactEmail}</span>
                              </div>
                            )}
                            {!project.contactPerson && !project.contactNumber && !project.contactEmail && (
                              <span className="text-gray-400 text-sm">No contact details</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {project.sector}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatCurrency(project.revenue)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">{formatDate(project.lostDate)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-pointer hover:underline text-sm">
                                  {project.lostReason.length > 50
                                    ? project.lostReason.substring(0, 50) + "..."
                                    : project.lostReason}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-white p-4 shadow-xl border-gray-100 max-w-sm rounded-xl">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-red-600 font-bold text-xs uppercase tracking-wider">
                                    <AlertTriangle className="h-3 w-3" />
                                    Lost Reason
                                  </div>
                                  <p className="text-sm text-gray-600 leading-relaxed italic">
                                    "{project.lostReason}"
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
                                    onClick={() => openViewModal(project)}
                                  >
                                    <Eye className="h-4 w-4 text-gray-500" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-white p-2 shadow-lg border-gray-100 rounded-md">
                                  <p className="text-xs font-medium text-gray-700">View Details</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-gray-100"
                                    onClick={() => openEditModal(project)}
                                  >
                                    <Edit className="h-4 w-4 text-gray-500" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-white p-2 shadow-lg border-gray-100 rounded-md">
                                  <p className="text-xs font-medium text-[#004E98]">Edit Reason</p>
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
                                    onClick={() => openReviveModal(project)}
                                  >
                                    <ArrowRight className="h-4 w-4 text-[#01a64e]" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Revive Project</p>
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
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="font-semibold text-gray-700">Student Name</TableHead>
                    {showMarketerInfo && <TableHead className="font-semibold text-gray-700">Ambassador</TableHead>}
                    <TableHead className="font-semibold text-gray-700">Contact Details</TableHead>
                    <TableHead className="font-semibold text-gray-700">Registration Date</TableHead>
                    <TableHead className="font-semibold text-gray-700">Last Active Date</TableHead>
                    <TableHead className="font-semibold text-gray-700">Dormant Period</TableHead>
                    <TableHead className="font-semibold text-gray-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dormantLoading ? (
                    <TableRow>
                      <TableCell colSpan={showMarketerInfo ? 7 : 6} className="h-24 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="h-5 w-5 animate-spin text-[#004E98]" />
                          <span className="text-sm text-gray-500">Loading dormant students...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : dormantStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={showMarketerInfo ? 7 : 6} className="h-24 text-center text-gray-500">
                        No dormant students found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    dormantStudents.map((student: any) => {
                      const daysInactive = Math.round(
                        (new Date().getTime() - new Date(student.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
                      );
                      return (
                        <TableRow key={student.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="font-semibold text-slate-900">
                            <div>
                              <span className="block">{student.client}</span>
                              <span className="text-[10px] text-gray-400 uppercase tracking-widest font-black">
                                Student Lead
                              </span>
                            </div>
                          </TableCell>
                          {showMarketerInfo && (
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-800">{student.bdName}</span>
                                <span className="text-xs text-gray-400">{student.bdEmail}</span>
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex flex-col text-xs text-gray-600 gap-0.5 font-semibold">
                              {student.contactNumber && <span>{student.contactNumber}</span>}
                              {student.contactEmail && <span className="text-gray-400 font-normal">{student.contactEmail}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">{formatDate(student.date)}</TableCell>
                          <TableCell className="text-xs text-gray-500">{formatDate(student.updatedAt)}</TableCell>
                          <TableCell>
                            <Badge className="bg-red-50 text-red-700 border-red-100 font-bold hover:bg-red-50">
                              {daysInactive} Days Dormant
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                onClick={() => reviveDormantMutation.mutate({ studentId: student.id })}
                                disabled={reviveDormantMutation.isPending}
                                className="bg-[#01a64e] hover:bg-[#006341] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-900/10"
                              >
                                {reviveDormantMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                )}
                                Book Sitting
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {activeTab === "b2b" ? (
            totalPages > 1 && (
              <div className="flex items-center justify-between py-4 px-4">
                <div className="text-sm text-gray-500">
                  Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalCount)} of {totalCount} results
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                      if (pageNum > totalPages) return null;
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )
          ) : (
            dormantTotalPages > 1 && (
              <div className="flex items-center justify-between py-4 px-4">
                <div className="text-sm text-gray-500">
                  Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, dormantTotalCount)} of {dormantTotalCount} results
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || dormantLoading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, dormantTotalPages) }, (_, i) => {
                      const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                      if (pageNum > dormantTotalPages) return null;
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === dormantTotalPages || dormantLoading}
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* View Project Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-[#004E98]" />
              <span>Project Details</span>
            </DialogTitle>
            <DialogDescription>
              Complete information about the lost project
            </DialogDescription>
          </DialogHeader>

          {selectedProject && (
            <div className="space-y-6">
              {/* Project Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Organization</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium">{selectedProject.organisationName}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Sector</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <Badge variant="outline">{selectedProject.sector}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Product</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <p>{selectedProject.product}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Revenue</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <p className="font-mono">{formatCurrency(selectedProject.revenue)}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Expected Quarter</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <p>{selectedProject.expectedQuarter}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Lost Date</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <p>{formatDate(selectedProject.lostDate)}</p>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div>
                <Label className="text-sm font-medium text-gray-700">Contact Details</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-lg space-y-2">
                  {selectedProject.contactPerson && (
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span>{selectedProject.contactPerson}</span>
                    </div>
                  )}
                  {selectedProject.contactNumber && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span>{selectedProject.contactNumber}</span>
                    </div>
                  )}
                  {selectedProject.contactEmail && (
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span>{selectedProject.contactEmail}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Comments */}
              {selectedProject.comments && (
                <div>
                  <Label className="text-sm font-medium text-gray-700">Comments</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm">{selectedProject.comments}</p>
                  </div>
                </div>
              )}

              {/* Lost Reason */}
              <div>
                <Label className="text-sm font-medium text-gray-700">Lost Reason</Label>
                <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-gray-700">{selectedProject.lostReason}</p>
                </div>
              </div>

              {selectedProject.sourceCampaignId && (
                <div>
                  <Label className="text-sm font-medium text-gray-700">Source Campaign</Label>
                  <div className="mt-1 p-3 bg-blue-50/50 border border-blue-100/50 rounded-lg flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#004E98]" />
                    <p className="text-sm font-medium">
                      {campaigns.find((c: any) => c.id === selectedProject.sourceCampaignId)?.name || 'Campaign Associated'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Reason Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Lost Reason</DialogTitle>
            <DialogDescription>
              Update the reason why this project was lost
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="editReason">Lost Reason</Label>
              <Textarea
                id="editReason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Explain why this project was lost..."
                className="min-h-[120px] mt-1"
                maxLength={500}
              />
              <div className="text-xs text-gray-500 mt-1">
                {editReason.length}/500 characters
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditReason}
              disabled={editReasonMutation.isPending || !editReason.trim() || editReason.trim().length < 10}
            >
              {editReasonMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Reason'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revive Project Modal */}
      <Dialog open={isReviveModalOpen} onOpenChange={setIsReviveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <RotateCcw className="h-5 w-5 text-[#01a64e]" />
              <span>Revive Project</span>
            </DialogTitle>
            <DialogDescription>
              Move this project back to the active pipeline
            </DialogDescription>
          </DialogHeader>

          {selectedProject && (
            <div className="space-y-4">
              <div className="p-4 bg-[#D0AC01]/5 border border-[#D0AC01]/20 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-[#D0AC01] mt-0.5" />
                  <div>
                    <p className="font-medium text-[#bb8114]">Are you sure?</p>
                    <p className="text-sm text-[#bb8114] mt-1">
                      This will move "{selectedProject.organisationName}" back to prospects.
                      The project will be available for further processing.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Target Stage</Label>
                <Select defaultValue="prospect">
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReviveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedProject && handleReviveProject(selectedProject.id)}
              disabled={reviveMutation.isPending}
              className="bg-[#01a64e] hover:bg-[#006341]"
            >
              {reviveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reviving...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Revive Project
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}