import { useParams, useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { useIsMobile } from "@/hooks/use-mobile";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Clock, User, Building2, MapPin, Mail, Phone,
    MessageSquare, AlertCircle, CheckCircle2,
    ArrowLeft, History, Users, Tag, Send,
    LayoutDashboard, FolderOpen, BookOpen, Fingerprint, Dna,
    GraduationCap, Activity, FileText, Globe, Filter, Terminal,
    ChevronDown, ChevronUp, Calendar, CreditCard, ShieldCheck, Briefcase,
    Paperclip, File as FileIcon, Loader2, HelpCircle, UserCircle
} from "lucide-react";
import { format } from "date-fns";
import { formatLabel, statusColors, priorityColors } from "@/components/cases/case-utils";
import { DashboardLayout } from "@/components/shared/dashboard-layout";
import { NavGroup } from "@/components/shared/dashboard-sidebar";
import { MentionInput } from "@/components/shared/mention-input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AcknowledgeModal, ResolveModal } from "@/components/cases/status-modals";
import { AcceptanceModal } from "@/components/cases/acceptance-modal";
import { StakeholderProfile, typeIcons, riskColors, formatStakeholderLocalTime } from "@/components/stakeholders/stakeholder-profile";
import { STAKEHOLDER_TYPE_COLORS } from "@/components/stakeholders/stakeholder-type-colors";
import { ChatWindow } from "@/components/communications/ChatWindow";
import { getSegmentDescription } from "@/components/stakeholders/segment-definitions";


export default function CaseWorkspace() {
    const { id } = useParams();
    const [, setLocation] = useLocation();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem("marketingUser");
        if (storedUser) {
            try { setUser(JSON.parse(storedUser)); } catch { }
        }
    }, []);

    const navGroups: NavGroup[] = [
        {
            title: "Workplace",
            items: [
                { id: "overview", label: "Overview", icon: LayoutDashboard },
                { id: "cases", label: "All Cases", icon: FolderOpen },
                { id: "collaboration", label: "Discussions", icon: MessageSquare },
            ],
        },
        {
            title: "Strategic Intelligence",
            items: [
                { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
                ...(user?.role === "manager" || user?.role === "admin" ? [{ id: "triage", label: "Triage", icon: Filter }] : []),
            ],
        },
        {
            title: "Governance",
            items: [
                { id: "sla", label: "SLA Monitor", icon: Clock },
            ],
        },
        ...(user?.role === "admin" ? [
            {
                title: "System Lab",
                items: [
                    { id: "simulate", label: "Simulate Scenarios", icon: Terminal },
                ],
            }
        ] : []),
    ];

    if (!id) return null;

    return (
        <DashboardLayout
            title="CIC CRM"
            subtitle="CASE WORKSPACE"
            navGroups={navGroups}
            activeTab="cases"
            setActiveTab={(tab) => setLocation(tab === "overview" ? "/cases/dashboard" : `/cases/dashboard?tab=${tab}`)}
            user={user}
            onLogout={() => {
                localStorage.removeItem("marketingToken");
                localStorage.removeItem("marketingUser");
                setLocation("/marketing/login");
            }}
            breadcrumbs={[
                { label: "Dashboard", onClick: () => setLocation("/cases/dashboard") },
                { label: "All Cases", onClick: () => setLocation("/cases/dashboard?tab=cases") },
                { label: "Case Workspace" }
            ]}
        >
            <CaseWorkspaceContent id={id} onBack={() => setLocation("/cases/dashboard")} user={user} />
        </DashboardLayout>
    );
}

