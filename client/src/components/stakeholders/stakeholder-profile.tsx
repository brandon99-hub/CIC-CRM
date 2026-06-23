import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    ChevronLeft, Mail, Phone, Building, MessageSquare, Link2, Activity,
    Calendar, Clock, Plus, PlusCircle, HelpCircle, GraduationCap, Briefcase, UserCheck, FileEdit, UserCog,
    MapPin, Shield, CheckCircle2, AlertTriangle, ExternalLink, UserCircle, History, Zap, TrendingUp,
    FileText, Award, DollarSign, Info, ChevronDown, ChevronUp, Settings2, Linkedin, Twitter, Globe,
    Instagram, Facebook, Save, X as CloseIcon, Edit2, Layers, AlertCircle, Network, Target, ShieldCheck
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { STAKEHOLDER_TYPE_COLORS } from "@/components/stakeholders/stakeholder-type-colors";
import { getSegmentDescription } from "./segment-definitions";
import type { Stakeholder, Interaction, Relationship } from "@/components/stakeholders/stakeholder-types";
import { useTranslation } from "react-i18next";
import { useRegion } from "@/lib/RegionContext";

export function getStakeholderTimezone(country: string) {
    if (country === 'Rwanda') return 'Africa/Kigali';
    if (country === 'Cameroon') return 'Africa/Douala';
    if (country === 'Uganda') return 'Africa/Kampala';
    if (country === 'United Kingdom') return 'Europe/London';
    if (country === 'Tanzania') return 'Africa/Dar_es_Salaam';
    if (country === 'Nigeria') return 'Africa/Lagos';
    if (country === 'South Africa') return 'Africa/Johannesburg';
    return 'Africa/Nairobi'; // default Kenya
}

export function getStakeholderCurrency(country: string) {
    if (country === 'Rwanda') return { code: 'RWF', locale: 'fr-RW' };
    if (country === 'Cameroon') return { code: 'XAF', locale: 'fr-CM' };
    if (country === 'Uganda') return { code: 'UGX', locale: 'en-UG' };
    if (country === 'United Kingdom') return { code: 'GBP', locale: 'en-GB' };
    if (country === 'Tanzania') return { code: 'TZS', locale: 'en-TZ' };
    if (country === 'Nigeria') return { code: 'NGN', locale: 'en-NG' };
    if (country === 'South Africa') return { code: 'ZAR', locale: 'en-ZA' };
    return { code: 'KES', locale: 'en-KE' };
}

export function formatStakeholderLocalTime(country: string) {
    const tz = getStakeholderTimezone(country || 'Kenya');
    try {
        return new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        }).format(new Date());
    } catch {
        return '';
    }
}

export function formatStakeholderCurrency(country: string, amount: number) {
    const curr = getStakeholderCurrency(country || 'Kenya');
    try {
        return new Intl.NumberFormat(curr.locale, { style: 'currency', currency: curr.code, maximumFractionDigits: 0 }).format(amount);
    } catch {
        return `${curr.code} ${amount.toLocaleString()}`;
    }
}

export const typeIcons: Record<string, any> = {
    student: GraduationCap, institution: Building, employer: Briefcase,
    marker: UserCheck, setter: FileEdit, staff: UserCog, other: HelpCircle,
};

export const riskColors: Record<string, string> = {
    low: "bg-green-100 text-green-700 border-green-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    critical: "bg-red-100 text-red-700 border-red-200"
};

interface StakeholderProfileProps {
    profile: {
        stakeholder: Stakeholder;
        interactions: Interaction[];
        relationships: Relationship[];
        cases: any[];
        segments?: any[];
        staffMetrics?: {
            assignedCases: number;
            casesResolved: number;
            activeShifts: number;
            avgResolutionTime: number;
        } | null;
        staffCases?: any[];
        staffShifts?: any[];
        staffQueues?: any[];
    } | null;
    isLoading?: boolean;
    onBack: () => void;
    onLogInteraction: (stakeholderId: string) => void;
    onNavigate: (to: string) => void;
    onCaseClick: (cid: string) => void;
    onUpdateStakeholder?: (stakeholderId: string, updates: Partial<Stakeholder>) => Promise<void>;
    organizations: string[];
    isEmbedded?: boolean;
}

