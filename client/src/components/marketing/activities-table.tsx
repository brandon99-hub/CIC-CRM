import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
    Calendar, Phone, MessageSquare, ListCheck, MoreVertical, 
    Search, Filter, Plus, Clock, User, CheckCircle2, 
    Circle, AlertCircle, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, isToday } from "date-fns";
import { MarketingUser } from "@/types/marketing-types";
import { MarketingActivityForm } from "./activity-form";
import { MarketingPageHeader } from "./marketing-page-header";


interface Activity {
    id: string;
    type: string;
    subject: string;
    description: string;
    dueDate: string;
    status: string;
    marketerId: string;
    bdName: string;
    createdAt: string;
    leadId?: string;
    prospectId?: string;
    expectedOrderId?: string;
    salesWonId?: string;
    startTime?: string;
    endTime?: string;
    reminderDate?: string;
    notificationType?: string;
}

interface MarketingActivitiesTableProps {
    currentUser: MarketingUser;
    showMarketerInfo: boolean;
}

export function MarketingActivitiesTable({ 
    currentUser, 
    showMarketerInfo 
}: MarketingActivitiesTableProps) {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const { toast } = useToast();

    const queryClient = useQueryClient();

    const token = () => localStorage.getItem("marketingToken");

    const { data: activities = [], isLoading } = useQuery<Activity[]>({
        queryKey: ["marketing", "activities"],
        queryFn: async () => {
            const res = await fetch("/api/marketing/activities", {
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (!res.ok) throw new Error("Failed to fetch activities");
            return res.json();
        }
    });
    const { data: leadsData } = useQuery({
        queryKey: ["marketing", "leads"],
        queryFn: async () => {
            const res = await fetch("/api/marketing/leads?limit=100", {
                headers: { Authorization: `Bearer ${token()}` }
            });
            return res.json();
        }
    });

    const { data: prospectsData } = useQuery({
        queryKey: ["marketing", "prospects"],
        queryFn: async () => {
            const res = await fetch("/api/marketing/prospects?limit=100", {
                headers: { Authorization: `Bearer ${token()}` }
            });
            return res.json();
        }
    });

    const { data: ordersData } = useQuery({
        queryKey: ["marketing", "expected-orders"],
        queryFn: async () => {
            const res = await fetch("/api/marketing/expected-orders?limit=100", {
                headers: { Authorization: `Bearer ${token()}` }
            });
            return res.json();
        }
    });

    const { data: salesData } = useQuery({
        queryKey: ["marketing", "sales-won"],
        queryFn: async () => {
            const res = await fetch("/api/marketing/sales-won?limit=100", {
                headers: { Authorization: `Bearer ${token()}` }
            });
            return res.json();
        }
    });

    const leads = leadsData?.leads || [];
    const prospects = prospectsData?.prospects || [];
    const orders = ordersData?.expectedOrders || [];
    const sales = salesData?.salesWon || [];

    const stakeholders = [
        ...leads.map((l: any) => ({ id: l.id, name: l.client, type: 'lead', phone: l.contactNumber, email: l.contactEmail })),
        ...prospects.map((p: any) => ({ id: p.id, name: p.client, type: 'prospect', phone: p.contactNumber, email: p.contactEmail })),
        ...orders.map((o: any) => ({ id: o.id, name: o.organisationName, type: 'expected_order', phone: o.contactNumber, email: o.contactEmail })),
        ...sales.map((s: any) => ({ id: s.id, name: s.organisationName, type: 'sales_won', phone: s.contactNumber, email: s.contactEmail }))
    ];

    const getStakeholderInfo = (act: Activity) => {
        const id = act.leadId || act.prospectId || act.expectedOrderId || act.salesWonId;
        if (!id) return null;
        return stakeholders.find(s => s.id === id) || null;
    };
    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string, status: string }) => {
            const res = await fetch(`/api/marketing/activities/${id}`, {
                method: "PATCH",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token()}` 
                },
                body: JSON.stringify({ status })
            });
            if (!res.ok) throw new Error("Failed to update status");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Updated", description: "Activity status updated." });
            queryClient.invalidateQueries({ queryKey: ["marketing", "activities"] });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/marketing/activities/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (!res.ok) throw new Error("Failed to delete activity");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Deleted", description: "Activity removed successfully." });
            queryClient.invalidateQueries({ queryKey: ["marketing", "activities"] });
        },
        onError: (error: any) => {
            toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
        }
    });

    const filteredActivities = activities.filter(act => {
        const matchesSearch = act.subject.toLowerCase().includes(search.toLowerCase()) || 
                             (act.description?.toLowerCase().includes(search.toLowerCase()));
        const matchesType = typeFilter === "all" || act.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'call': return <Phone className="h-4 w-4 text-blue-500" />;
            case 'meeting': return <Calendar className="h-4 w-4 text-purple-500" />;
            case 'task': return <ListCheck className="h-4 w-4 text-orange-500" />;
            case 'reminder': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
            default: return <MessageSquare className="h-4 w-4 text-gray-500" />;
        }
    };

    const getStatusBadge = (status: string, dueDate: string) => {
        if (status === 'completed') {
            return (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-none text-[9px] font-black uppercase tracking-widest gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Done
                </Badge>
            );
        }
        
        const isOverdue = dueDate && isPast(new Date(dueDate)) && !isToday(new Date(dueDate));
        if (isOverdue) {
            return (
                <Badge variant="outline" className="bg-red-50 text-red-600 border-none text-[9px] font-black uppercase tracking-widest gap-1">
                    <AlertCircle className="h-2.5 w-2.5" /> Overdue
                </Badge>
            );
        }

        return (
            <Badge variant="outline" className="bg-blue-50 text-blue-600 border-none text-[9px] font-black uppercase tracking-widest gap-1">
                <Circle className="h-2.5 w-2.5 text-blue-400" /> Pending
            </Badge>
        );
    };

    return (
        <div className="space-y-4">
            <MarketingPageHeader
                title="My Activities"
                subtitle="Track and manage your tasks, calls, and meetings"
                icon={Calendar}
                actionButton={{
                    label: "Log Activity",
                    onClick: () => setIsFormOpen(true),
                    icon: Plus
                }}
                searchValue={search}
                onSearchChange={setSearch}
            />

            {/* Custom Premium Tab Selector */}
            <div className="flex border-b border-gray-100 mb-6 gap-6 pt-2">
                {[
                    { id: 'all', label: 'All Activities', icon: ListCheck, count: activities.length },
                    { id: 'call', label: 'Phone Calls', icon: Phone, count: activities.filter(a => a.type === 'call').length },
                    { id: 'meeting', label: 'Meetings', icon: Calendar, count: activities.filter(a => a.type === 'meeting').length },
                    { id: 'task', label: 'Tasks & Todos', icon: ListCheck, count: activities.filter(a => a.type === 'task').length }
                ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = typeFilter === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setTypeFilter(tab.id)}
                            className={cn(
                                "flex items-center gap-2 pb-4 border-b-2 font-black uppercase tracking-wider text-[11px] transition-all relative cursor-pointer",
                                isActive 
                                    ? "border-[#004E98] text-[#004E98]" 
                                    : "border-transparent text-gray-400 hover:text-gray-600"
                            )}
                        >
                            <Icon className={cn("h-4 w-4", isActive ? "text-[#004E98]" : "text-gray-400")} />
                            {tab.label}
                            <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-black leading-none ml-1",
                                isActive ? "bg-[#004E98]/10 text-[#004E98]" : "bg-gray-100 text-gray-400"
                            )}>
                                {tab.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            <MarketingActivityForm
                isOpen={isFormOpen}
                onClose={() => {
                    setIsFormOpen(false);
                    setEditingActivity(null);
                }}
                initialData={editingActivity}
            />

            <div className="bg-white rounded-3xl border-none shadow-sm overflow-hidden ring-1 ring-black/[0.03]">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        {typeFilter === 'call' ? (
                            <TableRow className="border-b-gray-100 hover:bg-transparent">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 py-4 pl-6">Call Subject</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Call Date</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Call Time</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Stakeholder</TableHead>
                                {showMarketerInfo && (
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Marketer</TableHead>
                                )}
                                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-gray-400 pr-6">Actions</TableHead>
                            </TableRow>
                        ) : typeFilter === 'meeting' ? (
                            <TableRow className="border-b-gray-100 hover:bg-transparent">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 py-4 pl-6">Meeting Subject</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Meeting Date</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Meeting Time</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Stakeholder</TableHead>
                                {showMarketerInfo && (
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Marketer</TableHead>
                                )}
                                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-gray-400 pr-6">Actions</TableHead>
                            </TableRow>
                        ) : typeFilter === 'task' ? (
                            <TableRow className="border-b-gray-100 hover:bg-transparent">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 py-4 pl-6">Task Subject</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Due Date</TableHead>
                                {showMarketerInfo && (
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Marketer</TableHead>
                                )}
                                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-gray-400 pr-6">Actions</TableHead>
                            </TableRow>
                        ) : (
                            <TableRow className="border-b-gray-100 hover:bg-transparent">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 py-4 pl-6">Activity</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Type</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Date & Time</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Stakeholder</TableHead>
                                {showMarketerInfo && (
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Marketer</TableHead>
                                )}
                                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-gray-400 pr-6">Actions</TableHead>
                            </TableRow>
                        )}
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [1, 2, 3].map(i => (
                                <TableRow key={i} className="animate-pulse border-b-gray-50">
                                    <TableCell colSpan={8} className="py-8"><div className="h-4 bg-gray-100 rounded w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredActivities.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="py-20 text-center">
                                    <ListCheck className="h-10 w-10 text-gray-200 mx-auto mb-4" />
                                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No activities found</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredActivities.map((act) => {
                                const s = getStakeholderInfo(act);
                                return (
                                    <TableRow key={act.id} className="border-b-gray-50 hover:bg-gray-50/30 transition-colors group">
                                        {/* Subject Column */}
                                        <TableCell className="py-4 pl-6">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white transition-colors">
                                                    {getTypeIcon(act.type)}
                                                </div>
                                                <div>
                                                    <p className="text-[13px] font-black text-gray-900 leading-none">{act.subject}</p>
                                                    <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tight line-clamp-1">{act.description}</p>
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Type Column (for 'all' view only) */}
                                        {typeFilter === 'all' && (
                                            <TableCell>
                                                <Badge variant="outline" className="bg-gray-50 text-gray-600 border-none text-[9px] font-black uppercase tracking-widest">
                                                    {act.type}
                                                </Badge>
                                            </TableCell>
                                        )}

                                        {/* Status Column */}
                                        <TableCell>
                                            {getStatusBadge(act.status, act.dueDate)}
                                        </TableCell>

                                        {/* Call / Meeting tailored Date Column */}
                                        {['call', 'meeting'].includes(typeFilter) ? (
                                            <>
                                                <TableCell>
                                                    <span className="text-[11px] font-bold text-gray-900 flex items-center gap-1.5 whitespace-nowrap">
                                                        <Clock className="h-3 w-3 text-gray-300" /> {act.dueDate ? format(new Date(act.dueDate), "MMM d, yyyy") : 'No date'}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-[9px] font-black text-[#004E98] uppercase tracking-wider bg-blue-50/50 px-1.5 py-0.5 rounded-md w-fit whitespace-nowrap">
                                                        {act.startTime ? `${act.startTime} - ${act.endTime || 'TBD'}` : 'N/A'}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {s ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-black text-gray-700 uppercase flex items-center gap-1.5">
                                                                <User className="h-3 w-3 text-[#004E98]" /> {s.name}
                                                            </span>
                                                            {typeFilter === 'call' && s.phone && (
                                                                <span className="text-[9px] font-bold text-gray-500 mt-0.5 ml-4.5 flex items-center gap-1">
                                                                    <Phone className="h-2.5 w-2.5 text-blue-500" /> {s.phone}
                                                                </span>
                                                            )}
                                                            {typeFilter === 'meeting' && s.email && (
                                                                <span className="text-[9px] font-bold text-gray-500 mt-0.5 ml-4.5 flex items-center gap-1 lowercase">
                                                                    <Clock className="h-2.5 w-2.5 text-purple-500" /> {s.email}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] font-bold text-gray-400">N/A</span>
                                                    )}
                                                </TableCell>
                                            </>
                                        ) : typeFilter === 'task' ? (
                                            /* Task tailored Columns */
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-bold text-gray-900 flex items-center gap-1.5 whitespace-nowrap">
                                                        <Clock className="h-3 w-3 text-gray-300" /> {act.dueDate ? format(new Date(act.dueDate), "MMM d, yyyy") : 'No date'}
                                                    </span>
                                                    <span className="text-[9px] font-black text-[#004E98] mt-0.5 uppercase tracking-wider ml-4.5 bg-blue-50/50 px-1.5 py-0.5 rounded-md w-fit">
                                                        {format(new Date(act.dueDate), "h:mm a")}
                                                    </span>
                                                </div>
                                            </TableCell>
                                        ) : (
                                            /* 'All' default Columns */
                                            <>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold text-gray-900 flex items-center gap-1.5 whitespace-nowrap">
                                                            <Clock className="h-3 w-3 text-gray-300" /> {act.dueDate ? format(new Date(act.dueDate), "MMM d, yyyy") : 'No date'}
                                                        </span>
                                                        {(act.startTime || act.type === 'task') && (
                                                            <span className="text-[9px] font-black text-[#004E98] mt-0.5 uppercase tracking-wider ml-4.5 bg-blue-50/50 px-1.5 py-0.5 rounded-md w-fit">
                                                                {act.type === 'task' ? format(new Date(act.dueDate), "h:mm a") : `${act.startTime} - ${act.endTime || 'TBD'}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {s ? (
                                                        <span className="text-[11px] font-black text-gray-700 uppercase flex items-center gap-1.5">
                                                            <User className="h-3 w-3 text-[#004E98]" /> {s.name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] font-bold text-gray-400">N/A</span>
                                                    )}
                                                </TableCell>
                                            </>
                                        )}

                                        {/* Marketer Column */}
                                        {showMarketerInfo && (
                                            <TableCell>
                                                <span className="text-[11px] font-black text-[#004E98] flex items-center gap-1.5 uppercase">
                                                    <User className="h-3 w-3" /> {act.bdName}
                                                </span>
                                            </TableCell>
                                        )}

                                        {/* Actions Column */}
                                        <TableCell className="text-right pr-6">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-white">
                                                        <MoreVertical className="h-4 w-4 text-gray-400" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 rounded-2xl border-none shadow-2xl p-2 ring-1 ring-black/5 bg-white/95 backdrop-blur-md">
                                                    <DropdownMenuItem 
                                                        className="text-[10px] font-black uppercase tracking-tight py-2 px-3 rounded-xl focus:bg-blue-50 focus:text-blue-700 cursor-pointer gap-2"
                                                        onClick={() => {
                                                            setEditingActivity(act);
                                                            setIsFormOpen(true);
                                                        }}
                                                    >
                                                        <Plus className="h-3.5 w-3.5" /> Edit Activity
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        className="text-[10px] font-black uppercase tracking-tight py-2 px-3 rounded-xl focus:bg-emerald-50 focus:text-emerald-700 cursor-pointer gap-2"
                                                        onClick={() => updateStatusMutation.mutate({ id: act.id, status: 'completed' })}
                                                        disabled={act.status === 'completed'}
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Done
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        className="text-[10px] font-black uppercase tracking-tight py-2 px-3 rounded-xl focus:bg-red-50 focus:text-red-700 cursor-pointer gap-2"
                                                        onClick={() => deleteMutation.mutate(act.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}
