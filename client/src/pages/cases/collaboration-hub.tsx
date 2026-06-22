import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    MessageSquare, Search, AtSign, Filter, ChevronLeft, ChevronRight, ExternalLink, User,
    Send, CheckCircle2, LayoutDashboard, BookOpen, Clock, Terminal, FolderOpen, FileText,
    Paperclip, Download, FileStack
} from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/shared/dashboard-layout";
import { NavGroup } from "@/components/shared/dashboard-sidebar";
import { MentionInput } from "@/components/shared/mention-input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from "@/components/ui/dialog";


export default function CollaborationHub() {
    const [_, setLocation] = useLocation();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [user, setUser] = useState<any>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [selectedDiscussion, setSelectedDiscussion] = useState<any>(null);
    const [newMessage, setNewMessage] = useState("");
    const [discussions, setDiscussions] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSharingDoc, setIsSharingDoc] = useState(false);
    const [kbTemplateOpen, setKbTemplateOpen] = useState(false);
    const [kbArticles, setKbArticles] = useState<any[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isManager = user?.role === "manager" || user?.role === "admin";

    useEffect(() => {
        const storedUser = localStorage.getItem("marketingUser");
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                setUser(userData);
                fetchDiscussions();
                fetchKbArticles();
            } catch { }
        }
    }, []);

    const fetchKbArticles = async () => {
        try {
            const res = await apiRequest("/api/knowledge-base");
            const data = await res.json();
            setKbArticles(Array.isArray(data) ? data : (data.articles || []));
        } catch (error) {
            console.error("Error fetching KB articles:", error);
        }
    };

    const fetchDiscussions = async () => {
        try {
            setIsLoadingData(true);
            const res = await apiRequest("/api/cases/collaboration/all");
            const data = await res.json();
            setDiscussions(data.discussions || []);
        } catch (error) {
            console.error("Error fetching discussions:", error);
        } finally {
            setIsLoadingData(false);
        }
    };

    const hasTypedRef = useRef(false);
    const pendingNotesRef = useRef<string | undefined>(undefined);
    const lastSavedNotesRef = useRef<string>("");

    const fetchMessages = async (caseId: string) => {
        try {
            setIsLoadingMessages(true);
            const [commentsRes, notesRes] = await Promise.all([
                apiRequest(`/api/cases/${caseId}/comments`),
                apiRequest(`/api/cases/${caseId}/personal-notes`)
            ]);

            const commentsData = await commentsRes.json();
            const notesData = await notesRes.json();

            setMessages(commentsData.comments || []);

            const serverNotes = notesData.notes || "";
            // Only update local state if we haven't started editing this session
            if (!hasTypedRef.current) {
                setSelectedDiscussion((prev: any) => ({ ...prev, personalNotes: serverNotes }));
                lastSavedNotesRef.current = serverNotes;
                pendingNotesRef.current = serverNotes;
            }
        } catch (error) {
            console.error("Error fetching messages:", error);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    useEffect(() => {
        if (selectedDiscussion?.id) {
            fetchMessages(selectedDiscussion.id);
        }
    }, [selectedDiscussion?.id]);

    const navGroups: NavGroup[] = [
        {
            title: "Core",
            items: [
                { id: "overview", label: "Overview", icon: LayoutDashboard },
                { id: "cases", label: "All Cases", icon: FolderOpen },
            ],
        },
        {
            title: "Collaboration",
            items: [
                { id: "collaboration", label: "Discussions", icon: MessageSquare },
            ],
        },
        {
            title: "Intelligence",
            items: [
                { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
                ...(isManager ? [{ id: "triage", label: "Triage", icon: Filter }] : []),
            ],
        },
        {
            title: "Monitoring",
            items: [
                { id: "sla", label: "SLA Monitor", icon: Clock },
            ],
        },
        ...(user?.role === "admin" ? [
            {
                title: "Operations",
                items: [
                    { id: "simulate", label: "Simulate Scenarios", icon: Terminal },
                ],
            }
        ] : []),
    ];

    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedDiscussion) return;

        try {
            const res = await apiRequest(`/api/cases/${selectedDiscussion.id}/comments`, {
                method: "POST",
                body: JSON.stringify({
                    content: newMessage,
                    isInternal: true
                })
            });

            if (res.ok) {
                setNewMessage("");
                fetchMessages(selectedDiscussion.id);
                fetchDiscussions();
            }
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const getInitials = (name: string) => {
        if (!name) return "U";
        return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
    };

    const filteredDiscussions = discussions.filter(d =>
        (d.caseNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.title || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    const [isSavingNotes, setIsSavingNotes] = useState(false);

    // Debounced Auto-Save for Personal Notes in Collaboration Hub
    useEffect(() => {
        if (!selectedDiscussion?.id) {
            pendingNotesRef.current = undefined;
            hasTypedRef.current = false;
            return;
        }

        const currentNotes = selectedDiscussion.personalNotes || "";

        // Track if we actually have variations from what was loaded/initially there
        if (pendingNotesRef.current !== undefined && currentNotes !== pendingNotesRef.current) {
            hasTypedRef.current = true;
        }

        pendingNotesRef.current = currentNotes;

        const saveNotes = async (notesToSave: string, caseId: string) => {
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
            saveNotes(currentNotes, selectedDiscussion.id);
        }, 500);

        return () => clearTimeout(timer);
    }, [selectedDiscussion?.personalNotes, selectedDiscussion?.id]);

    // Unmount protection / Exit protection
    useEffect(() => {
        return () => {
            if (selectedDiscussion?.id && pendingNotesRef.current !== undefined && pendingNotesRef.current !== lastSavedNotesRef.current) {
                const token = localStorage.getItem("marketingToken");
                fetch(`/api/cases/${selectedDiscussion.id}/personal-notes`, {
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
    }, [selectedDiscussion?.id]);

    return (
        <DashboardLayout
            title="CIC CRM"
            subtitle="COLLABORATION HUB"
            navGroups={navGroups}
            activeTab="collaboration"
            setActiveTab={(tab) => setLocation(tab === "overview" ? "/cases/dashboard" : `/cases/dashboard?tab=${tab}`)}
            user={user}
            onLogout={() => {
                localStorage.removeItem("marketingToken");
                localStorage.removeItem("marketingUser");
                setLocation("/marketing/login");
            }}
            loading={isLoadingData}
            noPadding
        >
            <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
                {/* Discussions List - Left Panel */}
                <div
                    className={`border-r flex flex-col transition-all duration-300 ease-in-out bg-white ${sidebarCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-[360px] opacity-100"} h-full relative`}
                >
                    <div className="p-5 border-b sticky top-0 bg-white z-10">
                        <div className="flex items-center justify-between mb-4">
                            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2 tracking-tight uppercase">
                                <MessageSquare className="h-5 w-5 text-[#004E98]" /> Discussions
                            </h1>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400"
                                onClick={() => setSidebarCollapsed(true)}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <Input
                                placeholder="Search discussions..."
                                className="pl-9 h-10 bg-gray-50/50 border-gray-100 text-xs font-medium focus:bg-white transition-all rounded-xl"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-1">
                            {isLoadingData ? (
                                <div className="p-10 text-center">
                                    <div className="h-8 w-8 border-4 border-[#004E98]/10 border-t-[#004E98] rounded-full animate-spin mx-auto mb-3" />
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Loading...</p>
                                </div>
                            ) : filteredDiscussions.length === 0 ? (
                                <div className="p-10 text-center">
                                    <MessageSquare className="h-8 w-8 text-gray-200 mx-auto mb-3" />
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">No discussions found</p>
                                </div>
                            ) : (
                                filteredDiscussions.map((d) => (
                                    <DiscussionItem
                                        key={d.id}
                                        caseNumber={d.caseNumber}
                                        title={d.title}
                                        lastMessage={d.lastMessage}
                                        time={new Date(d.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        unread={d.unread}
                                        active={selectedDiscussion?.id === d.id}
                                        isCollaborator={user?.id !== d.assignedTo && Array.isArray(d.tags) && d.tags.some((t: any) => t.id === user?.id)}
                                        onClick={() => setSelectedDiscussion(d)}
                                    />
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Chat Panel - Right Side */}
                <div className="flex-1 flex flex-col relative bg-gray-50/20 overflow-hidden">
                    {sidebarCollapsed && (
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute left-4 top-4 z-20 h-9 w-9 shadow-md rounded-full border border-gray-100 bg-white"
                            onClick={() => setSidebarCollapsed(false)}
                        >
                            <ChevronRight className="h-4 w-4 text-[#004E98]" />
                        </Button>
                    )}

                    {!selectedDiscussion ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <div className="h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                                <MessageSquare className="h-10 w-10 text-gray-300" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2 uppercase tracking-tight">Collaboration Hub</h3>
                            <p className="text-sm text-gray-500 max-w-sm font-medium italic">
                                Select a discussion from the left to start collaborating with your team members.
                            </p>
                        </div>
                    ) : (
                        <>
                            <header className="h-[72px] border-b px-8 flex items-center justify-between bg-white z-10 shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="bg-[#004E98]/5 text-[#004E98] px-2.5 py-1 rounded-md text-[10px] font-black italic tracking-tighter border border-[#004E98]/10">
                                        {selectedDiscussion.caseNumber}
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-gray-900 leading-tight uppercase tracking-tight">{selectedDiscussion.title}</h2>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Active Discussion</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {isSavingNotes ? (
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 animate-pulse transition-all">
                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Syncing</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-50 border border-gray-100 transition-all">
                                            <CheckCircle2 className="h-3 w-3 text-gray-300" />
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Saved</span>
                                        </div>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 gap-2 font-black text-[10px] uppercase tracking-widest text-[#004E98] border-gray-200 hover:bg-[#004E98]/5 transition-all rounded-xl"
                                        onClick={() => setLocation(`/cases/workspace/${selectedDiscussion.id}`)}
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" /> Workspace
                                    </Button>
                                </div>
                            </header>

                            {/* DUAL MODE: NOTEBOOK & MESSAGES */}
                            <div className="flex-1 grid grid-cols-10 overflow-hidden">
                                {/* LEFT 40%: LINED NOTEBOOK (PERSONAL - ALL USERS GET THEIR OWN) */}
                                <div className="col-span-4 border-r bg-[#fffdf9] overflow-hidden flex flex-col">
                                    <div className="flex items-center gap-2 m-8 mb-6 border-b border-amber-100 pb-3">
                                        <BookOpen className="h-4 w-4 text-amber-600" />
                                        <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Personal Notebook</span>
                                        <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest ml-auto italic">Auto-saving</span>
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
                                            value={selectedDiscussion.personalNotes || ""}
                                            onChange={(e) => setSelectedDiscussion({ ...selectedDiscussion, personalNotes: e.target.value })}
                                            placeholder="Write your private reflections here directly on the rows..."
                                            className="w-full h-full bg-transparent border-none focus:ring-0 p-8 pt-[0.2rem] text-gray-700 font-medium italic text-xl leading-[2.8rem] resize-none placeholder:text-gray-300 transition-colors selection:bg-amber-100 outline-none shadow-none ring-0"
                                        />
                                    </div>
                                </div>

                                {/* RIGHT 60%: MESSAGES */}
                                <div className="col-span-6 flex flex-col bg-white overflow-hidden">
                                    <ScrollArea className="flex-1 p-8">
                                        <div className="space-y-10 max-w-4xl mx-auto">
                                            {isLoadingMessages ? (
                                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                                    <div className="h-10 w-10 border-4 border-[#004E98]/10 border-t-[#004E98] rounded-full animate-spin" />
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Syncing Feed...</p>
                                                </div>
                                            ) : messages.length === 0 ? (
                                                <div className="text-center py-20 opacity-30 flex flex-col items-center gap-4">
                                                    <MessageSquare className="h-12 w-12 text-gray-300" />
                                                    <p className="text-sm font-bold uppercase tracking-widest italic text-gray-400">No team messages yet</p>
                                                </div>
                                            ) : (
                                                messages.map((m) => (
                                                    <div key={m.id} className="group transition-all animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                        <div className="flex gap-5 items-start">
                                                            <Avatar className="h-10 w-10 ring-4 ring-blue-50/50 border border-white shadow-md flex-shrink-0">
                                                                <AvatarFallback className="bg-[#004E98] text-white text-[10px] font-black tracking-tighter flex items-center justify-center">{getInitials(m.userName)}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-3 mb-2 px-1">
                                                                    <span className="text-sm font-black text-gray-900 uppercase tracking-tight">{m.userName || "Team Member"}</span>
                                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.1em] opacity-40">
                                                                        {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                                                                    </span>
                                                                </div>
                                                                <div className="bg-gray-50/50 p-5 rounded-[24px] rounded-tl-none text-[15px] text-gray-700 shadow-sm border border-gray-100 leading-relaxed font-medium">
                                                                    {m.content}
                                                                    {m.attachments?.map((at: any) => (
                                                                        <div key={at.id} className="mt-3 p-3 bg-white rounded-xl border border-gray-100 flex items-center justify-between group/at">
                                                                            <div className="flex items-center gap-2">
                                                                                <FileText className="h-4 w-4 text-[#004E98]" />
                                                                                <span className="text-xs font-bold text-gray-600">{at.fileName}</span>
                                                                            </div>
                                                                            <Button 
                                                                                variant="ghost" 
                                                                                size="icon" 
                                                                                className="h-8 w-8 text-[#004E98] hover:bg-blue-50"
                                                                                onClick={() => window.open(at.fileUrl, '_blank')}
                                                                            >
                                                                                <Download className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </ScrollArea>

                                    {/* Action Bar */}
                                    <div className="p-6 bg-white border-t">
                                        <div className="max-w-4xl mx-auto flex gap-3 items-center bg-gray-50/50 p-2 rounded-[24px] border border-gray-100 ring-1 ring-black/5 focus-within:bg-white focus-within:shadow-2xl transition-all duration-300">
                                            <div className="flex items-center gap-1 pl-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-9 w-9 text-gray-400 hover:text-[#004E98] hover:bg-blue-50 rounded-full"
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    <Paperclip className="h-5 w-5" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-9 w-9 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-full"
                                                    onClick={() => setKbTemplateOpen(true)}
                                                >
                                                    <FileStack className="h-5 w-5" />
                                                </Button>
                                                <input 
                                                    type="file" 
                                                    ref={fileInputRef} 
                                                    className="hidden" 
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            // Logic for file upload
                                                            toast({ title: "Sharing File", description: `Uploading ${file.name}...` });
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <MentionInput
                                                value={newMessage}
                                                onChange={setNewMessage}
                                                onSend={sendMessage}
                                                placeholder={`Message team about ${selectedDiscussion.caseNumber}...`}
                                                className="flex-1 bg-transparent border-none focus-within:ring-0"
                                            />
                                            <div className="mb-1.5 mr-1.5">
                                                <Button
                                                    disabled={!newMessage.trim()}
                                                    onClick={sendMessage}
                                                    size="icon"
                                                    className="h-10 w-10 bg-[#004E98] hover:bg-[#004E98]/90 shadow-md rounded-[16px] transition-all active:scale-95"
                                                >
                                                    <Send className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            {/* KB Template Modal */}
            <Dialog open={kbTemplateOpen} onOpenChange={setKbTemplateOpen}>
                <DialogContent className="sm:max-w-[600px] p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden">
                    <DialogHeader className="p-6 border-b border-gray-100">
                        <DialogTitle className="text-xl font-black text-gray-900 flex items-center gap-2 uppercase tracking-tight">
                            <FileStack className="h-5 w-5 text-amber-600" /> KB Templates
                        </DialogTitle>
                        <DialogDescription className="text-gray-500 font-medium italic mt-1">
                            Select a knowledge base article to insert as a template.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4 bg-gray-50/30">
                        <ScrollArea className="h-[400px] pr-4">
                            <div className="space-y-3">
                                {kbArticles.length === 0 ? (
                                    <div className="py-20 text-center opacity-40">
                                        <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                                        <p className="text-sm font-bold uppercase tracking-widest">No templates available</p>
                                    </div>
                                ) : (
                                    kbArticles.map((article) => (
                                        <div 
                                            key={article.id} 
                                            className="p-4 bg-white rounded-xl border border-gray-100 hover:border-amber-300 hover:shadow-lg transition-all cursor-pointer group"
                                            onClick={() => {
                                                setNewMessage(prev => prev + (prev ? "\n\n" : "") + article.content);
                                                setKbTemplateOpen(false);
                                                toast({ title: "Template Inserted", description: "KB article content has been added to your message." });
                                            }}
                                        >
                                            <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-1 group-hover:text-amber-600">{article.title}</h4>
                                            <p className="text-xs text-gray-500 line-clamp-2 font-medium italic leading-relaxed">
                                                {article.content.replace(/[#*]/g, '').substring(0, 150)}...
                                            </p>
                                            <div className="mt-3 flex items-center justify-between">
                                                <Badge variant="outline" className="text-[9px] font-black tracking-widest uppercase bg-amber-50 text-amber-700 border-amber-100 px-2 py-0.5">
                                                    {article.category}
                                                </Badge>
                                                <span className="text-[9px] font-black text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-[1px] flex items-center gap-1">
                                                    Insert <ChevronRight className="h-3 w-3" />
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardLayout >
    );
}

function DiscussionItem({ caseNumber, title, lastMessage, time, unread = false, active = false, isCollaborator = false, onClick }: any) {
    return (
        <div
            onClick={onClick}
            className={`
                p-4 rounded-xl cursor-pointer transition-all border-l-4 mx-1
                ${active
                    ? "bg-[#004E98]/5 border-[#004E98] shadow-sm mb-1 ring-1 ring-[#004E98]/10"
                    : "hover:bg-gray-50 border-transparent"}
            `}
        >
            <div className="flex justify-between items-start mb-1.5">
                <div className="flex flex-col gap-1">
                    <span className={`text-[10px] font-black uppercase tracking-widest italic ${active ? "text-[#004E98]" : "text-gray-400"}`}>
                        {caseNumber}
                    </span>
                    {isCollaborator && (
                        <div className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0 rounded-sm border border-emerald-100 uppercase tracking-tighter w-fit">
                            Collaborator
                        </div>
                    )}
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter opacity-60">{time}</span>
            </div>
            <h3 className={`text-sm tracking-tight truncate leading-none ${active ? "font-black text-gray-900" : "font-bold text-gray-700"}`}>
                {title}
            </h3>
            <p className="text-xs text-gray-400 line-clamp-1 mt-2 leading-normal transition-all font-medium italic opacity-80">
                {lastMessage}
            </p>
            {unread && !active && (
                <div className="mt-2.5 flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-[#004E98] animate-pulse shadow-sm" />
                    <span className="text-[9px] font-black text-[#004E98] uppercase tracking-widest">New Interaction</span>
                </div>
            )}
        </div>
    );
}
