
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
    Calendar, Phone, MessageSquare, ListCheck, AlertCircle, 
    Loader2, User, Building2, Target, TrendingUp, Plus, FileText,
    ClipboardList, PhoneCall, Bell, ChevronsUpDown, Search, X, Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const activitySchema = z.object({
    type: z.enum(['call', 'meeting', 'task', 'reminder']),
    subject: z.string().min(1, "Subject is required").max(200),
    description: z.string().optional(),
    dueDate: z.string().min(1, "Due date is required"),
    status: z.enum(['pending', 'completed']).default('pending'),
    reminderDate: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    leadId: z.string().optional(),
    prospectId: z.string().optional(),
    expectedOrderId: z.string().optional(),
    salesWonId: z.string().optional(),
    notificationType: z.enum(['email', 'sms', 'in-app']).optional(),
    isRecurring: z.boolean().default(false).optional(),
    recurrence: z.enum(['daily', 'weekly', 'monthly', 'none']).optional(),
});

type ActivityFormData = z.infer<typeof activitySchema>;

interface MarketingActivityFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    initialData?: any;
}

export function MarketingActivityForm({ isOpen, onClose, onSuccess, initialData }: MarketingActivityFormProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    
    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<ActivityFormData>({
        resolver: zodResolver(activitySchema),
        defaultValues: {
            type: 'task',
            status: 'pending',
            dueDate: new Date().toISOString().split('T')[0],
            startTime: '09:00',
            endTime: '10:00',
            notificationType: 'in-app',
            isRecurring: false,
            recurrence: 'daily'
        }
    });

    useEffect(() => {
        if (initialData) {
            let reminderVal = initialData.reminderDate || "";
            if (reminderVal) {
                if (['task', 'call', 'meeting'].includes(initialData.type)) {
                    if (reminderVal.includes('T')) {
                        reminderVal = reminderVal.split('T')[1].substring(0, 5);
                    } else if (reminderVal.includes(' ')) {
                        reminderVal = reminderVal.split(' ')[1].substring(0, 5);
                    } else if (reminderVal.length > 5) {
                        reminderVal = reminderVal.substring(0, 5);
                    }
                } else {
                    if (reminderVal.includes('T')) {
                        reminderVal = reminderVal.substring(0, 16);
                    }
                }
            }

            const cleanDate = initialData.dueDate 
                ? (initialData.type === 'task' 
                    ? (initialData.dueDate.includes('T') ? initialData.dueDate.substring(0, 16) : initialData.dueDate)
                    : initialData.dueDate.split('T')[0].split(' ')[0])
                : new Date().toISOString().split('T')[0];

            reset({
                ...initialData,
                dueDate: cleanDate,
                reminderDate: reminderVal,
                isRecurring: initialData.isRecurring || false,
                recurrence: initialData.recurrence || 'daily'
            });
            if (initialData.reminderDate) {
                setSetReminder(true);
            }
        } else {
            reset({
                type: 'task',
                status: 'pending',
                dueDate: new Date().toISOString().split('T')[0],
                startTime: '09:00',
                endTime: '10:00',
                notificationType: 'in-app',
                isRecurring: false,
                recurrence: 'daily'
            });
            setSetReminder(false);
        }
    }, [initialData, reset, isOpen]);

    // ── Stakeholders Fetch ──────────────────────────────────────────────────
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
        ...leads.map((l: any) => ({ 
            id: l.id, 
            name: l.client, 
            type: 'lead', 
            phone: l.contactNumber, 
            email: l.contactEmail,
            contactPerson: l.contactPerson, 
            customerType: l.customerType 
        })),
        ...prospects.map((p: any) => ({ 
            id: p.id, 
            name: p.client, 
            type: 'prospect', 
            phone: p.contactNumber, 
            email: p.contactEmail,
            contactPerson: p.contactPerson, 
            customerType: p.customerType 
        })),
        ...orders.map((o: any) => ({ 
            id: o.id, 
            name: o.organisationName, 
            type: 'expected_order', 
            phone: o.contactNumber, 
            email: o.contactEmail,
            contactPerson: o.contactPerson, 
            customerType: o.customerType || 'institution' 
        })),
        ...sales.map((s: any) => ({ 
            id: s.id, 
            name: s.organisationName, 
            type: 'sales_won', 
            phone: s.contactNumber, 
            email: s.contactEmail,
            contactPerson: s.contactPerson, 
            customerType: s.customerType || 'institution' 
        }))
    ];

    const selectedLeadId = watch("leadId");
    const selectedProspectId = watch("prospectId");
    const selectedExpectedOrderId = watch("expectedOrderId");
    const selectedSalesWonId = watch("salesWonId");

    const selectedId = selectedLeadId || selectedProspectId || selectedExpectedOrderId || selectedSalesWonId;
    const selectedStakeholder = stakeholders.find(s => s.id === selectedId);

    const [setReminder, setSetReminder] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [stakeholderDropdownOpen, setStakeholderDropdownOpen] = useState(false);
    const stakeholderContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (stakeholderContainerRef.current && !stakeholderContainerRef.current.contains(event.target as Node)) {
                setStakeholderDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const token = () => localStorage.getItem("marketingToken");

    const mutation = useMutation({
        mutationFn: async (data: ActivityFormData) => {
            const isEditing = !!initialData?.id;
            const url = isEditing ? `/api/marketing/activities/${initialData.id}` : "/api/marketing/activities";
            const method = isEditing ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token()}`
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || `Failed to ${isEditing ? 'update' : 'create'} activity`);
            }
            return res.json();
        },
        onSuccess: () => {
            const isEditing = !!initialData?.id;
            toast({ title: "Success", description: `Activity ${isEditing ? 'updated' : 'created'} successfully.` });
            queryClient.invalidateQueries({ queryKey: ["marketing", "activities"] });
            reset();
            onSuccess?.();
            onClose();
        },
        onError: (err: any) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    });

    const activityType = watch("type");

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[850px] p-0 border-0 shadow-2xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
                <div className="max-h-[92vh] overflow-y-auto custom-scrollbar flex flex-col">
                    {/* Header Section */}
                    <div className="p-8 pb-6 border-b border-gray-50">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-4">
                                <div className="bg-[#004E98]/10 p-3.5 rounded-[1.25rem]">
                                    <Plus className="h-7 w-7 text-[#004E98]" />
                                </div>
                                <div className="space-y-1">
                                    <DialogTitle className="text-3xl font-black text-gray-900 tracking-tight leading-none">
                                        {initialData ? 'Update Activity' : 'Log New Activity'}
                                    </DialogTitle>
                                    <DialogDescription className="text-gray-400 text-[11px] font-black uppercase tracking-[0.2em] mt-0.5">
                                        Track calls, meetings, tasks and follow-ups
                                    </DialogDescription>
                                </div>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="p-8 space-y-8 bg-gray-50/30">
                        {/* Activity Type Selection - Grid Style */}
                        <div className="space-y-4">
                            <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 ml-1">
                                <Target className="h-3.5 w-3.5 text-[#004E98]" /> Select Activity Type
                            </Label>
                            <Select 
                                value={activityType} 
                                onValueChange={(val) => setValue("type", val as any)}
                            >
                                <SelectTrigger className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6">
                                    <SelectValue placeholder="Choose activity type..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-0 shadow-2xl p-2">
                                    <SelectItem value="task" className="rounded-xl py-3 focus:bg-[#004E98]/5 focus:text-[#004E98]">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-[#004E98]/5 rounded-lg text-[#004E98]">
                                                <ClipboardList className="h-4 w-4" />
                                            </div>
                                            <span className="font-bold text-gray-900">Task / Todo</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="call" className="rounded-xl py-3 focus:bg-[#004E98]/5 focus:text-[#004E98]">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-[#004E98]/5 rounded-lg text-[#004E98]">
                                                <PhoneCall className="h-4 w-4" />
                                            </div>
                                            <span className="font-bold text-gray-900">Phone Call</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="meeting" className="rounded-xl py-3 focus:bg-[#004E98]/5 focus:text-[#004E98]">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-[#004E98]/5 rounded-lg text-[#004E98]">
                                                <Calendar className="h-4 w-4" />
                                            </div>
                                            <span className="font-bold text-gray-900">Meeting / Presentation</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <Label htmlFor="subject" className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 ml-1">
                                    <MessageSquare className="h-3.5 w-3.5 text-[#004E98]" /> Subject Title
                                </Label>
                                <Input 
                                    id="subject"
                                    {...register("subject")}
                                    placeholder="Brief summary of the activity..."
                                    className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6"
                                />
                                {errors.subject && <p className="text-[10px] font-bold text-red-500 uppercase ml-1">{errors.subject.message}</p>}
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="dueDate" className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 ml-1">
                                    <Calendar className="h-3.5 w-3.5 text-[#004E98]" /> 
                                    {activityType === 'call' ? 'Date' : activityType === 'meeting' ? 'Meeting Date' : activityType === 'task' ? 'Date & Time' : 'Due Date & Time'}
                                </Label>
                                <Input 
                                    key={activityType === 'task' ? 'task-date' : 'other-date'}
                                    id="dueDate"
                                    type={activityType === 'task' ? "datetime-local" : "date"}
                                    {...register("dueDate")}
                                    className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6"
                                />
                                {errors.dueDate && <p className="text-[10px] font-bold text-red-500 uppercase ml-1">{errors.dueDate.message}</p>}
                            </div>
                        </div>

                        {/* Meeting Times and Reminders */}
                        {['meeting', 'call'].includes(activityType) ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Column 1 (Left Column) */}
                                <div className="space-y-6">
                                    {/* Start & Due Time */}
                                    <div className="space-y-4">
                                        <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 ml-1">
                                            <Calendar className="h-3.5 w-3.5 text-[#004E98]" /> Start & Due Time
                                        </Label>
                                        <div className="flex gap-4">
                                            <div className="flex-1 space-y-2">
                                                <Input 
                                                    type="time"
                                                    {...register("startTime")}
                                                    className="h-12 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 rounded-xl px-4"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <Input 
                                                    type="time"
                                                    {...register("endTime")}
                                                    className="h-12 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 rounded-xl px-4"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Reminder Settings (Checkbox Only) */}
                                    <div className="space-y-4">
                                        <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 ml-1">
                                            <AlertCircle className="h-3.5 w-3.5 text-[#004E98]" /> Reminder Settings
                                        </Label>
                                        <div className="flex items-center gap-4 p-4 bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm">
                                            <input 
                                                type="checkbox"
                                                id="setReminder"
                                                checked={setReminder}
                                                onChange={(e) => setSetReminder(e.target.checked)}
                                                className="h-5 w-5 rounded-lg accent-[#004E98] cursor-pointer"
                                            />
                                            <Label htmlFor="setReminder" className="text-sm font-bold text-gray-600 cursor-pointer flex-1">
                                                Set a reminder for this activity
                                            </Label>
                                        </div>
                                    </div>
                                </div>

                                {/* Column 2 (Right Column) */}
                                <div className="space-y-6">
                                    {/* Notification Type */}
                                    <div className="space-y-4">
                                        <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 ml-1">
                                            <Bell className="h-3.5 w-3.5 text-[#004E98]" /> Notification Type
                                        </Label>
                                        <Select 
                                            onValueChange={(val) => setValue("notificationType", val as any)}
                                            defaultValue={watch("notificationType")}
                                        >
                                            <SelectTrigger className="h-12 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 rounded-xl px-4 focus:ring-2 focus:ring-[#004E98]/10 transition-all">
                                                <SelectValue placeholder="Choose notification type..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-0 shadow-2xl p-2 bg-white">
                                                <SelectItem value="email" className="rounded-lg py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                                                        <span className="text-[12px] font-bold">Email Notification</span>
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="sms" className="rounded-lg py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                                        <span className="text-[12px] font-bold">SMS Alert</span>
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="in-app" className="rounded-lg py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-purple-500" />
                                                        <span className="text-[12px] font-bold">In-App Notification</span>
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Reminder Date/Time Picker Dropdown (below notification type and to the right of reminder checkbox) */}
                                    {setReminder && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 ml-1">
                                                <AlertCircle className="h-3.5 w-3.5 text-[#004E98]" /> Reminder Time
                                            </Label>
                                            <Input 
                                                type={['task', 'call', 'meeting'].includes(activityType) ? "time" : "datetime-local"}
                                                {...register("reminderDate")}
                                                className="h-12 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 rounded-xl px-4"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            // Original layout for tasks
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 ml-1">
                                        <AlertCircle className="h-3.5 w-3.5 text-[#004E98]" /> Reminder Settings
                                    </Label>
                                    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm">
                                        <input 
                                            type="checkbox"
                                            id="setReminder"
                                            checked={setReminder}
                                            onChange={(e) => setSetReminder(e.target.checked)}
                                            className="h-5 w-5 rounded-lg accent-[#004E98] cursor-pointer"
                                        />
                                        <Label htmlFor="setReminder" className="text-sm font-bold text-gray-600 cursor-pointer flex-1">
                                            Set a reminder for this activity
                                        </Label>
                                    </div>
                                    {setReminder && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <Input 
                                                type={['task', 'call', 'meeting'].includes(activityType) ? "time" : "datetime-local"}
                                                {...register("reminderDate")}
                                                className="h-12 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 rounded-xl px-4"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 ml-1">
                                        <Bell className="h-3.5 w-3.5 text-[#004E98]" /> Notification Type
                                    </Label>
                                    <Select 
                                        onValueChange={(val) => setValue("notificationType", val as any)}
                                        defaultValue={watch("notificationType")}
                                    >
                                        <SelectTrigger className="h-12 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 rounded-xl px-4 focus:ring-2 focus:ring-[#004E98]/10 transition-all">
                                            <SelectValue placeholder="Choose notification type..." />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-0 shadow-2xl p-2 bg-white">
                                            <SelectItem value="email" className="rounded-lg py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                                                    <span className="text-[12px] font-bold">Email Notification</span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="sms" className="rounded-lg py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                                    <span className="text-[12px] font-bold">SMS Alert</span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="in-app" className="rounded-lg py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                                                    <span className="text-[12px] font-bold">In-App Notification</span>
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {/* Stakeholder Selection */}
                        {(activityType === 'meeting' || activityType === 'call') && (
                            <div className="space-y-4">
                                <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 ml-1">
                                    <User className="h-4 w-4 text-[#004E98]" /> Select Stakeholder
                                </Label>
                                <div className="relative w-full" ref={stakeholderContainerRef}>
                                    <button
                                        type="button"
                                        onClick={() => setStakeholderDropdownOpen(!stakeholderDropdownOpen)}
                                        className="w-full h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#004E98]/10 transition-all rounded-2xl px-6 flex items-center justify-between text-left cursor-pointer"
                                    >
                                        {selectedStakeholder ? (
                                            <div className="flex items-center gap-2 w-full pr-4 truncate">
                                                <span className="text-[13px] font-bold text-gray-900">{selectedStakeholder.name}</span>
                                                {selectedStakeholder.phone && (
                                                    <span className="text-[11px] text-gray-500 font-semibold flex items-center gap-1 ml-2 whitespace-nowrap">
                                                        <Phone className="h-3 w-3 text-[#004E98]" /> {selectedStakeholder.phone}
                                                    </span>
                                                )}
                                                {((selectedStakeholder.customerType && selectedStakeholder.customerType !== 'student') || ['expected_order', 'sales_won'].includes(selectedStakeholder.type)) && selectedStakeholder.contactPerson && (
                                                    <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1 ml-2 whitespace-nowrap">
                                                        <User className="h-3 w-3 text-[#004E98]" /> {selectedStakeholder.contactPerson}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 font-medium">Search or select a stakeholder...</span>
                                        )}
                                        <ChevronsUpDown className="h-4 w-4 text-gray-400 shrink-0" />
                                    </button>

                                    {stakeholderDropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-gray-100 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col">
                                            <div className="p-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
                                                <Search className="h-4 w-4 text-gray-400 ml-2" />
                                                <Input 
                                                    placeholder="Search stakeholders..." 
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="h-10 text-xs font-bold bg-transparent border-0 focus-visible:ring-0 shadow-none px-2 focus:ring-0"
                                                    autoFocus
                                                />
                                                {searchQuery && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSearchQuery("")}
                                                        className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="max-h-60 overflow-y-auto p-1.5 custom-scrollbar space-y-0.5 bg-white">
                                                {stakeholders.filter(s => s.name?.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                                                    <div className="py-6 text-center text-sm text-gray-400 italic">
                                                        No stakeholders found.
                                                    </div>
                                                ) : (
                                                    stakeholders
                                                        .filter(s => s.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                                                        .map((s) => {
                                                            const isB2B = (s.customerType && s.customerType !== 'student') || ['expected_order', 'sales_won'].includes(s.type);
                                                            const isSelected = selectedId === s.id;
                                                            return (
                                                                <button
                                                                    key={`${s.type}-${s.id}`}
                                                                    type="button"
                                                                    className={cn(
                                                                        "w-full flex items-center justify-between px-4 py-3 text-left rounded-xl transition-all cursor-pointer",
                                                                        isSelected ? "bg-[#004E98] text-white" : "hover:bg-slate-50 text-slate-700"
                                                                    )}
                                                                    onClick={() => {
                                                                        setValue("leadId", undefined);
                                                                        setValue("prospectId", undefined);
                                                                        setValue("expectedOrderId", undefined);
                                                                        setValue("salesWonId", undefined);

                                                                        if (s.type === 'lead') setValue("leadId", s.id);
                                                                        else if (s.type === 'prospect') setValue("prospectId", s.id);
                                                                        else if (s.type === 'expected_order') setValue("expectedOrderId", s.id);
                                                                        else if (s.type === 'sales_won') setValue("salesWonId", s.id);

                                                                        setStakeholderDropdownOpen(false);
                                                                        setSearchQuery("");
                                                                    }}
                                                                >
                                                                    <div className="flex flex-col gap-0.5 pr-4 truncate text-left">
                                                                        <span className={cn("text-xs font-black uppercase tracking-tight", isSelected ? "text-white" : "text-slate-800")}>
                                                                            {s.name}
                                                                        </span>
                                                                        {(s.phone || (isB2B && s.contactPerson)) && (
                                                                            <div className="flex items-center gap-3 text-[10px] font-bold mt-1">
                                                                                {isB2B && s.contactPerson && (
                                                                                    <span className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded-md", isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
                                                                                        <User className="h-2.5 w-2.5" /> {s.contactPerson}
                                                                                    </span>
                                                                                )}
                                                                                {s.phone && (
                                                                                    <span className={cn("flex items-center gap-1", isSelected ? "text-white/80" : "text-slate-400")}>
                                                                                        <Phone className="h-2.5 w-2.5" /> {s.phone}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {isSelected && <Check className="h-4 w-4 text-white shrink-0" />}
                                                                </button>
                                                            );
                                                        })
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Task Recurrence Options */}
                        {activityType === 'task' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 ml-1">
                                    <ClipboardList className="h-3.5 w-3.5 text-[#004E98]" /> Recurrence Options
                                </Label>
                                <div className="flex flex-col md:flex-row gap-6 items-center w-full">
                                    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm flex-1">
                                        <input 
                                            type="checkbox"
                                            id="isRecurring"
                                            checked={watch("isRecurring")}
                                            onChange={(e) => {
                                                setValue("isRecurring", e.target.checked);
                                                if (e.target.checked) {
                                                    setValue("recurrence", "daily");
                                                }
                                            }}
                                            className="h-5 w-5 rounded-lg accent-[#004E98] cursor-pointer"
                                        />
                                        <Label htmlFor="isRecurring" className="text-sm font-bold text-gray-600 cursor-pointer flex-1">
                                            Make this a recurring task
                                        </Label>
                                    </div>
                                    
                                    {watch("isRecurring") && (
                                        <div className="flex-1 w-full animate-in fade-in slide-in-from-left-2 duration-300">
                                            <Select 
                                                value={watch("recurrence") || "daily"}
                                                onValueChange={(val) => setValue("recurrence", val as any)}
                                            >
                                                <SelectTrigger className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 rounded-2xl px-6 text-left">
                                                    <SelectValue placeholder="Choose recurrence frequency..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-0 shadow-2xl p-2 bg-white">
                                                    <SelectItem value="daily" className="rounded-lg py-2.5">Daily Repeat</SelectItem>
                                                    <SelectItem value="weekly" className="rounded-lg py-2.5">Weekly Repeat</SelectItem>
                                                    <SelectItem value="monthly" className="rounded-lg py-2.5">Monthly Repeat</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Description Section - DNA style */}
                        <div className="space-y-3">
                            <Label htmlFor="description" className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-700 flex items-center gap-2 ml-1">
                                <FileText className="h-4 w-4 text-[#004E98]" /> Activity Description & Internal Notes
                            </Label>
                            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 relative group">
                                <Textarea 
                                    id="description"
                                    {...register("description")}
                                    placeholder="Enter detailed notes about the call or meeting..."
                                    className="bg-transparent border-0 focus-visible:ring-0 p-0 text-sm font-bold text-gray-900 resize-none min-h-[160px] leading-relaxed placeholder:text-slate-400"
                                />
                                <div className="absolute bottom-4 right-6 text-[9px] font-black text-slate-400 uppercase tracking-[2px]">Resolution Blueprint</div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between pt-4">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                className="font-black text-gray-400 uppercase tracking-widest text-[11px] hover:text-gray-900 hover:bg-gray-100 h-14 px-10 rounded-2xl transition-all"
                            >
                                Discard
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={mutation.isPending}
                                className="bg-[#004E98] hover:bg-[#003d7a] text-white font-black rounded-2xl shadow-xl shadow-blue-500/10 transition-all uppercase tracking-[0.15em] text-[12px] h-14 px-12 gap-3"
                            >
                                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                                Save Activity
                            </Button>
                        </div>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}
