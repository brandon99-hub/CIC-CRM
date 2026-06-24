import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogDescription, DialogTitle, DialogHeader
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Search, Plus, BookOpen, ExternalLink,
    FileText, Loader2, Pencil, Trash2, X, Dna, MessageSquare, Grid, AlertCircle, HelpCircle, FileTerminal, ShieldCheck, ArrowUpCircle, Upload, Paperclip, FileIcon, XCircle, CheckCircle2, GitBranch
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KbEscalations } from "./kb-escalations";

interface KnowledgeBaseTabProps {
    user?: any;
    permissions?: string[];
}

export function KnowledgeBaseTab({ user, permissions = [] }: KnowledgeBaseTabProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    
    const canManageKb = user?.role === "admin" || permissions.includes("cases.kb.manage");
    const canManageEscalations = user?.role === "admin" || permissions.includes("cases.escalation.manage");

    // Local State
    const [activeTab, setActiveTab] = useState<string>("templates");
    const [kbSearch, setKbSearch] = useState("");
    const [kbModalOpen, setKbModalOpen] = useState(false);
    const [editingArticle, setEditingArticle] = useState<any>(null);
    const [kbForm, setKbForm] = useState({ 
        title: "", content: "", category: "template", tags: "", isPublished: true,
        isTemplate: true, initialResponse: "", resolutionSummary: "", rootCause: "",
        sopSteps: [] as string[], serviceCategoryId: "", metadata: {} as any
    });
    const [kbLoading, setKbLoading] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);

    // Data Fetching
    const { data: kbArticlesData, isLoading: loading } = useQuery({
        queryKey: ["knowledge-base", { kbSearch, category: activeTab }],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (kbSearch) params.set("search", kbSearch);
            // Map activeTab to category
            const catMap: Record<string, string> = {
                "templates": "template",
                "scripts": "script",
                "faqs": "faq",
                "policies": "policy"
            };
            params.set("category", catMap[activeTab] || "template");
            const res = await apiRequest(`/api/knowledge-base?${params}`);
            return res.json();
        },
        enabled: activeTab !== "escalations"
    });

    const { data: serviceCategories = [] } = useQuery<any[]>({
        queryKey: ["admin", "categories"],
        queryFn: async () => {
            const res = await apiRequest("/api/admin/service-categories");
            const d = await res.json();
            return Array.isArray(d.serviceCategories) ? d.serviceCategories : (Array.isArray(d) ? d : []);
        }
    });

    const articles = Array.isArray(kbArticlesData) ? kbArticlesData : kbArticlesData?.articles || [];

    const filteredArticles = articles.filter((article: any) => {
        if (!article.serviceCategoryId) return true; // General data, visible to all
        if (user?.role === "admin") return true;
        
        const category = serviceCategories.find(c => c.id === article.serviceCategoryId);
        if (category && category.departmentId === user?.departmentId) return true;
        
        return false;
    });

    // Actions
    const onRefresh = () => queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
    
    const onOpenModal = (article?: any) => {
        if (article) { 
            setEditingArticle(article); 
            setKbForm({ 
                title: article.title, 
                content: article.content || "", 
                category: article.category || "template", 
                tags: article.tags ? (typeof article.tags === 'string' ? article.tags : JSON.stringify(article.tags)) : "", 
                isPublished: article.isPublished,
                isTemplate: article.isTemplate || true,
                initialResponse: article.initialResponse || "",
                resolutionSummary: article.resolutionSummary || "",
                rootCause: article.rootCause || "",
                sopSteps: article.sopSteps || [],
                serviceCategoryId: article.serviceCategoryId || "",
                metadata: article.metadata || {}
            }); 
        }
        else { 
            setEditingArticle(null); 
            const catMap: Record<string, string> = {
                "templates": "template", "scripts": "script", "faqs": "faq", "policies": "policy"
            };
            setKbForm({ 
                title: "", content: "", category: catMap[activeTab] || "template", tags: "", 
                isPublished: true, isTemplate: activeTab === "templates", initialResponse: "",
                resolutionSummary: "", rootCause: "", sopSteps: [], serviceCategoryId: "", metadata: {}
            }); 
        }
        setUploadFile(null);
        setKbModalOpen(true);
    };

    const onCloseModal = () => {
        setKbModalOpen(false);
        setUploadFile(null);
    };

    const onSave = async () => {
        if (!kbForm.title) return toast({ title: "Validation Error", description: "Title is required", variant: "destructive" });
        setKbLoading(true);
        try {
            const url = editingArticle ? `/api/knowledge-base/${editingArticle.id}` : "/api/knowledge-base";
            
            let metadata = kbForm.metadata || {};
            if (uploadFile) {
                metadata = {
                    ...metadata,
                    documentName: uploadFile.name,
                    documentSize: uploadFile.size,
                    documentType: uploadFile.type
                };
            }
            
            const payload = { ...kbForm, metadata };
            
            const res = await apiRequest(url, {
                method: editingArticle ? "PUT" : "POST",
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast({ title: "Success", description: `Item ${editingArticle ? 'updated' : 'created'} successfully` });
                onCloseModal();
                onRefresh();
            } else {
                const data = await res.json().catch(() => null);
                toast({ title: "Error", description: data?.error || "Failed to save item", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Network error saving item", variant: "destructive" });
        } finally {
            setKbLoading(false);
        }
    };

    const onDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this item?")) return;
        try {
            const res = await apiRequest(`/api/knowledge-base/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast({ title: "Deleted", description: "Item removed from knowledge base." });
                onRefresh();
            } else {
                toast({ title: "Error", description: "Failed to delete item.", variant: "destructive" });
            }
        } catch {
            toast({ title: "Error", description: "Network error during deletion.", variant: "destructive" });
        }
    };

    const renderArticleList = () => {
        if (loading) {
            return (
                <div className="flex justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[#004E98]" />
                </div>
            );
        }

        if (filteredArticles.length === 0) {
            return (
                <div className="text-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-900">No content found</h3>
                    <p className="text-gray-500 mt-2 text-sm max-w-md mx-auto">
                        No articles match the current filter. {canManageKb && "Create one to get started."}
                    </p>
                    {canManageKb && (
                        <Button onClick={() => onOpenModal()} className="mt-6 bg-[#004E98] hover:bg-[#003d7a] text-white transition-all shadow-md">
                            <Plus className="h-4 w-4 mr-2" /> Add New Item
                        </Button>
                    )}
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredArticles.map((article: any) => (
                    <Card key={article.id} className="group hover:border-[#004E98]/20 transition-all shadow-sm border-gray-100 cursor-pointer overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canManageKb && (
                                <>
                                    <Button size="icon" variant="secondary" className="h-8 w-8 bg-white/90 hover:bg-white text-gray-600 hover:text-[#004E98] shadow-sm backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); onOpenModal(article); }}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="secondary" className="h-8 w-8 bg-white/90 hover:bg-white text-gray-600 hover:text-red-600 shadow-sm backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); onDelete(article.id); }}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                        </div>
                        <CardHeader className="pb-3 border-b border-gray-50 bg-gray-50/30">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1.5 flex-1 pr-8">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge className="bg-[#004E98]/10 text-[#004E98] hover:bg-[#004E98]/20 border-0 font-bold uppercase tracking-widest text-[9px] rounded-sm px-2 py-0.5">
                                            {article.categoryName || "General"}
                                        </Badge>
                                        <Badge variant="outline" className="text-[9px] font-bold text-gray-500 uppercase tracking-widest bg-white">
                                            {article.departmentName || "All Depts"}
                                        </Badge>
                                        {article.isTemplate && (
                                            <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-0 font-bold uppercase tracking-widest text-[9px] rounded-sm px-2 py-0.5 flex items-center gap-1">
                                                <Dna className="h-3 w-3" /> Blueprint
                                            </Badge>
                                        )}
                                    </div>
                                    <CardTitle className="text-lg font-black text-gray-900 group-hover:text-[#004E98] transition-colors leading-tight line-clamp-2">
                                        {article.title}
                                    </CardTitle>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 pb-5 space-y-4">
                            {(article.resolutionSummary || article.initialResponse) && (
                                <div className="space-y-3">
                                    {article.resolutionSummary && (
                                        <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100/50">
                                            <div className="flex flex-col space-y-1">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-1">
                                                    <FileText className="h-3 w-3" /> Summary
                                                </span>
                                                <p className="text-sm font-medium text-gray-700 line-clamp-2">{article.resolutionSummary}</p>
                                            </div>
                                        </div>
                                    )}
                                    {article.initialResponse && (
                                        <div className="bg-emerald-50/50 rounded-lg p-3 border border-emerald-100/50">
                                            <div className="flex flex-col space-y-1">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                                                    <MessageSquare className="h-3 w-3" /> Standard Reply
                                                </span>
                                                <p className="text-sm font-medium text-gray-700 line-clamp-2 italic">"{article.initialResponse}"</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {(article.sopSteps && article.sopSteps.length > 0) && (
                                <div className="flex items-center gap-4 text-xs font-medium text-gray-500 border-t border-gray-100 pt-4">
                                    <div className="flex items-center gap-1.5">
                                        <div className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black text-[10px]">{article.sopSteps.length}</div>
                                        <span>Procedural Steps</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-auto text-[10px] uppercase font-black tracking-widest text-[#004E98] group-hover:underline">
                                        View Details <ExternalLink className="h-3 w-3" />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-[#004E98]/10 p-3 rounded-lg flex-shrink-0">
                        <BookOpen className="h-6 w-6 text-[#004E98]" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 leading-none">Knowledge Base</h3>
                        <p className="text-sm text-gray-500 mt-2 flex items-center gap-1.5 font-medium">
                            Standard Operating Procedures & Institutional Memory
                        </p>
                    </div>
                </div>

                {activeTab === "escalations" ? (
                    canManageEscalations && (
                        <Button
                            onClick={() => window.dispatchEvent(new Event("open-escalation-chain-modal"))}
                            className="bg-[#004E98] hover:bg-[#003B73] shadow-md transition-all hover:scale-[1.02] font-bold h-10 px-4 rounded-xl"
                        >
                            <Plus className="h-4 w-4 mr-2" /> Construct New Chain
                        </Button>
                    )
                ) : (
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder={`Search ${activeTab}...`}
                                className="pl-10 h-10 border-gray-200 focus:border-[#004E98] focus:ring-[#004E98] bg-white transition-all text-sm rounded-xl"
                                value={kbSearch}
                                onChange={(e) => setKbSearch(e.target.value)}
                            />
                        </div>
                        {canManageKb && (
                            <Button
                                onClick={() => onOpenModal()}
                                className="h-10 px-4 bg-[#004E98] hover:bg-[#003d7a] text-white shadow-sm transition-all text-sm font-medium w-full sm:w-auto rounded-xl"
                            >
                                <Plus className="h-4 w-4 mr-2" /> New {activeTab === "policies" ? "Policy" : activeTab === "faqs" ? "FAQ" : activeTab === "scripts" ? "Script" : "Template"}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                {/* Tabs List Section */}
                <div className="flex items-center mb-4 border-b border-gray-100 bg-transparent px-2 pt-2">
                    <TabsList className="bg-transparent h-12 gap-8 border-none p-0 flex min-w-max">
                        <TabsTrigger 
                            value="templates" 
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 transition-all"
                        >
                            <BookOpen className="h-4 w-4" />
                            Templates (SOPs)
                        </TabsTrigger>
                        <TabsTrigger 
                            value="scripts" 
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 transition-all"
                        >
                            <FileTerminal className="h-4 w-4" />
                            Service Scripts
                        </TabsTrigger>
                        <TabsTrigger 
                            value="faqs" 
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 transition-all"
                        >
                            <HelpCircle className="h-4 w-4" />
                            FAQs
                        </TabsTrigger>
                        <TabsTrigger 
                            value="policies" 
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 transition-all"
                        >
                            <ShieldCheck className="h-4 w-4" />
                            Policies
                        </TabsTrigger>
                        <TabsTrigger 
                            value="escalations" 
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 transition-all"
                        >
                            <ArrowUpCircle className="h-4 w-4" />
                            Escalation Procedures
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Tab Content Section */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 min-h-[400px]">
                    <TabsContent value="templates" className="m-0 outline-none border-none">
                        {renderArticleList()}
                    </TabsContent>
                    <TabsContent value="scripts" className="m-0 outline-none border-none">
                        {renderArticleList()}
                    </TabsContent>
                    <TabsContent value="faqs" className="m-0 outline-none border-none">
                        {renderArticleList()}
                    </TabsContent>
                    <TabsContent value="policies" className="m-0 outline-none border-none">
                        {renderArticleList()}
                    </TabsContent>
                    <TabsContent value="escalations" className="m-0 outline-none border-none">
                        <KbEscalations canManage={canManageEscalations} />
                    </TabsContent>
                </div>
            </Tabs>

            <Dialog open={kbModalOpen} onOpenChange={onCloseModal}>
                {activeTab === "templates" ? (
                <DialogContent className="sm:max-w-[850px] p-0 border-0 shadow-2xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
                    <div className="max-h-[92vh] overflow-y-auto custom-scrollbar flex flex-col">
                        <div className="p-8 pb-6 border-b border-gray-50">
                            <div className="flex items-center gap-4">
                                <div className="bg-emerald-500/10 p-3.5 rounded-[1.25rem]">
                                    <Dna className="h-7 w-7 text-emerald-600" />
                                </div>
                                <div className="space-y-1">
                                    <DialogTitle className="text-3xl font-black text-gray-900 tracking-tight leading-none">
                                        Template DNA
                                    </DialogTitle>
                                    <DialogDescription className="text-gray-400 text-[11px] font-black uppercase tracking-[0.2em] mt-0.5">
                                        Define standard protocols and guides
                                    </DialogDescription>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 space-y-8 bg-gray-50/30">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                                        Template Title
                                    </Label>
                                    <Input
                                        value={kbForm.title}
                                        onChange={(e) => setKbForm({ ...kbForm, title: e.target.value })}
                                        placeholder="Give it a clear, actionable title..."
                                        className="h-11 bg-white border-gray-200 focus:bg-white transition-all font-bold rounded-xl"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                                        Service Category (Optional)
                                    </Label>
                                    <Select 
                                        value={kbForm.serviceCategoryId || "none"} 
                                        onValueChange={(v) => setKbForm({ ...kbForm, serviceCategoryId: v === "none" ? "" : v })}
                                    >
                                        <SelectTrigger className="h-11 bg-white border-gray-200 focus:bg-white transition-all rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-50 p-1.5 rounded-lg">
                                                    <Grid className="h-3.5 w-3.5 text-[#004E98]" />
                                                </div>
                                                <SelectValue placeholder="Assign to a category..." />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-gray-100 shadow-2xl">
                                            <SelectItem value="none" className="font-bold py-3">General (All Departments)</SelectItem>
                                            {serviceCategories.map(c => (
                                                <SelectItem key={c.id} value={c.id} className="font-bold py-3 transition-colors focus:bg-blue-50 focus:text-[#004E98]">{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[11px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2 ml-1">
                                    <MessageSquare className="h-4 w-4" /> Root Cause
                                </Label>
                                <div className="p-6 bg-emerald-50/30 rounded-[2rem] border border-emerald-100/30 relative">
                                    <Textarea
                                        value={kbForm.rootCause}
                                        onChange={(e) => setKbForm({ ...kbForm, rootCause: e.target.value })}
                                        placeholder="Type the root cause here..."
                                        className="bg-transparent border-0 focus-visible:ring-0 p-0 text-sm font-bold text-emerald-900 resize-none min-h-[100px] leading-relaxed"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[11px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2 ml-1">
                                    <FileText className="h-4 w-4" /> Resolution Summary
                                </Label>
                                <div className="p-6 bg-blue-50/20 rounded-[2rem] border border-blue-100/50 relative">
                                    <Textarea
                                        value={kbForm.resolutionSummary}
                                        onChange={(e) => setKbForm({ ...kbForm, resolutionSummary: e.target.value })}
                                        placeholder="Summary for internal reference..."
                                        className="bg-transparent border-0 focus-visible:ring-0 p-0 text-sm font-bold text-gray-900 resize-none min-h-[100px] leading-relaxed"
                                    />
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                                    <div className="flex items-center gap-2 text-emerald-600">
                                        <Plus className="h-4 w-4" />
                                        <h4 className="text-xs font-black uppercase tracking-widest">Procedural Steps (SOP)</h4>
                                    </div>
                                    <Button
                                        onClick={() => setKbForm({ ...kbForm, sopSteps: [...(kbForm.sopSteps || []), ""] })}
                                        className="h-10 text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 hover:bg-emerald-100 gap-2 rounded-xl px-5"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Add Step
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {(kbForm.sopSteps || []).map((step: string, idx: number) => (
                                        <div key={idx} className="flex gap-4 items-center group">
                                            <div className="flex items-center justify-center h-10 w-10 rounded-2xl bg-white text-[#004E98] text-xs font-black border border-gray-100">
                                                {idx + 1}
                                            </div>
                                            <div className="relative flex-1">
                                                <Input
                                                    value={step}
                                                    onChange={(e) => {
                                                        const newSteps = [...kbForm.sopSteps];
                                                        newSteps[idx] = e.target.value;
                                                        setKbForm({ ...kbForm, sopSteps: newSteps });
                                                    }}
                                                    placeholder={`Step ${idx + 1}...`}
                                                    className="h-14 py-3 text-xs font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 pr-12 rounded-2xl"
                                                />
                                                <Button variant="ghost" size="icon" onClick={() => {
                                                    const newSteps = kbForm.sopSteps.filter((_, i) => i !== idx);
                                                    setKbForm({ ...kbForm, sopSteps: newSteps });
                                                }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-500">
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-white border-t border-gray-50 flex items-center justify-between mt-auto">
                            <Button variant="ghost" onClick={onCloseModal} className="font-black text-gray-400 uppercase tracking-widest text-[11px] h-14 px-10 rounded-2xl">
                                Discard
                            </Button>
                            <Button onClick={onSave} disabled={kbLoading} className="bg-[#004E98] hover:bg-[#004E98]/90 text-white font-black rounded-2xl uppercase tracking-[0.15em] text-[12px] h-14 px-12 gap-3">
                                {kbLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dna className="h-4 w-4" />}
                                {editingArticle ? "Update Item" : "Create Item"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
                ) : (
                <DialogContent className="sm:max-w-[600px] p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="p-8 pb-4">
                        <DialogHeader>
                            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                {activeTab === "faqs" ? <HelpCircle className="h-5 w-5 text-[#004E98]" /> : activeTab === "policies" ? <ShieldCheck className="h-5 w-5 text-[#004E98]" /> : <FileTerminal className="h-5 w-5 text-[#004E98]" />}
                                <DialogTitle className="text-2xl font-bold text-gray-900">
                                    {activeTab === "faqs" ? "FAQ Entry" : activeTab === "policies" ? "Policy Document" : "Service Script"}
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-gray-500 text-sm mt-3">
                                {activeTab === "faqs" ? "Document frequently asked questions and answers" : activeTab === "policies" ? "Define institutional policies and frameworks" : "Draft standard responses for common scenarios"}
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-8 pt-6 space-y-6 bg-white">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                                {activeTab === "faqs" ? "Question" : activeTab === "policies" ? "Policy Title" : "Script Name"}
                            </Label>
                            <Input
                                value={kbForm.title}
                                onChange={(e) => setKbForm({ ...kbForm, title: e.target.value })}
                                placeholder={activeTab === "faqs" ? "e.g. How do I defer an exam?" : "e.g. Exam Deferment Script"}
                                className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white transition-all font-bold"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                                Service Category (Optional)
                            </Label>
                            <Select value={kbForm.serviceCategoryId || "none"} onValueChange={(v) => setKbForm({ ...kbForm, serviceCategoryId: v === "none" ? "" : v })}>
                                <SelectTrigger className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white transition-all">
                                    <SelectValue placeholder="Assign to a category..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">General (All Departments)</SelectItem>
                                    {serviceCategories.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                                {activeTab === "faqs" ? "Answer / Content" : activeTab === "policies" ? "Policy Content" : "Initial Response"}
                            </Label>
                            <Textarea
                                value={activeTab === "scripts" ? kbForm.initialResponse : kbForm.content}
                                onChange={(e) => {
                                    if (activeTab === "scripts") {
                                        setKbForm({ ...kbForm, initialResponse: e.target.value });
                                    } else {
                                        setKbForm({ ...kbForm, content: e.target.value });
                                    }
                                }}
                                placeholder={activeTab === "scripts" ? "Type the standard reply here..." : "Type the content here..."}
                                className="min-h-[120px] bg-gray-50/50 focus:bg-white border-gray-200 resize-none transition-all"
                            />
                        </div>

                        {/* Document Upload Simulation */}
                        <div className="space-y-2 pt-4 border-t border-gray-100">
                            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                                <Paperclip className="h-3.5 w-3.5" /> Attach Document (Optional)
                            </Label>
                            <div 
                                className={`relative border-2 border-dashed rounded-xl p-6 transition-all text-center cursor-pointer group overflow-hidden ${
                                    uploadFile || kbForm.metadata?.documentName 
                                        ? "border-[#004E98]/30 bg-blue-50/30" 
                                        : "border-gray-200 bg-gray-50/50 hover:border-[#004E98]/20 hover:bg-blue-50/10"
                                }`}
                                onClick={() => document.getElementById('kb-file-input')?.click()}
                            >
                                <input 
                                    id="kb-file-input"
                                    type="file" 
                                    className="hidden" 
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) setUploadFile(file);
                                    }}
                                />
                                
                                {uploadFile || kbForm.metadata?.documentName ? (
                                    <div className="flex flex-col items-center gap-3 relative z-10">
                                        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                                            <FileIcon className="h-6 w-6 text-[#004E98]" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-gray-900 line-clamp-1">{uploadFile?.name || kbForm.metadata?.documentName}</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                {uploadFile ? `${(uploadFile.size / 1024 / 1024).toFixed(2)} MB • READY` : "UPLOADED"}
                                            </p>
                                        </div>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm"
                                            className="h-8 px-3 rounded-lg text-[10px] font-bold uppercase text-red-500 hover:text-red-600 hover:bg-red-50 transition-all"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setUploadFile(null);
                                                setKbForm({ ...kbForm, metadata: { ...kbForm.metadata, documentName: undefined, documentSize: undefined, documentType: undefined } });
                                            }}
                                        >
                                            <XCircle className="h-3 w-3 mr-1.5" /> Remove
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3 relative z-10">
                                        <div className="bg-white p-3 rounded-xl group-hover:shadow-sm transition-all border border-gray-100">
                                            <Upload className="h-6 w-6 text-gray-400 group-hover:text-[#004E98] transition-colors" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs font-bold text-gray-900">Click to browse or drop file</p>
                                            <p className="text-[10px] font-medium text-gray-400">PDF, DOCX, JPG (Max 10MB)</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-3">
                        <Button variant="outline" onClick={onCloseModal} className="font-bold text-gray-600 bg-white border-gray-200">
                            Cancel
                        </Button>
                        <Button onClick={onSave} disabled={kbLoading} className="bg-[#004E98] hover:bg-[#003B73] text-white font-bold shadow-md">
                            {kbLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            {editingArticle ? "Save Changes" : "Create Item"}
                        </Button>
                    </div>
                </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
