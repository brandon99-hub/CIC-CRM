import {
    User, Users, Briefcase, UserCheck, Shield, Landmark, UserCog, HelpCircle
} from "lucide-react";

// Shared color maps for stakeholder components
export const STAKEHOLDER_TYPE_COLORS: Record<string, string> = {
    individual_policyholder: "bg-blue-100 text-[#004E98]",
    sacco_cooperative: "bg-green-100 text-[#01a64e]",
    corporate_client: "bg-amber-100 text-[#D0AC01]",
    agent: "bg-purple-100 text-purple-700",
    broker: "bg-sky-100 text-sky-700",
    bancassurance_partner: "bg-rose-100 text-rose-800",
    staff: "bg-indigo-100 text-indigo-700",
    organization: "bg-cyan-100 text-cyan-700",
    department: "bg-teal-100 text-teal-700",
    other: "bg-gray-100 text-gray-700",
};

export const STAKEHOLDER_TYPE_ICONS: Record<string, any> = {
    individual_policyholder: User,
    sacco_cooperative: Users,
    corporate_client: Briefcase,
    agent: UserCheck,
    broker: Shield,
    bancassurance_partner: Landmark,
    staff: UserCog,
    organization: Briefcase,
    department: Briefcase,
    other: HelpCircle,
};
