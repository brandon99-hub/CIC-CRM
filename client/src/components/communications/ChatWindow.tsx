import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send, MoreVertical, AlertCircle, CheckCircle2, MessageSquare,
  Loader2, Flag, UserCheck, EyeOff, Trash2, ThumbsUp, StickyNote, RefreshCw,
  Phone, Clock, X, Zap, Mail, Star, Sparkles, PlusCircle
} from "lucide-react";
import { apiRequest } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { ResolveModal, EscalateModal } from "../cases/status-modals";
import { EmailMessageCard } from "./EmailMessageCard";
import { ChatTriageModal } from "./ChatTriageModal";
import { useToast } from "@/hooks/use-toast";

interface ChatWindowProps {
  conversationId: string | null;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function isNumericString(str: string) {
  return /^\d+$/.test(str.trim());
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const [message, setMessage] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showTriageModal, setShowTriageModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: categories = [] } = useQuery({
    queryKey: ["service-categories"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/service-categories");
      const json = await res.json();
      return json.serviceCategories || [];
    }
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/users");
      const json = await res.json();
      return json.users || [];
    }
  });

  const { data: templatesRes } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const res = await apiRequest("/api/knowledge-base?isTemplate=true");
      return res.ok ? res.json() : { articles: [] };
    }
  });
  const templates = templatesRes?.articles || [];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["chat", conversationId],
    queryFn: async () => {
      const res = await apiRequest(`/api/conversations/${conversationId}/messages`);
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: !!conversationId,
    refetchInterval: 10000,
  });

  const convo = data?.conversation;
  const msgs: any[] = data?.messages ?? [];
  const withinWindow: boolean = data?.withinWindow ?? true;
  const isCommentChannel = convo?.channel === "facebook_comment" || convo?.channel === "instagram_comment";
  const isDMChannel = convo?.channel === "messenger" || convo?.channel === "instagram_dm" || convo?.channel === "whatsapp";

  // Reset warning dismiss when conversation changes
  useEffect(() => { setWarningDismissed(false); }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const replyMutation = useMutation({
    mutationFn: async ({ text, note }: { text: string; note: boolean }) => {
      const endpoint = note
        ? `/api/conversations/${conversationId}/note`
        : `/api/conversations/${conversationId}/reply`;
      const res = await apiRequest(endpoint, { method: "POST", body: JSON.stringify({ text }) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to send");
      }
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      setIsNote(false);
      refetch();
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }
  });

  const triageMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/conversations/${conversationId}/triage`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to trigger AI triage");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.result === "case_created") {
        toast({ title: "Case Created", description: "The AI successfully created and assigned a case." });
      } else if (data.result === "signal_created") {
        toast({ title: "Review Required", description: "AI needs your help to confirm the service category." });
        setShowTriageModal(true);
      } else {
        toast({ title: "AI Triage", description: data.message });
      }
      refetch();
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err: any) => {
      toast({ title: "Triage Failed", description: err.message, variant: "destructive" });
    }
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest(`/api/conversations/${conversationId}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ resolutionNotes, saveToKb, sopSteps, rootCause }: any) => {
      const res = await apiRequest(`/api/conversations/${conversationId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolutionNotes, saveToKb, sopSteps, rootCause }),
      });
      return res.json();
    },
    onSuccess: () => {
      setShowResolveModal(false);
      qc.invalidateQueries({ queryKey: ["chat", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async ({ categoryId, assignedTo }: any) => {
      const res = await apiRequest(`/api/conversations/${conversationId}/escalate`, {
        method: "POST",
        body: JSON.stringify({ categoryId, assignedTo }),
      });
      return res.json();
    },
    onSuccess: () => {
      setShowEscalateModal(false);
      qc.invalidateQueries({ queryKey: ["chat", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ action, commentId }: { action: string; commentId: string }) => {
      if (action === "hide")
        return apiRequest(`/api/conversations/${conversationId}/hide-comment`, { method: "POST", body: JSON.stringify({ commentId, hide: true }) });
      if (action === "delete")
        return apiRequest(`/api/conversations/${conversationId}/delete-comment`, { method: "DELETE", body: JSON.stringify({ commentId }) });
      if (action === "like")
        return apiRequest(`/api/conversations/${conversationId}/like-comment`, { method: "POST", body: JSON.stringify({ commentId }) });
    },
    onSuccess: () => refetch(),
  });

  const starMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/conversations/${conversationId}/star`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const aiReplyMutation = useMutation({
    mutationFn: async () => {
      // Just a mock for now or calling the actual chat endpoint if configured
      const res = await apiRequest("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "Please suggest a short, professional reply to this conversation.",
          history: msgs.map((m: any) => ({
            role: m.direction === "inbound" ? "user" : "assistant",
            content: m.body
          })).slice(-5)
        })
      });
      if (!res.ok) throw new Error("Failed to generate reply");
      return res.json();
    },
    onSuccess: (data) => {
      setMessage(data.reply || "");
    }
  });

  // ── Empty / Loading / Error states ───────────────────────────────────────────
  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f0f4fa]/40">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-gray-100">
            <MessageSquare size={32} className="text-[#004E98]/30" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-800">No conversation selected</h3>
            <p className="text-sm text-gray-400 mt-1">Select a conversation from the list to start messaging.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f0f4fa]/40">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-[#004E98]/50" />
          <p className="text-xs text-gray-400 font-medium">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
          <AlertCircle size={24} className="text-red-400" />
        </div>
        <p className="text-sm text-gray-500 font-medium">Failed to load messages</p>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:underline">
          <RefreshCw size={12} /> Try again
        </button>
      </div>
    );
  }

  const meta: any = convo?.metadata ?? {};
  // Prefer stakeholderName (from DB join), then senderName from metadata, then userName, then senderId as last resort
  let rawName = convo?.stakeholderName || meta.senderName || meta.userName || meta.fromName || meta.senderId || "Unknown";
  rawName = rawName.replace(/\s*Unknown\s*$/i, "").replace(/\s*User\s*$/i, "").trim();
  const displayName = isNumericString(rawName) || !rawName ? "Unknown" : rawName;

  const channelLabel = convo?.channel?.replace(/_/g, " ") ?? "";
  const isPlatformFacebook = convo?.channel?.includes("messenger") || convo?.channel?.includes("facebook");
  const isPlatformWhatsApp = convo?.channel === "whatsapp";
  const isEmailChannel = convo?.channel === "email";
  const platformColor = isPlatformWhatsApp ? "#128C7E" : isPlatformFacebook ? "#004E98" : isEmailChannel ? "#e11d48" : "#e1306c";
  const isResolved = convo?.status === "resolved";
  // Subject lives at the conversation level in most providers; fall back to
  // the most recent message's subject if the backend sends it per-message.
  const subject: string =
    meta.subject || [...msgs].reverse().find((m: any) => m.subject)?.subject || "";
  const senderEmail: string =
    meta.fromEmail || meta.senderEmail || (typeof meta.senderId === "string" && meta.senderId.includes("@") ? meta.senderId : "");

  // Group messages by date
  const grouped: { date: string; msgs: any[] }[] = [];
  for (const m of msgs) {
    const d = formatDate(m.createdAt);
    if (!grouped.length || grouped[grouped.length - 1].date !== d) {
      grouped.push({ date: d, msgs: [m] });
    } else {
      grouped[grouped.length - 1].msgs.push(m);
    }
  }

  const handleSend = () => {
    if (!message.trim()) return;
    replyMutation.mutate({ text: message.trim(), note: isNote });
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-100 bg-white shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Avatar with platform color ring */}
            <div className="relative shrink-0">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black shadow-sm"
                style={{ background: `linear-gradient(135deg, ${platformColor}cc, ${platformColor})` }}
              >
                {isEmailChannel ? <Mail size={16} /> : getInitials(displayName)}
              </div>
              {/* Online indicator — not meaningful for email */}
              {!isEmailChannel && (
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white",
                  isResolved ? "bg-gray-300" : "bg-emerald-400"
                )} />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5 min-w-0">
                <h2 className="font-bold text-gray-900 text-[14px] leading-tight truncate">{displayName}</h2>
                {isEmailChannel && senderEmail && (
                  <span className="text-[11px] text-gray-400 font-medium truncate hidden md:inline">&lt;{senderEmail}&gt;</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm text-white/90"
                  style={{ background: platformColor }}
                >
                  {channelLabel}
                </span>
                {isResolved && (
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">· Resolved</span>
                )}
              </div>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {convo?.caseId && meta.simulated ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-purple-700 bg-purple-50 rounded-lg border border-purple-100 shadow-sm">
                <Zap size={12} className="text-purple-500" />
                Escalated by AI - {meta.nlp_confidence || 100}% Confidence
              </div>
            ) : (
              <>
                <button
                  onClick={() => starMutation.mutate()}
                  disabled={starMutation.isPending}
                  className="flex items-center justify-center p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors border border-transparent disabled:opacity-60"
                  title={meta.starred ? "Unstar" : "Star conversation"}
                >
                  <Star size={16} className={meta.starred ? "fill-amber-400 text-amber-500" : ""} />
                </button>
                {!convo?.caseId && convo?.metadata?.pendingSignalId ? (
                  <button
                    onClick={() => setShowTriageModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-100"
                    title="Review AI Triage"
                  >
                    <AlertCircle size={12} /> Pending Triage
                  </button>
                ) : !convo?.caseId ? (
                  <button
                    onClick={() => triageMutation.mutate()}
                    disabled={triageMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100 disabled:opacity-60"
                    title="Create case with AI context"
                  >
                    {triageMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <PlusCircle size={12} />} Create Case
                  </button>
                ) : null}
                {!isResolved ? (
                  <button
                    onClick={() => setShowResolveModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-100 disabled:opacity-60"
                  >
                    <CheckCircle2 size={12} /> Resolve
                  </button>
                ) : (
                  <button
                    onClick={() => statusMutation.mutate("new")}
                    disabled={statusMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-100 disabled:opacity-60"
                  >
                    {statusMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Reopen
                  </button>
                )}
                {convo?.caseId && (
                  <button
                    onClick={() => setShowEscalateModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
                  >
                    <Flag size={12} /> Escalate
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 24-hour window warning — compact strip ──────────────────────────── */}
      {isDMChannel && !withinWindow && !warningDismissed && (
        <div className="mx-4 mt-3 flex items-center gap-2.5 px-3 py-2 bg-amber-50 border-l-3 border-amber-400 rounded-r-lg rounded-l-sm shrink-0 border border-amber-100">
          <Clock size={13} className="text-amber-500 shrink-0" />
          <p className="text-[11px] text-amber-700 font-medium flex-1 leading-snug">
            <span className="font-black">24-hour window expired.</span> Customer must message first to reopen.
          </p>
          <button onClick={() => setWarningDismissed(true)} className="text-amber-400 hover:text-amber-600 transition-colors shrink-0">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Messages area ────────────────────────────────────────────────────── */}
      <div className={cn("flex-1 overflow-y-auto", isEmailChannel ? "px-5 py-5 space-y-3 bg-[#f7f8fa]" : "px-5 py-5 space-y-1 bg-[#f0f4fa]/50")}>
        {msgs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100">
              <MessageSquare size={22} className="text-gray-300" />
            </div>
            <p className="text-sm text-gray-400 font-medium">No messages yet</p>
          </div>
        ) : isEmailChannel ? (
          // ── Email thread — Gmail-style stacked cards, latest expanded ───────
          (() => {
            const lastRealId = [...msgs].reverse().find((m: any) => !m.isInternalNote)?.id;
            return grouped.map((group) => (
              <div key={group.date}>
                <div className="flex items-center justify-center my-4">
                  <span className="text-[11px] font-bold text-gray-400 bg-white shadow-sm border border-gray-100 rounded-full px-3 py-1 tracking-wide">
                    {group.date}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {group.msgs.map((msg: any) =>
                    msg.isInternalNote ? (
                      <div key={msg.id} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-start gap-2.5">
                        <StickyNote size={13} className="text-amber-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Internal Note</span>
                            <span className="text-[10px] text-amber-400 font-medium">{formatTime(msg.createdAt)}</span>
                          </div>
                          <p className="text-sm text-amber-800 leading-relaxed">{msg.body}</p>
                        </div>
                      </div>
                    ) : (
                      <EmailMessageCard
                        key={msg.id}
                        msg={msg}
                        fallbackName={displayName}
                        defaultExpanded={msg.id === lastRealId}
                      />
                    )
                  )}
                </div>
              </div>
            ));
          })()
        ) : (
          grouped.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-5">
                <span className="text-[11px] font-bold text-gray-400 bg-white shadow-sm border border-gray-100 rounded-full px-3 py-1 tracking-wide">
                  {group.date}
                </span>
              </div>

              <div className="space-y-0.5">
                {group.msgs.map((msg: any, idx: number) => {
                  const isInbound = msg.direction === "inbound";
                  const isNoteMsg = msg.isInternalNote;
                  const prevMsg = group.msgs[idx - 1];
                  const nextMsg = group.msgs[idx + 1];
                  // Message grouping: same direction as neighbours
                  const sameAsPrev = prevMsg && prevMsg.direction === msg.direction && !prevMsg.isInternalNote && !isNoteMsg;
                  const sameAsNext = nextMsg && nextMsg.direction === msg.direction && !nextMsg.isInternalNote && !isNoteMsg;
                  // Add extra gap above first of a new sender group
                  const groupGap = !sameAsPrev ? "mt-4" : "mt-0.5";

                  // ── Internal Note ──────────────────────────────────────────
                  if (isNoteMsg) {
                    return (
                      <div key={msg.id} className="mt-4 mb-1">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-start gap-2.5">
                          <StickyNote size={13} className="text-amber-500 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Internal Note</span>
                              <span className="text-[10px] text-amber-400 font-medium">{formatTime(msg.createdAt)}</span>
                            </div>
                            <p className="text-sm text-amber-800 leading-relaxed">{msg.body}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // ── Chat bubble ───────────────────────────────────────────
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex items-end gap-2 group",
                        groupGap,
                        !isInbound && "flex-row-reverse"
                      )}
                    >
                      {/* Avatar — only show for first message in a group */}
                      <div className={cn("w-7 shrink-0", isInbound ? "" : "")}>
                        {isInbound && !sameAsPrev ? (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black"
                            style={{ background: platformColor }}
                          >
                            {getInitials(displayName).slice(0, 1)}
                          </div>
                        ) : (
                          <div className="w-7 h-7" /> /* placeholder to maintain alignment */
                        )}
                      </div>

                      {/* Bubble + timestamp */}
                      <div className={cn("max-w-[68%] flex flex-col", !isInbound && "items-end")}>
                        {/* Sender name — only first in group */}
                        {isInbound && !sameAsPrev && (
                          <span className="text-[10px] font-black text-gray-400 mb-1 ml-1 uppercase tracking-wide">{displayName}</span>
                        )}

                        <div
                          className={cn(
                            "px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                            // Bubble rounding — soften corners adjacent to same sender
                            isInbound
                              ? cn(
                                  "bg-white text-gray-800 border border-gray-100",
                                  !sameAsPrev && !sameAsNext ? "rounded-2xl rounded-bl-sm" :
                                  !sameAsPrev ? "rounded-2xl rounded-bl-sm rounded-br-2xl" :
                                  sameAsNext ? "rounded-xl rounded-l-sm" :
                                  "rounded-xl rounded-l-sm rounded-br-2xl"
                                )
                              : cn(
                                  "text-white",
                                  !sameAsPrev && !sameAsNext ? "rounded-2xl rounded-br-sm" :
                                  !sameAsPrev ? "rounded-2xl rounded-br-sm rounded-bl-2xl" :
                                  sameAsNext ? "rounded-xl rounded-r-sm" :
                                  "rounded-xl rounded-r-sm rounded-bl-2xl"
                                )
                          )}
                          style={!isInbound ? { background: `linear-gradient(135deg, ${platformColor}dd, ${platformColor})` } : {}}
                        >
                          {msg.body}
                        </div>

                        {/* Timestamp below bubble — only last in group */}
                        {!sameAsNext && (
                          <span className={cn(
                            "text-[10px] font-medium mt-1 px-1",
                            isInbound ? "text-gray-400" : "text-gray-400"
                          )}>
                            {formatTime(msg.createdAt)}
                          </span>
                        )}

                        {/* Comment moderation actions */}
                        {isInbound && isCommentChannel && msg.externalMessageId && (
                          <div className="hidden group-hover:flex items-center gap-1 mt-1">
                            <button
                              onClick={() => commentMutation.mutate({ action: "like", commentId: msg.externalMessageId })}
                              className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Like comment"
                            >
                              <ThumbsUp size={11} />
                            </button>
                            <button
                              onClick={() => commentMutation.mutate({ action: "hide", commentId: msg.externalMessageId })}
                              className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Hide comment"
                            >
                              <EyeOff size={11} />
                            </button>
                            <button
                              onClick={() => commentMutation.mutate({ action: "delete", commentId: msg.externalMessageId })}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete comment"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Reply Composer ───────────────────────────────────────────────────── */}
      <div className="bg-white border-t border-gray-100 px-4 pt-3 pb-4 shrink-0">
        {isEmailChannel && !isNote && (senderEmail || displayName !== "Unknown") && (
          <p className="text-[11px] text-gray-400 font-medium mb-2">
            Replying to <span className="text-gray-600 font-bold">{senderEmail || displayName}</span>
            {subject && <span className="text-gray-400"> · Re: {subject}</span>}
          </p>
        )}
        {/* Tab toggle — underline style */}
        <div className="flex items-center gap-0 mb-3 border-b border-gray-100">
          <button
            onClick={() => setIsNote(false)}
            className={cn(
              "text-[12px] font-bold px-3 pb-2 border-b-2 -mb-px transition-colors",
              !isNote
                ? "border-[#004E98] text-[#004E98]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            )}
          >
            Reply
          </button>
          <button
            onClick={() => setIsNote(true)}
            className={cn(
              "text-[12px] font-bold px-3 pb-2 border-b-2 -mb-px flex items-center gap-1.5 transition-colors",
              isNote
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-gray-400 hover:text-gray-600"
            )}
          >
            <StickyNote size={11} /> Internal Note
          </button>
          <div className="flex-1 border-b-2 border-transparent -mb-px"></div>
          <button
            onClick={() => aiReplyMutation.mutate()}
            disabled={aiReplyMutation.isPending || isNote}
            className="flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-full transition-colors mb-1.5 disabled:opacity-50"
            title="Generate AI Reply Suggestion"
          >
            {aiReplyMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            AI Suggest
          </button>
        </div>

        {/* Input area */}
        <div className={cn(
          "rounded-xl border transition-all",
          isNote
            ? "bg-amber-50/50 border-amber-200 focus-within:border-amber-400 focus-within:shadow-[0_0_0_3px_rgba(251,191,36,0.1)]"
            : "bg-gray-50 border-gray-200 focus-within:border-[#004E98]/40 focus-within:shadow-[0_0_0_3px_rgba(0,78,152,0.06)]",
          isDMChannel && !withinWindow && !isNote && "opacity-50 pointer-events-none"
        )}>
          <textarea
            rows={isEmailChannel && !isNote ? 12 : 2}
            placeholder={
              isNote
                ? "Add an internal note — only visible to your team..."
                : isDMChannel && !withinWindow
                  ? "24-hour window expired — customer must message first"
                  : isEmailChannel
                    ? "Write your reply..."
                    : "Type a message..."
            }
            className={cn(
              "w-full bg-transparent border-none focus:outline-none text-[13px] text-gray-700 placeholder:text-gray-400 px-3.5 pt-3 pb-2 leading-relaxed",
              isEmailChannel && !isNote ? "resize-y" : "resize-none"
            )}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && message.trim()) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isDMChannel && !withinWindow && !isNote}
          />

          <div className="flex items-center justify-between px-3.5 pb-2.5">
            {/* Character counter */}
            {!isEmailChannel && (
              <span className={cn(
                "text-[10px] font-medium transition-colors",
                message.length > 900 ? "text-red-400" : message.length > 600 ? "text-amber-400" : "text-gray-300"
              )}>
                {message.length > 0 ? `${message.length}/1000` : ""}
              </span>
            )}
            {isEmailChannel && <span />}

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!message.trim() || replyMutation.isPending || (isDMChannel && !withinWindow && !isNote)}
              className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95",
                isNote
                  ? "bg-amber-500 hover:bg-amber-600 shadow-sm shadow-amber-500/30"
                  : "shadow-sm shadow-blue-500/30"
              )}
              style={!isNote ? { background: `linear-gradient(135deg, ${platformColor}cc, ${platformColor})` } : {}}
            >
              {replyMutation.isPending
                ? <Loader2 size={14} className="animate-spin" />
                : <Send size={14} className="translate-x-[1px]" />
              }
            </button>
          </div>
        </div>

        {/* Error message */}
        {replyMutation.isError && (
          <p className="text-[11px] text-red-500 mt-2 flex items-center gap-1 font-medium">
            <AlertCircle size={11} /> {(replyMutation.error as Error).message}
          </p>
        )}
      </div>
      
      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      <ResolveModal
        open={showResolveModal}
        onOpenChange={setShowResolveModal}
        onConfirm={async (resolutionNotes, saveToKb, sopSteps, rootCause) => {
          await resolveMutation.mutateAsync({ resolutionNotes, saveToKb, sopSteps, rootCause });
        }}
        isProcessing={resolveMutation.isPending}
        templates={templates}
        caseData={{
          caseNumber: "",
          title: displayName,
          channel: channelLabel,
        }}
      />

      <EscalateModal
        open={showEscalateModal}
        onOpenChange={setShowEscalateModal}
        onConfirm={async (categoryId, assignedTo) => {
          await escalateMutation.mutateAsync({ categoryId, assignedTo });
        }}
        isProcessing={escalateMutation.isPending}
        categories={categories}
        users={users}
        channel={channelLabel}
        signalContent={msgs[msgs.length - 1]?.text || ""}
      />

      {showTriageModal && convo?.metadata?.pendingSignalId && (
        <ChatTriageModal
          signalId={convo.metadata.pendingSignalId}
          isOpen={showTriageModal}
          onClose={() => setShowTriageModal(false)}
          onSuccess={() => { setShowTriageModal(false); refetch(); qc.invalidateQueries({ queryKey: ["conversations"] }); }}
          categories={categories}
          users={users}
        />
      )}
    </div>
  );
}
