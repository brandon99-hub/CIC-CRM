import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Search, Building2, ArrowLeft, FolderOpen, User, Phone, Mail, Settings, FileText, Grid3X3, List, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export interface Sector {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  institution: string;
  leadMarketer: string;
  contactPerson: string;
  contactNumber: string;
  currentVendor?: string;
  remarks?: string;
  sectorId: string;
  createdAt: string;
  updatedAt: string;
}

interface BDUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  onClose: () => void;
}

const projectSchema = z.object({
  institution: z.string().min(1, "Institution name is required"),
  leadMarketer: z.string().optional(),
  contactPerson: z.string().optional(),
  contactNumber: z.string().optional(),
  currentVendor: z.string().optional(),
  remarks: z.string().optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface SectorsManagementProps {
  onSuccess?: () => void;
  externalSearch?: string;
  externalViewMode?: 'table' | 'grid';
  isExternalCreateOpen?: boolean;
  onExternalCreateClose?: () => void;
  onSectorSelect?: (sector: Sector | null) => void;
  isProjectCreateOpenExternal?: boolean;
  onProjectCreateCloseExternal?: () => void;
  externalSelectedSector?: Sector | null;
}

export function SectorsManagement({ 
  onSuccess, 
  externalSearch, 
  externalViewMode,
  isExternalCreateOpen,
  onExternalCreateClose,
  onSectorSelect,
  isProjectCreateOpenExternal,
  onProjectCreateCloseExternal,
  externalSelectedSector
}: SectorsManagementProps) {
  const queryClient = useQueryClient();
  const token = () => localStorage.getItem("marketingToken");

  const [searchTerm, setSearchTerm] = useState("");
  const [isInternalCreateOpen, setIsInternalCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [assigningProject, setAssigningProject] = useState<Project | null>(null);
  const [selectedMarketer, setSelectedMarketer] = useState<string>("");
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');

  const [isProjectCreateOpenInternal, setIsProjectCreateOpenInternal] = useState(false);
  const isProjectCreateOpen = isProjectCreateOpenExternal !== undefined ? isProjectCreateOpenExternal : isProjectCreateOpenInternal;
  const setIsProjectCreateOpen = (open: boolean) => {
    if (onProjectCreateCloseExternal && !open) onProjectCreateCloseExternal();
    setIsProjectCreateOpenInternal(open);
  };

  const [projectsPage, setProjectsPage] = useState(1);
  const [isProjectEditOpen, setIsProjectEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const {
    register: registerProject,
    handleSubmit: handleProjectSubmit,
    formState: { errors: projectErrors },
    reset: resetProject,
    setValue: setProjectValue,
    watch: watchProject,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      institution: "",
      leadMarketer: "unassigned",
      contactPerson: "",
      contactNumber: "",
      currentVendor: "",
      remarks: "",
    },
  });

  useEffect(() => {
    // If externalSelectedSector is null, go back to sectors list
    if (externalSelectedSector === null) {
      handleBackToSectors();
    } 
    // If it's a sector object, select it
    else if (externalSelectedSector) {
      handleSectorClick(externalSelectedSector);
    }
  }, [externalSelectedSector]);

  const effectiveSearch = externalSearch !== undefined ? externalSearch : searchTerm;
  const effectiveViewMode = externalViewMode !== undefined ? externalViewMode : viewMode;
  const isCreateOpen = isExternalCreateOpen !== undefined ? isExternalCreateOpen : isInternalCreateOpen;
  const setIsCreateOpen = (open: boolean) => {
    if (onExternalCreateClose && !open) onExternalCreateClose();
    setIsInternalCreateOpen(open);
  };

  const { data: sectorsData, isLoading: loading } = useQuery<{ sectors: Sector[] }>({
    queryKey: ["marketing", "sectors", "list"],
    queryFn: async () => {
      const response = await fetch("/api/marketing/sectors", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!response.ok) throw new Error("Failed to load sectors");
      return response.json();
    },
    staleTime: 600000,
  });

  const { data: bdUsersData } = useQuery<{ users: BDUser[] }>({
    queryKey: ["marketing", "users", "list"],
    queryFn: async () => {
      const response = await fetch("/api/marketing/users", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!response.ok) throw new Error("Failed to load BD users");
      return response.json();
    },
    staleTime: 600000,
  });

  const { data: projectsData, isLoading: isLoadingProjects } = useQuery<any>({
    queryKey: ["marketing", "projects", selectedSector?.id, projectsPage],
    queryFn: async () => {
      if (!selectedSector) return null;
      const response = await fetch(`/api/marketing/projects?sectorId=${selectedSector.id}&page=${projectsPage}&limit=10`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!response.ok) throw new Error("Failed to load projects");
      return response.json();
    },
    enabled: !!selectedSector,
  });

  const sectors = sectorsData?.sectors || [];
  const bdUsers = bdUsersData?.users || [];
  const projects = projectsData?.projects || [];
  const projectsPagination = projectsData?.pagination || { page: 1, limit: 10, total: 0, pages: 1 };


  const saveSectorMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingSector ? `/api/marketing/sectors/${editingSector.id}` : "/api/marketing/sectors";
      const method = editingSector ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${editingSector ? "update" : "create"} sector`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: `Sector ${editingSector ? "updated" : "created"} successfully` });
      setIsCreateOpen(false);
      setIsEditOpen(false);
      setEditingSector(null);
      setFormData({ name: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["marketing", "sectors"] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteSectorMutation = useMutation({
    mutationFn: async (sectorId: string) => {
      const response = await fetch(`/api/marketing/sectors/${sectorId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to deactivate sector");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Sector deactivated successfully" });
      queryClient.invalidateQueries({ queryKey: ["marketing", "sectors"] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleCreate = () => saveSectorMutation.mutate(formData);
  const handleEdit = () => saveSectorMutation.mutate(formData);
  const handleDelete = (sectorId: string) => {
    if (confirm("Are you sure you want to deactivate this sector?")) {
      deleteSectorMutation.mutate(sectorId);
    }
  };

  const openEditDialog = (sector: Sector) => {
    setEditingSector(sector);
    setFormData({
      name: sector.name,
      description: sector.description || "",
    });
    setIsEditOpen(true);
  };

  const handleSectorClick = (sector: Sector) => {
    setSelectedSector(sector);
    setProjectsPage(1);
    onSectorSelect?.(sector);
  };

  const handleBackToSectors = () => {
    setSelectedSector(null);
    setProjectsPage(1);
    onSectorSelect?.(null);
  };

  const saveProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string, data: ProjectFormData }) => {
      const url = id ? `/api/marketing/projects/${id}` : "/api/marketing/projects";
      const method = id ? "PUT" : "POST";
      const requestData = {
        ...data,
        leadMarketer: data.leadMarketer === "unassigned" ? undefined : data.leadMarketer,
        sectorId: selectedSector?.id,
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${id ? "update" : "create"} project`);
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: "Success", description: `Project ${variables.id ? "updated" : "created"} successfully` });
      setIsProjectCreateOpen(false);
      setIsProjectEditOpen(false);
      setEditingProject(null);
      resetProject();
      queryClient.invalidateQueries({ queryKey: ["marketing", "projects", selectedSector?.id] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch(`/api/marketing/projects/${projectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete project");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Project deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["marketing", "projects", selectedSector?.id] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleProjectCreate = (data: ProjectFormData) => saveProjectMutation.mutate({ data });
  const handleProjectEdit = (data: ProjectFormData) => saveProjectMutation.mutate({ id: editingProject?.id, data });
  const handleProjectDelete = (projectId: string) => {
    if (confirm("Are you sure you want to delete this project?")) {
      deleteProjectMutation.mutate(projectId);
    }
  };

  const openProjectEditDialog = (project: Project) => {
    setEditingProject(project);
    setProjectValue("institution", project.institution);
    setProjectValue("leadMarketer", project.leadMarketer || "unassigned");
    setProjectValue("contactPerson", project.contactPerson || "");
    setProjectValue("contactNumber", project.contactNumber || "");
    setProjectValue("currentVendor", project.currentVendor || "");
    setProjectValue("remarks", project.remarks || "");
    setIsProjectEditOpen(true);
  };

  const handleAssignProject = (project: Project) => {
    setAssigningProject(project);
    setSelectedMarketer("");
    setIsAssignOpen(true);
  };

  const assignProjectMutation = useMutation({
    mutationFn: async ({ id, marketerId }: { id: string, marketerId: string }) => {
      const response = await fetch(`/api/marketing/projects/${id}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ leadMarketer: marketerId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to assign project");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Project assigned successfully" });
      setIsAssignOpen(false);
      setAssigningProject(null);
      setSelectedMarketer("");
      queryClient.invalidateQueries({ queryKey: ["marketing", "projects", selectedSector?.id] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleConfirmAssignment = () => {
    if (assigningProject && selectedMarketer) {
      assignProjectMutation.mutate({ id: assigningProject.id, marketerId: selectedMarketer });
    }
  };

  const filteredSectors = sectors.filter(sector =>
    sector.name.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
    (sector.description && sector.description.toLowerCase().includes(effectiveSearch.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="text-gray-500">Loading sectors...</div>
        </div>
      </div>
    );
  }

  // Show projects view if a sector is selected
  if (selectedSector) {
    return (
      <div className="space-y-6">
        {!onSectorSelect && (
          <div className="flex items-center space-x-4 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToSectors}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sectors
            </Button>
          </div>
        )}

        {/* Add Project Button */}
        {!onSectorSelect && (
          <div className="flex justify-end">
            <Button 
              onClick={() => setIsProjectCreateOpen(true)}
              className="bg-[#004E98] hover:bg-[#003B73]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Project
            </Button>
          </div>
        )}
        <Dialog open={isProjectCreateOpen} onOpenChange={setIsProjectCreateOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
              <DialogHeader className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[#004E98]/10 rounded-lg flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-[#004E98]" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-semibold">Add New Project</DialogTitle>
                    <DialogDescription className="text-gray-600">
                      Add a new project to the <span className="font-medium text-[#004E98]">{selectedSector.name}</span> sector.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <form onSubmit={handleProjectSubmit(handleProjectCreate)} className="space-y-6" noValidate>
                {/* Basic Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-1 h-6 bg-[#004E98] rounded-full"></div>
                    <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="institution" className="text-sm font-medium text-gray-700">
                        Institution Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="institution"
                        {...registerProject("institution")}
                        className={`h-11 ${projectErrors.institution ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-[#004E98] focus:ring-[#004E98]"}`}
                        placeholder="Enter institution name"
                      />
                      {projectErrors.institution && (
                        <p className="text-sm text-red-500 flex items-center">
                          <span className="mr-1">⚠</span>
                          {projectErrors.institution.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="leadMarketer" className="text-sm font-medium text-gray-700">
                        Lead Marketer <span className="text-gray-400">(Optional)</span>
                      </Label>
                      <Select
                        value={watchProject("leadMarketer") || "unassigned"}
                        onValueChange={(value) => setProjectValue("leadMarketer", value)}
                      >
                        <SelectTrigger className="h-11 focus:border-[#004E98] focus:ring-[#004E98]">
                          <SelectValue placeholder="Select lead marketer (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">No assignment</SelectItem>
                          {bdUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Contact Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-1 h-6 bg-[#01a64e] rounded-full"></div>
                    <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
                    <span className="text-sm text-gray-500">(Optional)</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="contactPerson" className="text-sm font-medium text-gray-700">
                        Contact Person
                      </Label>
                      <Input
                        id="contactPerson"
                        {...registerProject("contactPerson")}
                        className="h-11 focus:border-[#004E98] focus:ring-[#004E98]"
                        placeholder="Enter contact person name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contactNumber" className="text-sm font-medium text-gray-700">
                        Contact Number
                      </Label>
                      <Input
                        id="contactNumber"
                        {...registerProject("contactNumber")}
                        className="h-11 focus:border-[#004E98] focus:ring-[#004E98]"
                        placeholder="Enter contact number"
                      />
                    </div>
                  </div>
                </div>


                {/* Additional Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-1 h-6 bg-[#e55f00] rounded-full"></div>
                    <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>
                    <span className="text-sm text-gray-500">(Optional)</span>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentVendor" className="text-sm font-medium text-gray-700">
                        Current Vendor
                      </Label>
                      <Input
                        id="currentVendor"
                        {...registerProject("currentVendor")}
                        className="h-11 focus:border-[#004E98] focus:ring-[#004E98]"
                        placeholder="Enter current vendor name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="remarks" className="text-sm font-medium text-gray-700">
                        Remarks & Notes
                      </Label>
                      <Textarea
                        id="remarks"
                        {...registerProject("remarks")}
                        className="focus:border-[#004E98] focus:ring-[#004E98] resize-none"
                        placeholder="Enter any additional remarks or notes about this project..."
                        rows={4}
                      />
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                  <div className="text-sm text-gray-500">
                    <span className="text-red-500">*</span> Required fields
                  </div>
                  <div className="flex items-center space-x-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsProjectCreateOpen(false)}
                      className="h-11 px-6"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="h-11 px-8 bg-[#004E98] hover:bg-[#003d7a]"
                      disabled={saveProjectMutation.isPending}
                    >
                      {saveProjectMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Project"
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
        </Dialog>

        {/* Projects Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FolderOpen className="h-5 w-5 mr-2" />
              Projects {isLoadingProjects ? '(Loading...)' : `(${projects.length})`}
            </CardTitle>
            <CardDescription>
              Manage projects within the {selectedSector.name} sector
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-[#004E98]" />
                  <p className="text-gray-600">Loading projects...</p>
                </div>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
                <p className="text-gray-500 mb-4">
                  Get started by adding your first project to this sector.
                </p>
                <Button onClick={() => setIsProjectCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Project
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Institution</TableHead>
                    <TableHead>Lead Marketer</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Contact Number</TableHead>
                    <TableHead>Current Vendor</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project: Project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.institution}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-gray-400" />
                          {project.leadMarketer ? (
                            <span className="text-sm">
                              {bdUsers.find(u => u.id === project.leadMarketer)?.firstName} {bdUsers.find(u => u.id === project.leadMarketer)?.lastName}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400 italic">Unassigned</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-gray-400" />
                          {project.contactPerson || (
                            <span className="text-sm text-gray-400 italic">Not provided</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 mr-2 text-gray-400" />
                          {project.contactNumber || (
                            <span className="text-sm text-gray-400 italic">Not provided</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {project.currentVendor || (
                          <span className="text-sm text-gray-400 italic">Not specified</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600 max-w-xs truncate">
                        {project.remarks || (
                          <span className="text-sm text-gray-400 italic">No remarks</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          {!project.leadMarketer && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleAssignProject(project)}
                              className="bg-[#004E98] hover:bg-[#003d7a] text-white"
                            >
                              <User className="h-4 w-4 mr-1" />
                              Assign
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openProjectEditDialog(project)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleProjectDelete(project.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Project Dialog */}
        <Dialog open={isProjectEditOpen} onOpenChange={setIsProjectEditOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#01a64e]/10 rounded-lg flex items-center justify-center">
                  <Edit className="h-5 w-5 text-[#01a64e]" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold">Edit Project</DialogTitle>
                  <DialogDescription className="text-gray-600">
                    Update the project information and details.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleProjectSubmit(handleProjectEdit)} className="space-y-6" noValidate>
              {/* Basic Information Section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="w-1 h-6 bg-[#004E98] rounded-full"></div>
                  <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="edit-institution" className="text-sm font-medium text-gray-700">
                      Institution Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="edit-institution"
                      {...registerProject("institution")}
                      className={`h-11 ${projectErrors.institution ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-[#004E98] focus:ring-[#004E98]"}`}
                      placeholder="Enter institution name"
                    />
                    {projectErrors.institution && (
                      <p className="text-sm text-red-500 flex items-center">
                        <span className="mr-1">⚠</span>
                        {projectErrors.institution.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-leadMarketer" className="text-sm font-medium text-gray-700">
                      Lead Marketer <span className="text-gray-400">(Optional)</span>
                    </Label>
                    <Select
                      value={watchProject("leadMarketer") || "unassigned"}
                      onValueChange={(value) => setProjectValue("leadMarketer", value)}
                    >
                      <SelectTrigger className="h-11 focus:border-[#004E98] focus:ring-[#004E98]">
                        <SelectValue placeholder="Select lead marketer (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">No assignment</SelectItem>
                        {bdUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="w-1 h-6 bg-[#01a64e] rounded-full"></div>
                  <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
                  <span className="text-sm text-gray-500">(Optional)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="edit-contactPerson" className="text-sm font-medium text-gray-700">
                      Contact Person
                    </Label>
                    <Input
                      id="edit-contactPerson"
                      {...registerProject("contactPerson")}
                      className="h-11 focus:border-[#004E98] focus:ring-[#004E98]"
                      placeholder="Enter contact person name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-contactNumber" className="text-sm font-medium text-gray-700">
                      Contact Number
                    </Label>
                    <Input
                      id="edit-contactNumber"
                      {...registerProject("contactNumber")}
                      className="h-11 focus:border-[#004E98] focus:ring-[#004E98]"
                      placeholder="Enter contact number"
                    />
                  </div>
                </div>
              </div>


              {/* Additional Information Section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="w-1 h-6 bg-[#e55f00] rounded-full"></div>
                  <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>
                  <span className="text-sm text-gray-500">(Optional)</span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-currentVendor" className="text-sm font-medium text-gray-700">
                      Current Vendor
                    </Label>
                    <Input
                      id="edit-currentVendor"
                      {...registerProject("currentVendor")}
                      className="h-11 focus:border-[#004E98] focus:ring-[#004E98]"
                      placeholder="Enter current vendor name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-remarks" className="text-sm font-medium text-gray-700">
                      Remarks & Notes
                    </Label>
                    <Textarea
                      id="edit-remarks"
                      {...registerProject("remarks")}
                      className="focus:border-[#004E98] focus:ring-[#004E98] resize-none"
                      placeholder="Enter any additional remarks or notes about this project..."
                      rows={4}
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  <span className="text-red-500">*</span> Required fields
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsProjectEditOpen(false)}
                    className="h-11 px-6"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="h-11 px-8 bg-[#01a64e] hover:bg-[#006341]"
                    disabled={saveProjectMutation.isPending}
                  >
                    {saveProjectMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Project"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Assignment Dialog */}
        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#004E98]/10 rounded-lg flex items-center justify-center">
                  <User className="h-5 w-5 text-[#004E98]" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold">Assign Project</DialogTitle>
                  <DialogDescription className="text-gray-600">
                    Assign this project to a marketer or business development team member.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6">
              {/* Project Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Project Details</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><span className="font-medium">Institution:</span> {assigningProject?.institution}</p>
                  <p><span className="font-medium">Sector:</span> {selectedSector?.name}</p>
                </div>
              </div>

              {/* Assignment Selection */}
              <div className="space-y-3">
                <Label htmlFor="marketer-select" className="text-sm font-medium text-gray-700">
                  Select Marketer/BD Member <span className="text-red-500">*</span>
                </Label>
                <Select value={selectedMarketer} onValueChange={setSelectedMarketer}>
                  <SelectTrigger className="h-11 focus:border-[#004E98] focus:ring-[#004E98]">
                    <SelectValue placeholder="Choose a team member to assign this project" />
                  </SelectTrigger>
                  <SelectContent>
                    {bdUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center space-x-2">
                          <span>{user.firstName} {user.lastName}</span>
                          <Badge variant="outline" className="text-xs">
                            {user.role.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assignment Note */}
              <div className="bg-[#004E98]/5 border border-[#004E98]/20 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <div className="w-5 h-5 bg-[#004E98]/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-[#004E98]">ℹ</span>
                  </div>
                  <div className="text-sm text-[#004E98]">
                    <p className="font-medium mb-1">What happens when you assign?</p>
                    <p>This project will be moved to the assigned marketer's prospects list and they will be responsible for following up with the client.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAssignOpen(false)}
                className="h-11 px-6"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmAssignment}
                disabled={!selectedMarketer || assignProjectMutation.isPending}
                className="h-11 px-8 bg-[#004E98] hover:bg-[#003d7a] disabled:bg-gray-300"
              >
                {assignProjectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  "Assign Project"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Show sectors view (default)
  return (
    <div className="space-y-6">
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Sector</DialogTitle>
            <DialogDescription>
              Add a new business sector to organize projects and prospects.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Sector Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Healthcare, Finance, Education"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of the sector"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saveSectorMutation.isPending}>
              {saveSectorMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editingSector ? "Updating..." : "Creating..."}
                </>
              ) : (
                editingSector ? "Update Sector" : "Create Sector"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sectors Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
            <Building2 className="h-5 w-5 text-[#004E98] mr-2" />
            Business Sectors
          </CardTitle>
          <CardDescription>
            {filteredSectors.length} sector{filteredSectors.length !== 1 ? 's' : ''} available
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredSectors.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? "No sectors found" : "No sectors yet"}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm
                  ? "Try adjusting your search terms."
                  : "Create your first business sector to organize projects."
                }
              </p>
              {!searchTerm && (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Sector
                </Button>
              )}
            </div>
          ) : effectiveViewMode === 'grid' ? (
            // Grid View
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSectors.map((sector) => (
                <Card
                  key={sector.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleSectorClick(sector)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-[#004E98]/10 rounded-lg flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-[#004E98]" />
                      </div>
                      <Badge
                        variant={sector.isActive ? "default" : "secondary"}
                      >
                        {sector.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {sector.name}
                    </h3>

                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {sector.description || "No description provided."}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {new Date(sector.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(sector);
                          }}
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(sector.id);
                          }}
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // Table View
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sector</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSectors.map((sector) => (
                    <TableRow
                      key={sector.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleSectorClick(sector)}
                    >
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">{sector.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">
                          {sector.description || "No description"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={sector.isActive ? "default" : "secondary"}
                        >
                          {sector.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">
                          {new Date(sector.createdAt).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(sector);
                            }}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(sector.id);
                            }}
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sector</DialogTitle>
            <DialogDescription>
              Update the sector information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Sector Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Healthcare, Finance, Education"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of the sector"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saveSectorMutation.isPending}>
              {saveSectorMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Sector"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