export function CaseWorkspaceContent({ id, onBack, user }: { id: string; onBack?: () => void; user: any }) {
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const [isUpdating, setIsUpdating] = useState(false);
    const [showAckModal, setShowAckModal] = useState(false);
    const [showResolveModal, setShowResolveModal] = useState(false);
    const [showAcceptanceModal, setShowAcceptanceModal] = useState(false);
    const [notebookText, setNotebookText] = useState("");

    const { data: workspace, isLoading, isError, refetch: loadWorkspace } = useQuery({
        queryKey: ["cases", "workspace", id],
        queryFn: async () => {
            const res = await apiRequest(`/api/cases/${id}/workspace`);
            if (!res.ok) throw new Error("Failed to load workspace");
            return res.json();
        },
        staleTime: 1000 * 30,
    });

    useEffect(() => {
        if (workspace?.case?.status === 'pending_acceptance') {
            setShowAcceptanceModal(true);
        } else {
            setShowAcceptanceModal(false);
        }
    }, [workspace]);

    const handleAcknowledge = async (message: string, resolveImmediately?: boolean, resolutionData?: any) => {
        setIsUpdating(true);
        try {
            const res = await apiRequest(`/api/cases/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify({
                    status: resolveImmediately ? "resolved" : "in_progress",
                    acknowledged: true,
                    message: message,
                    ...(resolveImmediately && resolutionData ? {
                        resolutionNotes: resolutionData.resolutionNotes,
                        rootCause: resolutionData.rootCause,
                        sopSteps: resolutionData.sopSteps
                    } : {})
                })
            });
            if (res.ok) {
                setShowAckModal(false);
                await loadWorkspace();
            }
        } catch (err) {
            console.error("Failed to respond to case:", err);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleAcceptConsent = async () => {
        setIsUpdating(true);
        try {
            const res = await apiRequest(`/api/cases/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify({
                    status: "in_progress"
                })
            });
            if (res.ok) {
                setShowAcceptanceModal(false);
                await loadWorkspace();
            }
        } catch (err) {
            console.error("Failed to accept case:", err);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleEscalateConsent = async () => {
        setIsUpdating(true);
        try {
            const res = await apiRequest(`/api/cases/${id}/escalate`, {
                method: "POST"
            });
            if (res.ok) {
                setShowAcceptanceModal(false);
                await loadWorkspace();
            }
        } catch (err) {
            console.error("Failed to escalate case:", err);
        } finally {
            setIsUpdating(false);
        }
    };

    if (isLoading) return <WorkspaceLoading />;
    if (!workspace) return <div className="p-8 text-center text-gray-500">Case not found. Please verify the ID or your access permissions.</div>;

    const { case: caseData, category, collaboration, department, assignee, slaRule, history, interactions, stakeholder } = workspace;
    const isAcknowledged = !!caseData.firstResponseAt;

    const finalResponseDeadline = caseData.slaResponseDeadline ||
        (slaRule?.responseTimeMinutes ? new Date(new Date(caseData.createdAt).getTime() + slaRule.responseTimeMinutes * 60000).toISOString() : null);

    let finalPrimaryDeadline = caseData.slaDeadline;
    if (!finalPrimaryDeadline && slaRule?.timeline) {
        let multiplier = 1;
        if (slaRule.timelineUnit === "minutes") multiplier = 60000;
        else if (slaRule.timelineUnit === "hours") multiplier = 3600000;
        else if (slaRule.timelineUnit === "seconds") multiplier = 1000;
        else if (slaRule.timelineUnit?.includes("days")) multiplier = 86400000; // Simplified working vs calendar for frontend view
        finalPrimaryDeadline = new Date(new Date(caseData.createdAt).getTime() + slaRule.timeline * multiplier).toISOString();
    }

    const handleResolve = async (resolutionNotes: string, saveToKb: boolean, sopSteps: string[], rootCause: string) => {
        setIsUpdating(true);
        try {
            const res = await apiRequest(`/api/cases/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ 
                    status: "resolved", 
                    resolutionNotes,
                    saveToKb,
                    sopSteps,
                    rootCause
                })
            });
            if (res.ok) {
                setShowResolveModal(false);
                await loadWorkspace();
            }
        } catch (err) {
            console.error("Failed to resolve case:", err);
        } finally {
            setIsUpdating(false);
        }
    };

    const scrollToChat = () => {
        document.getElementById("case-chat-window")?.scrollIntoView({ behavior: "smooth" });
    };

    const handleAction = () => {
        if (workspace?.conversationId) {
            const tab = caseData.channel === 'email' ? 'email-inbox' : 'whatsapp-inbox';
            setLocation(`/communications/dashboard?tab=${tab}&conversation=${workspace.conversationId}&fromCase=${caseData.caseNumber}`);
        } else {
            scrollToChat();
        }
    };

    const resolutionDuration = caseData.resolvedAt && caseData.firstResponseAt
        ? Math.round((new Date(caseData.resolvedAt).getTime() - new Date(caseData.firstResponseAt).getTime()) / (1000 * 60))
        : null;

    const s = workspace?.stakeholder;
    const TypeIcon = s ? (typeIcons[s.type] || HelpCircle) : UserCircle;
    const dynamicRisk = s?.riskLevel || 'low';

    const stakeholderSegments = s?.tags?.filter((tag: string) => tag.startsWith('seg:')).map((tag: string) => {
        const id = tag.replace('seg:', '');
        return {
            id,
            name: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            description: getSegmentDescription(id)
        };
    }) || [];

    return (
        <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12">
            {/* UNIFIED SUPER-HEADER */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#004E98]/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                
                {/* Top Row: Navigation and Operations */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 border-b border-gray-50 pb-4">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onBack}
                            className="h-10 w-10 text-gray-400 hover:text-[#004E98] hover:bg-blue-50 rounded-full transition-all"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="px-3 py-1 bg-[#004E98]/5 text-[#004E98] font-black italic tracking-tight text-xs border border-[#004E98]/10 rounded-sm">
                                {caseData.caseNumber}
                            </Badge>
                            <Badge className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${statusColors[caseData.status] || "bg-gray-100 text-gray-600"}`}>
                                {caseData.status.replace('_', ' ')}
                            </Badge>
                            <Separator orientation="vertical" className="h-4 hidden sm:block" />
                            <div className="flex items-center gap-1.5 px-1">
                                <User className="h-4 w-4 text-gray-400" />
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden sm:inline">Assigned To</span>
                                <span className="text-[10px] font-black text-gray-700 italic">
                                    {assignee ? `${assignee.firstName} ${assignee.lastName}` : "Unassigned"}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap justify-center sm:justify-end items-center gap-4 bg-gray-50/80 px-4 py-2 rounded-2xl border border-gray-100 shadow-inner">
                        {finalResponseDeadline && (
                            <>
                                <SLACountdown deadline={finalResponseDeadline} completedAt={caseData.firstResponseAt} label="Response Time" unit="minutes" />
                                {finalPrimaryDeadline && <Separator orientation="vertical" className="h-8 opacity-30 hidden sm:block" />}
                            </>
                        )}
                        {finalPrimaryDeadline && (
                            <SLACountdown deadline={finalPrimaryDeadline} completedAt={caseData.resolvedAt} label={slaRule?.metricType ? slaRule.metricType.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'Target Metric'} unit={slaRule?.timelineUnit} />
                        )}
                    </div>
                </div>

                {/* Bottom Row: Stakeholder Identity & Actions */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-[#004E98]/5 flex items-center justify-center text-[#004E98] shadow-inner ring-1 ring-[#004E98]/10">
                            <TypeIcon className="h-10 w-10" />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                                {s ? (
                                    (s.type === 'institution' || s.type === 'employer' || s.type === 'corporate_partner' || s.type === 'government_agency') ? (s.organization || s.name) : `${s.firstName || ""} ${s.lastName || ""}`.trim()
                                ) : (
                                    caseData.title
                                )}
                            </h1>
                            {s ? (
                                <div className="flex flex-wrap items-center gap-2 mt-2">
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
                                        {stakeholderSegments.map((seg: any) => (
                                            <Tooltip key={seg.id} delayDuration={200}>
                                                <TooltipTrigger asChild>
                                                    <span className="inline-block cursor-help">
                                                        <Badge className="bg-[#D0AC01]/10 text-[#D0AC01] px-2.5 py-0.5 font-bold rounded-md text-[10px] uppercase tracking-widest shadow-sm hover:bg-[#D0AC01]/20 transition-colors border-none">
                                                            {seg.name}
                                                        </Badge>
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-white border border-gray-100 text-gray-700 shadow-xl max-w-[250px] p-3 rounded-lg z-50">
                                                    <p className="text-xs font-medium leading-relaxed">{seg.description || "Segment connection"}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ))}
                                    </TooltipProvider>
                                    <div className="flex items-center gap-2 ml-2">
                                        <Clock className="h-4 w-4 text-gray-400" />
                                        <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">
                                            Local Time: <span className="text-gray-900">{formatStakeholderLocalTime(s.country || "Kenya")}</span>
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 font-medium">No Linked Stakeholder</p>
                            )}
                        </div>
                    </div>

                    <div className={`flex w-full sm:w-auto ${!caseData.firstResponseAt && slaRule?.responseTimeMinutes ? 'flex-col gap-2' : 'flex-col sm:flex-row items-stretch sm:items-center gap-3'}`}>
                        {(!caseData.firstResponseAt && slaRule?.responseTimeMinutes) && (
                            <Button
                                onClick={handleAction}
                                disabled={isUpdating}
                                className="w-full sm:w-auto h-11 px-8 bg-[#004E98] hover:bg-[#004E98]/90 text-white font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-tighter text-[11px]"
                            >
                                <MessageSquare className="h-4 w-4" /> Respond
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={handleAction}
                            disabled={isUpdating || caseData.status === 'resolved'}
                            className={`w-full sm:w-auto h-11 px-8 font-black rounded-xl shadow-sm transition-all uppercase tracking-tighter text-[11px] border-2 flex items-center justify-center ${caseData.status === 'resolved'
                                ? "text-emerald-500 border-emerald-500 bg-emerald-50/50 hover:bg-emerald-100/50"
                                : "text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300"
                                }`}
                        >
                            <CheckCircle2 className="h-4 w-4 mr-2" /> {caseData.status === 'resolved' ? 'Resolved' : 'Resolve'}
                        </Button>
                    </div>
                </div>

                <AcknowledgeModal
                    open={showAckModal}
                    onOpenChange={setShowAckModal}
                    onConfirm={handleAcknowledge}
                    isProcessing={isUpdating}
                    channel={caseData.channel}
                    templates={workspace?.templates || []}
                />

                <ResolveModal
                    open={showResolveModal}
                    onOpenChange={setShowResolveModal}
                    onConfirm={handleResolve}
                    isProcessing={isUpdating}
                    templates={workspace?.templates || []}
                    caseData={{
                        caseNumber: caseData.caseNumber,
                        title: caseData.title,
                        description: caseData.description,
                        channel: caseData.channel,
                        categoryName: category?.name,
                        departmentName: department?.name
                    }}
                />
            </div>

            {/* TIER 1.5: ORIGINAL COMMUNICATION */}
            <div className="w-full">
                <CommunicationCard
                    interaction={workspace?.interactions?.[0]}
                    channel={caseData.channel}
                    description={caseData.description}
                    createdAt={caseData.createdAt}
                    department={department}
                    category={category}
                />
            </div>

            {/* TIER 2: EMBEDDED STAKEHOLDER PROFILE */}
            <div className="w-full">
                {s ? (
                    <StakeholderProfile 
                        profile={{
                            stakeholder: s,
                            interactions: workspace.interactions || [],
                            relationships: workspace.relationships || [],
                            cases: workspace.stakeholderCases || [],
                            segments: stakeholderSegments
                        }}
                        isEmbedded={true}
                        isLoading={false}
                        onBack={() => {}}
                        onLogInteraction={() => {}}
                        onNavigate={() => {}}
                        onCaseClick={() => {}}
                        organizations={[]}
                    />
                ) : (
                    <div className="bg-white rounded-2xl border p-12 text-center text-gray-500">
                        <Fingerprint className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-bold text-gray-900 mb-2">No Stakeholder Linked</h3>
                        <p className="text-sm">This case is not yet associated with a verified stakeholder profile.</p>
                    </div>
                )}
            </div>

            {/* TIER 3 & 4: VERTICAL STACK FOR COMMUNICATION AND COLLABORATION */}
            <div className="flex flex-col gap-6 w-full">

                {/* Team Discussions / OmniChannel Chat */}
                <div className="w-full min-h-[700px] flex flex-col bg-white" id="case-chat-window">
                    {workspace.conversationId ? (
                        <ChatWindow conversationId={workspace.conversationId} />
                    ) : (
                        <CollaborationThread
                            caseId={id || ""}
                            initialComments={collaboration || []}
                            initialPersonalNotes={caseData.personalNotes}
                            canViewNotes={true}
                            text={notebookText}
                            setText={setNotebookText}
                        />
                    )}
                </div>
            </div>

            <AcceptanceModal 
                isOpen={showAcceptanceModal && caseData.assignedTo === user?.id}
                caseId={caseData.id}
                deadline={caseData.acceptanceDeadline}
                onAccept={handleAcceptConsent}
                onEscalate={handleEscalateConsent}
            />
        </div>
    );
}

function CommunicationCard({
    interaction, channel, description, createdAt, department, category
}: {
    interaction: any;
    channel: string;
    description?: string;
    createdAt?: string | null;
    department?: any;
    category?: any;
}) {
    const getChannelIcon = (channel: string) => {
        const lowerChannel = channel?.toLowerCase();
        if (lowerChannel.includes('whatsapp')) return <MessageSquare className="h-4 w-4 text-green-500" />;
        if (lowerChannel.includes('sms')) return <Send className="h-4 w-4 text-blue-400" rotate={-45} />;
        if (lowerChannel.includes('email')) return <Mail className="h-4 w-4 text-red-400" />;
        if (lowerChannel.includes('call')) return <Phone className="h-4 w-4 text-orange-400" />;
        if (lowerChannel.includes('portal')) return <Globe className="h-4 w-4 text-purple-400" />;
        return <MessageSquare className="h-4 w-4 text-[#004E98]" />;
    };

    return (
        <Card className="border-none shadow-sm ring-1 ring-gray-100 overflow-hidden h-full">
            <CardHeader className="bg-gray-50/50 py-4 border-b">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-700">
                        {getChannelIcon(channel)} Original Communication
                    </CardTitle>
                    <span className="text-[11px] text-[#004E98] font-black uppercase tracking-wider bg-[#004E98]/10 px-3 py-1 rounded-full">
                        {createdAt ? format(new Date(createdAt), "MMM d, HH:mm") : "Unknown Date"}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <div className="bg-blue-50/20 p-6 rounded-xl border border-blue-50/50 text-gray-800 leading-relaxed italic relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#004E98]/20 rounded-l-xl" />
                    "{interaction?.content || interaction?.description || description || "No original communication content provided."}"
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Channel</span>
                        <Badge variant="secondary" className="gap-1.5 font-bold bg-white border border-gray-100 shadow-sm text-[#004E98] px-3 py-1">
                            {getChannelIcon(channel)} {channel || "Unknown"}
                        </Badge>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Department</span>
                        <Badge variant="secondary" className="gap-1.5 font-bold bg-white border border-gray-100 shadow-sm text-gray-600 px-3 py-1">
                            <Building2 className="h-3 w-3" /> {department?.name || "Unassigned"}
                        </Badge>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Category</span>
                        <Badge variant="secondary" className="gap-1.5 font-bold bg-white border border-gray-100 shadow-sm text-gray-600 px-3 py-1">
                            <Tag className="h-3 w-3" /> {category?.name || "General"}
                        </Badge>
                    </div>
                    {interaction?.subject && (
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Subject</span>
                            <Badge variant="secondary" className="gap-1.5 font-bold bg-white border border-gray-100 shadow-sm text-gray-600 px-3 py-1">
                                <Tag className="h-3 w-3" /> {interaction.subject}
                            </Badge>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}


function StakeholderIdentityCard({ stakeholder, contactName }: { stakeholder: any; contactName: string }) {
    if (!stakeholder) {
        return (
            <Card className="border-none shadow-sm ring-1 ring-gray-100 overflow-hidden bg-white h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="bg-gray-50 p-4 rounded-full mb-4">
                    <Fingerprint className="h-8 w-8 text-gray-300" />
                </div>
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">No Linked Stakeholder</h3>
                <p className="text-xs text-[#004E98] font-bold italic">{contactName || "Anonymous Contact"}</p>
                <p className="text-[10px] text-gray-400 mt-4 leading-relaxed">This case is not yet linked to a verified stakeholder profile in the CRM.</p>
            </Card>
        );
    }
    const metadata = stakeholder?.metadata || {};
    const type = stakeholder?.type?.toLowerCase() || "student";

    const getIdentity = () => {
        switch (type) {
            case "institution":
            case "accreditation":
                return {
                    name: stakeholder.organization || contactName || "Unknown Institution",
                    id: stakeholder.policyNumber || "N/A",
                    label1: "Location",
                    value1: stakeholder.county || "Kenya",
                    icon1: MapPin,
                    label2: "Type",
                    value2: "Educational Institution",
                    icon2: Building2,
                    avatarIcon: Building2
                };
            case "employer":
                return {
                    name: stakeholder.organization || contactName || "Unknown Employer",
                    id: stakeholder.policyNumber || "N/A",
                    label1: "Industry",
                    value1: metadata.industry || "General Industry",
                    icon1: Briefcase,
                    label2: "Designation",
                    value2: metadata.designation || "HR Contact",
                    icon2: User,
                    avatarIcon: Briefcase
                };
            case "marker":
            case "setter":
                return {
                    name: stakeholder.firstName ? `${stakeholder.firstName} ${stakeholder.lastName}` : contactName || "Unknown Professional",
                    id: stakeholder.policyNumber || "N/A",
                    label1: "Subject",
                    value1: metadata.subject_area || "General",
                    icon1: BookOpen,
                    label2: "Role",
                    value2: type.toUpperCase(),
                    icon2: ShieldCheck,
                    avatarIcon: ShieldCheck
                };
            default: // student
                return {
                    name: stakeholder.firstName ? `${stakeholder.firstName} ${stakeholder.lastName}` : contactName || "Unknown Student",
                    id: stakeholder.policyNumber || "N/A",
                    label1: "Programme",
                    value1: metadata.programme_enrolled || "General Study",
                    icon1: GraduationCap,
                    label2: "Institution",
                    value2: stakeholder.organization || "Private Candidate",
                    icon2: Building2,
                    avatarIcon: GraduationCap
                };
        }
    };

    const identity = getIdentity();

    return (
        <Card className="border-none shadow-sm ring-1 ring-gray-100 overflow-hidden bg-white h-full">
            <CardHeader className="py-3 px-5 border-b bg-gray-50/30 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Fingerprint className="h-3.5 w-3.5 text-[#004E98]" /> Stakeholder Identity
                </CardTitle>
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-[#004E98]/20 text-[#004E98] py-0 h-5">
                    {type}
                </Badge>
            </CardHeader>
            <CardContent className="p-6">
                <div className="flex items-start gap-5">
                    <Avatar className="h-16 w-16 ring-4 ring-blue-50 border-2 border-white shadow-sm">
                        <AvatarFallback className="bg-gray-100 text-[#004E98] text-lg font-bold">
                            <identity.avatarIcon className="h-8 w-8 opacity-40" />
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <div className="flex flex-col mb-4">
                            <h3 className="text-xl font-black text-gray-900 leading-none mb-1.5 uppercase tracking-tight">{identity.name}</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID / REG:</span>
                                <span className="text-xs font-black text-[#004E98] bg-[#004E98]/5 px-1.5 py-0.5 rounded italic">{identity.id}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                            <div className="flex items-center gap-3">
                                <div className="bg-gray-50 p-2 rounded-md"><identity.icon1 className="h-4 w-4 text-[#004E98]/60" /></div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 leading-none">{identity.label1}</span>
                                    <span className="text-xs font-bold text-gray-800 line-clamp-1 truncate w-[140px] leading-tight">{identity.value1}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-gray-50 p-2 rounded-md"><identity.icon2 className="h-4 w-4 text-[#004E98]/60" /></div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 leading-none">{identity.label2}</span>
                                    <span className="text-xs font-bold text-gray-800 line-clamp-1 truncate w-[140px] leading-tight">{identity.value2}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-gray-50 p-2 rounded-md"><Mail className="h-4 w-4 text-[#004E98]/60" /></div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 leading-none">Email</span>
                                    <span className="text-xs font-bold text-gray-800 break-all leading-tight">{stakeholder?.email || "N/A"}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-gray-50 p-2 rounded-md"><Phone className="h-4 w-4 text-[#004E98]/60" /></div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 leading-none">Phone</span>
                                    <span className="text-xs font-bold text-gray-800 leading-tight">{stakeholder?.phone || "N/A"}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function CustomAccordion({ title, icon: Icon, children, defaultOpen = false }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border rounded-lg overflow-hidden mb-2 bg-white">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 bg-gray-50/50 hover:bg-gray-50 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-[#004E98]" />
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{title}</span>
                </div>
                {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
            </button>
            {isOpen && <div className="p-4 border-t bg-white">{children}</div>}
        </div>
    );
}

function StakeholderInsightsCard({ stakeholder }: { stakeholder: any }) {
    if (!stakeholder) {
        return (
            <Card className="border-none shadow-sm ring-1 ring-gray-100 overflow-hidden bg-white h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="bg-gray-50 p-4 rounded-full mb-4">
                    <Activity className="h-8 w-8 text-gray-300" />
                </div>
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">No Intelligence Profile</h3>
                <p className="text-[10px] text-gray-400 leading-relaxed max-w-[200px]">Strategic intelligence and portal activity will appear here once the stakeholder is matched.</p>
            </Card>
        );
    }
    const metadata = stakeholder?.metadata || {};
    const type = stakeholder?.type?.toLowerCase() || "student";

    const getInsights = () => {
        switch (type) {
            case "institution":
            case "accreditation":
                return {
                    stats: [
                        { label: "Status", value: metadata.accreditation_status || "Active", type: "badge" },
                        { label: "Renewals", value: "2", type: "number" },
                        { label: "Score", value: stakeholder.engagementScore || "85", type: "number" },
                        { label: "Risk", value: stakeholder.riskLevel || "Low", type: "risk" }
                    ],
                    accordions: [
                        {
                            title: "Accreditation Milestones",
                            icon: Calendar,
                            content: (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-medium">Last Inspection</span>
                                        <span className="font-bold text-gray-800">{metadata.inspection_dates || "Oct 12, 2025"}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-medium">Renewal Due</span>
                                        <span className="font-bold text-orange-600 underline decoration-dotted">{metadata.renewal_dates || "Dec 15, 2026"}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-medium">Approved Programmes</span>
                                        <div className="flex gap-1">
                                            {(metadata.programmes_offered || ["CPA", "CS"]).map((p: any) => (
                                                <Badge key={p} variant="outline" className="text-[9px] py-0 h-4 bg-blue-50/50">{p}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                    ]
                };
            case "marker":
            case "setter":
                return {
                    stats: [
                        { label: "Assigned", value: metadata.scripts_assigned || "0", type: "number" },
                        { label: "Completed", value: metadata.scripts_completed || "0", type: "number" },
                        { label: "Delays", value: `${metadata.delays || 0}d`, type: "number" },
                        { label: "Risk", value: stakeholder.riskLevel || "Low", type: "risk" }
                    ],
                    accordions: [
                        {
                            title: "Workflow Signals",
                            icon: Activity,
                            content: (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-medium">Panel Membership</span>
                                        <span className="font-bold text-gray-800">{metadata.panel_role || "Lead Marker"}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-medium">Agreement Status</span>
                                        <Badge className="bg-green-50 text-green-700 text-[10px] h-4">SIGNED</Badge>
                                    </div>
                                </div>
                            )
                        }
                    ]
                };
            case "employer":
                return {
                    stats: [
                        { label: "Verifs", value: metadata.verification_requests || "12", type: "number" },
                        { label: "Sponsored", value: metadata.sponsored_candidates || "5", type: "number" },
                        { label: "Eng. Score", value: stakeholder.engagementScore || "92", type: "number" },
                        { label: "Risk", value: stakeholder.riskLevel || "Low", type: "risk" }
                    ],
                    accordions: [
                        {
                            title: "Partnership Details",
                            icon: Briefcase,
                            content: (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-medium">Region</span>
                                        <span className="font-bold text-gray-800">{stakeholder.county || "Nairobi"}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-medium">Verification Access</span>
                                        <Badge className="bg-blue-50 text-blue-700 text-[10px] h-4">ACTIVE</Badge>
                                    </div>
                                </div>
                            )
                        }
                    ]
                };
            default: // student
                return {
                    stats: [
                        { label: "Exam Regs", value: metadata.exam_registrations || "0", type: "number" },
                        { label: "Sittings", value: metadata.exam_sittings || "0", type: "number" },
                        { label: "Eng. Score", value: stakeholder.engagementScore || "0", type: "number" },
                        { label: "Risk", value: stakeholder.riskLevel || "Low", type: "risk" }
                    ],
                    accordions: [
                        {
                            title: "Academic Timeline",
                            icon: GraduationCap,
                            content: (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-medium">Latest Registration</span>
                                        <span className="font-bold text-gray-800">{metadata.latest_reg_date || "Aug 2025 Series"}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-medium">Fee Balance</span>
                                        <span className={`font-bold ${metadata.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                            KES {metadata.balance || "0"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-medium">Results Status</span>
                                        <Badge className="bg-blue-50 text-blue-700 text-[10px] h-4">{metadata.results_status || "PENDING"}</Badge>
                                    </div>
                                </div>
                            )
                        }
                    ]
                };
        }
    };

    const insights = getInsights();

    return (
        <Card className="border-none shadow-sm ring-1 ring-gray-100 overflow-hidden bg-white h-full">
            <CardHeader className="py-3 px-5 border-b bg-gray-50/30">
                <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-orange-500" /> Stakeholder Intelligence
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {insights.stats.map((stat) => (
                        <div key={stat.label} className="bg-gray-50/50 rounded-xl p-3 border border-gray-100 text-center flex flex-col items-center justify-center min-h-[70px]">
                            {stat.type === "risk" ? (
                                <Badge className={`text-[10px] font-black tracking-widest ${stat.value.toLowerCase() === 'high' ? 'bg-red-600' : 'bg-[#004E98]'}`}>
                                    {stat.value.toUpperCase()}
                                </Badge>
                            ) : stat.type === "badge" ? (
                                <Badge variant="outline" className="text-[10px] font-black border-[#004E98]/20 text-[#004E98] py-0">
                                    {stat.value.toUpperCase()}
                                </Badge>
                            ) : (
                                <span className="text-lg font-black text-gray-900 tracking-tighter italic leading-none mb-1">{stat.value}</span>
                            )}
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">{stat.label}</p>
                        </div>
                    ))}
                </div>

                <div className="space-y-1">
                    {insights.accordions.map((acc, idx) => (
                        <CustomAccordion key={idx} title={acc.title} icon={acc.icon} defaultOpen={idx === 0}>
                            {acc.content}
                        </CustomAccordion>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function RecentActivityCard({ history, interactions, stakeholderCases }: { history: any[]; interactions: any[]; stakeholderCases: any[] }) {
    // We are shifting from "Recent Activity" (internal logs) to "Stakeholder Case History" (raised cases)
    // Limiting to top 5 most recent as requested
    const cases = [...stakeholderCases]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

    return (
        <Card className="border-none shadow-sm ring-1 ring-gray-100 bg-white h-full flex flex-col">
            <CardHeader className="py-4 border-b bg-gray-50/30">
                <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2 uppercase tracking-tighter">
                    <History className="h-4 w-4 text-[#004E98]" /> Top 5 Recent Cases
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col min-h-[400px]">
                <TooltipProvider>
                    <ScrollArea className="flex-1 px-4 py-4">
                        <div className="space-y-4">
                            {cases.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 italic text-xs">No previous cases found for this stakeholder.</div>
                            ) : (
                                cases.map((c) => (
                                    <div 
                                        key={c.id} 
                                        className="group cursor-pointer hover:bg-gray-50/50 p-4 rounded-2xl transition-all border border-transparent hover:border-gray-100 hover:shadow-sm bg-white ring-1 ring-gray-100/50" 
                                        onClick={() => window.location.href = `/cases/workspace/${c.id}`}
                                    >
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[11px] font-black uppercase tracking-tight text-gray-900 group-hover:text-[#004E98]">
                                                    {c.policyNumber || "GUEST"}: {c.stakeholderFirstName} {c.stakeholderLastName}
                                                </span>
                                                <Badge className={`text-[8px] py-0 h-3.5 border-0 font-black uppercase tracking-widest ml-auto ${statusColors[c.status] || "bg-gray-100 text-gray-600"}`}>
                                                    {formatLabel(c.status)}
                                                </Badge>
                                            </div>
                                            
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-bold text-gray-700 line-clamp-2 group-hover:text-[#004E98] bg-gray-50/50 p-2.5 rounded-lg border border-gray-100/50 italic leading-relaxed">
                                                            {c.title}
                                                        </p>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="bg-white p-4 shadow-2xl border-gray-100 max-w-sm rounded-2xl ring-1 ring-black/5">
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-[#004E98]">Original Communication</p>
                                                        <p className="text-xs font-medium text-gray-600 leading-relaxed italic border-l-2 border-blue-100 pl-3">
                                                            {c.description || "No description available."}
                                                        </p>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>

                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-gray-100/50">
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                                                    <div className="h-5 w-5 rounded-md bg-emerald-50 flex items-center justify-center">
                                                        <User className="h-3 w-3 text-emerald-500" />
                                                    </div>
                                                    <span>Agent: <span className="text-gray-900 font-black uppercase">{c.assignedUserName || "Unassigned"}</span></span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                                                    <div className="h-5 w-5 rounded-md bg-blue-50 flex items-center justify-center">
                                                        <Building2 className="h-3 w-3 text-blue-500" />
                                                    </div>
                                                    <span>Dept: <span className="text-gray-900 font-black uppercase">{c.departmentName || "N/A"}</span></span>
                                                </div>
                                                <div className="flex items-center gap-1 ml-auto">
                                                    <Clock className="h-3 w-3 text-gray-300" />
                                                    <span className="text-[9px] text-gray-400 font-bold tabular-nums uppercase">
                                                        {c.createdAt ? format(new Date(c.createdAt), "dd/MM/yyyy HH:mm") : ""}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </TooltipProvider>
                <div className="p-4 border-t bg-gray-50/10 text-center">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">
                        Select a case to view longitudinal details
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

function SLACountdown({ deadline, completedAt, label, unit }: { deadline: string | null; completedAt?: string | null; label: string; unit?: string | null }) {
    const [time, setTime] = useState("");
    const [status, setStatus] = useState<"normal" | "urgent" | "breached" | "completed">("normal");

    useEffect(() => {
        if (completedAt) {
            setTime("COMPLETED");
            setStatus("completed");
            return;
        }

        if (!deadline) {
            setTime("No Deadline");
            setStatus("normal");
            return;
        }

        const update = () => {
            const now = new Date();
            const due = new Date(deadline);
            const diff = due.getTime() - now.getTime();

            if (diff <= 0) {
                setTime("BREACHED");
                setStatus("breached");
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const hoursRemainder = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            if (hours < 1 && diff > 0) setStatus("urgent");

            if (unit && unit.toLowerCase().includes("day")) {
                if (days > 0) {
                    setTime(`${days}d ${hoursRemainder}h`);
                } else {
                    setTime(`${hoursRemainder}h ${mins}m`);
                }
            } else if (unit === "seconds") {
                const totalSecs = Math.floor(diff / 1000);
                setTime(`${totalSecs}s`);
            } else if (unit === "minutes") {
                const totalMins = Math.floor(diff / (1000 * 60));
                setTime(`${totalMins}m`);
            } else {
                // Default or "hours"
                setTime(`${hours}h ${mins}m`);
            }
        };

        update();
        const timer = setInterval(update, 60000);
        return () => clearInterval(timer);
    }, [deadline, completedAt]);

    return (
        <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1.5">{label}</span>
            <div className={`flex items-center gap-1.5 font-black text-sm tracking-tight ${status === "completed" ? "text-green-500" :
                status === "breached" ? "text-red-600 animate-pulse" :
                    status === "urgent" ? "text-orange-500" : "text-[#004E98]"
                }`}>
                {status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                {time}
            </div>
        </div>
    );
}

interface KnowledgeBaseArticle {
    id: string;
    title: string;
    content: string;
    category: string;
    isTemplate: boolean;
    resolutionSummary?: string;
    rootCause?: string;
    sopSteps?: string[];
}

function KnowledgeBaseTemplateSelector({ 
    onSelect, 
    onQuickResolve 
}: { 
    onSelect: (content: string) => void;
    onQuickResolve: (article: KnowledgeBaseArticle) => void;
}) {
    const [open, setOpen] = useState(false);
    const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = useState("");
    const isMobile = useIsMobile();

    const loadArticles = async () => {
        setIsLoading(true);
        try {
            const res = await apiRequest("/api/knowledge-base");
            if (res.ok) {
                const data = await res.json();
                setArticles(data.articles || []);
            }
        } catch (err) {
            console.error("Failed to load KB articles:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (open) loadArticles();
    }, [open]);

    const filtered = articles.filter(a =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.category?.toLowerCase().includes(search.toLowerCase())
    );

    const SelectorContent = () => (
        <div className={cn("flex flex-col min-h-0", isMobile ? "px-6 pb-12" : "p-8 flex-1")}>
            {!isMobile && (
                <DialogHeader className="mb-8 flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-5">
                            <div className="bg-blue-500/10 p-4 rounded-[1.25rem] shadow-inner">
                                <BookOpen className="h-8 w-8 text-[#004E98]" />
                            </div>
                            <div className="space-y-1">
                                <DialogTitle className="text-3xl font-black text-gray-900 tracking-tight leading-none">
                                    Response Templates
                                </DialogTitle>
                                <DialogDescription className="text-gray-400 text-[11px] font-black uppercase tracking-[0.2em] mt-0.5">
                                    Select a precisely crafted blueprint for your reply
                                </DialogDescription>
                            </div>
                        </div>
                    </div>
                </DialogHeader>
            )}

            {isMobile && (
                <DrawerHeader className="px-0 py-8 mb-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-500/10 p-3 rounded-2xl">
                            <BookOpen className="h-6 w-6 text-[#004E98]" />
                        </div>
                        <div className="text-left">
                            <DrawerTitle className="text-2xl font-black text-gray-900 tracking-tight">Templates</DrawerTitle>
                            <DrawerDescription className="text-[10px] font-black uppercase tracking-widest text-gray-400">Response DNA Blueprints</DrawerDescription>
                        </div>
                    </div>
                </DrawerHeader>
            )}

            <div className="space-y-6 flex-1 flex flex-col min-h-0">
                <div className="relative flex-shrink-0 group">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                        <Filter className="h-4 w-4 text-gray-400 group-focus-within:text-[#004E98] transition-colors" />
                    </div>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="SEARCH TEMPLATES BY TITLE OR CATEGORY..."
                        className="w-full bg-gray-50/50 border-gray-100 h-14 pl-12 pr-6 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-[#004E98]/5 focus:border-[#004E98]/20 transition-all placeholder:text-gray-300 shadow-sm"
                    />
                </div>

                <ScrollArea className={cn("flex-1", isMobile ? "-mx-2 px-2" : "pr-4")}>
                    <div className="grid grid-cols-1 gap-4 pb-6">
                        {isLoading ? (
                            [1, 2, 3, 4].map(i => (
                                <div key={i} className="h-28 w-full rounded-[1.5rem] bg-gray-50 animate-pulse border border-gray-100" />
                            ))
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-100">
                                <AlertCircle className="h-10 w-10 text-gray-200 mb-4" />
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No matching blueprints discovered</p>
                            </div>
                        ) : (
                            filtered.map(article => (
                                <div
                                    key={article.id}
                                    className="group flex flex-col p-5 bg-white border border-gray-100 hover:border-[#004E98]/20 hover:bg-blue-50/20 transition-all rounded-[1.5rem] shadow-sm hover:shadow-lg relative overflow-hidden"
                                >
                                    <div className="absolute right-0 top-0 p-4 opacity-[0.02] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
                                        <Dna className="h-16 w-16" />
                                    </div>
                                    
                                    <div className="flex flex-col gap-2 mb-4 relative z-10">
                                        <h5 className="font-black text-[13px] text-gray-900 group-hover:text-[#004E98] transition-colors uppercase tracking-tight leading-tight pr-8">
                                            {article.title}
                                        </h5>
                                        
                                        <div className="flex flex-wrap gap-2">
                                            <div className="px-2.5 py-1.5 bg-gray-50 border border-gray-100 rounded-lg flex items-center gap-1.5 shadow-sm">
                                                <Tag className="h-3 w-3 text-gray-400" />
                                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none">
                                                    {article.category || "General"}
                                                </span>
                                            </div>
                                            {article.sopSteps && article.sopSteps.length > 0 && (
                                                <div className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-1.5 shadow-sm">
                                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none">
                                                        {article.sopSteps.length} Steps
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mb-4 bg-gray-50/50 p-3 rounded-xl border border-gray-100/50">
                                        <p className="text-[11px] text-gray-500 font-bold line-clamp-2 leading-relaxed opacity-80 italic">
                                            "{article.content}"
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-50 relative z-10">
                                        <Button
                                            onClick={() => {
                                                onSelect(article.content);
                                                setOpen(false);
                                            }}
                                            variant="ghost"
                                            className="flex-1 h-9 text-[10px] font-black uppercase tracking-widest text-[#004E98] hover:bg-blue-100/50 rounded-lg"
                                        >
                                            Apply Text
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                onQuickResolve(article);
                                                setOpen(false);
                                            }}
                                            className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm shadow-emerald-200"
                                        >
                                            Use & Resolve
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>

            {!isMobile && (
                <DialogFooter className="mt-8 flex-shrink-0 pt-6 border-t border-gray-50">
                    <Button
                        variant="ghost"
                        onClick={() => setOpen(false)}
                        className="font-black text-[11px] text-gray-400 uppercase tracking-widest hover:text-gray-900 h-12 px-8 rounded-xl"
                    >
                        Discard Selection
                    </Button>
                </DialogFooter>
            )}
        </div>
    );

    const trigger = (
        <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.preventDefault(); setOpen(true); }}
            className="h-10 w-10 text-gray-400 hover:text-[#004E98] hover:bg-blue-50 transition-all rounded-2xl"
            title="Use Response Template"
        >
            <BookOpen className="h-4 w-4" />
        </Button>
    );

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={setOpen}>
                <DrawerTrigger asChild>
                    {trigger}
                </DrawerTrigger>
                <DrawerContent className="max-h-[95vh]">
                    <SelectorContent />
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[750px] max-h-[90vh] bg-white rounded-[2rem] border-0 shadow-2xl p-0 overflow-hidden flex flex-col ring-1 ring-black/5">
                <div className="h-2 bg-[#004E98] flex-shrink-0" />
                <SelectorContent />
            </DialogContent>
        </Dialog>
    );
}

function CollaborationThread({ 
    caseId, 
    initialComments, 
    initialPersonalNotes, 
    canViewNotes,
    text,
    setText 
}: { 
    caseId: string; 
    initialComments: any[]; 
    initialPersonalNotes?: string; 
    canViewNotes: boolean;
    text: string;
    setText: React.Dispatch<React.SetStateAction<string>>;
}) {
    const [comments, setComments] = useState(initialComments);
    const [personalNotes, setPersonalNotes] = useState(initialPersonalNotes || "");
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
 
    const fileInputRef = useRef<HTMLInputElement>(null);
    const hasTypedRef = useRef(false);
    const lastSavedNotesRef = useRef<string>(initialPersonalNotes || "");
    const pendingNotesRef = useRef<string | undefined>(undefined);

    // Sync state with props if server data changes and user hasn't typed
    useEffect(() => {
        if (!hasTypedRef.current) {
            setPersonalNotes(initialPersonalNotes || "");
            lastSavedNotesRef.current = initialPersonalNotes || "";
            pendingNotesRef.current = initialPersonalNotes || "";
        }
    }, [initialPersonalNotes]);

    // Debounced Auto-Save for Personal Notes
    useEffect(() => {
        const currentNotes = personalNotes || "";

        // Track if we actually have variations from what was loaded/initially there
        if (pendingNotesRef.current !== undefined && currentNotes !== pendingNotesRef.current) {
            hasTypedRef.current = true;
        }

        pendingNotesRef.current = currentNotes;

        pendingNotesRef.current = currentNotes;

        const saveNotes = async (notesToSave: string) => {
            if (notesToSave === lastSavedNotesRef.current) return;
            setIsSavingNotes(true);
            try {
                await apiRequest(`/api/cases/${caseId}/personal-notes`, {
                    method: "PATCH",
                    body: JSON.stringify({ personalNotes: notesToSave })
                });
                lastSavedNotesRef.current = notesToSave;
            } catch (err) {
                console.error("Failed to save personal notes:", err);
            } finally {
                setIsSavingNotes(false);
            }
        };

        const timer = setTimeout(() => {
            saveNotes(currentNotes);
        }, 500);

        return () => clearTimeout(timer);
    }, [personalNotes, caseId]);

    // Unmount Protection
    useEffect(() => {
        return () => {
            if (pendingNotesRef.current !== undefined && pendingNotesRef.current !== lastSavedNotesRef.current) {
                const token = localStorage.getItem("marketingToken");
                fetch(`/api/cases/${caseId}/personal-notes`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ personalNotes: pendingNotesRef.current }),
                    keepalive: true
                }).catch(console.error);
            }
        };
    }, [caseId]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            // In a real app, we'd upload to S3/Cloudinary. 
            // Here we simulate by creating a blob URL and calling our simulation API.
            const dummyUrl = URL.createObjectURL(file);
            
            const res = await apiRequest(`/api/cases/${caseId}/attachments`, {
                method: "POST",
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    fileUrl: dummyUrl
                })
            });

            if (res.ok) {
                const attachment = await res.json();
                // After successful "upload", post a comment about it
                const commentRes = await apiRequest(`/api/cases/${caseId}/comments`, {
                    method: "POST",
                    body: JSON.stringify({ 
                        content: `Shared a document: ${file.name}`, 
                        isInternal: true,
                        attachments: [attachment]
                    })
                });

                if (commentRes.ok) {
                    const { comment } = await commentRes.json();
                    const storedUser = JSON.parse(localStorage.getItem("marketingUser") || "{}");
                    const userName = `${storedUser.firstName} ${storedUser.lastName}`;
                    setComments([...comments, { ...comment, userName }]);
                }
            }
        } catch (err) {
            console.error("Upload failed:", err);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const postNote = async () => {
        if (!text.trim() || isPosting) return;
        setIsPosting(true);
        try {
            const res = await apiRequest(`/api/cases/${caseId}/comments`, {
                method: "POST",
                body: JSON.stringify({ content: text, isInternal: true })
            });
            if (res.ok) {
                const { comment } = await res.json();
                const storedUser = JSON.parse(localStorage.getItem("marketingUser") || "{}");
                const userName = `${storedUser.firstName} ${storedUser.lastName}`;
                setComments([...comments, { ...comment, userName }]);
                setText("");
            }
        } catch (err) {
            console.error("Failed to post note:", err);
        } finally {
            setIsPosting(false);
        }
    };

    const getInitials = (name: string) => {
        if (!name) return "U";
        return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
    };

    return (
        <Card className="border-none shadow-sm ring-1 ring-gray-100 bg-white overflow-hidden">
            <CardHeader className="py-4 border-b bg-gray-50/20 px-8 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-black text-gray-700 uppercase tracking-tighter flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#004E98]" /> Notebook & Discussions
                </CardTitle>
                <div className="flex items-center gap-2">
                    {isSavingNotes ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 animate-pulse">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Syncing</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-50 border border-gray-100">
                            <CheckCircle2 className="h-3 w-3 text-gray-300" />
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Saved</span>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0 flex flex-col">
                <div className="grid grid-cols-1 lg:grid-cols-10 h-[650px]">
                    {/* LEFT 40%: LINED NOTEBOOK (PERSONAL) - ONLY FOR ASSIGNEE */}
                    {canViewNotes && (
                        <div className="lg:col-span-4 border-r bg-[#fffdf9] overflow-hidden flex flex-col">
                            <div className="flex items-center gap-2 m-8 mb-6 border-b border-amber-100 pb-3">
                                <BookOpen className="h-4 w-4 text-amber-600" />
                                <span className="text-xs font-black text-amber-800 uppercase tracking-widest">Personal Notebook</span>
                                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest ml-auto italic">Auto-saving in real-time</span>
                            </div>
                            <div
                                className="flex-1 relative"
                                style={{
                                    backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px)',
                                    backgroundSize: '100% 2.8rem',
                                    backgroundPosition: '0 2.25rem'
                                }}
                            >
                                <textarea
                                    value={personalNotes}
                                    onChange={(e) => setPersonalNotes(e.target.value)}
                                    placeholder="Start typing your private observations directly on the lines..."
                                    className="w-full h-full bg-transparent border-none focus:ring-0 p-8 pt-[0.2rem] text-gray-700 font-medium italic text-xl leading-[2.8rem] resize-none placeholder:text-gray-300 placeholder:italic transition-colors selection:bg-amber-100 outline-none shadow-none ring-0"
                                />
                            </div>
                        </div>
                    )}

                    {/* RIGHT 60%: COLLABORATION FEED */}
                    <div className={canViewNotes ? "lg:col-span-6 flex flex-col bg-white" : "lg:col-span-10 flex flex-col bg-white"}>
                        <ScrollArea className="flex-1 p-8">
                            <div className="space-y-8">
                                {comments.length === 0 ? (
                                    <div className="text-center py-20 opacity-30 flex flex-col items-center gap-4">
                                        <MessageSquare className="h-12 w-12 text-gray-300" />
                                        <p className="text-sm font-bold uppercase tracking-widest italic text-gray-400">No team messages yet.</p>
                                    </div>
                                ) : (
                                    comments.map((c) => (
                                        <div key={c.id} className="group flex gap-4 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <Avatar className="h-10 w-10 ring-4 ring-blue-50 border border-white shadow-sm flex-shrink-0">
                                                <AvatarFallback className="bg-[#004E98] text-white text-xs font-black">{getInitials(c.userName)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1.5 px-1">
                                                    <span className="text-xs font-black text-gray-900 uppercase tracking-tight">{c.userName || "Team Member"}</span>
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest opacity-60">
                                                        {c.createdAt ? format(new Date(c.createdAt), "HH:mm p") : ""}
                                                    </span>
                                                </div>
                                                <div className="bg-gray-50/50 p-4 rounded-3xl rounded-tl-none text-sm text-gray-700 shadow-sm border border-gray-100 leading-relaxed font-medium">
                                                    {c.content}
                                                    {Array.isArray(c.attachments) && c.attachments.length > 0 && (
                                                        <div className="mt-4 pt-3 border-t border-gray-200/50 space-y-2">
                                                            {c.attachments.map((at: any, idx: number) => (
                                                                <a 
                                                                    key={idx}
                                                                    href={at.fileUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group/file"
                                                                >
                                                                    <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 group-hover/file:bg-[#004E98] group-hover/file:text-white transition-colors">
                                                                        <FileIcon className="h-5 w-5" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-xs font-black text-gray-900 truncate uppercase tracking-tight">{at.fileName}</p>
                                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                                            {(at.fileSize / 1024).toFixed(1)} KB • {at.fileType?.split('/')[1]?.toUpperCase() || 'FILE'}
                                                                        </p>
                                                                    </div>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>

                        <div className="p-6 border-t bg-gray-50/30">
                            <div className="flex gap-4 items-end bg-white p-2 rounded-3xl border border-gray-200 transition-all focus-within:shadow-xl focus-within:border-[#004E98]/20">
                                <div className="mb-2 ml-2 flex items-center gap-1">
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleFileUpload}
                                        className="hidden" 
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={isUploading}
                                        onClick={() => fileInputRef.current?.click()}
                                        className="h-10 w-10 text-gray-400 hover:text-[#004E98] hover:bg-blue-50 transition-all rounded-2xl"
                                        title="Share Document"
                                    >
                                        {isUploading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Paperclip className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                                <MentionInput
                                    value={text}
                                    onChange={setText}
                                    onSend={postNote}
                                    placeholder="Tag colleagues with @ to collaborate..."
                                    className="flex-1"
                                />
                                <div className="mb-2 mr-2">
                                    <Button
                                        disabled={!text.trim() || isPosting}
                                        onClick={postNote}
                                        size="icon"
                                        className="h-10 w-10 bg-[#004E98] hover:bg-[#004E98]/90 transition-transform active:scale-95 shadow-md rounded-2xl"
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card >
    );
}

function WorkspaceLoading() {
    return (
        <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-500">
            {/* Header Skeleton */}
            <div className="bg-white rounded-xl border p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="flex items-start gap-6 flex-1">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-5 w-24 rounded-sm" />
                                <Skeleton className="h-5 w-20 rounded-full" />
                                <Separator orientation="vertical" className="h-3" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-8 w-3/4 rounded-md" />
                        </div>
                    </div>
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-6 bg-gray-50/80 px-6 py-3 rounded-2xl border border-gray-100">
                            <div className="space-y-2">
                                <Skeleton className="h-3 w-16 mx-auto" />
                                <Skeleton className="h-6 w-20" />
                            </div>
                            <Separator orientation="vertical" className="h-10" />
                            <div className="space-y-2">
                                <Skeleton className="h-3 w-16 mx-auto" />
                                <Skeleton className="h-6 w-20" />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Skeleton className="h-11 w-32 rounded-xl" />
                            <Skeleton className="h-11 w-32 rounded-xl" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Side: Info & Details */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
                        <CardHeader className="bg-gray-50/50 border-b p-6">
                            <Skeleton className="h-6 w-40" />
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center gap-4">
                                    <Skeleton className="h-10 w-10 rounded-xl" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-3 w-20" />
                                        <Skeleton className="h-4 w-full" />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
                        <CardHeader className="bg-gray-50/50 border-b p-6">
                            <Skeleton className="h-6 w-40" />
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                           <Skeleton className="h-4 w-full" />
                           <Skeleton className="h-4 w-5/6" />
                           <Skeleton className="h-4 w-4/6" />
                        </CardContent>
                    </Card>
                </div>

                {/* Right Side: Notebook & Collaboration */}
                <div className="lg:col-span-8">
                    <Card className="rounded-2xl border-none shadow-sm overflow-hidden h-[735px] flex flex-col">
                        <div className="p-6 border-b flex items-center justify-between">
                            <Skeleton className="h-8 w-48 rounded-lg" />
                            <Skeleton className="h-6 w-24 rounded-full" />
                        </div>
                        <div className="flex-1 p-8 space-y-8">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="flex gap-4">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-16 w-full rounded-2xl" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t bg-gray-50/30">
                            <Skeleton className="h-14 w-full rounded-3xl" />
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
