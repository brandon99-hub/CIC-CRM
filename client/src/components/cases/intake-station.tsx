import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api-client";
import { 
    Search, Terminal, User, FileText, ChevronRight, Zap, 
    ArrowRight, Loader2, BookOpen, Clock, AlertCircle, CheckCircle2,
    Plus, HelpCircle, RefreshCw, X, Fingerprint, MapPin, Building2, Phone, Mail
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StakeholderProfile } from "@/components/stakeholders/stakeholder-profile";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface IntakeStationProps {
    onCaseCreated: () => void;
    onBack: () => void;
}



export function IntakeStation({ onCaseCreated, onBack }: IntakeStationProps) {
    const { toast } = useToast();
    const [searchId, setSearchId] = useState("");
    const [debouncedId, setDebouncedId] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

    const { data: serviceCategories = [] } = useQuery({
        queryKey: ["admin", "service-categories"],
        queryFn: async () => {
            const res = await apiRequest("/api/admin/service-categories");
            const d = await res.json();
            return d.serviceCategories || d;
        },
    });

    const { data: departments = [] } = useQuery({
        queryKey: ["admin", "departments"],
        queryFn: async () => {
            const res = await apiRequest("/api/admin/departments");
            const d = await res.json();
            return d.departments || d;
        },
    });
    
    const [form, setForm] = useState({
        title: "",
        description: "",
        priority: "medium",
        channel: "call",
        serviceCategoryId: "",
        status: "open",
        resolution: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Debounce CIC ID
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedId(searchId), 600);
        return () => clearTimeout(timer);
    }, [searchId]);

    // Query Stakeholder by Registration Number
    const { data: stakeholderData, isLoading: isLookupLoading } = useQuery({
        queryKey: ["stakeholder", "lookup", debouncedId],
        queryFn: async () => {
            if (!debouncedId) return null;
            const res = await apiRequest(`/api/stakeholders?search=${debouncedId}`);
            if (!res.ok) return null;
            const data = await res.json();
            const stakeholder = data.stakeholders.find((s: any) => s.policyNumber === debouncedId);
            if (!stakeholder) return null;
            
            // Fetch full profile (interactions, relationships, etc.)
            const profileRes = await apiRequest(`/api/stakeholders/${stakeholder.id}`);
            return profileRes.json();
        },
        enabled: !!debouncedId && debouncedId.length > 3
    });

    // Query Templates
    const { data: templates } = useQuery({
        queryKey: ["knowledge-base", "templates"],
        queryFn: async () => {
            const res = await apiRequest("/api/knowledge-base?isTemplate=true");
            return res.json();
        }
    });

    const templateList = templates?.articles || [];

    // Handle Template Selection
    useEffect(() => {
        if (selectedTemplateId) {
            const template = templateList.find((t: any) => t.id === selectedTemplateId);
            if (template) {
                setForm(prev => ({
                    ...prev,
                    title: prev.title || template.title,
                    description: template.content,
                    resolution: template.resolution_summary || ""
                }));
            }
        }
    }, [selectedTemplateId, templateList]);

    const handleSubmit = async (isResolveNow: boolean = false) => {
        if (!form.title || !form.serviceCategoryId) {
            toast({ title: "Validation Error", description: "Title and Category are required.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...form,
                stakeholderId: stakeholderData?.stakeholder?.id || null,
                status: isResolveNow ? "resolved" : "open",
                resolvedAt: isResolveNow ? new Date().toISOString() : null,
                resolution: isResolveNow ? form.resolution || form.description : null,
                createdAt: new Date().toISOString()
            };

            const res = await apiRequest("/api/cases", {
                method: "POST",
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast({ 
                    title: isResolveNow ? "Case Resolved" : "Case Assigned", 
                    description: `Successfully ${isResolveNow ? 'created and resolved' : 'created and assigned'} case.`
                });
                // Reset form
                setForm({
                    title: "",
                    description: "",
                    priority: "medium",
                    channel: "call",
                    serviceCategoryId: "",
                    status: "open",
                    resolution: ""
                });
                setSelectedTemplateId("");
                onCaseCreated();
            } else {
                const error = await res.json();
                toast({ title: "Error", description: error.error || "Failed to create case", variant: "destructive" });
            }
        } catch (err) {
            toast({ title: "Connection Error", description: "Failed to reach server", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8 pb-20">
            {/* --- Header Search --- */}
            <Card className="bg-white border-none shadow-sm ring-1 ring-black/[0.03] overflow-visible">
                <CardHeader className="p-6 pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={onBack}
                                className="mr-1 h-9 w-9 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-all"
                            >
                                <ChevronRight className="h-5 w-5 rotate-180" />
                            </Button>
                            <div className="bg-[#004E98]/5 p-3 rounded-xl ring-1 ring-[#004E98]/10">
                                <Terminal className="h-6 w-6 text-[#004E98]" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black text-gray-900 tracking-tight">Case Creation</CardTitle>
                                <p className="text-gray-400 text-[9px] font-black uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-[#004E98]/40 rounded-full" />
                                    Standardized Case Initiation
                                </p>
                            </div>
                        </div>

                        <div className="relative w-full md:w-[400px] group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-[#004E98] transition-colors" />
                            <Input
                                placeholder="ENTER CIC ID (REG #)..."
                                value={searchId}
                                onChange={(e) => setSearchId(e.target.value)}
                                className="pl-10 h-10 text-[10px] font-black uppercase tracking-widest bg-gray-50/50 border-gray-100/50 rounded-xl focus:ring-2 focus:ring-[#004E98]/10 transition-all placeholder:text-gray-300 shadow-sm"
                            />
                            {isLookupLoading && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <Loader2 className="h-5 w-5 animate-spin text-[#004E98]" />
                                </div>
                            )}
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* --- Identification Feedback --- */}
            {!debouncedId && (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="bg-gray-50 p-6 rounded-full">
                        <Search className="h-12 w-12 text-gray-300" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-lg font-black text-gray-400 uppercase tracking-tight">Awaiting Identification</p>
                        <p className="text-sm text-gray-400 font-medium">Input a Registration Number to pull 360° Intelligence</p>
                    </div>
                </div>
            )}

            {debouncedId && !isLookupLoading && !stakeholderData && (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="bg-amber-50 p-6 rounded-full border border-amber-100">
                        <AlertCircle className="h-12 w-12 text-amber-400" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-lg font-black text-amber-900 uppercase tracking-tight">Stakeholder Not Found</p>
                        <p className="text-sm text-amber-700/60 font-medium max-w-sm">
                            This ID is not registered in our CRM. Please guide the stakeholder to the official CIC registration portal.
                        </p>
                    </div>
                </div>
            )}

            {/* --- 360 Profile Section --- */}
            {stakeholderData && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <StakeholderProfile 
                        profile={stakeholderData}
                        onBack={() => {}}
                        onLogInteraction={() => {}}
                        onNavigate={() => {}}
                        onCaseClick={() => {}}
                        organizations={[]}
                    />
                </div>
            )}

            {/* --- Intake Workstation --- */}
            <Card className="bg-white border-none shadow-sm ring-1 ring-gray-100 overflow-hidden">
                <div className="bg-gray-50/50 px-8 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-[#004E98]" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Intake Workstation</span>
                    </div>
                    {stakeholderData && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black text-[10px] uppercase tracking-widest px-3 py-1">
                            <CheckCircle2 className="h-3 w-3 mr-1.5" /> ID Verified
                        </Badge>
                    )}
                </div>
                <CardContent className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Side: Basic Info */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Case Title *</Label>
                                <Input 
                                    placeholder="Brief subject of the inquiry..."
                                    value={form.title}
                                    onChange={(e) => setForm({...form, title: e.target.value})}
                                    className="h-12 text-sm font-bold bg-white border-gray-200 rounded-xl focus:ring-4 focus:ring-[#004E98]/5 transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Service Category *</Label>
                                    <Select value={form.serviceCategoryId} onValueChange={(v) => setForm({...form, serviceCategoryId: v})}>
                                        <SelectTrigger className="h-12 border-gray-200 rounded-xl bg-white font-bold text-xs uppercase tracking-tight">
                                            <SelectValue placeholder="SELECT CATEGORY..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {serviceCategories.map((cat: any) => (
                                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Priority</Label>
                                    <Select value={form.priority} onValueChange={(v) => setForm({...form, priority: v})}>
                                        <SelectTrigger className="h-12 border-gray-200 rounded-xl bg-white font-bold text-xs uppercase tracking-tight">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="urgent">Urgent</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Resolution Template</Label>
                                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                    <SelectTrigger className="h-12 border-[#004E98]/20 bg-blue-50/30 rounded-xl font-bold text-xs uppercase tracking-tight text-[#004E98]">
                                        <div className="flex items-center gap-2">
                                            <BookOpen className="h-4 w-4" />
                                            <SelectValue placeholder="CHOOSE A BLUEPRINT..." />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Template</SelectItem>
                                        {templateList.map((t: any) => (
                                            <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Right Side: Narrative */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Description / Notes</Label>
                                <Textarea 
                                    placeholder="Enter full details of the inquiry..."
                                    rows={5}
                                    value={form.description}
                                    onChange={(e) => setForm({...form, description: e.target.value})}
                                    className="border-gray-200 rounded-xl focus:ring-4 focus:ring-[#004E98]/5 transition-all bg-white text-sm font-medium leading-relaxed"
                                />
                            </div>

                            <div className="flex items-center gap-4 pt-2">
                                <Button 
                                    disabled={isSubmitting}
                                    onClick={() => handleSubmit(false)}
                                    className="flex-1 bg-[#004E98] hover:bg-[#004E98]/90 text-white font-black text-[11px] uppercase tracking-widest h-14 rounded-2xl shadow-xl shadow-blue-500/10 transition-all hover:scale-[1.02]"
                                >
                                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Zap className="h-5 w-5 mr-2" />}
                                    Assign Workflow
                                </Button>
                                <Button 
                                    disabled={isSubmitting}
                                    onClick={() => handleSubmit(true)}
                                    variant="outline"
                                    className="flex-1 border-[#004E98] text-[#004E98] hover:bg-blue-50 font-black text-[11px] uppercase tracking-widest h-14 rounded-2xl transition-all"
                                >
                                    Resolve Immediately
                                    <ArrowRight className="h-5 w-5 ml-2" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
