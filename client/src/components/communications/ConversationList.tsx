import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UserCircle2, MessageSquare, Instagram, Facebook, Phone, Mail, AlertCircle, RefreshCw, MessageCircle, AtSign, Paperclip } from "lucide-react";
import { apiRequest } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiSelect } from "@/components/ui/multi-select";
import { getEmailSnippet, formatEmailListDate } from "./email-utils";

interface ConversationListProps {
  platform: "facebook" | "instagram" | "email" | "whatsapp";
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
}

const CHANNEL_COLORS: Record<string, string> = {
  messenger: "bg-blue-100 text-blue-700",
  instagram_dm: "bg-pink-100 text-pink-700",
  facebook_comment: "bg-blue-50 text-blue-600",
  instagram_comment: "bg-pink-50 text-pink-600",
  facebook_mention: "bg-indigo-50 text-indigo-600",
  instagram_mention: "bg-purple-50 text-purple-600",
  whatsapp: "bg-emerald-100 text-emerald-700",
};

const CHANNEL_ICONS: Record<string, any> = {
  messenger: MessageSquare,
  instagram_dm: MessageSquare,
  facebook_comment: MessageCircle,
  instagram_comment: MessageCircle,
  facebook_mention: AtSign,
  instagram_mention: AtSign,
  whatsapp: MessageCircle,
};

function getInitials(name: string) {
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
}

function isNumericString(str: string) {
  return /^\d+$/.test((str || "").trim());
}

