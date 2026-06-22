import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";

const leadFormSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  enquiryType: z.string().min(1, "Please select an enquiry type"),
  remarks: z.string().min(5, "Please provide some details about your enquiry"),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

interface LeadCaptureFormProps {
  campaignId: string;
  campaignType: string;
}

export function LeadCaptureForm({ campaignId, campaignType }: LeadCaptureFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      enquiryType: "",
      remarks: "",
    },
  });

  const onSubmit = async (data: LeadFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/marketing/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          sourceCampaignId: campaignId,
          status: "new",
        }),
      });

      if (!response.ok) throw new Error("Failed to submit enquiry");

      toast({
        title: "Enquiry Submitted!",
        description: "Thank you for your interest. A representative will contact you shortly.",
      });
      reset();
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "There was an error sending your enquiry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
      <CardHeader className="bg-gradient-to-r from-[#004E98] to-[#003B73] text-white p-8 md:p-12">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
            <Send className="w-6 h-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-black uppercase tracking-tight">Express Interest</CardTitle>
            <CardDescription className="text-blue-100 font-medium">Get personalized guidance from KASNEB experts.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 md:p-12">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Full Name</Label>
              <Input 
                placeholder="John Doe" 
                {...register("fullName")}
                className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all border-2"
              />
              {errors.fullName && <p className="text-xs text-red-500 font-bold ml-1">{errors.fullName.message}</p>}
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Email Address</Label>
              <Input 
                type="email" 
                placeholder="john@example.com" 
                {...register("email")}
                className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all border-2"
              />
              {errors.email && <p className="text-xs text-red-500 font-bold ml-1">{errors.email.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Phone Number</Label>
              <Input 
                placeholder="+254 700 000000" 
                {...register("phone")}
                className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all border-2"
              />
              {errors.phone && <p className="text-xs text-red-500 font-bold ml-1">{errors.phone.message}</p>}
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Enquiry Type</Label>
              <Select 
                value={watch("enquiryType")}
                onValueChange={(v) => setValue("enquiryType", v)}
              >
                <SelectTrigger className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white border-2">
                  <SelectValue placeholder="Select interest..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  <SelectItem value="admission">New Admission</SelectItem>
                  <SelectItem value="accreditation">Institutional Accreditation</SelectItem>
                  <SelectItem value="exemption">Exemption Enquiry</SelectItem>
                  <SelectItem value="other">General Support</SelectItem>
                </SelectContent>
              </Select>
              {errors.enquiryType && <p className="text-xs text-red-500 font-bold ml-1">{errors.enquiryType.message}</p>}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Additional Remarks</Label>
            <Textarea 
              placeholder="How can we help you achieve your goals?" 
              {...register("remarks")}
              className="min-h-[120px] rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all border-2 resize-none"
            />
            {errors.remarks && <p className="text-xs text-red-500 font-bold ml-1">{errors.remarks.message}</p>}
          </div>

          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full h-16 bg-[#004E98] hover:bg-[#003B73] text-white text-lg font-black uppercase tracking-widest rounded-3xl shadow-xl shadow-blue-900/10 transition-all active:scale-95"
          >
            {isSubmitting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              "Submit Enquiry"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
