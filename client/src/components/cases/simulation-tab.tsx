import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    MessageSquare,
    Send,
    Loader2,
    Database,
    Trash2,
    RefreshCw,
    PlusCircle,
    AlertTriangle,
    PlayCircle,
    Zap,
    GraduationCap,
    Building2,
    Briefcase,
    FileText,
    PenTool
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SimulationTabProps {
    onTriggerScenario: (scenario: string) => Promise<void>;
    onSimulateSignal: (signal: { source: string; text: string; metadata?: any }) => Promise<void>;
}

import { CHANNELS, channelIcons, formatLabel } from "./case-utils";

const CHANNEL_METADATA: Record<string, { description: string; color: string; badge: string }> = {
    call: { description: "Inbound phone calls to the contact centre.", color: "blue", badge: "Voice" },
    email: { description: "Standard email enquiries.", color: "sky", badge: "Text" },
    whatsapp: { description: "WhatsApp business API messages.", color: "green", badge: "Chat" },
    live_chat: { description: "Website live chat widget.", color: "amber", badge: "Chat" },
    chatbot: { description: "Automated chatbot escalations.", color: "purple", badge: "AI" },
    facebook: { description: "Facebook page messages and comments.", color: "blue", badge: "Social" },
    instagram: { description: "Instagram DMs and comments.", color: "purple", badge: "Social" },
    linkedin: { description: "LinkedIn business page interactions.", color: "blue", badge: "Social" },
    tiktok: { description: "TikTok comments and direct messages.", color: "red", badge: "Social" },
    website: { description: "Web forms and portal inquiries.", color: "sky", badge: "Web" },
    walk_in: { description: "Physical visits to customer service desks.", color: "amber", badge: "Physical" },
    sms: { description: "Short message service texts.", color: "green", badge: "Text" }
};

const colorMap: Record<string, { border: string; bg: string; button: string; badge: string; text: string }> = {
    purple: { border: "border-t-purple-500", bg: "bg-purple-50", button: "bg-purple-600 hover:bg-purple-700", badge: "bg-purple-100 text-purple-700", text: "text-purple-600" },
    blue: { border: "border-t-blue-500", bg: "bg-blue-50", button: "bg-blue-600 hover:bg-blue-700", badge: "bg-blue-100 text-blue-700", text: "text-blue-600" },
    amber: { border: "border-t-amber-500", bg: "bg-amber-50", button: "bg-amber-600 hover:bg-amber-700", badge: "bg-amber-100 text-amber-700", text: "text-amber-600" },
    green: { border: "border-t-green-500", bg: "bg-green-50", button: "bg-green-600 hover:bg-green-700", badge: "bg-green-100 text-green-700", text: "text-green-600" },
    red: { border: "border-t-red-500", bg: "bg-red-50", button: "bg-red-600 hover:bg-red-700", badge: "bg-red-100 text-red-700", text: "text-red-600" },
    sky: { border: "border-t-sky-500", bg: "bg-sky-50", button: "bg-sky-600 hover:bg-sky-700", badge: "bg-sky-100 text-sky-700", text: "text-sky-600" },
};

