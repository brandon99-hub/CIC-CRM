import {
    GraduationCap, Building, Briefcase, UserCheck, FileEdit, UserCog, HelpCircle,
    Handshake, Landmark, Megaphone, HeartHandshake, Globe, Store, Award
} from "lucide-react";

// Shared color maps for stakeholder components
export const STAKEHOLDER_TYPE_COLORS: Record<string, string> = {
    student: "bg-blue-100 text-[#004E98]",
    alumni: "bg-purple-100 text-purple-700",
    institution: "bg-green-100 text-[#01a64e]",
    employer: "bg-amber-100 text-[#D0AC01]",
    corporate_partner: "bg-blue-100 text-blue-800",
    government_agency: "bg-rose-100 text-rose-800",
    media: "bg-sky-100 text-sky-700",
    sponsor: "bg-pink-100 text-pink-700",
    international_student: "bg-teal-100 text-teal-800",
    vendor: "bg-orange-100 text-orange-800",
    organization: "bg-cyan-100 text-cyan-700",
    staff: "bg-indigo-100 text-indigo-700",
    department: "bg-teal-100 text-teal-700",
    other: "bg-gray-100 text-gray-700",
};

export const STAKEHOLDER_TYPE_ICONS: Record<string, any> = {
    student: GraduationCap,
    alumni: Award,
    institution: Building,
    employer: Briefcase,
    corporate_partner: Handshake,
    government_agency: Landmark,
    media: Megaphone,
    sponsor: HeartHandshake,
    international_student: Globe,
    vendor: Store,
    organization: Briefcase,
    staff: UserCog,
    department: Building,
    other: HelpCircle,
};