function friendlyName(convo: any): string {
  let raw = convo.stakeholderName || "";
  raw = raw.replace(/\sUnknown$/, "").trim();
  if (isNumericString(raw) || !raw || raw === "Unknown") {
    return convo.metadata?.userName || convo.metadata?.senderName || "Unknown";
  }
  return raw;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ConversationList({ platform, activeConversationId, onSelectConversation }: ConversationListProps) {
  const [search, setSearch] = useState("");
  const defaultFilter = platform === "facebook" ? "messenger" : platform === "instagram" ? "instagram_dm" : platform === "whatsapp" ? "whatsapp" : "inbox";
  const [activeFilter, setActiveFilter] = useState<string>(defaultFilter);
  const [selectedAddresses, setSelectedAddresses] = useState<string[]>([]);

  const platformFilters = platform === "facebook" ? [
    { id: "messenger", label: "Direct Messages" },
    { id: "facebook_comment", label: "Comments" },
    { id: "facebook_mention", label: "Mentions" },
  ] : platform === "instagram" ? [
    { id: "instagram_dm", label: "Direct Messages" },
    { id: "instagram_comment", label: "Comments" },
    { id: "instagram_mention", label: "Mentions" },
  ] : platform === "whatsapp" ? [
    { id: "whatsapp", label: "WhatsApp Chats" },
  ] : [
    { id: "inbox", label: "Inbox" },
    { id: "sent", label: "Sent" },
    { id: "starred", label: "Starred" },
    { id: "drafts", label: "Drafts" },
    { id: "all", label: "All Mail" },
  ];

  // reset filter when platform changes
  useEffect(() => {
    setActiveFilter(platform === "facebook" ? "messenger" : platform === "instagram" ? "instagram_dm" : platform === "whatsapp" ? "whatsapp" : "inbox");
  }, [platform]);

  const { data: pagesData } = useQuery({
    queryKey: ["social", "pages"],
    queryFn: async () => {
      const res = await apiRequest("/api/social/pages");
      if (!res.ok) throw new Error("Failed to load pages");
      return res.json();
    }
  });

  const activePage = pagesData?.pages?.find((p: any) => p.platform === platform);
  let accountName = activePage?.pageName || "Official Account";
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["conversations", platform, activeFilter],
    queryFn: async () => {
      // If "all" or specific tabs are selected, we need to fetch channels for this platform
      let q = "";
      if (platform === "email") {
        q = `?channel=email`; // Fetch all email channel, we will filter by status locally for simplicity, or we can add logic later.
      } else if (activeFilter !== "all") {
        q = `?channel=${activeFilter}`;
      } else {
        const channels = platform === "facebook" ? "messenger,facebook_comment,facebook_mention" : platform === "instagram" ? "instagram_dm,instagram_comment,instagram_mention" : "whatsapp";
        q = `?channels=${channels}`;
      }
      const res = await apiRequest(`/api/conversations${q}`);
      if (!res.ok) throw new Error("Failed to load conversations");
      return res.json();
    },
    refetchInterval: 15000, 
  });

  const conversations: any[] = data?.conversations || [];

  if (platform === "whatsapp" && conversations.length > 0) {
    // Show the WhatsApp number if available
    accountName = conversations[0].metadata?.myPhone || accountName;
  }

  const receivingAddresses = Array.from(
    new Set(
      conversations
        .map((c: any) => c.metadata?.myEmail || c.metadata?.toEmail)
        .filter(Boolean)
    )
  ) as string[];

  const addressOptions = receivingAddresses.map(addr => ({ id: addr, label: addr }));

  let filtered = search.trim()
    ? conversations.filter(c =>
        c.stakeholderName?.toLowerCase().includes(search.toLowerCase()) ||
        c.metadata?.subject?.toLowerCase().includes(search.toLowerCase()) ||
        c.lastMessage?.body?.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  if (platform === "email") {
    // Filter by addresses
    if (selectedAddresses.length > 0) {
      filtered = filtered.filter(c => {
        const email = c.metadata?.myEmail || c.metadata?.toEmail;
        return email && selectedAddresses.includes(email);
      });
    }
    // Filter by tabs
    if (activeFilter === "inbox") {
      filtered = filtered.filter(c => c.status === "new" || c.status === "open" || c.status === "active");
    } else if (activeFilter === "sent") {
      // For now, if the last message is outbound, we consider it sent
      filtered = filtered.filter(c => c.lastMessage?.direction === "outbound" && !c.lastMessage?.isInternalNote);
    } else if (activeFilter === "starred") {
      filtered = filtered.filter(c => c.metadata?.starred === true);
    } else if (activeFilter === "drafts") {
      // We'll store draft status in localStorage, check later. For now empty.
      filtered = filtered.filter(c => false);
    } else if (activeFilter === "all") {
      // show all
    }
  }

  // Sort conversations so that unescalated issues (no caseId) appear at the top
  filtered.sort((a, b) => {
    const aIsEscalated = !!a.caseId;
    const bIsEscalated = !!b.caseId;
    if (aIsEscalated === bIsEscalated) {
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    }
    return aIsEscalated ? 1 : -1;
  });


  return (
    <div className="w-[340px] bg-white border-r border-gray-200 flex flex-col h-full z-0 shrink-0">
      {/* Account Info / Email Filter */}
      <div className="p-5 border-b border-gray-100 flex items-center bg-slate-50/50">
        {platform === "email" ? (
            <div className="w-full">
              <MultiSelect
                options={addressOptions}
                value={selectedAddresses}
                onValueChange={setSelectedAddresses}
                placeholder="Filter by email address..."
                searchPlaceholder="Search addresses..."
              />
            </div>
        ) : (
            <h3 className="font-black text-[13px] text-slate-800 tracking-wide uppercase truncate">
              {accountName}
            </h3>
        )}
      </div>

      {/* Channel Tabs */}
      <div className="border-b border-gray-100 bg-white">
        <Tabs value={activeFilter} onValueChange={setActiveFilter} className="w-full">
          <div className="px-4 pt-2">
            <TabsList className="bg-transparent h-auto min-h-[40px] gap-2 md:gap-4 border-none p-0 flex flex-nowrap overflow-x-auto custom-scrollbar pb-1 w-full justify-start">
              {platformFilters.map(c => (
                <TabsTrigger
                  key={c.id}
                  value={c.id}
                  className={cn(
                    "data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 rounded-none border-b-2 border-transparent px-1 py-2 h-auto text-[10px] font-black uppercase tracking-widest text-gray-400 transition-colors whitespace-nowrap flex-shrink-0",
                    platform === "facebook" 
                      ? "data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] hover:text-[#004E98]/70" 
                      : platform === "instagram" ? "data-[state=active]:border-pink-600 data-[state=active]:text-pink-600 hover:text-pink-600/70"
                      : platform === "whatsapp" ? "data-[state=active]:border-[#128C7E] data-[state=active]:text-[#128C7E] hover:text-[#128C7E]/70"
                      : "data-[state=active]:border-rose-500 data-[state=active]:text-rose-600 hover:text-rose-600/70"
                  )}
                >
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-100 bg-slate-50/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#004E98]/20 focus:border-[#004E98]/30 transition-all placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-3 p-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-2 bg-gray-100 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle size={32} className="text-red-300" />
            <p className="text-sm text-gray-500">Failed to load conversations</p>
            <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 p-8 h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center">
              <MessageSquare size={24} className="text-gray-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Inbox Zero</p>
              <p className="text-xs text-gray-500 mt-1">You're all caught up on {platform}.</p>
            </div>
          </div>
        ) : (
          filtered.map((convo) => {
            const Icon = CHANNEL_ICONS[convo.channel] ?? MessageSquare;
            const colorClass = CHANNEL_COLORS[convo.channel] ?? "bg-gray-100 text-gray-600";
            const isActive = activeConversationId === convo.id;
            const isUnread = convo.status === "new";
            const isComment = convo.channel.includes("comment");
            const isMention = convo.channel.includes("mention");
            const isEmail = platform === "email";
            const subject: string = convo.metadata?.subject || convo.subject || "";
            const hasAttachment = !!(convo.lastMessage?.attachments?.length || convo.metadata?.hasAttachments);
            const accentDot = isEmail ? "bg-rose-500" : platform === "whatsapp" ? "bg-[#128C7E]" : "bg-[#004E98]";
            const accentRing = isEmail
              ? "ring-[3px] ring-offset-1 ring-rose-500 z-10 relative rounded-lg border-transparent shadow-md"
              : platform === "facebook" ? "ring-[3px] ring-offset-1 ring-[#004E98] z-10 relative rounded-lg border-transparent shadow-md"
              : platform === "instagram" ? "ring-[3px] ring-offset-1 ring-purple-500 z-10 relative rounded-lg border-transparent shadow-md"
              : "ring-[3px] ring-offset-1 ring-[#128C7E] z-10 relative rounded-lg border-transparent shadow-md";

            return (
              <div
                key={convo.id}
                onClick={() => onSelectConversation(convo.id)}
                className={cn(
                  "p-4 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-md group",
                  isActive ? cn("bg-slate-50", accentRing) : "bg-white border-b border-gray-50"
                )}
              >

                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shadow-sm",
                      isEmail ? "bg-gradient-to-br from-rose-400 to-rose-600 text-white" : colorClass,
                      isActive ? "ring-2 ring-white" : ""
                    )}>
                      {getInitials(friendlyName(convo) || "?")}
                    </div>
                    {isUnread && (
                      <div className={cn("absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white", accentDot)} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <h4 className={cn("text-[13px] truncate pr-2", isUnread ? "font-black text-gray-900" : "font-bold text-gray-700")}>
                        {friendlyName(convo)}
                      </h4>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasAttachment && <Paperclip size={11} className="text-gray-300" />}
                        <span className="text-[10px] font-bold tracking-wider text-gray-400">
                          {isEmail ? formatEmailListDate(convo.lastMessageAt) : timeAgo(convo.lastMessageAt)}
                        </span>
                      </div>
                    </div>

                    {/* Contextual UI for Comments / Mentions */}
                    {(isComment || isMention) && convo.metadata?.postContext && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={cn(
                          "text-[9px] uppercase font-black tracking-widest px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-500 flex items-center gap-1",
                          isActive && "bg-white shadow-sm"
                        )}>
                          <Icon size={8} /> {isComment ? "Comment on" : "Mentioned in"}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 truncate italic">
                          "{convo.metadata.postContext}"
                        </span>
                      </div>
                    )}

                    {isEmail ? (
                      <p className="text-[13px] truncate leading-relaxed">
                        <span className={isUnread ? "font-bold text-gray-900" : "font-semibold text-gray-600"}>
                          {subject || "(No subject)"}
                        </span>
                        <span className="font-normal text-gray-400"> — {getEmailSnippet(convo.lastMessage?.body)}</span>
                      </p>
                    ) : (
                      <p className={cn(
                        "text-[13px] truncate leading-relaxed",
                        isUnread ? "font-bold text-gray-900" : "font-medium text-gray-500"
                      )}>
                        {convo.lastMessage?.body || "No messages yet"}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-1.5">
                      {convo.status === "resolved" && (
                        <span className="text-[9px] uppercase font-black tracking-widest bg-green-50 text-green-600 px-1.5 py-0.5 rounded-sm">
                          Resolved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