export function SimulationTab({ onTriggerScenario, onSimulateSignal }: SimulationTabProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState<string | null>(null);
    const [batchCount, setBatchCount] = useState(1);
    const [customSignal, setCustomSignal] = useState({ source: "email", text: "" });
    const [marketingSimType, setMarketingSimType] = useState<"b2c" | "b2b">("b2c");

    const handleScenario = async (slug: string, label: string) => {
        setLoading(slug);
        try {
            for (let i = 0; i < batchCount; i++) {
                await onTriggerScenario(slug);
            }
            toast({
                title: "Signals Generated",
                description: `${batchCount} unique ${label} signal(s) injected into the triage pipeline.`
            });
        } finally {
            setLoading(null);
        }
    };

    const handleCustom = async () => {
        if (!customSignal.text.trim()) return;
        setLoading("custom");
        try {
            for (let i = 0; i < batchCount; i++) {
                await onSimulateSignal(customSignal);
            }
            toast({
                title: "Custom Signals Sent",
                description: `${batchCount} custom signal(s) processed via NLP.`
            });
            setCustomSignal({ ...customSignal, text: "" });
        } finally {
            setLoading(null);
        }
    };

    const handleSeedStakeholders = async () => {
        setLoading("seed");
        try {
            const token = localStorage.getItem("marketingToken");
            const res = await fetch("/api/simulation/seed-stakeholders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });
            if (!res.ok) throw new Error("Failed to seed stakeholders");
            const data = await res.json();
            toast({ title: "Success", description: data.message });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(null);
        }
    };

    const handleSimulateMarketingLeads = async () => {
        setLoading("marketing-leads");
        try {
            const token = localStorage.getItem("marketingToken");
            const res = await fetch("/api/simulate/marketing-leads", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    pipelineType: marketingSimType,
                    volume: batchCount > 5 ? batchCount : 10,
                    spreadStages: true
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || "Failed to generate marketing leads");
            toast({ title: "Marketing Leads Generated", description: data.message });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(null);
        }
    };

    const handleReseed = async () => {
        setLoading("reseed");
        try {
            const token = localStorage.getItem("marketingToken");
            const res = await fetch("/api/simulation/reseed", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });
            if (!res.ok) throw new Error("Failed to reseed system");
            const data = await res.json();
            toast({ title: "Reseed Complete", description: data.message });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(null);
        }
    };

    const handleClearCases = async () => {
        if (!confirm("This will delete ALL cases, history, comments, and triage signals. Users and stakeholders are kept. Continue?")) return;
        setLoading("clear");
        try {
            const token = localStorage.getItem("marketingToken");
            const res = await fetch("/api/simulation/clear-cases", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            toast({ title: "Cases Cleared", description: data.message });
        } catch (err) {
            toast({ title: "Error", description: "Failed to clear cases.", variant: "destructive" });
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Seed Stakeholders */}
                <Card className="bg-emerald-50/50 border-emerald-200 border-dashed">
                    <CardContent className="py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Users className="h-5 w-5 text-emerald-600" />
                            <div>
                                <p className="text-sm font-bold text-emerald-700">Seed Stakeholders</p>
                                <p className="text-xs text-emerald-600/70">Generate 50 unique stakeholders (5 per type)</p>
                            </div>
                        </div>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold h-9"
                            disabled={!!loading}
                            onClick={handleSeedStakeholders}
                        >
                            {loading === "seed" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
                            Seed
                        </Button>
                    </CardContent>
                </Card>

                {/* Simulate Marketing Leads */}
                <Card className="bg-blue-50/50 border-blue-200 border-dashed">
                    <CardContent className="py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Briefcase className="h-5 w-5 text-blue-600" />
                            <div>
                                <p className="text-sm font-bold text-blue-700">Simulate Marketing Leads</p>
                                <p className="text-xs text-blue-600/70">Generate B2C or B2B pipeline test data</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={marketingSimType} onValueChange={(v: "b2c" | "b2b") => setMarketingSimType(v)}>
                                <SelectTrigger className="w-24 h-9 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="b2c">B2C Retail</SelectItem>
                                    <SelectItem value="b2b">B2B Group</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold h-9"
                                disabled={!!loading}
                                onClick={handleSimulateMarketingLeads}
                            >
                                {loading === "marketing-leads" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Briefcase className="h-4 w-4 mr-2" />}
                                Generate
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Clear Cases */}
                <Card className="bg-red-50/50 border-red-200 border-dashed">
                    <CardContent className="py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Trash2 className="h-5 w-5 text-red-600" />
                            <div>
                                <p className="text-sm font-bold text-red-700">Clear All Cases</p>
                                <p className="text-xs text-red-600/70">Wipe all cases and triage data</p>
                            </div>
                        </div>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold h-9"
                            disabled={!!loading}
                            onClick={handleClearCases}
                        >
                            {loading === "clear" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Clear
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Bulk Mode Banner */}
            <Card className="bg-[#004E98]/5 border-[#004E98]/20 border-dashed">
                <CardContent className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Zap className="h-5 w-5 text-[#004E98]" />
                        <div>
                            <p className="text-sm font-bold text-[#004E98]">Bulk Generation Mode</p>
                            <p className="text-xs text-[#004E98]/70">Each trigger generates unique, randomised signals — no duplicates</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Signals per trigger:</Label>
                        <Input
                            type="number"
                            min={1}
                            max={25}
                            value={batchCount}
                            onChange={(e) => setBatchCount(parseInt(e.target.value) || 1)}
                            className="w-20 h-9 border-[#004E98]/20 bg-white"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Channels Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {CHANNELS.map((channel) => {
                    const meta = CHANNEL_METADATA[channel] || { description: "Standard Channel", color: "sky", badge: "General" };
                    const c = colorMap[meta.color] || colorMap.sky;
                    const Icon = channelIcons[channel] || MessageSquare;
                    const isLoading = loading === channel;
                    const label = formatLabel(channel);
                    return (
                        <Card key={channel} className={`border-t-4 ${c.border} hover:shadow-md transition-shadow`}>
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <Icon className={`h-8 w-8 ${c.text} mb-2`} />
                                    <Badge className={`text-[10px] font-semibold border-0 ${c.badge}`}>
                                        {meta.badge}
                                    </Badge>
                                </div>
                                <CardTitle className="text-base font-bold">{label}</CardTitle>
                                <CardDescription className="text-xs leading-relaxed">{meta.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    className={`w-full text-white text-sm ${c.button}`}
                                    disabled={!!loading}
                                    onClick={() => handleScenario(channel, label)}
                                >
                                    {isLoading
                                        ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        : <Zap className="h-4 w-4 mr-2" />
                                    }
                                    Generate Signal{batchCount > 1 ? `s (×${batchCount})` : ""}
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Custom Signal */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-bold">Custom Signal Injection</CardTitle>
                    <CardDescription className="text-xs">Manually compose a raw text signal to test the NLP categorisation logic against any text.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">Inbound Source</Label>
                            <Select value={customSignal.source} onValueChange={(v) => setCustomSignal({ ...customSignal, source: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CHANNELS.map((ch) => <SelectItem key={ch} value={ch}>{formatLabel(ch)}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold">Signal Text</Label>
                        <Textarea
                            placeholder="e.g. 'I am disputing my November examination result for Advanced Taxation...'"
                            value={customSignal.text}
                            rows={3}
                            onChange={(e) => setCustomSignal({ ...customSignal, text: e.target.value })}
                        />
                    </div>
                    <Button
                        disabled={loading === "custom" || !customSignal.text.trim()}
                        onClick={handleCustom}
                        className="bg-[#004E98] text-white hover:bg-[#003d7a]"
                    >
                        {loading === "custom" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                        Inject Signal{batchCount > 1 ? ` (×${batchCount})` : ""}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