export function StakeholderProfile({ profile, isLoading, onBack, onLogInteraction, onNavigate, onCaseClick, onUpdateStakeholder, organizations, isEmbedded = false }: StakeholderProfileProps) {
    const { formatCurrency, formatLocalTime } = useRegion();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(profile?.stakeholder?.type === 'staff' ? "staff_shifts" : "activities");
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<Stakeholder>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [openAccordions, setOpenAccordions] = useState<string[]>([]);

    if (isLoading) {
        return (
            <div className="space-y-6 pb-12 animate-pulse">
                {/* ── Premium Header Skeleton ── */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-50 pb-4">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-8 w-20 rounded-lg" />
                            <div className="h-6 w-px bg-gray-100 hidden md:block" />
                            <div className="flex items-center gap-4">
                                <Skeleton className="w-14 h-14 rounded-2xl" />
                                <div className="space-y-2">
                                    <Skeleton className="h-7 w-48 rounded-lg" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-5 w-16 rounded-full" />
                                        <Skeleton className="h-5 w-24 rounded-full" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-7 w-20 rounded-full" />
                            <Skeleton className="h-7 w-20 rounded-full" />
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <Skeleton className="h-10 w-40 rounded-xl" />
                        <div className="flex gap-3">
                            <Skeleton className="h-10 w-32 rounded-xl" />
                            <Skeleton className="h-10 w-40 rounded-xl" />
                        </div>
                    </div>
                </div>

                {/* ── 2-Card Identity & Financial Grid Skeleton ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="border-gray-100 shadow-sm rounded-xl">
                        <div className="h-14 bg-gray-50/50 border-b border-gray-100 px-5 flex items-center">
                            <Skeleton className="h-5 w-40" />
                        </div>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="space-y-2">
                                        <Skeleton className="h-3 w-20" />
                                        <Skeleton className="h-5 w-full" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-gray-100 shadow-sm rounded-xl">
                        <div className="h-14 bg-gray-50/50 border-b border-gray-100 px-5 flex items-center">
                            <Skeleton className="h-5 w-40" />
                        </div>
                        <CardContent className="p-6 space-y-6">
                            <Skeleton className="h-24 w-full rounded-xl" />
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ── Tabs Skeleton ── */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="border-b border-gray-100 bg-gray-50/30 px-6 h-14 flex items-center gap-8">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-28" />
                    </div>
                    <div className="p-8 space-y-4">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-32 w-full rounded-xl mt-6" />
                    </div>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <UserCircle className="h-16 w-16 text-muted-foreground" />
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-muted-foreground">No Stakeholder Selected</h2>
                    <p className="text-sm text-muted-foreground mt-1">Select a stakeholder to view their 360° profile</p>
                </div>
                <Button variant="outline" onClick={onBack}>Back to Stakeholders</Button>
            </div>
        );
    }

    const { stakeholder: s, interactions, relationships, cases, segments, staffMetrics, staffCases, staffShifts, staffQueues } = profile;
    const TypeIcon = typeIcons[s.type] || HelpCircle;
    const score = s.engagementScore || 0;
    const meta = s.metadata || {};

    const dynamicRisk = s.riskLevel || 'low';

    const handleStartEdit = () => {
        setEditData({
            lifecycleStage: s.lifecycleStage,
            preferredChannel: s.preferredChannel,
            preferredLanguage: s.preferredLanguage,
            communicationFrequency: s.communicationFrequency,
            socialProfiles: s.socialProfiles || {},
            organization: s.organization
        });
        setOpenAccordions(["comm-details", "social-details"]);
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!onUpdateStakeholder) return;
        setIsSaving(true);
        try {
            await onUpdateStakeholder(s.id, editData);
            setIsEditing(false);
            setOpenAccordions([]);
        } catch (error) {
            console.error("Failed to update stakeholder:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const updateEditField = (field: keyof Stakeholder, value: any) => {
        setEditData(prev => ({ ...prev, [field]: value }));
    };

    const updateSocialField = (platform: string, value: string) => {
        setEditData(prev => ({
            ...prev,
            socialProfiles: {
                ...(prev.socialProfiles || {}),
                [platform]: value
            }
        }));
    };

    return (
        <div className="space-y-6 pb-12">
            {/* ── Premium Header (Redesigned) ── */}
            {!isEmbedded && (
                <div className="space-y-6 no-print">
                    {/* Action Bar */}
                    <div className="flex items-center justify-between">
                        <Button variant="ghost" size="sm" onClick={onBack} className="h-9 px-3 gap-2 text-gray-500 hover:text-[#004E98] font-bold hover:bg-[#004E98]/5 text-xs uppercase tracking-wider rounded-xl transition-colors">
                            <ChevronLeft className="h-4 w-4" /> Back to Directory
                        </Button>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="sm" onClick={() => window.print()} className="h-9 px-4 gap-2 text-xs font-bold text-gray-600 border-gray-200 hover:bg-gray-50 rounded-xl shadow-sm">
                                <FileText className="h-4 w-4" /> Download Dossier
                            </Button>
                            {isEditing ? (
                                <>
                                    <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setOpenAccordions([]); }} className="h-9 px-5 font-bold text-gray-500 hover:bg-gray-50 rounded-xl">
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="h-9 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-900/10 rounded-xl gap-2"
                                    >
                                        {isSaving ? <Activity className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                        Save Changes
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleStartEdit}
                                        className="h-9 px-5 gap-2 font-bold text-[#004E98] border-[#004E98]/20 hover:bg-[#004E98]/5 rounded-xl bg-white shadow-sm"
                                    >
                                        <Edit2 className="h-4 w-4" /> Edit Profile
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => onLogInteraction(s.id)}
                                        className="h-9 px-6 bg-[#004E98] hover:bg-[#003B73] text-white font-bold shadow-lg shadow-blue-900/20 rounded-xl gap-2"
                                    >
                                        <PlusCircle className="h-4 w-4" /> Action Request
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Profile Identity Card */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#004E98]/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />

                        <div className="flex items-center gap-6 relative z-10">
                            <div className="w-20 h-20 rounded-2xl bg-[#004E98]/5 flex items-center justify-center text-[#004E98] shadow-inner ring-1 ring-[#004E98]/10">
                                <TypeIcon className="h-10 w-10" />
                            </div>
                            <div className="space-y-2">
                                <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                                    {(s.type === 'corporate_client' || s.type === 'sacco_cooperative' || s.type === 'bancassurance_partner' || s.type === 'agent' || s.type === 'broker') ? (s.organization || s.name) : `${s.firstName || ""} ${s.lastName || ""}`.trim()}
                                </h1>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className={`${STAKEHOLDER_TYPE_COLORS[s.type] || "bg-gray-100 text-gray-700"} text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 border-none shadow-sm`}>
                                        {s.type.replace('_', ' ')}
                                    </Badge>
                                    <Badge variant="outline" className={`${riskColors[(s as any).aggregatedRisk || dynamicRisk] || "bg-gray-100 text-gray-700"} text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 border-none shadow-sm`}>
                                        {(s as any).aggregatedRisk || dynamicRisk} Risk
                                    </Badge>
                                    {s.tags?.filter((tag: string) => !tag.startsWith('seg:')).map((tag: any, idx: number) => (
                                        <Badge key={`${tag}-${idx}`} variant="secondary" className="bg-gray-100 text-gray-600 px-2.5 py-0.5 font-bold rounded-md text-[10px] uppercase tracking-widest shadow-sm">
                                            {tag}
                                        </Badge>
                                    ))}
                                    <TooltipProvider>
                                        {segments?.map((seg: any) => (
                                            <Tooltip key={seg.id} delayDuration={200}>
                                                <TooltipTrigger asChild>
                                                    <span className="inline-block cursor-help">
                                                        <Badge className="bg-[#D0AC01]/10 text-[#D0AC01] px-2.5 py-0.5 font-bold rounded-md text-[10px] uppercase tracking-widest shadow-sm hover:bg-[#D0AC01]/20 transition-colors border-none">
                                                            {seg.name}
                                                        </Badge>
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-white border border-gray-100 text-gray-700 shadow-xl max-w-[250px] p-3 rounded-lg z-50">
                                                    <p className="text-xs font-medium leading-relaxed">{getSegmentDescription(seg.name) || seg.description || "Segment connection"}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ))}
                                    </TooltipProvider>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <Clock className="h-4 w-4 text-gray-400" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">
                                        Local Time: <span className="text-gray-900">{formatStakeholderLocalTime(s.country || "Kenya")}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 2-Card Identity & Financial Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Card 1: Identity & Communication */}
                <Card className="border-gray-100 shadow-sm rounded-xl overflow-hidden">
                    <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-5">
                        <div className="flex items-center gap-3">
                            <UserCircle className="h-5 w-5 text-[#004E98]" />
                            <CardTitle className="text-sm font-bold text-gray-900 uppercase tracking-widest">Stakeholder Identity</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Registration ID</Label>
                                <p className="text-sm font-bold text-gray-900">{s.policyNumber || "—"}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Lifecycle Stage</Label>
                                {isEditing ? (
                                    <Select value={editData.lifecycleStage} onValueChange={(v) => updateEditField("lifecycleStage", v)}>
                                        <SelectTrigger className="h-9 border-gray-200 rounded-lg text-xs font-bold bg-gray-100/30">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                                <>
                                                    <SelectItem value="lead" className="font-bold text-blue-600">Lead</SelectItem>
                                                    <SelectItem value="prospect" className="font-bold text-indigo-600">Prospect</SelectItem>
                                                    <SelectItem value="active" className="font-bold text-emerald-600">Active</SelectItem>
                                                    <SelectItem value="renewal" className="font-bold text-amber-600">In Renewal</SelectItem>
                                                    <SelectItem value="lapsed" className="font-bold text-gray-500">Lapsed/Dormant</SelectItem>
                                                    <SelectItem value="cancelled" className="font-bold text-red-600">Cancelled</SelectItem>
                                                    <SelectItem value="suspended" className="font-bold text-orange-600">Suspended</SelectItem>
                                                </>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <p className={`text-sm font-black uppercase tracking-widest ${["registered", "accredited"].includes(s.lifecycleStage?.toLowerCase() || '') ? 'text-emerald-600' :
                                            ["inquiry", "application_submitted"].includes(s.lifecycleStage?.toLowerCase() || '') ? 'text-blue-600' :
                                                s.lifecycleStage?.toLowerCase() === 'alumni' ? 'text-indigo-600' :
                                                    s.lifecycleStage?.toLowerCase() === 'suspended' || s.lifecycleStage?.toLowerCase() === 'under_review' ? 'text-orange-500' :
                                                        s.lifecycleStage?.toLowerCase() === 'lapsed' || s.lifecycleStage?.toLowerCase() === 'dormant' ? 'text-red-600' : 'text-gray-500'
                                        }`}>
                                        {s.lifecycleStage?.replace(/_/g, " ") || "Registered"}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1 col-span-2 md:col-span-1">
                                <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Primary Email</Label>
                                <p className="text-sm font-bold text-gray-700 truncate">{s.email || "No email"}</p>
                            </div>
                            <div className="space-y-1 col-span-2 md:col-span-1">
                                <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Phone Number</Label>
                                <p className="text-sm font-bold text-gray-700">{s.phone || "—"}</p>
                            </div>
                            <div className="space-y-1 col-span-2 md:col-span-1">
                                <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Product Line</Label>
                                {isEditing ? (
                                    <Input
                                        value={editData.productLine || ""}
                                        onChange={(e) => updateEditField("productLine", e.target.value)}
                                        className="h-8 text-xs font-bold border-gray-200 bg-gray-50 rounded-lg mt-1"
                                        placeholder="e.g. Motor, Medical, Life"
                                    />
                                ) : (
                                    <p className="text-sm font-bold text-[#004E98]">{s.productLine || "Not Specified"}</p>
                                )}
                            </div>
                            <div className="space-y-1 col-span-2 md:col-span-1">
                                <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Region</Label>
                                {isEditing ? (
                                    <Input value={editData.region || ""} onChange={(e) => updateEditField("region", e.target.value)} className="h-8 text-xs font-bold border-gray-200 bg-gray-50 rounded-lg mt-1" />
                                ) : (
                                    <p className="text-sm font-bold text-gray-700">{s.region || "—"}</p>
                                )}
                            </div>
                            <div className="space-y-1 col-span-2 md:col-span-1">
                                <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Country</Label>
                                {isEditing ? (
                                    <Input value={editData.country || ""} onChange={(e) => updateEditField("country", e.target.value)} className="h-8 text-xs font-bold border-gray-200 bg-gray-50 rounded-lg mt-1" />
                                ) : (
                                    <p className="text-sm font-bold text-gray-700">{s.country || "Kenya"}</p>
                                )}
                            </div>
                            <div className="space-y-1 col-span-2 md:col-span-1">
                                <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">County</Label>
                                {isEditing ? (
                                    <Input value={editData.county || ""} onChange={(e) => updateEditField("county", e.target.value)} className="h-8 text-xs font-bold border-gray-200 bg-gray-50 rounded-lg mt-1" />
                                ) : (
                                    <p className="text-sm font-bold text-gray-700">{s.county || "—"}</p>
                                )}
                            </div>
                        </div>

                        <Accordion type="multiple" value={openAccordions} onValueChange={setOpenAccordions} className="border-t border-gray-100 pt-2">
                            <AccordionItem value="comm-details" className="border-none">
                                <AccordionTrigger className="hover:no-underline py-4">
                                    <div className="flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4 text-gray-400" />
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Communication Intelligence</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-2 gap-6 pt-2">
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Preferred Channel</Label>
                                            {isEditing ? (
                                                <Select value={editData.preferredChannel} onValueChange={(v) => updateEditField("preferredChannel", v)}>
                                                    <SelectTrigger className="h-9 border-gray-200 rounded-lg text-xs font-bold">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="email">Email</SelectItem>
                                                        <SelectItem value="phone">Phone / Call</SelectItem>
                                                        <SelectItem value="sms">SMS</SelectItem>
                                                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                                        <SelectItem value="portal">Client Portal</SelectItem>
                                                        <SelectItem value="walk_in">Branch / Walk-in</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <p className="text-xs font-bold text-gray-700 capitalize">{s.preferredChannel || "Email"}</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Preferred Language</Label>
                                            {isEditing ? (
                                                <Select value={editData.preferredLanguage} onValueChange={(v) => updateEditField("preferredLanguage", v)}>
                                                    <SelectTrigger className="h-9 border-gray-200 rounded-lg text-xs font-bold">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="english">English</SelectItem>
                                                        <SelectItem value="swahili">Swahili</SelectItem>
                                                        <SelectItem value="french">French</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <p className="text-xs font-bold text-gray-700 uppercase italic">{s.preferredLanguage || "English"}</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                {s.type === 'staff' ? "Department" : "Organization/Institution"}
                                            </Label>
                                            {isEditing ? (
                                                <Select value={editData.organization || "none"} onValueChange={(v) => updateEditField("organization", v === "none" ? "" : v)}>
                                                    <SelectTrigger className="h-9 text-xs font-bold border-gray-200 rounded-lg bg-gray-100/30">
                                                        <SelectValue placeholder="Select Organization" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none" className="font-bold text-gray-400 italic">Independent / None</SelectItem>
                                                        {organizations.map(org => (
                                                            <SelectItem key={org} value={org} className="font-bold">{org}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <p className="text-xs font-bold text-[#004E98] hover:underline cursor-pointer">{s.organization || "Independent"}</p>
                                            )}
                                        </div>
                                        {(s.type === 'corporate_client' || s.type === 'sacco_cooperative' || s.type === 'bancassurance_partner' || s.type === 'agent' || s.type === 'broker') && (
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Specific Contact</Label>
                                                <p className="text-xs font-bold text-gray-700 capitalize">{s.name || "Unassigned"}</p>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Log Frequency</Label>
                                            <p className="text-xs font-bold text-gray-500 uppercase">{s.communicationFrequency || "As Needed"}</p>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                </Card>

                {/* Card 2: Financials & Connectivity */}
                <Card className="border-gray-100 shadow-sm rounded-xl overflow-hidden">
                    <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-5">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="h-5 w-5 text-[#004E98]" />
                            <CardTitle className="text-sm font-bold text-gray-900 uppercase tracking-widest">Value & Connectivity</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {s.type === 'staff' ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-[#004E98]/5 p-4 rounded-xl border border-[#004E98]/10 flex flex-col justify-center">
                                    <Label className="text-[10px] font-black text-[#004E98]/60 uppercase tracking-widest leading-none mb-2">Assigned Cases</Label>
                                    <p className="text-3xl font-black text-[#004E98]">{staffMetrics?.assignedCases || 0}</p>
                                </div>
                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col justify-center">
                                    <Label className="text-[10px] font-black text-emerald-600/70 uppercase tracking-widest leading-none mb-2">Cases Resolved</Label>
                                    <p className="text-3xl font-black text-emerald-600">{staffMetrics?.casesResolved || 0}</p>
                                </div>
                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex flex-col justify-center">
                                    <Label className="text-[10px] font-black text-amber-600/70 uppercase tracking-widest leading-none mb-2">Active Shifts</Label>
                                    <p className="text-3xl font-black text-amber-600">{staffMetrics?.activeShifts || 0}</p>
                                </div>
                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col justify-center">
                                    <Label className="text-[10px] font-black text-indigo-600/70 uppercase tracking-widest leading-none mb-2">Avg Resolution Time</Label>
                                    <p className="text-3xl font-black text-indigo-600">{staffMetrics?.avgResolutionTime || 0} <span className="text-sm font-bold text-indigo-400">mins</span></p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                    <div className="space-y-1 col-span-2 bg-[#004E98]/5 p-4 rounded-xl border border-[#004E98]/10 flex items-center justify-between">
                                        <div>
                                            <Label className="text-[10px] font-black text-[#004E98]/60 uppercase tracking-widest leading-none">Total Premiums Paid</Label>
                                            <p className="text-2xl font-bold text-[#004E98] mt-1">{formatStakeholderCurrency(s.country || "Kenya", (s.premiumPaymentHistory || []).reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0))}</p>
                                        </div>
                                        <DollarSign className="h-8 w-8 text-[#004E98]/20" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Engagement Score</Label>
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg font-bold text-gray-900">{(s as any).aggregatedEngagement || s.engagementScore || 0}%</span>
                                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(s as any).aggregatedEngagement || s.engagementScore || 0}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Risk Level</Label>
                                        <div>
                                            <Badge className={`${riskColors[(s as any).aggregatedRisk || dynamicRisk] || "bg-gray-100 text-gray-700"} text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 border-none shadow-sm`}>
                                                {(s as any).aggregatedRisk || dynamicRisk} Risk
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                <Accordion type="multiple" value={openAccordions} onValueChange={setOpenAccordions} className="border-t border-gray-100 pt-2">
                                    <AccordionItem value="social-details" className="border-none">
                                        <AccordionTrigger className="hover:no-underline py-4">
                                            <div className="flex items-center gap-2">
                                                <Activity className="h-4 w-4 text-gray-400" />
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Social Media Integration</span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="grid grid-cols-2 gap-4 pt-2">
                                                {[
                                                    { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-[#0077b5]' },
                                                    { id: 'twitter', label: 'X (Twitter)', icon: Twitter, color: 'text-[#1da1f2]' },
                                                    { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-600' },
                                                    { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-700' }
                                                ].map((p) => (
                                                    <div key={p.id} className="space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <p.icon className={`h-3 w-3 ${p.color}`} />
                                                            <Label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{p.label}</Label>
                                                        </div>
                                                        {isEditing ? (
                                                            <Input 
                                                                value={editData.socialProfiles?.[p.id] || ""} 
                                                                onChange={(e) => updateSocialField(p.id, e.target.value)} 
                                                                className="h-8 text-[11px] font-bold border-gray-200 rounded-lg outline-none" 
                                                                placeholder={`${p.label} URL`}
                                                            />
                                                        ) : (
                                                            <p className="text-xs font-bold text-gray-500 truncate">{s.socialProfiles?.[p.id] || "—"}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Main Tabbed Content Section ── */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 bg-gray-50/30 px-6 pt-2 overflow-x-auto custom-scrollbar">
                    <TabsList className="bg-transparent h-12 gap-8 border-none p-0 flex w-max min-w-full">
                        {s.type !== 'staff' && (
                            <TabsTrigger value="activities" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap flex-shrink-0">
                                <Activity className="h-4 w-4 mr-2" /> Activity & Cases
                            </TabsTrigger>
                        )}
                        {s.type !== 'staff' && (
                            <TabsTrigger value="policies" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap flex-shrink-0">
                                <Shield className="h-4 w-4 mr-2" /> Policy History
                            </TabsTrigger>
                        )}
                        {s.type !== 'staff' && (
                            <TabsTrigger value="claims" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap flex-shrink-0">
                                <AlertTriangle className="h-4 w-4 mr-2" /> Claims History
                            </TabsTrigger>
                        )}
                        {s.type !== 'staff' && (
                            <TabsTrigger value="payment" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap flex-shrink-0">
                                <DollarSign className="h-4 w-4 mr-2" /> Payment History
                            </TabsTrigger>
                        )}
                        {s.type !== 'staff' && (
                            <TabsTrigger value="connections" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap flex-shrink-0">
                                <Network className="h-4 w-4 mr-2" /> Connections
                            </TabsTrigger>
                        )}
                        {s.type !== 'staff' && (
                            <TabsTrigger value="underwriting" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap flex-shrink-0">
                                <ShieldCheck className="h-4 w-4 mr-2" /> Underwriting
                            </TabsTrigger>
                        )}

                        {s.type === 'staff' && (
                            <>
                                <TabsTrigger value="staff_shifts" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap flex-shrink-0">
                                    <Calendar className="h-4 w-4 mr-2" /> Shifts
                                </TabsTrigger>
                                <TabsTrigger value="staff_cases" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap flex-shrink-0">
                                    <History className="h-4 w-4 mr-2" /> Case History
                                </TabsTrigger>
                                <TabsTrigger value="staff_queues" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap flex-shrink-0">
                                    <Layers className="h-4 w-4 mr-2" /> Queue & Workload
                                </TabsTrigger>
                            </>
                        )}
                    </TabsList>
                </div>

                <TabsContent value="employee_certificates" className="p-8">
                    <Card className="border-gray-100 shadow-sm rounded-xl">
                        <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-black text-[#004E98] uppercase tracking-widest flex items-center gap-2">
                                <Award className="h-4 w-4" /> Certified Employees
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <p className="text-sm font-bold text-gray-400 italic text-center py-8">No certified employees recorded yet.</p>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="underwriting" className="p-0 border-t border-gray-100">
                    <div className="bg-white overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/20">
                            <p className="text-[10px] font-black uppercase text-[#004E98] tracking-[0.2em] flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4" /> Current status of ongoing medical exams, document reviews, or risk assessments.
                            </p>
                        </div>
                        <div className="p-8 flex flex-col items-center justify-center min-h-[200px]">
                            {meta.underwritingProgress ? (
                                <div className="space-y-4 text-center">
                                    <div className="w-16 h-16 rounded-full bg-[#004E98]/10 flex items-center justify-center mx-auto">
                                        <Activity className="h-8 w-8 text-[#004E98]" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Current Status</p>
                                        <Badge className="bg-[#004E98] text-white px-4 py-1.5 text-sm font-bold shadow-md hover:bg-[#003B73] transition-colors uppercase tracking-wider">
                                            {meta.underwritingProgress}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-gray-500 font-medium max-w-md mx-auto mt-4">
                                        The stakeholder is currently at the <strong>{meta.underwritingProgress}</strong> stage in the risk assessment and approval pipeline.
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center space-y-3">
                                    <Shield className="h-10 w-10 text-gray-200 mx-auto" />
                                    <p className="text-sm font-bold text-gray-400 italic">No underwriting records found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="policies" className="p-0 border-t border-gray-100">
                    <div className="bg-white overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/20 flex flex-row items-center justify-between">
                            <p className="text-[10px] font-black uppercase text-[#004E98] tracking-[0.2em] flex items-center gap-2">
                                <Shield className="h-4 w-4" /> A comprehensive record of all past and present insurance contracts held by this client.
                            </p>
                            {s.policyRenewalDate && (
                                <Badge className="bg-amber-100 text-amber-700 text-[10px] uppercase font-black">
                                    Renews: {new Date(s.policyRenewalDate).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </Badge>
                            )}
                        </div>
                        <div className="p-0">
                            {(s.policyHistory || []).length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50/30 border-b border-gray-100">
                                        <tr>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Policy No</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Product</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Period</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {(s.policyHistory || []).map((pol: any, i: number) => (
                                            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="py-3 px-6">
                                                    <p className="text-xs font-bold text-gray-900">{pol.policyNumber || "N/A"}</p>
                                                </td>
                                                <td className="py-3 px-6">
                                                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">{pol.product || "Unknown"}</p>
                                                </td>
                                                <td className="py-3 px-6">
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                        {pol.startDate ? new Date(pol.startDate).toLocaleDateString('en-KE') : '—'} - {pol.endDate ? new Date(pol.endDate).toLocaleDateString('en-KE') : '—'}
                                                    </p>
                                                </td>
                                                <td className="py-3 px-6 text-right">
                                                    <Badge className={`${pol.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'} border-none uppercase text-[9px] font-black tracking-widest`}>
                                                        {pol.status || "Completed"}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-sm font-bold text-gray-400 italic text-center py-8">No policy history recorded</p>
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="claims" className="p-0 border-t border-gray-100">
                    <div className="bg-white overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/20">
                            <p className="text-[10px] font-black uppercase text-[#004E98] tracking-[0.2em] flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" /> A log of all insurance claims filed, including their assessment status and payout amounts.
                            </p>
                        </div>
                        <div className="p-0">
                            {(s.claimsHistory || []).length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50/30 border-b border-gray-100">
                                        <tr>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Date</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Claim ID / Type</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest text-center">Amount (KES)</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {(s.claimsHistory || []).map((claim: any, i: number) => (
                                            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="py-3 px-6">
                                                    <p className="text-xs font-bold text-gray-900">{claim.date ? new Date(claim.date).toLocaleDateString('en-KE') : "N/A"}</p>
                                                </td>
                                                <td className="py-3 px-6">
                                                    <p className="text-xs font-bold text-[#004E98]">{claim.claimId || "Unknown"}</p>
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{claim.type || "General"}</p>
                                                </td>
                                                <td className="py-3 px-6 text-center">
                                                    <span className="text-xs font-black text-gray-900">{formatStakeholderCurrency(s.country || "Kenya", claim.amount || 0)}</span>
                                                </td>
                                                <td className="py-3 px-6 text-right">
                                                    <Badge className={`${claim.status === 'Settled' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} border-none uppercase text-[9px] font-black tracking-widest`}>
                                                        {claim.status || "Pending"}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-sm font-bold text-gray-400 italic text-center py-8">No claims recorded</p>
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="payment" className="p-0 border-t border-gray-100">
                    <div className="bg-white overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/20 flex flex-row items-center justify-between">
                            <p className="text-[10px] font-black uppercase text-[#004E98] tracking-[0.2em] flex items-center gap-2">
                                <DollarSign className="h-4 w-4" /> A ledger of all premium payments received from this stakeholder.
                            </p>
                            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-[#004E98]/20 text-[#004E98] bg-[#004E98]/5">
                                Total: KES {((s.premiumPaymentHistory || []).reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0)).toLocaleString()}
                            </Badge>
                        </div>
                        <div className="p-0">
                            {(s.premiumPaymentHistory || []).length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50/30 border-b border-gray-100">
                                        <tr>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Date</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Reference</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Description</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Amount (KES)</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {(s.premiumPaymentHistory || []).map((payment: any, i: number) => (
                                            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="py-3 px-6">
                                                    <p className="text-xs font-bold text-gray-500">
                                                        {new Date(payment.date || new Date()).toLocaleDateString('en-KE')}
                                                    </p>
                                                </td>
                                                <td className="py-3 px-6">
                                                    <p className="text-[10px] font-bold text-gray-400 tracking-wider font-mono">
                                                        {payment.reference || "N/A"}
                                                    </p>
                                                </td>
                                                <td className="py-3 px-6">
                                                    <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                                                        {payment.type || "Service Payment"}
                                                    </p>
                                                </td>
                                                <td className="py-3 px-6 text-right">
                                                    <span className="text-sm font-black text-gray-900">{Number(payment.amount).toLocaleString() || 0}</span>
                                                </td>
                                                <td className="py-3 px-6 text-center">
                                                    <Badge className={`${payment.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} border-none uppercase text-[9px] font-black tracking-widest`}>
                                                        {payment.status || "Paid"}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-sm font-bold text-gray-400 italic text-center py-8">No payments recorded</p>
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="activities" className="p-0 border-t border-gray-100">
                    <div className="bg-white overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/20">
                            <h4 className="text-[10px] font-black uppercase text-[#004E98] tracking-[0.2em] flex items-center gap-2">
                                <History className="h-3 w-3" /> Complaints, queries & Communication history
                            </h4>
                        </div>
                        <div className="p-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        <th className="py-4 px-8 font-black text-gray-400 uppercase text-[10px] tracking-widest">Type</th>
                                        <th className="py-4 px-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Subject & Reference</th>
                                        <th className="py-4 px-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Assignee</th>
                                        <th className="py-4 px-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Department</th>
                                        <th className="py-4 px-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Status</th>
                                        <th className="py-4 px-8 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {[
                                        ...cases.map(c => ({ ...c, activityType: 'case', createdAt: c.openedAt || c.createdAt }))
                                    ]
                                        .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
                                        .map((act) => (
                                            <tr
                                                key={`${act.activityType}-${act.id}`}
                                                className="group hover:bg-gray-50/80 cursor-pointer transition-colors h-20"
                                                onClick={() => act.activityType === 'case' ? onCaseClick(act.id) : null}
                                            >
                                                <td className="px-8 whitespace-nowrap">
                                                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                                        {(act.activityType === 'case' ? (act.channel || 'portal') : 'interaction').replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="space-y-1">
                                                                    <p className="text-sm font-bold text-gray-700 group-hover:text-[#004E98] transition-colors line-clamp-1">
                                                                        {act.activityType === 'case' ? act.title : act.subject}
                                                                    </p>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                                            ID: {act.activityType === 'case' ? (act.caseNumber || act.id.slice(0, 8).toUpperCase()) : "SIM-INT"}
                                                                        </span>
                                                                        {act.priority && (
                                                                            <>
                                                                                <div className="w-1 h-1 rounded-full bg-gray-200" />
                                                                                <span className={`text-[10px] font-black uppercase tracking-widest ${act.priority === 'critical' || act.priority === 'high' ? 'text-red-500' : 'text-gray-400'
                                                                                    }`}>
                                                                                    {act.priority}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="max-w-[300px] p-4 bg-white shadow-xl border-gray-100 rounded-xl" sideOffset={10}>
                                                                <div className="space-y-2">
                                                                    <p className="text-[10px] font-black uppercase text-[#004E98] tracking-widest">Original Communication</p>
                                                                    <p className="text-sm text-gray-600 leading-relaxed italic">
                                                                        {act.description || act.notes || "No historical notes available for this item."}
                                                                    </p>
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </td>
                                                <td className="px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                                                            <UserCircle className="h-4 w-4 text-gray-400" />
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-700">{act.assignedToName || act.assignedTo || "Unassigned"}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-gray-200 text-gray-500 rounded-lg whitespace-nowrap w-fit">
                                                            {(act as any).departmentName || act.department || "Operations"}
                                                        </Badge>
                                                        {act.activityType === 'case' && (act as any).categoryName && (
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{ (act as any).categoryName }</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 whitespace-nowrap">
                                                    <Badge className={`${act.activityType === 'case' ? (riskColors[act.priority?.toLowerCase()] || "bg-gray-100 text-gray-700") : "bg-blue-50 text-[#004E98]"} border-none uppercase text-[9px] font-black tracking-widest px-2.5 py-0.5`}>
                                                        {act.activityType === 'case' ? act.status?.replace(/_/g, ' ') : (act.interactionType || "LOGGED")}
                                                    </Badge>
                                                </td>
                                                <td className="px-8 text-right whitespace-nowrap">
                                                    <div className="flex flex-col items-end">
                                                        <p className="text-sm font-bold text-gray-700">
                                                            {new Date(act.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                                        </p>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                            {new Date(act.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="connections" className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {segments && segments.length > 0 ? (
                            segments.map((seg) => (
                                <Card key={seg.id} className="border-gray-100 shadow-sm hover:shadow-md transition-shadow group rounded-xl">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-[#004E98]/5 transition-colors">
                                                <Target className="h-6 w-6 text-gray-400 group-hover:text-[#004E98]" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">SEGMENT</p>
                                                    <Badge className="bg-[#D0AC01]/10 text-[#D0AC01] text-[9px] font-bold border-none uppercase h-4">
                                                        ACTIVE
                                                    </Badge>
                                                </div>
                                                <p className="text-sm font-bold text-gray-900 truncate group-hover:underline cursor-pointer">
                                                    {seg.name || "Assigned Segment"}
                                                </p>
                                                <p className="text-[10px] text-gray-500 mt-0.5 truncate italic" title={seg.description}>{seg.description || "Segment connection"}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            <div className="col-span-full py-12 flex flex-col items-center justify-center space-y-4">
                                <Network className="h-12 w-12 text-gray-100" />
                                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">No Assigned Segments</p>
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="accreditation" className="p-8">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Accreditation Lifecycle</h3>
                            <Button size="sm" className="bg-[#004E98] hover:bg-[#003B73] font-bold shadow-md rounded-xl">
                                <Plus className="h-4 w-4 mr-2" /> Start Process
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Document Review Section */}
                            <Card className="border-gray-100 shadow-sm rounded-xl">
                                <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-4">
                                    <CardTitle className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-[#004E98]" /> Document Review
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-4">
                                    <div className="space-y-3">
                                        {['Ministry Registration', 'Trainer Qualifications', 'QA Procedures', 'Library Evidence'].map((doc, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-[#004E98]/20 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center">
                                                        <FileText className="h-4 w-4 text-gray-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-gray-900">{doc}</p>
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Pending Upload</p>
                                                    </div>
                                                </div>
                                                <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold">Request</Button>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Visit Scheduling Section */}
                            <Card className="border-gray-100 shadow-sm rounded-xl">
                                <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-4">
                                    <CardTitle className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-emerald-600" /> Assessment Visits
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="flex flex-col items-center justify-center py-8 space-y-3 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/30">
                                        <Calendar className="h-8 w-8 text-gray-300" />
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center">No Visits Scheduled</p>
                                        <Button variant="outline" size="sm" className="bg-white hover:bg-gray-50 font-bold border-gray-200 shadow-sm">
                                            Schedule Field Visit
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>


                <TabsContent value="staff_shifts" className="p-8">
                    <Card className="border-gray-100 shadow-sm rounded-xl">
                        <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-4">
                            <CardTitle className="text-xs font-black text-[#004E98] uppercase tracking-widest flex items-center gap-2">
                                <Calendar className="h-4 w-4" /> Shift Schedule
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {(staffShifts || []).length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50/30 border-b border-gray-100">
                                        <tr>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Date</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Shift Name</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Time</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {(staffShifts || []).map((shift: any, i: number) => (
                                            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="py-3 px-6">
                                                    <p className="text-xs font-bold text-gray-900">
                                                        {new Date(shift.date).toLocaleDateString('en-KE')}
                                                    </p>
                                                </td>
                                                <td className="py-3 px-6">
                                                    <p className="text-xs font-bold text-[#004E98]">{shift.shiftName}</p>
                                                </td>
                                                <td className="py-3 px-6">
                                                    <p className="text-[10px] font-bold text-gray-500 font-mono">
                                                        {shift.startTime} - {shift.endTime}
                                                    </p>
                                                </td>
                                                <td className="py-3 px-6 text-right">
                                                    <Badge className={`${shift.status === 'scheduled' ? 'bg-amber-100 text-amber-700' : shift.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'} border-none uppercase text-[9px] font-black tracking-widest`}>
                                                        {shift.status}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-sm font-bold text-gray-400 italic text-center py-8">No shifts scheduled</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="staff_cases" className="p-8">
                    <Card className="border-gray-100 shadow-sm rounded-xl">
                        <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-4">
                            <CardTitle className="text-xs font-black text-[#004E98] uppercase tracking-widest flex items-center gap-2">
                                <History className="h-4 w-4" /> Assigned Case History
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {(staffCases || []).length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50/30 border-b border-gray-100">
                                        <tr>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Case ID</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Title</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Priority</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Resolution Time</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {(staffCases || []).map((c: any, i: number) => (
                                            <tr key={i} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => onCaseClick(c.id)}>
                                                <td className="py-3 px-6">
                                                    <p className="text-[10px] font-bold text-gray-500 font-mono">{c.caseNumber}</p>
                                                </td>
                                                <td className="py-3 px-6">
                                                    <p className="text-xs font-bold text-gray-900 truncate max-w-[200px]">{c.title}</p>
                                                </td>
                                                <td className="py-3 px-6">
                                                    <Badge className={`${riskColors[c.priority?.toLowerCase()] || "bg-gray-100 text-gray-700"} border-none uppercase text-[9px] font-black tracking-widest`}>
                                                        {c.priority}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-6">
                                                    <p className="text-xs font-bold text-gray-600">{c.resolutionDurationMinutes ? `${c.resolutionDurationMinutes} mins` : "—"}</p>
                                                </td>
                                                <td className="py-3 px-6 text-right">
                                                    <Badge className={`${c.status === 'resolved' || c.status === 'closed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-[#004E98]'} border-none uppercase text-[9px] font-black tracking-widest`}>
                                                        {c.status.replace(/_/g, ' ')}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-sm font-bold text-gray-400 italic text-center py-8">No case history available</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="staff_queues" className="p-8">
                    <Card className="border-gray-100 shadow-sm rounded-xl">
                        <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-4">
                            <CardTitle className="text-xs font-black text-[#004E98] uppercase tracking-widest flex items-center gap-2">
                                <Layers className="h-4 w-4" /> Queue Enrollments
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {(staffQueues || []).length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50/30 border-b border-gray-100">
                                        <tr>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Queue Name</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Skill Level</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest">Max Concurrent</th>
                                            <th className="py-3 px-6 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {(staffQueues || []).map((q: any, i: number) => (
                                            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="py-3 px-6">
                                                    <p className="text-xs font-bold text-gray-900">{q.queueName}</p>
                                                </td>
                                                <td className="py-3 px-6">
                                                    <Badge className="bg-[#004E98]/10 text-[#004E98] border-none uppercase text-[9px] font-black tracking-widest">
                                                        Level {q.skillLevel}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-6">
                                                    <p className="text-xs font-bold text-gray-600 text-center">{q.maxConcurrentCases}</p>
                                                </td>
                                                <td className="py-3 px-6 text-right">
                                                    <Badge className={`${q.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'} border-none uppercase text-[9px] font-black tracking-widest`}>
                                                        {q.isActive ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-sm font-bold text-gray-400 italic text-center py-8">Not enrolled in any queues</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>

            {/* Print styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print, button, [role="tablist"] { display: none !important; }
                    .rounded-xl { border-radius: 0.5rem !important; }
                    body { background: white !important; }
                    .shadow-sm, .shadow-md, .shadow-xl { box-shadow: none !important; }
                }
            `}} />
        </div>
    );
}
