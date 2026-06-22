import { Fragment, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, AlertCircle, QrCode, ExternalLink, Calendar, MapPin, DollarSign, Users, Clock, MoreVertical } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Campaign {
    id: string;
    name: string;
    type: string;
    channel: string;
    status: string;
    subject?: string;
    content?: string;
    scheduledAt?: string;
    targetAudience?: any;
    totalRecipients?: number;
    delivered?: number;
    opened?: number;
    clicked?: number;
    bounced?: number;
    budget?: string | number;
    actualCost?: string | number;
    ctaUrl?: string;
    expectedCapacity?: number | string;
    venue?: string;
    eventDate?: string;
    registrationSlug?: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

interface CampaignForm {
    name: string;
    type: string;
    channel: string;
    subject: string;
    content: string;
    status: string;
    scheduledAt?: string;
    targetAudience?: any;
    budget?: string | number;
    actualCost?: string | number;
    ctaUrl?: string;
}

interface CampaignsTabProps {
    campaigns: Campaign[];
    pagination?: Pagination;
    onPageChange?: (page: number) => void;
    onOpenModal: (campaign?: Campaign) => void;
    onDelete: (id: string) => void;
    onViewIssues?: (id: string, name: string) => void;
    isEventView?: boolean;
}

export function CampaignsTab({ campaigns, pagination, onPageChange, onOpenModal, onDelete, onViewIssues, isEventView }: CampaignsTabProps) {
    const [selectedQrEvent, setSelectedQrEvent] = useState<{ url: string; name: string } | null>(null);

    const generatePDFQRCode = async (regUrl: string, eventName: string) => {
        try {
            // Generate clean high-resolution local QR code
            const qrDataUrl = await QRCode.toDataURL(regUrl, {
                errorCorrectionLevel: 'H',
                margin: 2,
                scale: 10,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });

            // Setup A4 PDF Document
            const doc = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4"
            });

            // 1. Top Banner (Deep Royal Blue)
            doc.setFillColor(0, 78, 152);
            doc.rect(15, 15, 180, 50, "F");

            // Banner Texts
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(255, 255, 255);
            doc.text("KASNEB CUSTOMER RELATIONSHIP MANAGEMENT", 105, 28, { align: "center" });

            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.text("OFFICIAL REGISTRATION PORTAL", 105, 42, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            doc.setTextColor(200, 220, 255);
            doc.text("Scan the QR code below using your mobile device to join the event", 105, 52, { align: "center" });

            // 2. Event Title Box
            doc.setFillColor(248, 250, 252);
            doc.rect(15, 75, 180, 28, "F");
            doc.setDrawColor(226, 232, 240);
            doc.rect(15, 75, 180, 28, "D");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(13);
            doc.setTextColor(15, 23, 42);
            doc.text(eventName.toUpperCase(), 105, 91, { align: "center" });

            // 3. QR Code Area
            doc.setDrawColor(148, 163, 184);
            doc.rect(50, 115, 110, 110, "D");
            doc.addImage(qrDataUrl, "PNG", 55, 120, 100, 100);

            // 4. Detailed Scan Instructions
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text("SCANNING INSTRUCTIONS", 105, 242, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            doc.setTextColor(71, 85, 105);
            doc.text("1. Open the Camera app or a dedicated QR code scanner on your smartphone.", 105, 252, { align: "center" });
            doc.text("2. Point your camera at the QR code above until a notification link appears.", 105, 259, { align: "center" });
            doc.text("3. Tap the link to open the KASNEB Registration portal and submit your details.", 105, 266, { align: "center" });

            // 5. Divider Line & Branded Footer
            doc.setDrawColor(241, 245, 249);
            doc.line(15, 276, 195, 276);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(148, 163, 184);
            doc.text("POWERED BY KASNEB CRM MARKETING SYSTEM", 105, 284, { align: "center" });

            // Direct local PDF download trigger
            doc.save(`KASNEB_Event_Registration_${eventName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
        } catch (error) {
            console.error("PDF generation failed:", error);
        }
    };

    // Event calculations
    const isEventPassed = (c: any) => {
        if (!c.eventDate) return false;
        const datePart = c.eventDate.split('T')[0];
        const endTime = c.targetAudience?.eventEndTime || "23:59";
        const eventEndDateTime = new Date(`${datePart}T${endTime}`);
        return eventEndDateTime.getTime() < Date.now();
    };

    const activeEvents = campaigns.filter(c => !isEventPassed(c));

    const totalBudget = activeEvents.reduce((acc, c) => acc + (c.budget ? parseFloat(c.budget.toString()) : 0), 0);
    const totalSpent = campaigns.reduce((acc, c) => acc + (c.actualCost ? parseFloat(c.actualCost.toString()) : 0), 0);
    const totalExpected = activeEvents.reduce((acc, c) => acc + (c.expectedCapacity ? Number(c.expectedCapacity) : 0), 0);

    // Digital stats
    const totalDelivered = campaigns.reduce((acc, c) => acc + (c.delivered || 0), 0);
    const avgOpenRate = campaigns.length > 0 
        ? Math.round((campaigns.reduce((acc, c) => acc + (c.opened || 0), 0) / (campaigns.reduce((acc, c) => acc + (c.delivered || 1), 0) || 1)) * 100) 
        : 0;
    const avgClickRate = campaigns.length > 0 
        ? Math.round((campaigns.reduce((acc, c) => acc + (c.clicked || 0), 0) / (campaigns.reduce((acc, c) => acc + (c.opened || 1), 0) || 1)) * 100) 
        : 0;

    return (
        <div className="space-y-6">

            {isEventView ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="rounded-2xl border-gray-100 shadow-sm">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-black text-[#004E98]">{activeEvents.length}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1 flex items-center justify-center gap-1">
                                <Calendar className="h-3 w-3" /> Active Events
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-gray-100 shadow-sm">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-black text-[#01a64e]">{totalExpected.toLocaleString()}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1 flex items-center justify-center gap-1">
                                <Users className="h-3 w-3" /> Expected Attendees
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-gray-100 shadow-sm">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-black text-[#D0AC01]">KES {totalBudget.toLocaleString()}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1 flex items-center justify-center gap-1">
                                <DollarSign className="h-3 w-3" /> Allocated Budget
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-gray-100 shadow-sm">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-black text-[#e55f00]">KES {totalSpent.toLocaleString()}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1 flex items-center justify-center gap-1">
                                <DollarSign className="h-3 w-3" /> Actual Cost spent
                            </p>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="rounded-2xl border-gray-100 shadow-sm">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-black text-[#004E98]">{pagination?.total || campaigns.length}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Total Campaigns</p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-gray-100 shadow-sm">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-black text-[#01a64e]">{totalDelivered.toLocaleString()}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Delivered</p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-gray-100 shadow-sm">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-black text-[#D0AC01]">{avgOpenRate}%</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Avg Open Rate</p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-gray-100 shadow-sm">
                        <CardContent className="p-4 text-center">
                            <p className="text-2xl font-black text-[#e55f00]">{avgClickRate}%</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Avg Click Rate</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            {isEventView ? (
                                <TableRow>
                                    <TableHead>Event Name</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Time Range</TableHead>
                                    <TableHead>Budget</TableHead>
                                    <TableHead>Actual Cost</TableHead>
                                    <TableHead>Audience</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            ) : (
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Channel</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Scheduled / Sent</TableHead>
                                    <TableHead>Audience</TableHead>
                                    <TableHead>Recipients</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            )}
                        </TableHeader>
                        <TableBody>
                            {campaigns.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                        No {isEventView ? "events" : "campaigns"} yet. Create your first {isEventView ? "event" : "campaign"}.
                                    </TableCell>
                                </TableRow>
                            ) : campaigns.map((campaign) => (
                                <TableRow key={campaign.id}>
                                    {isEventView ? (
                                        <>
                                            <TableCell className="font-medium">{campaign.name}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-gray-600">
                                                    <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                                    <span className="text-xs font-semibold truncate max-w-[150px]">{campaign.venue || "TBD"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-gray-600">
                                                    <Calendar className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                                    <span className="text-xs font-semibold">{campaign.eventDate ? new Date(campaign.eventDate).toLocaleDateString() : "TBD"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-gray-600">
                                                    <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                                    <span className="text-xs font-semibold">{campaign.targetAudience?.eventStartTime || "TBD"} - {campaign.targetAudience?.eventEndTime || "TBD"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-semibold text-gray-900">
                                                {campaign.budget ? `KES ${Number(campaign.budget).toLocaleString()}` : "—"}
                                            </TableCell>
                                            <TableCell className="font-semibold text-gray-900">
                                                {campaign.actualCost ? `KES ${Number(campaign.actualCost).toLocaleString()}` : "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="text-[10px] uppercase font-black bg-[#004E98]/5 text-[#004E98] border border-[#004E98]/10 px-2 py-0.5">
                                                    {campaign.targetAudience?.stakeholderType || 'all'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-slate-100 transition-colors">
                                                                <MoreVertical className="h-4 w-4 text-slate-500" />
                                                                <span className="sr-only">Open menu</span>
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-xl border border-gray-100 bg-white">
                                                            <DropdownMenuItem onClick={() => onOpenModal(campaign)} className="rounded-xl py-2.5 px-3 focus:bg-[#004E98]/5 text-slate-700 flex items-center gap-2 cursor-pointer font-semibold transition-colors">
                                                                <Pencil className="h-4 w-4 text-slate-400" />
                                                                <span>Edit Event</span>
                                                            </DropdownMenuItem>

                                                            {campaign.registrationSlug && (
                                                                <>
                                                                    <DropdownMenuItem 
                                                                        onClick={() => {
                                                                            const regUrl = `${window.location.origin}/events/register/${campaign.registrationSlug}`;
                                                                            window.open(regUrl, '_blank');
                                                                        }}
                                                                        className="rounded-xl py-2.5 px-3 focus:bg-[#004E98]/5 text-slate-700 flex items-center gap-2 cursor-pointer font-semibold transition-colors"
                                                                    >
                                                                        <ExternalLink className="h-4 w-4 text-slate-400" />
                                                                        <span>Desk Registration</span>
                                                                    </DropdownMenuItem>

                                                                    <DropdownMenuItem 
                                                                        onClick={() => {
                                                                            const regUrl = `${window.location.origin}/events/register/${campaign.registrationSlug}`;
                                                                            generatePDFQRCode(regUrl, campaign.name);
                                                                        }}
                                                                        className="rounded-xl py-2.5 px-3 focus:bg-[#004E98]/5 text-slate-700 flex items-center gap-2 cursor-pointer font-semibold transition-colors"
                                                                    >
                                                                        <QrCode className="h-4 w-4 text-slate-400" />
                                                                        <span>QR Code PDF Flyer</span>
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}

                                                            {onViewIssues && (
                                                                <DropdownMenuItem onClick={() => onViewIssues(campaign.id, campaign.name)} className="rounded-xl py-2.5 px-3 focus:bg-[#004E98]/5 text-slate-700 flex items-center gap-2 cursor-pointer font-semibold transition-colors">
                                                                    <AlertCircle className="h-4 w-4 text-slate-400" />
                                                                    <span>Event Desk</span>
                                                                </DropdownMenuItem>
                                                            )}

                                                            <DropdownMenuSeparator className="my-1 border-slate-50" />

                                                            <DropdownMenuItem onClick={() => onDelete(campaign.id)} className="rounded-xl py-2.5 px-3 text-red-600 focus:bg-red-50/50 focus:text-red-600 flex items-center gap-2 cursor-pointer font-semibold transition-colors">
                                                                <Trash2 className="h-4 w-4 text-red-500" />
                                                                <span>Delete Event</span>
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </>
                                    ) : (
                                        <>
                                            <TableCell className="font-medium">{campaign.name}</TableCell>
                                            <TableCell><Badge variant="outline">{campaign.type}</Badge></TableCell>
                                            <TableCell>
                                                <Badge className={campaign.channel === "email" ? "bg-[#004E98]" : campaign.channel === "sms" ? "bg-[#01a64e]" : "bg-[#e55f00]"}>
                                                    {campaign.channel}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={campaign.status === "sent" ? "bg-[#01a64e]" : campaign.status === "draft" ? "bg-gray-400" : "bg-[#004E98] animate-pulse"}>
                                                    {campaign.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs space-y-1">
                                                    {campaign.scheduledAt && (
                                                        <p className="text-gray-500 italic">{new Date(campaign.scheduledAt).toLocaleString()}</p>
                                                    )}
                                                    {campaign.status === 'sent' && campaign.id && (
                                                        <p className="font-medium text-[#01a64e]">Sent</p>
                                                    )}
                                                    {!campaign.scheduledAt && campaign.status !== 'sent' && (
                                                        <p className="text-gray-400">Not set</p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <Badge variant="secondary" className="text-[10px] uppercase font-black bg-[#004E98]/5 text-[#004E98] border border-[#004E98]/10 px-2 py-0.5">
                                                        {campaign.targetAudience?.segment || 'All'}
                                                    </Badge>
                                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider pl-1">
                                                        Type: {campaign.targetAudience?.stakeholderType || 'all'}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-black text-gray-900">{campaign.totalRecipients || 0}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => onOpenModal(campaign)}><Pencil className="h-4 w-4" /></Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-500 text-gray-400 transition-colors" onClick={() => onDelete(campaign.id)}><Trash2 className="h-4 w-4" /></Button>
                                                </div>
                                            </TableCell>
                                        </>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>

                {pagination && pagination.pages > 1 && (
                    <div className="p-4 border-t flex items-center justify-between bg-gray-50/30">
                        <p className="text-xs text-gray-500 font-medium tracking-tight">
                            Showing <span className="font-bold text-gray-900">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="font-bold text-gray-900">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-bold text-gray-900">{pagination.total}</span> campaigns
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                                onClick={() => onPageChange?.(pagination.page - 1)}
                                disabled={pagination.page <= 1}
                            >
                                Previous
                            </Button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
                                    const pageNum = i + 1;
                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={pagination.page === pageNum ? "default" : "outline"}
                                            size="sm"
                                            className={cn(
                                                "h-8 w-8 rounded-lg text-[10px] font-black transition-all active:scale-95",
                                                pagination.page === pageNum ? "bg-[#004E98] text-white shadow-lg shadow-blue-900/20" : "text-gray-500 hover:bg-gray-100"
                                            )}
                                            onClick={() => onPageChange?.(pageNum)}
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                                onClick={() => onPageChange?.(pagination.page + 1)}
                                disabled={pagination.page >= pagination.pages}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}

            </Card>

            {selectedQrEvent && (
                <Dialog open={!!selectedQrEvent} onOpenChange={() => setSelectedQrEvent(null)}>
                    <DialogContent className="rounded-3xl border-0 shadow-2xl p-8 max-w-sm mx-auto text-center space-y-6 bg-white animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center justify-center space-y-4">
                            <div className="bg-[#004E98]/10 p-3 rounded-2xl text-[#004E98]">
                                <QrCode className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-black text-gray-900 leading-tight">Event Registration QR</DialogTitle>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">{selectedQrEvent.name}</p>
                            </div>
                        </div>
                        
                        <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex items-center justify-center shadow-inner">
                            <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selectedQrEvent.url)}`}
                                alt="Event Registration QR"
                                className="w-48 h-48 rounded-xl object-contain bg-white p-2 shadow-sm"
                            />
                        </div>

                        <p className="text-[11px] text-gray-400 font-medium max-w-[240px] mx-auto">
                            Scan this QR code with any mobile device to open the physical event registration portal instantly.
                        </p>

                        <div className="flex gap-2 pt-2">
                            <Button 
                                className="flex-1 rounded-xl h-11 font-bold bg-[#004E98] hover:bg-[#003B75] text-white"
                                onClick={() => window.open(selectedQrEvent.url, '_blank')}
                            >
                                Open Portal
                            </Button>
                            <Button 
                                variant="outline"
                                className="rounded-xl h-11 font-bold flex-1"
                                onClick={() => setSelectedQrEvent(null)}
                            >
                                Close
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
