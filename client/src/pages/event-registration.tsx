import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Calendar, Users, Loader2, ArrowRight, CheckCircle2, ChevronRight, AlertCircle } from "lucide-react";

interface ValidatedEvent {
  id: string;
  name: string;
  scheduledAt?: string;
  venue?: string;
  description?: string;
}

export default function EventRegistration() {
  const [, params] = useRoute("/events/register/:slug");
  const slug = params?.slug;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Unified flow steps: 1 = Single-Page 2-in-1 Form, 4 = Success Screen
  const [currentStep, setCurrentStep] = useState<1 | 4>(1);

  // Pre-flight check states
  const [validatedEvent, setValidatedEvent] = useState<ValidatedEvent | null>(null);
  const [isValidatingSlug, setIsValidatingSlug] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdLead, setCreatedLead] = useState<{ id: string; routedToDepartment: string } | null>(null);

  const PRODUCTS = [
    "Motor",
    "Life",
    "Medical",
    "Property",
    "Marine",
    "Pension",
    "Group Life",
    "Micro-insurance",
    "Other"
  ];

  const queryKey = ["eventFormState", slug || "default"];

  // Initialize form state query cache using TanStack Query
  const { data: cachedForm } = useQuery({
    queryKey,
    queryFn: () => ({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      institution: "",
      productOfInterest: "",
      issuesReported: "",
      selectedPath: "admissions" as "admissions" | "support",
    }),
    staleTime: Infinity,
  });

  // Local React state synchronized with TanStack query state
  const [formData, setFormData] = useState(cachedForm || {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    institution: "",
    productOfInterest: "",
    issuesReported: "",
    selectedPath: "admissions" as "admissions" | "support",
  });

  // Keep local state in sync if cached values load asynchronously
  useEffect(() => {
    if (cachedForm) {
      setFormData(cachedForm);
    }
  }, [cachedForm]);

  // Synchronized state updater
  const updateForm = (updates: Partial<typeof formData>) => {
    const nextVal = { ...formData, ...updates };
    setFormData(nextVal);
    queryClient.setQueryData(queryKey, nextVal);
  };

  // Pre-flight slug validation
  useEffect(() => {
    if (slug) {
      validateSlug();
    } else {
      setIsValidatingSlug(false);
      setValidationError("No event slug provided.");
    }
  }, [slug]);

  const validateSlug = async () => {
    setIsValidatingSlug(true);
    setValidationError(null);
    try {
      const res = await fetch(`/api/events/validate/${slug}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Event not found or has ended.");
      }
      const data = await res.json();
      setValidatedEvent(data.event);
    } catch (err: any) {
      setValidationError(err.message || "Event not found.");
    } finally {
      setIsValidatingSlug(false);
    }
  };

  // Submission handles both paths unified
  const handleRegisterLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phone.trim()) {
      toast({
        title: "Phone Number Required",
        description: "Please provide your phone number so we can link your service inquiry.",
        variant: "destructive",
      });
      return;
    }

    if (formData.selectedPath === "admissions" && !formData.productOfInterest) {
      toast({
        title: "Product Required",
        description: "Please select a target product of interest.",
        variant: "destructive",
      });
      return;
    }

    if (formData.selectedPath === "support" && !formData.issuesReported.trim()) {
      toast({
        title: "Service Issue Required",
        description: "Please describe your current challenge so an advisor can support you.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/events/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          institution: formData.institution,
          productOfInterest: formData.selectedPath === "admissions" ? formData.productOfInterest : "Other",
          issuesReported: formData.selectedPath === "support" ? formData.issuesReported : undefined,
          eventSlug: slug,
          selectedPath: formData.selectedPath,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Registration failed");
      }

      const responseData = await res.json();
      setCreatedLead(responseData.lead);

      toast({
        title: formData.selectedPath === "admissions" ? "Registration Successful" : "Support Ticket Logged",
        description: formData.selectedPath === "admissions"
          ? "Your admission details have been queued successfully."
          : "Your current student issue was recorded and staged for forensic assignment.",
      });

      setCurrentStep(4);
    } catch (err: any) {
      toast({
        title: "Process Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Reset form to default states
  const handleReset = () => {
    const defaultData = {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      institution: "",
      productOfInterest: "",
      issuesReported: "",
      selectedPath: "admissions" as "admissions" | "support",
    };
    setFormData(defaultData);
    queryClient.setQueryData(queryKey, defaultData);
    setCreatedLead(null);
    setCurrentStep(1);
  };

  // Render Loader during Pre-flight Check
  if (isValidatingSlug) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-4">
        <Loader2 className="h-10 w-10 text-[#004E98] animate-spin mb-4" />
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Verifying event details...</p>
      </div>
    );
  }

  // Render Error Card if Pre-flight slug validation fails
  if (validationError || !validatedEvent) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-3xl overflow-hidden bg-white">
          <CardContent className="pt-12 pb-12 text-center space-y-6">
            <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Event Unavailable</h1>
              <p className="text-gray-500 font-medium">{validationError || "This CIC registration portal is currently closed or the event has concluded."}</p>
            </div>
            <Button variant="outline" className="rounded-xl h-12 w-full font-bold border-slate-200" onClick={() => window.location.href = 'https://cic.co.ke'}>
              Visit Official CIC Site
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render Premium Dynamic Expectation Success Screen (Step 4)
  if (currentStep === 4) {
    const departmentName = createdLead?.routedToDepartment || "General Counselling";
    const referenceCode = createdLead ? `REF-${createdLead.id.substring(0, 4).toUpperCase()}` : "REF-PENDING";

    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg bg-white border border-slate-100 shadow-2xl rounded-[2.5rem] overflow-hidden">
          <CardContent className="p-8 md:p-12 text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">You're All Set!</h2>
              <div className="inline-block px-4 py-1.5 bg-slate-50 text-slate-600 border border-slate-200/50 rounded-full text-xs font-black tracking-widest mx-auto">
                {referenceCode}
              </div>
            </div>

            <div className="space-y-4 text-left border-t border-slate-100 pt-6 mt-6">
              <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider">What Happens Next?</h3>
              <p className="text-gray-600 leading-relaxed text-sm">
                A CIC representative from our <strong className="text-[#004E98] font-black">{departmentName}</strong> department has been notified. They will contact you within <strong>3 business days</strong> to guide you through registration, resources, and policy requirements.
              </p>
            </div>

            <Button 
              className="w-full h-14 rounded-2xl bg-[#004E98] hover:bg-[#003d7a] text-white font-black text-sm tracking-wide shadow-lg shadow-[#004E98]/10 mt-6"
              onClick={handleReset}
            >
              Register Another Person
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render Unified, Minimalist Single-Page Form
  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col justify-start items-center p-6 sm:p-12">
      
      {/* 1. BRANDING HEADER AT THE TOP */}
      <div className="w-full max-w-xl text-center mb-8 pt-4">
        <div className="inline-flex items-center gap-3.5 mb-5 px-5 py-2.5 bg-white shadow-sm border border-slate-100 rounded-full">
          <img src="/logo.webp" alt="CIC Logo" className="w-7 h-7 object-contain" />
          <span className="text-xs font-black uppercase tracking-[0.2em] text-[#004E98]">CIC Events</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight uppercase px-4">
          {validatedEvent.name}
        </h1>
        {validatedEvent.venue && (
          <div className="flex items-center justify-center gap-2 mt-3 text-xs font-semibold text-slate-500 bg-slate-100 px-4 py-1.5 rounded-full w-fit mx-auto border border-slate-200/50">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>{validatedEvent.venue}</span>
          </div>
        )}
      </div>

      {/* 2. MINIMALIST CENTERED FORM CARD */}
      <Card className="w-full max-w-xl border border-slate-100 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden p-8 md:p-10">
        <form onSubmit={handleRegisterLead}>
          
          {/* Path segmented switch */}
          <div className="flex border-b border-slate-100 mb-8 w-full justify-center">
            <button 
              type="button" 
              onClick={() => updateForm({ selectedPath: "admissions" })}
              className={`pb-3.5 px-6 text-xs font-black uppercase tracking-widest border-b-2 transition-all duration-200 ${
                formData.selectedPath === "admissions" 
                  ? "border-[#004E98] text-[#004E98]" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Admissions Inquiry
            </button>
            <button 
              type="button" 
              onClick={() => updateForm({ selectedPath: "support" })}
              className={`pb-3.5 px-6 text-xs font-black uppercase tracking-widest border-b-2 transition-all duration-200 ${
                formData.selectedPath === "support" 
                  ? "border-[#004E98] text-[#004E98]" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Support Desk
            </button>
          </div>

          {/* Form Fields container */}
          <div className="space-y-6">

            {/* First Name & Last Name (Unified at the top of BOTH tabs) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#004E98] ml-1">First Name</Label>
                <Input 
                  placeholder="Jane"
                  value={formData.firstName}
                  onChange={(e) => updateForm({ firstName: e.target.value })}
                  className="h-14 bg-gray-50/50 border-gray-200 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 focus-visible:ring-2 focus-visible:ring-[#004E98]/20 outline-none rounded-2xl border-2 transition-all duration-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#004E98] ml-1">Last Name</Label>
                <Input 
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => updateForm({ lastName: e.target.value })}
                  className="h-14 bg-gray-50/50 border-gray-200 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 focus-visible:ring-2 focus-visible:ring-[#004E98]/20 outline-none rounded-2xl border-2 transition-all duration-200"
                />
              </div>
            </div>
            
            {/* Phone input (REQUIRED in both paths) */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#004E98] ml-1">Phone Number *</Label>
              <Input 
                required
                type="tel"
                placeholder="e.g. +254 712 345678"
                value={formData.phone}
                onChange={(e) => updateForm({ phone: e.target.value })}
                className="h-14 bg-gray-50/50 border-gray-200 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 focus-visible:ring-2 focus-visible:ring-[#004E98]/20 outline-none rounded-2xl border-2 transition-all duration-200"
              />
            </div>

            {/* Path A Fields: Admissions details */}
            {formData.selectedPath === "admissions" && (
              <>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#004E98] ml-1">Product of Interest *</Label>
                  <Select 
                    required
                    value={formData.productOfInterest} 
                    onValueChange={(v) => updateForm({ productOfInterest: v })}
                  >
                    <SelectTrigger className="h-14 bg-gray-50/50 border-gray-200 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 rounded-2xl border-2 outline-none transition-all duration-200">
                      <SelectValue placeholder="Select target product..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl bg-white">
                      {PRODUCTS.map(q => (
                        <SelectItem key={q} value={q} className="font-bold">{q}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Email Address (Optional)</Label>
                  <Input 
                    type="email"
                    placeholder="jane.doe@example.com"
                    value={formData.email}
                    onChange={(e) => updateForm({ email: e.target.value })}
                    className="h-14 bg-gray-50/50 border-gray-200 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 focus-visible:ring-2 focus-visible:ring-[#004E98]/20 outline-none rounded-2xl border-2 transition-all duration-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Current Institution (Optional)</Label>
                  <Input 
                    placeholder="e.g. Strathmore University"
                    value={formData.institution}
                    onChange={(e) => updateForm({ institution: e.target.value })}
                    className="h-14 bg-gray-50/50 border-gray-200 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 focus-visible:ring-2 focus-visible:ring-[#004E98]/20 outline-none rounded-2xl border-2 transition-all duration-200"
                  />
                </div>
              </>
            )}

            {/* Path B Fields: Support ticket details */}
            {formData.selectedPath === "support" && (
              <>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Email Address (Optional)</Label>
                  <Input 
                    type="email"
                    placeholder="jane.doe@example.com"
                    value={formData.email}
                    onChange={(e) => updateForm({ email: e.target.value })}
                    className="h-14 bg-gray-50/50 border-gray-200 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 focus-visible:ring-2 focus-visible:ring-[#004E98]/20 outline-none rounded-2xl border-2 transition-all duration-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#004E98] ml-1">Having issues with CIC Services? *</Label>
                  <Textarea 
                    required
                    placeholder="Describe your challenge in detail (minimum 10 words for actionable support)..."
                    value={formData.issuesReported}
                    onChange={(e) => updateForm({ issuesReported: e.target.value })}
                    className="min-h-[120px] bg-gray-50/50 border-gray-200 focus:border-[#004E98] focus:ring-2 focus:ring-[#004E98]/20 focus-visible:ring-2 focus-visible:ring-[#004E98]/20 outline-none rounded-2xl border-2 resize-none p-4 transition-all duration-200"
                  />
                </div>
              </>
            )}

          </div>

          {/* Action buttons */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <Button 
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-2xl bg-[#004E98] hover:bg-[#003d7a] text-white font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-1.5 transition-all"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                <>
                  <span>Submit</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>

        </form>
      </Card>
    </div>
  );
}
