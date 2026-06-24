import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Edit,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  Plus,
  UserCheck,
  UserX,
  Target,
  TrendingUp,
  LayoutDashboard,
  Mail,
  Shield,
} from "lucide-react";
import { format } from "date-fns";
import { MarketingPageHeader } from "./marketing-page-header";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MarketingUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

interface UsersResponse {
  users: MarketingUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function UserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = () => localStorage.getItem("marketingToken");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<MarketingUser | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    role: "marketer",
    bdType: "b2b",
    year: new Date().getFullYear(),
    target: "",
    revisedTarget: "",
    bookingTarget: "",
    commissionPercentage: "",
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never";
    return format(new Date(dateString), "MMM dd, yyyy");
  };

  const { data: usersResponse, isLoading: usersLoading } = useQuery<UsersResponse>({
    queryKey: ["marketing", "users", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...(search && { search }),
      });
      const response = await fetch(`/api/marketing/users?${params}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!response.ok) throw new Error("Failed to load users");
      return response.json();
    },
  });

  const { data: rolesData, isLoading: rolesLoading } = useQuery<{ roles: any[] }>({
    queryKey: ["admin", "roles"],
    queryFn: async () => {
      const response = await fetch("/api/admin/roles", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!response.ok) throw new Error("Failed to load roles");
      return response.json();
    },
  });

  const users = usersResponse?.users || [];
  const pagination = usersResponse?.pagination || { page: 1, limit: 10, total: 0, pages: 0 };
  const availableRoles = rolesData?.roles || [];

  const saveUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingUser ? `/api/marketing/users/${editingUser.id}` : "/api/marketing/auth/register";
      const method = editingUser ? "PUT" : "POST";
      const body = editingUser
        ? {
            firstName: data.firstName,
            lastName: data.lastName,
            phoneNumber: data.phoneNumber,
            role: data.role,
            bdType: data.bdType,
          }
        : {
            email: data.email,
            password: data.password,
            firstName: data.firstName,
            lastName: data.lastName,
            phoneNumber: data.phoneNumber,
            role: data.role,
            bdType: data.bdType,
          };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save user");
      }
      return response.json();
    },
    onSuccess: async (data) => {
      const savedUser = data.user || data.newUser;
      const userId = editingUser ? editingUser.id : savedUser?.id;

      if (userId) {
        try {
          await fetch("/api/marketing/admin/set-target", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token()}`,
            },
            body: JSON.stringify({
              marketerId: userId,
              year: formData.year,
              target: formData.target ? parseFloat(formData.target) : 0,
              revisedTarget: formData.revisedTarget ? parseFloat(formData.revisedTarget) : undefined,
              bookingTarget: formData.bookingTarget ? parseInt(formData.bookingTarget) : 0,
              commissionPercentage: formData.commissionPercentage ? parseInt(formData.commissionPercentage) : 5,
            }),
          });
        } catch (err) {
          console.error("Error setting targets during save:", err);
        }
      }

      setShowAddDialog(false);
      setEditingUser(null);
      setFormData({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        phoneNumber: "",
        role: "marketer",
        bdType: "b2b",
        year: new Date().getFullYear(),
        target: "",
        revisedTarget: "",
        bookingTarget: "",
        commissionPercentage: "",
      });
      queryClient.invalidateQueries({ queryKey: ["marketing"] });
      toast({ title: "Success", description: `User ${editingUser ? "updated" : "created"} successfully` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deactivateUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/marketing/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!response.ok) throw new Error("Failed to deactivate user");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing"] });
      toast({ title: "Success", description: "User deactivated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleEdit = async (user: MarketingUser) => {
    setEditingUser(user);
    const matchingRole = availableRoles.find(r => r.name.toLowerCase() === user.role.toLowerCase());
    
    const initialFormData = {
      email: user.email,
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: "",
      role: matchingRole ? matchingRole.name : user.role,
      bdType: (user as any).bdType || "b2b",
      year: new Date().getFullYear(),
      target: "",
      revisedTarget: "",
      bookingTarget: "",
      commissionPercentage: "",
    };

    setFormData(initialFormData);
    setShowAddDialog(true);

    try {
      const pipelineParam = (user as any).bdType === "b2c" ? "B2C" : "B2B";
      const response = await fetch(`/api/marketing/dashboard/stats?bdId=${user.id}&year=${new Date().getFullYear()}&pipeline=${pipelineParam}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (response.ok) {
        const stats = await response.json();
        setFormData(prev => ({
          ...prev,
          target: (stats.target !== undefined && stats.target !== null) ? stats.target.toString() : "",
          revisedTarget: (stats.revisedTarget !== undefined && stats.revisedTarget !== null) ? stats.revisedTarget.toString() : "",
          bookingTarget: (stats.bookingTarget !== undefined && stats.bookingTarget !== null) ? stats.bookingTarget.toString() : "",
          commissionPercentage: (stats.commissionPercentage !== undefined && stats.commissionPercentage !== null) ? stats.commissionPercentage.toString() : "",
        }));
      }
    } catch (error) {
      console.error("Failed to fetch user targets:", error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveUserMutation.mutate(formData);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to deactivate this user?")) {
      deactivateUserMutation.mutate(id);
    }
  };


  if (usersLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-[#004E98]" />
      </div>
    );
  }

  return (
    <>
      <MarketingPageHeader
        title="User Management"
        subtitle="Manage marketing team members, their roles, and dashboard access."
        icon={Users}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        searchValue={search}
        searchPlaceholder="Search users by name or email..."
        actionButton={{
          label: "Add User",
          icon: Plus,
          onClick: () => {
            setEditingUser(null);
            setFormData({
              email: "",
              password: "",
              firstName: "",
              lastName: "",
              phoneNumber: "",
              role: "marketer",
              bdType: "b2b",
              year: new Date().getFullYear(),
              target: "",
              revisedTarget: "",
              bookingTarget: "",
              commissionPercentage: "",
            });
            setShowAddDialog(true);
          }
        }}
      />

      <Card className="border-0 shadow-none bg-transparent">
        <CardContent className="p-0">
          <div className="hidden">
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader className="space-y-3 pb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#004E98]/50 to-purple-600 rounded-xl flex items-center justify-center">
                      {editingUser ? (
                        <Edit className="h-6 w-6 text-white" />
                      ) : (
                        <Plus className="h-6 w-6 text-white" />
                      )}
                    </div>
                    <div>
                      <DialogTitle className="text-2xl font-bold text-gray-900">
                        {editingUser ? "Edit User" : "Add New User"}
                      </DialogTitle>
                      <DialogDescription className="text-gray-600 text-base">
                        {editingUser ? "Update user information and permissions" : "Create a new marketing team member with access credentials"}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Personal Information Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                      <Users className="h-5 w-5 text-[#004E98]" />
                      <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-sm font-semibold text-gray-700 flex items-center space-x-1">
                          <span>First Name</span>
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          required
                          className="h-11 border-gray-300 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 rounded-lg transition-all duration-200"
                          placeholder="Enter first name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-sm font-semibold text-gray-700 flex items-center space-x-1">
                          <span>Last Name</span>
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          required
                          className="h-11 border-gray-300 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 rounded-lg transition-all duration-200"
                          placeholder="Enter last name"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Information Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                      <Mail className="h-5 w-5 text-[#004E98]" />
                      <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-semibold text-gray-700 flex items-center space-x-1">
                        <span>Email Address</span>
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        className="h-11 border-gray-300 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 rounded-lg transition-all duration-200"
                        placeholder="user@company.com"
                      />
                    </div>
                  </div>

                  {/* Security Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                      <Shield className="h-5 w-5 text-[#004E98]" />
                      <h3 className="text-lg font-semibold text-gray-900">Security & Access</h3>
                    </div>

                    {!editingUser && (
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-sm font-semibold text-gray-700 flex items-center space-x-1">
                          <span>Temporary Password</span>
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required={!editingUser}
                          className="h-11 border-gray-300 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 rounded-lg transition-all duration-200"
                          placeholder="Enter temporary password"
                        />
                        <p className="text-xs text-gray-500">
                          User will be required to change this password on first login
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="role" className="text-sm font-semibold text-gray-700 flex items-center space-x-1">
                        <span>User Role</span>
                        <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value) => setFormData({ ...formData, role: value })}
                      >
                        <SelectTrigger className="h-11 border-gray-300 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 rounded-lg transition-all duration-200">
                          <SelectValue placeholder={rolesLoading ? "Loading roles..." : "Select a role"} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoles.map((role) => (
                            <SelectItem key={role.id} value={role.name} className="py-3">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-[#004E98] rounded-full"></div>
                                <span>{role.name}</span>
                                {role.description && (
                                  <span className="text-xs text-gray-500">- {role.description.substring(0, 30)}...</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                          {availableRoles.length === 0 && !rolesLoading && (
                            <SelectItem value="none" disabled>No roles available</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* BD Profile & Performance Targets Section */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
                      <Target className="h-5 w-5 text-[#004E98]" />
                      <h3 className="text-lg font-semibold text-gray-900">BD Profile & Performance Targets</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bdType" className="text-sm font-semibold text-gray-700">
                          Business Developer Focus Type
                        </Label>
                        <Select
                          value={formData.bdType}
                          onValueChange={(value) => setFormData({ ...formData, bdType: value })}
                        >
                          <SelectTrigger className="h-11 border-gray-300 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 rounded-lg transition-all duration-200">
                            <SelectValue placeholder="Select BD focus track" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="b2b" className="py-2">B2B Executive (Corporate Revenue)</SelectItem>
                            <SelectItem value="b2c" className="py-2">Brand Ambassador (B2C Volume)</SelectItem>
                            <SelectItem value="both" className="py-2">Both Tracks (B2B & B2C)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="targetYear" className="text-sm font-semibold text-gray-700">
                          Target Year
                        </Label>
                        <Select
                          value={formData.year.toString()}
                          onValueChange={(value) => setFormData({ ...formData, year: parseInt(value) })}
                        >
                          <SelectTrigger className="h-11 border-gray-300 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 rounded-lg transition-all duration-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 5 }, (_, i) => {
                              const yr = new Date().getFullYear() + i;
                              return (
                                <SelectItem key={yr} value={yr.toString()}>{yr}</SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Conditional Target Inputs */}
                    {(formData.bdType === "b2b" || formData.bdType === "both") && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                        <div className="space-y-2">
                          <Label htmlFor="target" className="text-sm font-semibold text-blue-900">
                            Initial Revenue Target (KES)
                          </Label>
                          <Input
                            id="target"
                            type="number"
                            step="0.01"
                            value={formData.target}
                            onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                            className="h-11 bg-white border-blue-200 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 rounded-lg transition-all duration-200"
                            placeholder="Enter KES target amount"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="revisedTarget" className="text-sm font-semibold text-blue-900">
                            Revised Revenue Target (KES)
                          </Label>
                          <Input
                            id="revisedTarget"
                            type="number"
                            step="0.01"
                            value={formData.revisedTarget}
                            onChange={(e) => setFormData({ ...formData, revisedTarget: e.target.value })}
                            className="h-11 bg-white border-blue-200 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 rounded-lg transition-all duration-200"
                            placeholder="Enter KES revised amount"
                          />
                        </div>
                      </div>
                    )}

                    {(formData.bdType === "b2c" || formData.bdType === "both") && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                        <div className="space-y-2">
                          <Label htmlFor="bookingTarget" className="text-sm font-semibold text-emerald-900">
                            Policy Issuance Target (Count)
                          </Label>
                          <Input
                            id="bookingTarget"
                            type="number"
                            value={formData.bookingTarget}
                            onChange={(e) => setFormData({ ...formData, bookingTarget: e.target.value })}
                            className="h-11 bg-white border-emerald-200 focus:border-[#01a64e] focus:ring-2 focus:ring-[#01a64e]/20 rounded-lg transition-all duration-200"
                            placeholder="Enter exam booking count target"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="commissionPercentage" className="text-sm font-semibold text-emerald-900">
                            Commission Rate (%)
                          </Label>
                          <Input
                            id="commissionPercentage"
                            type="number"
                            min="0"
                            max="100"
                            value={formData.commissionPercentage}
                            onChange={(e) => setFormData({ ...formData, commissionPercentage: e.target.value })}
                            className="h-11 bg-white border-emerald-200 focus:border-[#01a64e] focus:ring-2 focus:ring-[#01a64e]/20 rounded-lg transition-all duration-200"
                            placeholder="Enter commission percentage (e.g. 5)"
                          />
                        </div>
                      </div>
                    )}
                  </div>



                  <DialogFooter className="gap-3 pt-6 border-t border-gray-200">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddDialog(false)}
                      disabled={saveUserMutation.isPending}
                      className="h-11 px-6 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={saveUserMutation.isPending}
                      className="h-11 px-6 bg-gradient-to-r from-[#004E98] to-[#0066a2] hover:from-[#003d7a] hover:to-[#005080] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saveUserMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {editingUser ? "Updating..." : "Adding..."}
                        </>
                      ) : editingUser ? (
                        <>
                          <Edit className="h-4 w-4 mr-2" />
                          Update User
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add User
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="font-semibold text-gray-700">Name</TableHead>
                  <TableHead className="font-semibold text-gray-700">Email</TableHead>
                  <TableHead className="font-semibold text-gray-700">Role</TableHead>
                  <TableHead className="font-semibold text-gray-700">Status</TableHead>
                  <TableHead className="font-semibold text-gray-700">Last Login</TableHead>
                  <TableHead className="font-semibold text-gray-700">Created</TableHead>
                  <TableHead className="font-semibold text-gray-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <Users className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">No users found</p>
                        <p className="text-sm text-gray-400">Start by adding your first team member</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} className="hover:bg-gray-50/50">
                      <TableCell className="font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell className="text-gray-600">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize border-blue-200 text-blue-700 bg-blue-50">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {user.isActive ? (
                            <>
                              <UserCheck className="h-4 w-4 text-[#01a64e]" />
                              <span className="text-sm text-[#01a64e]">Active</span>
                            </>
                          ) : (
                            <>
                              <UserX className="h-4 w-4 text-red-600" />
                              <span className="text-sm text-red-600">Inactive</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">{formatDate(user.lastLoginAt)}</TableCell>
                      <TableCell className="text-gray-600">{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-gray-100"
                                  onClick={() => handleEdit(user)}
                                >
                                  <Edit className="h-4 w-4 text-gray-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit User</p>
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
                                  onClick={() => handleDelete(user.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Deactivate User</p>
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


    </>
  );
}
