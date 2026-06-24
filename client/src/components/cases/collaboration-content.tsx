import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    MessageSquare, Search, AtSign, Filter, ChevronLeft, ChevronRight, ExternalLink, User,
    Send, CheckCircle2, LayoutDashboard, BookOpen, Clock, Terminal, FolderOpen, FileText,
    Paperclip, Download, FileStack, Loader2, Plus
} from "lucide-react";
import { useLocation } from "wouter";
import { MentionInput } from "@/components/shared/mention-input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useQuery } from "@tanstack/react-query";



interface CollaborationContentProps {
    user: any;
    onViewWorkspace: (id: string) => void;
}

export function CollaborationContent({ user, onViewWorkspace }: CollaborationContentProps) {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [selectedDiscussion, setSelectedDiscussion] = useState<any>(null);
    const [newMessage, setNewMessage] = useState("");
    const [discussions, setDiscussions] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // New Discussion Modal State
    const [newDiscussionModalOpen, setNewDiscussionModalOpen] = useState(false);
    const [selectedNewCaseId, setSelectedNewCaseId] = useState("");
    const [newDiscussionText, setNewDiscussionText] = useState("");
    const [isCreatingDiscussion, setIsCreatingDiscussion] = useState(false);

    const { data: allCasesData = [] } = useQuery<any[]>({
        queryKey: ["cases"],
        queryFn: async () => {
            const res = await apiRequest("/api/cases");
            const data = await res.json();
            return data.cases || [];
        }
    });
    const caseOptions = allCasesData.map(c => ({ id: c.id, value: c.id, label: `#${c.caseNumber} - ${c.status}` }));

    useEffect(() => {
        fetchDiscussions();
    }, []);

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

    const handleStartNewDiscussion = async () => {
        if (!selectedNewCaseId || !newDiscussionText.trim()) return;
        try {
            setIsCreatingDiscussion(true);
            const res = await apiRequest(`/api/cases/${selectedNewCaseId}/comments`, {
                method: "POST",
                body: JSON.stringify({
                    text: newDiscussionText,
                    isInternal: true
                })
            });
            if (!res.ok) throw new Error("Failed to start discussion");
            toast({ title: "Success", description: "Discussion initialized." });
            setNewDiscussionModalOpen(false);
            setNewDiscussionText("");
            setSelectedNewCaseId("");
            fetchDiscussions();
        } catch (error) {
            toast({ title: "Error", description: "Failed to initialize discussion", variant: "destructive" });
        } finally {
            setIsCreatingDiscussion(false);
        }
    };

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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedDiscussion) return;

        try {
            setIsUploading(true);
            toast({ title: "Uploading File", description: `Preparing ${file.name}...` });

            // Read file as Base64
            const reader = new FileReader();
            reader.onload = async () => {
                const base64Data = reader.result as string;

                const res = await apiRequest(`/api/cases/${selectedDiscussion.id}/upload-attachment`, {
                    method: "POST",
                    body: JSON.stringify({
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        fileData: base64Data
                    })
                });

                if (res.ok) {
                    toast({ title: "Success", description: "File shared successfully." });
                    fetchMessages(selectedDiscussion.id);
                } else {
                    toast({ variant: "destructive", title: "Upload Failed", description: "Could not share the file." });
                }
                setIsUploading(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Error uploading file:", error);
            toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred during upload." });
            setIsUploading(false);
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

    useEffect(() => {
        if (!selectedDiscussion?.id) {
            pendingNotesRef.current = undefined;
            hasTypedRef.current = false;
            return;
        }

        const currentNotes = selectedDiscussion.personalNotes || "";
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

    return (
        <div className="flex h-full overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm">
            {/* Discussions List - Left Panel */}
            <div
                className={`border-r flex flex-col transition-all duration-300 ease-in-out bg-white ${sidebarCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-[300px] opacity-100"} h-full relative`}
            >
                <div className="p-4 border-b sticky top-0 bg-white z-10">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-sm font-black text-gray-900 flex items-center gap-2 tracking-tight uppercase">
                            <MessageSquare className="h-4 w-4 text-[#004E98]" /> Discussions
                        </h1>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-[#004E98] hover:text-[#004E98] hover:bg-blue-50"
                                onClick={() => setNewDiscussionModalOpen(true)}
                                title="New Discussion"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-gray-400 hover:text-gray-600"
                                onClick={() => setSidebarCollapsed(true)}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                        <Input
                            placeholder="Search..."
                            className="pl-8 h-8 bg-gray-50/50 border-gray-100 text-[10px] font-bold focus:bg-white transition-all rounded-lg uppercase tracking-tight"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                        {isLoadingData ? (
                            <div className="p-8 text-center">
                                <Loader2 className="h-6 w-6 text-[#004E98] animate-spin mx-auto mb-2 opacity-20" />
                                <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Loading</p>
                            </div>
                        ) : filteredDiscussions.length === 0 ? (
                            <div className="p-8 text-center opacity-30">
                                <MessageSquare className="h-6 w-6 text-gray-200 mx-auto mb-2" />
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Empty</p>
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
                        className="absolute left-3 top-3 z-20 h-8 w-8 shadow-sm rounded-full border border-gray-100 bg-white"
                        onClick={() => setSidebarCollapsed(false)}
                    >
                        <ChevronRight className="h-3.5 w-3.5 text-[#004E98]" />
                    </Button>
                )}

                {!selectedDiscussion ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <div className="h-16 w-16 bg-white/50 backdrop-blur-sm border border-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                            <MessageSquare className="h-8 w-8 text-gray-200" />
                        </div>
                        <h3 className="text-sm font-black text-gray-900 mb-1 uppercase tracking-tight">Select Discussion</h3>
                        <p className="text-[10px] text-gray-400 max-w-[200px] font-bold uppercase tracking-widest italic line-height-relaxed">
                            Pick a case to start team collaboration
                        </p>
                    </div>
                ) : (
                    <>
                        <header className="h-[64px] border-b px-6 flex items-center justify-between bg-white z-10 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-[#004E98]/5 text-[#004E98] px-2 py-0.5 rounded-md text-[9px] font-black italic tracking-tighter border border-[#004E98]/10 capitalize">
                                    {selectedDiscussion.caseNumber}
                                </div>
                                <h2 className="text-xs font-black text-gray-900 leading-tight uppercase tracking-tight max-w-[300px] truncate">
                                    {selectedDiscussion.title}
                                </h2>
                            </div>
                            <div className="flex items-center gap-3">
                                {isSavingNotes ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Sync</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100 opacity-60">
                                        <CheckCircle2 className="h-2.5 w-2.5 text-gray-300" />
                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Saved</span>
                                    </div>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1.5 font-black text-[9px] uppercase tracking-widest text-[#004E98] border-gray-100 hover:bg-[#004E98]/5 transition-all rounded-lg px-2.5"
                                    onClick={() => onViewWorkspace(selectedDiscussion.id)}
                                >
                                    <ExternalLink className="h-3 w-3" /> Workspace
                                </Button>
                            </div>
                        </header>

                        <div className="flex-1 grid grid-cols-10 overflow-hidden">
                            {/* Notebook */}
                            <div className="col-span-3 border-r bg-[#fffefc] overflow-hidden flex flex-col">
                                <div className="flex items-center gap-2 px-4 h-10 border-b border-amber-100/50">
                                    <BookOpen className="h-3 w-3 text-amber-600" />
                                    <span className="text-[9px] font-black text-amber-900 uppercase tracking-widest">Personal Notes</span>
                                </div>
                                <div
                                    className="flex-1 relative"
                                    style={{
                                        backgroundImage: 'linear-gradient(#f1f2f4 1px, transparent 1px)',
                                        backgroundSize: '100% 2rem',
                                        backgroundPosition: '0 1.5rem'
                                    }}
                                >
                                    <textarea
                                        value={selectedDiscussion.personalNotes || ""}
                                        onChange={(e) => setSelectedDiscussion({ ...selectedDiscussion, personalNotes: e.target.value })}
                                        placeholder="Start typing..."
                                        className="w-full h-full bg-transparent border-none focus:ring-0 p-4 pt-[0.2rem] text-gray-700 font-medium italic text-sm leading-[2rem] resize-none placeholder:text-gray-200 outline-none shadow-none ring-0"
                                    />
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="col-span-7 flex flex-col bg-white overflow-hidden">
                                <ScrollArea className="flex-1 p-6">
                                    <div className="space-y-8 max-w-2xl mx-auto">
                                        {isLoadingMessages ? (
                                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                                <Loader2 className="h-8 w-8 text-[#004E98]/20 animate-spin" />
                                                <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest animate-pulse">Syncing Feed</p>
                                            </div>
                                        ) : messages.length === 0 ? (
                                            <div className="text-center py-20 opacity-20 flex flex-col items-center gap-3">
                                                <MessageSquare className="h-8 w-8 text-gray-300" />
                                                <p className="text-[10px] font-black uppercase tracking-widest italic text-gray-400">Empty Board</p>
                                            </div>
                                        ) : (
                                            messages.map((m) => (
                                                <div key={m.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                    <div className="flex gap-4 items-start">
                                                        <Avatar className="h-8 w-8 border border-white shadow-sm flex-shrink-0">
                                                            <AvatarFallback className="bg-[#004E98] text-white text-[9px] font-black tracking-tighter">{getInitials(m.userName)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-[11px] font-black text-gray-900 uppercase tracking-tight">{m.userName || "Team Member"}</span>
                                                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tight opacity-40">
                                                                    {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                                                                </span>
                                                            </div>
                                                            <div className="bg-gray-50 p-3.5 rounded-2xl rounded-tl-none text-[13px] text-gray-700 shadow-sm border border-gray-100/50 leading-relaxed font-medium">
                                                                {m.content}
                                                                {m.attachments?.map((at: any) => (
                                                                    <div key={at.id} className="mt-2.5 p-2 bg-white rounded-xl border border-gray-100 flex items-center justify-between group/at">
                                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                                            <FileText className="h-3.5 w-3.5 text-[#004E98] shrink-0" />
                                                                            <span className="text-[10px] font-bold text-gray-500 truncate">{at.fileName}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-7 w-7 text-[#004E98] hover:bg-blue-50 transition-colors"
                                                                                onClick={() => window.open(at.fileUrl, '_blank')}
                                                                                title="Open in new tab"
                                                                            >
                                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const link = document.createElement('a');
                                                                                    link.href = at.fileUrl;
                                                                                    link.download = at.fileName;
                                                                                    link.click();
                                                                                }}
                                                                                title="Download"
                                                                            >
                                                                                <Download className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </div>
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
                                <div className="p-4 bg-white border-t">
                                    <div className="max-w-2xl mx-auto flex gap-2 items-center bg-gray-50 p-1.5 rounded-2xl border border-gray-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#004E98]/10 transition-all duration-300">
                                        <div className="flex items-center gap-1 pl-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled={isUploading}
                                                className="h-8 w-8 text-gray-400 hover:text-[#004E98] hover:bg-blue-50 rounded-lg relative"
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                                            </Button>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                onChange={handleFileUpload}
                                            />
                                        </div>
                                        <MentionInput
                                            value={newMessage}
                                            onChange={setNewMessage}
                                            onSend={sendMessage}
                                            placeholder={`Message about ${selectedDiscussion.caseNumber}...`}
                                            className="flex-1 bg-transparent border-none focus-within:ring-0 [&>textarea]:text-xs [&>textarea]:font-bold [&>textarea]:uppercase [&>textarea]:tracking-tight [&>textarea]:placeholder:normal-case [&>textarea]:min-h-[40px] [&>textarea]:p-2.5"
                                        />
                                        <div className="mr-0.5">
                                            <Button
                                                disabled={!newMessage.trim()}
                                                onClick={sendMessage}
                                                size="icon"
                                                className="h-9 w-9 bg-[#004E98] hover:bg-[#004E98]/90 shadow-sm rounded-xl transition-all"
                                            >
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* File Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
            />

            {/* New Discussion Modal */}
            <Dialog open={newDiscussionModalOpen} onOpenChange={setNewDiscussionModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Start New Discussion</DialogTitle>
                        <DialogDescription>
                            Initialize an internal discussion thread for an existing case.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Select Case</Label>
                            <SearchableSelect
                                options={caseOptions}
                                value={selectedNewCaseId}
                                onValueChange={(val) => setSelectedNewCaseId(val || "")}
                                placeholder="Search cases by number..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>First Message</Label>
                            <MentionInput
                                value={newDiscussionText}
                                onChange={setNewDiscussionText}
                                onSend={handleStartNewDiscussion}
                                placeholder="Tag colleagues with @ to collaborate..."
                                className="flex-1"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setNewDiscussionModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleStartNewDiscussion}
                            disabled={!selectedNewCaseId || !newDiscussionText.trim() || isCreatingDiscussion}
                            className="bg-[#004E98] hover:bg-[#003B73] text-white"
                        >
                            {isCreatingDiscussion ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                            Start Discussion
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function DiscussionItem({ caseNumber, title, lastMessage, time, unread = false, active = false, isCollaborator = false, onClick }: any) {
    return (
        <div
            onClick={onClick}
            className={`
                p-3.5 rounded-xl cursor-pointer transition-all border-l-4 mx-1
                ${active
                    ? "bg-[#004E98]/5 border-[#004E98] shadow-sm mb-1 ring-1 ring-[#004E98]/10"
                    : "hover:bg-gray-50 border-transparent"}
            `}
        >
            <div className="flex justify-between items-start mb-1.5">
                <div className="flex flex-col gap-1">
                    <span className={`text-[9px] font-black uppercase tracking-widest italic ${active ? "text-[#004E98]" : "text-gray-400"}`}>
                        {caseNumber}
                    </span>
                    {isCollaborator && (
                        <div className="text-[7px] font-black text-emerald-600 bg-emerald-50 px-1 py-0 rounded-sm border border-emerald-100 uppercase tracking-tighter w-fit">
                            Collaborator
                        </div>
                    )}
                </div>
                <span className="text-[8px] font-black text-gray-400/50 uppercase tracking-tighter">{time}</span>
            </div>
            <h3 className={`text-[11px] tracking-tight truncate leading-tight ${active ? "font-black text-gray-900" : "font-black text-gray-600"}`}>
                {title}
            </h3>
            <p className="text-[10px] text-gray-400 line-clamp-1 mt-1.5 leading-normal transition-all font-bold uppercase tracking-tight opacity-50">
                {lastMessage}
            </p>
            {unread && !active && (
                <div className="mt-2 flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#004E98] animate-pulse" />
                    <span className="text-[8px] font-black text-[#004E98] uppercase tracking-widest">New</span>
                </div>
            )}
        </div>
    );
}
