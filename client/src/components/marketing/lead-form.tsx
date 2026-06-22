import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Loader2,
  User,
  Users,
  Calendar,
  DollarSign,
  FileText,
  Phone,
  Target,
  Building2,
  MessageSquare
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { DocumentAttachmentSection } from "./document-attachment-section";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Paperclip } from "lucide-react";

const leadSchema = z.object({
  date: z.string().min(1, "Date is required"),
  client: z.string().min(1, "Client name is required"),
  contactPerson: z.string().min(1, "Contact person is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  contactEmail: z.string().email("Valid email is required"),
  remarks: z.string().optional(),
  revenue: z.number().min(0, "Revenue cannot be negative").optional().or(z.nan().transform(() => undefined)),
  salesStage: z.enum(['lead', 'prospect_registration', 'prospect_booking', 'prospect_engagement', 'expected_order', 'sales_won', 'dormant']).default('lead'),
  customerType: z.enum(['student', 'institution', 'organization', 'employer']).describe('Stakeholder Type'),
  sourceCampaignId: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface MarketingLeadFormProps {
  onSuccess: () => void;
  isOpen?: boolean; // controlled open (for external triggers)
  onClose?: () => void; // called when dialog requests close (controlled)
  hideTrigger?: boolean; // when true, do not render the built-in trigger button
}

export function MarketingLeadForm({ onSuccess, isOpen, onClose, hideTrigger = false }: MarketingLeadFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      salesStage: 'lead',
    },
  });

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

  const onSubmit = async (data: LeadFormData) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("marketingToken");

      // Convert date to datetime format for backend
      const formattedData = {
        ...data,
        date: new Date(data.date).toISOString(),
        revenue: data.revenue?.toString(),
        sourceCampaignId: data.sourceCampaignId === "" ? null : data.sourceCampaignId
      };

      const response = await fetch("/api/marketing/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formattedData),
      });

        if (response.ok) {
          const leadData = await response.json();
          const newLeadId = leadData.lead.id;

          // Upload staged files if any
          if (stagedFiles.length > 0) {
            for (const file of stagedFiles) {
              const payload = {
                name: file.name.split('.')[0],
                category: 'attachment',
                fileName: file.name,
                fileType: file.type || 'application/octet-stream',
                fileSize: file.size,
                url: `/attached_assets/${file.name}`,
                leadId: newLeadId
              };

              await fetch("/api/marketing/documents", {
                method: "POST",
                headers: { 
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload)
              });
            }
            queryClient.invalidateQueries({ queryKey: ["marketing", "documents"] });
          }

          toast({
            title: "Success",
            description: `Lead created successfully ${stagedFiles.length > 0 ? 'with attachments' : ''}!`,
          });
          reset();
          setStagedFiles([]);
          setOpen(false);
          onSuccess();
        } else {
        const errorData = await response.json();
        console.error("Failed to create lead:", errorData);

        // Show user-friendly error message
        if (errorData.details && Array.isArray(errorData.details)) {
          const firstError = errorData.details[0];
          alert(`Validation Error: ${firstError.message || 'Please check your input'}`);
        } else {
          alert(`Error: ${errorData.error || 'Failed to create lead'}`);
        }
      }
    } catch (error) {
      console.error("Failed to create lead:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStageColor = (stage: string) => {
    const colors = {
      lead: "bg-[#004E98]/10 text-[#004E98]",
      qualified: "bg-[#D0AC01]/10 text-[#bb8114]",
      proposal: "bg-[#004E98]/10 text-[#004E98]",
      negotiation: "bg-[#e55f00]/10 text-[#e55f00]",
      closed_won: "bg-[#01a64e]/10 text-[#006341]",
      closed_lost: "bg-red-100 text-red-800",
      dormant: "bg-slate-100 text-slate-700"
    };
    return colors[stage as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <Dialog
      open={isOpen !== undefined ? isOpen : open}
      onOpenChange={(value) => {
        if (isOpen !== undefined) {
          if (!value) {
            onClose?.();
          }
        } else {
          setOpen(value);
        }
      }}
    >
      {!hideTrigger && isOpen === undefined && (
        <DialogTrigger asChild>
          <Button className="bg-gradient-to-r from-[#004E98] to-[#0066a2] hover:from-[#003d7a] hover:to-[#005080] shadow-lg">
            <Plus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#004E98]/10 rounded-lg">
              <User className="h-6 w-6 text-[#004E98]" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-gray-900">Add New Lead</DialogTitle>
              <DialogDescription className="text-gray-600 mt-1">
                Capture a new potential client and track their journey
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
          {/* Basic Information Card */}
          <Card className="border-0 shadow-sm bg-gradient-to-r from-[#004E98]/5 to-[#004E98]/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#004E98]" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    {...register("date")}
                    className={`h-11 ${errors.date ? "border-red-500 focus:border-red-500" : "focus:border-[#004E98]"}`}
                  />
                  {errors.date && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="text-red-500">•</span>
                      {errors.date.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salesStage" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Sales Stage
                  </Label>
                  <Select
                    value={watch("salesStage")}
                    onValueChange={(value) => setValue("salesStage", value as any)}
                  >
                    <SelectTrigger className="h-11 focus:border-[#004E98]">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStageColor("lead")} text-xs`}>Lead</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="prospect_registration">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStageColor("prospect_registration")} text-xs`}>Prospect Registration</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="prospect_booking">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStageColor("prospect_booking")} text-xs`}>Prospect Booking</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="prospect_engagement">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStageColor("prospect_engagement")} text-xs`}>Prospect Engagement</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="expected_order">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStageColor("expected_order")} text-xs`}>Expected Order</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="sales_won">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStageColor("sales_won")} text-xs`}>Sales Won</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="dormant">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStageColor("dormant")} text-xs`}>Dormant</Badge>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.salesStage && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <span className="text-red-500">•</span>
                      {errors.salesStage.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerType" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Stakeholder Type
                  </Label>
                  <Select
                    value={watch("customerType")}
                    onValueChange={(value) => setValue("customerType", value as any)}
                  >
                    <SelectTrigger className={`h-11 ${errors.customerType ? "border-red-500" : "focus:border-[#004E98]"}`}>
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
                      <span className="text-red-500">•</span>
                      {errors.customerType.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Client Name
                </Label>
                <Input
                  id="client"
                  {...register("client")}
                  className={`h-11 ${errors.client ? "border-red-500 focus:border-red-500" : "focus:border-[#004E98]"}`}
                  placeholder="Enter client or company name"
                />
                {errors.client && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <span className="text-red-500">•</span>
                    {errors.client.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact Information Card */}
          <Card className="border-0 shadow-sm bg-gradient-to-r from-[#01a64e]/5 to-[#01a64e]/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Phone className="h-5 w-5 text-[#01a64e]" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactPerson" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Contact Person *
                  </Label>
                  <Input
                    id="contactPerson"
                    {...register("contactPerson")}
                    className={`h-11 ${errors.contactPerson ? "border-red-500" : "focus:border-[#01a64e]"}`}
                    placeholder="Enter full name"
                  />
                  {errors.contactPerson && (
                    <p className="text-sm text-red-500">{errors.contactPerson.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactNumber" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Contact Number *
                  </Label>
                  <Input
                    id="contactNumber"
                    {...register("contactNumber")}
                    className={`h-11 ${errors.contactNumber ? "border-red-500" : "focus:border-[#01a64e]"}`}
                    placeholder="e.g. +254 712 345 678"
                  />
                  {errors.contactNumber && (
                    <p className="text-sm text-red-500">{errors.contactNumber.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Contact Email *
                </Label>
                <Input
                  id="contactEmail"
                  type="email"
                  {...register("contactEmail")}
                  className={`h-11 ${errors.contactEmail ? "border-red-500" : "focus:border-[#01a64e]"}`}
                  placeholder="name@company.com"
                />
                {errors.contactEmail && (
                  <p className="text-sm text-red-500">{errors.contactEmail.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Financial Information Card */}
          <Card className="border-0 shadow-sm bg-gradient-to-r from-[#D0AC01]/5 to-[#D0AC01]/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-[#D0AC01]" />
                Financial Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="revenue" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Estimated Revenue (KSH)
                  </Label>
                  <div className="relative">
                    <Input
                      id="revenue"
                      type="number"
                      step="0.01"
                      {...register("revenue", { valueAsNumber: true })}
                      className={`h-11 ${errors.revenue ? "border-red-500 focus:border-red-500" : "focus:border-[#D0AC01]"}`}
                      placeholder="0.00"
                    />
                  </div>
                  {errors.revenue && (
                    <p className="text-sm text-red-500">{errors.revenue.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sourceCampaignId" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Campaign Attribution
                  </Label>
                  <Select
                    value={watch("sourceCampaignId") || ""}
                    onValueChange={(value) => setValue("sourceCampaignId", value === "none" ? "" : value)}
                  >
                    <SelectTrigger className="h-11 focus:border-[#D0AC01]">
                      <SelectValue placeholder="Select campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None / Direct</SelectItem>
                      {campaignsList.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.channel})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Notes Card */}
          <Card className="border-0 shadow-sm bg-gradient-to-r from-[#004E98]/5 to-pink-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#004E98]" />
                Additional Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="remarks" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Remarks
                </Label>
                <Textarea
                  id="remarks"
                  {...register("remarks")}
                  placeholder="Enter any additional notes, requirements, or special considerations"
                  className="min-h-[80px] resize-none focus:border-[#004E98]"
                />
              </div>

              {/* Staged Attachments */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-[#004E98]">
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-bold uppercase tracking-tight">Attachments</span>
                    {stagedFiles.length > 0 && (
                      <Badge className="bg-[#004E98]/10 text-[#004E98] border-none">
                        {stagedFiles.length}
                      </Badge>
                    )}
                  </div>
                  <Input 
                    type="file" 
                    id="lead-file-upload" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setStagedFiles([...stagedFiles, file]);
                    }}
                  />
                  <Label 
                    htmlFor="lead-file-upload"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-[#004E98]/10 text-[#004E98] hover:bg-[#004E98]/20 cursor-pointer transition-all"
                  >
                    <Plus className="h-3 w-3" />
                    Attach File
                  </Label>
                </div>

                {stagedFiles.length > 0 && (
                  <div className="space-y-2">
                    {stagedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 group">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="text-xs font-bold text-gray-700 line-clamp-1">{file.name}</span>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                          onClick={() => setStagedFiles(stagedFiles.filter((_, i) => i !== idx))}
                        >
                          <Plus className="h-4 w-4 rotate-45" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <DialogFooter className="gap-3 pt-6 border-t bg-gray-50 -mx-6 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-11 px-6 font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-11 px-8 bg-gradient-to-r from-[#004E98] to-[#0066a2] hover:from-[#003d7a] hover:to-[#005080] shadow-lg font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Lead...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Lead
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
