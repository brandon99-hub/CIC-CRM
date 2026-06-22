import { Phone, Mail, Globe, MessageCircle, MessageSquare, Users, Bot, Facebook, Instagram, Linkedin, Smartphone, MessageSquareText } from "lucide-react";

export const CHANNELS = [
    "call",
    "email",
    "whatsapp",
    "live_chat",
    "chatbot",
    "facebook",
    "instagram",
    "linkedin",
    "tiktok",
    "website",
    "walk_in",
    "sms"
];

export const STATUSES = ["open", "pending_acceptance", "in_progress", "escalated", "resolved"];
export const PRIORITIES = ["low", "medium", "high", "critical"];

export const statusColors: Record<string, string> = {
    open: "bg-blue-100 text-blue-800",
    pending_acceptance: "bg-orange-100 text-orange-800 border-orange-200",
    in_progress: "bg-yellow-100 text-yellow-800",
    escalated: "bg-red-100 text-red-800",
    resolved: "bg-green-100 text-green-800",
};

export const priorityColors: Record<string, string> = {
    low: "bg-gray-100 text-gray-700",
    medium: "bg-blue-100 text-blue-700",
    high: "bg-orange-100 text-orange-700",
    critical: "bg-red-100 text-red-700",
};

export const slaStatusColors: Record<string, string> = {
    within: "bg-green-100 text-green-800",
    approaching: "bg-yellow-100 text-yellow-800",
    breached: "bg-red-100 text-red-800",
};

export const channelIcons: Record<string, React.ElementType> = {
    call: Phone,
    email: Mail,
    whatsapp: MessageCircle,
    live_chat: MessageSquare,
    chatbot: Bot,
    facebook: Facebook,
    instagram: Instagram,
    linkedin: Linkedin,
    tiktok: Smartphone, // fallback icon since lucide might not have tiktok
    website: Globe,
    walk_in: Users,
    sms: MessageSquareText,
};

export const formatLabel = (val: string) =>
    val ? val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Unknown";

export const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" });

export const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-KE", {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

export const getTimeRemaining = (deadline: string | null): { text: string; status: string } => {
    if (!deadline) return { text: "N/A", status: "within" };
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return { text: "Breached", status: "breached" };
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours < 2) return { text: `${hours}h ${minutes}m`, status: "approaching" };
    if (hours < 24) return { text: `${hours}h`, status: hours < 4 ? "approaching" : "within" };
    const days = Math.floor(hours / 24);
    return { text: `${days}d ${hours % 24}h`, status: "within" };
};

/** Evaluates a single SLA timer (response or resolution) considering completion */
export const getDeadlineStatus = (
    deadline: string | null,
    completedAt: string | null | undefined,
    fallbackMinutes?: number,
    createdAt?: string
): { text: string; status: "completed" | "breached" | "approaching" | "within" | "none" } => {
    // Calculate effective deadline: from DB or fallback using rule minutes + createdAt
    const effectiveDeadline = deadline ||
        (fallbackMinutes && createdAt
            ? new Date(new Date(createdAt).getTime() + fallbackMinutes * 60000).toISOString()
            : null);

    if (!effectiveDeadline) return { text: "No Deadline", status: "none" };

    if (completedAt) {
        // Check if it was completed before or after deadline
        const wasBreached = new Date(completedAt).getTime() > new Date(effectiveDeadline).getTime();
        return wasBreached
            ? { text: "Breached", status: "breached" }
            : { text: "Completed", status: "completed" };
    }

    const diff = new Date(effectiveDeadline).getTime() - Date.now();
    if (diff <= 0) return { text: "Breached", status: "breached" };

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours < 4) return { text: hours < 1 ? `${minutes}m` : `${hours}h ${minutes}m`, status: "approaching" };
    if (hours < 24) return { text: `${hours}h ${minutes}m`, status: "within" };
    const days = Math.floor(hours / 24);
    return { text: `${days}d ${hours % 24}h`, status: "within" };
};
