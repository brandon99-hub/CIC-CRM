import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { RevenueSharingModal } from "./revenue-sharing-modal";

const prospectsSchema = z.object({
  date: z.string().min(1, "Date is required"),
  client: z.string().min(1, "Client name is required"),
  contactPerson: z.string().min(1, "Contact person is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  contactEmail: z.string().email("Valid email is required"),
  remarks: z.string().optional(),
  revenue: z.number().min(0, "Revenue cannot be negative").optional().or(z.nan().transform(() => undefined)),
  stage: z.enum(['prospect', 'lead', 'expected_order', 'sales_won']),
  customerType: z.enum(['student', 'institution', 'organization', 'employer']).default('organization'),
  sectorId: z.string().optional(),
  sourceCampaignId: z.string().optional(),
});

type ProspectsFormData = z.infer<typeof prospectsSchema>;

interface Sector {
  id: string;
  name: string;
  description?: string;
}

interface MarketingProspectsFormProps {
  onSuccess: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  hideTrigger?: boolean;
  initialStage?: 'prospect' | 'lead';
}

export function MarketingProspectsForm({ onSuccess, isOpen, onClose, hideTrigger, initialStage = 'prospect' }: MarketingProspectsFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [existingProspect, setExistingProspect] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [preservedFormData, setPreservedFormData] = useState<any>(null);
  const { toast } = useToast();

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

  // Use external open state if provided
  const isDialogOpen = isOpen !== undefined ? isOpen : open;
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setOpen(false);
    }
    reset();
    setPreservedFormData(null); // Clear preserved data when closing
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ProspectsFormData>({
    resolver: zodResolver(prospectsSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      stage: initialStage,
    },
  });

  useEffect(() => {
    if (isDialogOpen) {
      setValue('stage', initialStage);
    }
  }, [isDialogOpen, initialStage]);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = () => {
    const userData = localStorage.getItem("marketingUser");
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  };

  const restoreFormData = () => {
    if (preservedFormData) {
      // Restore all the form fields
      Object.keys(preservedFormData).forEach(key => {
        setValue(key as any, preservedFormData[key]);
      });
    }
  };


  const checkForDuplicate = async (clientName: string, contactEmail: string, contactNumber: string) => {
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch("/api/marketing/prospects/check-duplicate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          client: clientName,
          contactEmail: contactEmail,
          contactNumber: contactNumber,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.isDuplicate && data.duplicates.length > 0 ? data.duplicates[0] : null;
      }
    } catch (error) {
      console.error("Error checking for duplicate:", error);
    }
    return null;
  };

  const handleRevenueSplit = async (splitData: any) => {
    try {
      const token = localStorage.getItem("marketingToken");
      const response = await fetch(`/api/marketing/prospects/${existingProspect.id}/split-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sharedWithMarketerId: currentUser.id,
          revenueSplit: splitData.newPercentage, // The percentage for the new marketer
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Revenue sharing arrangement created successfully",
        });
        setPreservedFormData(null); // Clear preserved data
        handleClose();
        onSuccess?.();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to create revenue sharing",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating revenue split:", error);
      toast({
        title: "Error",
        description: "Failed to create revenue sharing",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: ProspectsFormData) => {
    setLoading(true);
    try {
      // Check for duplicate prospect
      const duplicate = await checkForDuplicate(data.client, data.contactEmail, data.contactNumber);

      if (duplicate) {
        setExistingProspect(duplicate);
        // Preserve the form data before closing
        setPreservedFormData(data);
        // Close the main modal and open revenue sharing modal
        handleClose();
        setShowRevenueModal(true);
        setLoading(false);
        return;
      }

      // No duplicate found, create new prospect
      const token = localStorage.getItem("marketingToken");

      // Convert date to datetime format for backend
      const formattedData = {
        ...data,
        date: new Date(data.date).toISOString()
      };

      const response = await fetch("/api/marketing/prospects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formattedData),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Prospect created successfully!",
        });
        setPreservedFormData(null); // Clear preserved data
        handleClose();
        onSuccess?.();
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to create prospect",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to create prospect:", error);
      toast({
        title: "Error",
        description: "Failed to create prospect",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleClose}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Prospect
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#004E98]/10 rounded-lg flex items-center justify-center">
              <Plus className="h-5 w-5 text-[#004E98]" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">Add New {initialStage === 'lead' ? 'Lead' : 'Prospect'}</DialogTitle>
              <DialogDescription className="text-gray-600">
                Enter the details for the new {initialStage === 'lead' ? 'lead' : 'prospect'} to track potential business opportunities.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-1 h-6 bg-[#004E98] rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm font-medium text-gray-700">
                  Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="date"
                  type="date"
                  {...register("date")}
                  className={`h-11 ${errors.date ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-[#004E98] focus:ring-[#004E98]"}`}
                />
                {errors.date && (
                  <p className="text-sm text-red-500 flex items-center">
                    <span className="mr-1">⚠</span>
                    {errors.date.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerType" className="text-sm font-medium text-gray-700">
                  Stakeholder Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={watch("customerType")}
                  onValueChange={(value) => setValue("customerType", value as any)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student (Individual)</SelectItem>
                    <SelectItem value="institution">Institution (Partner)</SelectItem>
                    <SelectItem value="organization">Organization (Partner)</SelectItem>
                    <SelectItem value="employer">Employer (Partner)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client" className="text-sm font-medium text-gray-700">
                  Client Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="client"
                  {...register("client")}
                  className={`h-11 ${errors.client ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-[#004E98] focus:ring-[#004E98]"}`}
                  placeholder="Enter client name"
                />
                {errors.client && (
                  <p className="text-sm text-red-500 flex items-center">
                    <span className="mr-1">⚠</span>
                    {errors.client.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-1 h-6 bg-[#01a64e] rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="contactPerson" className="text-sm font-medium text-gray-700">
                  Contact Person <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contactPerson"
                  {...register("contactPerson")}
                  className={`h-11 ${errors.contactPerson ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-[#004E98] focus:ring-[#004E98]"}`}
                  placeholder="Enter contact person name"
                />
                {errors.contactPerson && (
                  <p className="text-sm text-red-500 flex items-center">
                    <span className="mr-1">⚠</span>
                    {errors.contactPerson.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactNumber" className="text-sm font-medium text-gray-700">
                  Contact Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contactNumber"
                  {...register("contactNumber")}
                  className={`h-11 ${errors.contactNumber ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-[#004E98] focus:ring-[#004E98]"}`}
                  placeholder="Enter contact number"
                />
                {errors.contactNumber && (
                  <p className="text-sm text-red-500 flex items-center">
                    <span className="mr-1">⚠</span>
                    {errors.contactNumber.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactEmail" className="text-sm font-medium text-gray-700">
                Contact Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contactEmail"
                type="email"
                {...register("contactEmail")}
                className={`h-11 ${errors.contactEmail ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-[#004E98] focus:ring-[#004E98]"}`}
                placeholder="Enter contact email"
              />
              {errors.contactEmail && (
                <p className="text-sm text-red-500 flex items-center">
                  <span className="mr-1">⚠</span>
                  {errors.contactEmail.message}
                </p>
              )}
            </div>
          </div>


          {/* Business Information Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-1 h-6 bg-[#e55f00] rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900">Business Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="sectorId" className="text-sm font-medium text-gray-700">
                  Sector <span className="text-gray-400">(Optional)</span>
                </Label>
                <Select
                  value={watch("sectorId") || undefined}
                  onValueChange={(value) => setValue("sectorId", value || undefined)}
                >
                  <SelectTrigger className="h-11 focus:border-[#004E98] focus:ring-[#004E98]">
                    <SelectValue placeholder="Select business sector (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((sector) => (
                      <SelectItem key={sector.id} value={sector.id}>
                        {sector.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="revenue" className="text-sm font-medium text-gray-700">
                  Revenue (KSH) <span className="text-gray-400">(Optional)</span>
                </Label>
                <Input
                  id="revenue"
                  type="number"
                  step="0.01"
                  {...register("revenue", { valueAsNumber: true })}
                  className={`h-11 ${errors.revenue ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "focus:border-[#004E98] focus:ring-[#004E98]"}`}
                  placeholder="0.00"
                />
                {errors.revenue && (
                  <p className="text-sm text-red-500 flex items-center">
                    <span className="mr-1">⚠</span>
                    {errors.revenue.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sourceCampaignId" className="text-sm font-medium text-gray-700">
                Source Campaign <span className="text-gray-400">(Optional)</span>
              </Label>
              <Select
                value={watch("sourceCampaignId") || undefined}
                onValueChange={(value) => setValue("sourceCampaignId", value || undefined)}
              >
                <SelectTrigger className="h-11 focus:border-[#004E98] focus:ring-[#004E98]">
                  <SelectValue placeholder="Select campaign that brought this lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None / Direct</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name} ({campaign.channel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-gray-400 italic pl-1">Tagging this helps in calculating ROI for your marketing campaigns.</p>
            </div>
          </div>

          {/* Additional Information Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-1 h-6 bg-gray-600 rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900">Additional Information</h3>
              <span className="text-sm text-gray-500">(Optional)</span>
            </div>

            <div className="space-y-4">

              <div className="space-y-2">
                <Label htmlFor="remarks" className="text-sm font-medium text-gray-700">
                  Remarks & Notes
                </Label>
                <Textarea
                  id="remarks"
                  {...register("remarks")}
                  className="focus:border-[#004E98] focus:ring-[#004E98] resize-none"
                  placeholder="Enter any additional remarks or notes about this prospect..."
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
                onClick={handleClose}
                disabled={loading}
                className="h-11 px-6"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="h-11 px-8 bg-[#004E98] hover:bg-[#003d7a]"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create {initialStage === 'lead' ? 'Lead' : 'Prospect'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>

      {/* Revenue Sharing Modal - Rendered outside main modal */}
      <RevenueSharingModal
        isOpen={showRevenueModal}
        onClose={() => setShowRevenueModal(false)}
        onBack={() => {
          setShowRevenueModal(false);
          // Restore the preserved form data
          restoreFormData();
          // Re-open the main modal
          if (isOpen !== undefined) {
            // If using external open state, we need to trigger it
            // This will be handled by the parent component
          } else {
            setOpen(true);
          }
        }}
        onConfirm={handleRevenueSplit}
        existingProspect={existingProspect}
        newMarketer={{
          id: currentUser?.id || '',
          name: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : '',
          email: currentUser?.email || ''
        }}
      />
    </Dialog>
  );
}