import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Pencil, Trash2, Globe, Activity, RefreshCw, Server, Loader2, AlertOctagon, AlertTriangle, ShieldAlert, PowerOff, Wifi, Download, MoreVertical, CheckCircle, TestTube2, TestTubeDiagonal, Share2, Link, ShieldCheck } from "lucide-react";

import { Integration } from "@/types/admin";

interface PortalType {
    value: string;
    label: string;
}

interface IntegrationsProps {
    integrations: Integration[];
    portalTypes: PortalType[];
    onTestIntegration: (id: string) => void;
    onSyncIntegration: (id: string) => void;
    onResubscribeIntegration?: (id: string) => void;
    onBackfillMessages?: (id: string) => void;
    // Modal
    integrationModalOpen: boolean;
    editingIntegration: Integration | null;
    integrationForm: {
        name: string;
        portalType: string;
        baseUrl: string;
        apiKey: string;
        clientId: string;
        clientSecret: string;
        authType: string;
        isActive: boolean;
    };
    onIntegrationFormChange: (form: IntegrationsProps["integrationForm"]) => void;
    onOpenIntegrationModal: (intg?: Integration) => void;
    onSaveIntegration: () => void;
    onDeleteIntegration: (id: string) => void;
    onCloseIntegrationModal: () => void;
    isSavingIntegration?: boolean;
}

function renderEmptyState(entity: string, onAdd: () => void) {
    return (
        <div className="text-center py-16 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200">
            <div className="bg-white p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                <Globe className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-gray-600 font-medium text-lg">No {entity} configured</p>
            <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">Establish secure connections with external portals and third-party ecosystems to unify your data layer.</p>
            <Button variant="outline" onClick={onAdd} className="mt-6 border-gray-200 hover:bg-white hover:border-[#004E98] hover:text-[#004E98] transition-all">
                <Plus className="h-4 w-4 mr-2" /> Connect Your First Gateway
            </Button>
        </div>
    );
}

const getIntegrationStatus = (intg: Integration) => {
    if (!intg.isActive) return { label: 'INACTIVE', color: 'text-gray-500', bg: 'bg-gray-100', icon: PowerOff };
    if (intg.syncStatus === 'pending_auth') return { label: 'PENDING AUTH', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100 border', icon: ShieldAlert };
    if (intg.syncStatus === 'syncing') return { label: 'SYNCING', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100 border', icon: RefreshCw, spin: true };
    if (intg.syncStatus === 'failed' || intg.lastTestStatus === 'failed') return { label: 'FAILED', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100 border', icon: AlertOctagon };
    if (intg.lastTestStatus === 'warning') return { label: 'DEGRADED', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100 border', icon: AlertTriangle };
    return { label: 'OPERATIONAL', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100 border', icon: Activity };
};

export function Integrations({
    integrations,
    portalTypes,
    onTestIntegration,
    onSyncIntegration,
    onResubscribeIntegration,
    onBackfillMessages,
    integrationModalOpen,
    editingIntegration,
    integrationForm,
    onIntegrationFormChange,
    onOpenIntegrationModal,
    onSaveIntegration,
    onDeleteIntegration,
    onCloseIntegrationModal,
    isSavingIntegration,
}: IntegrationsProps) {
    // Tracks which action is loading for a given integration row: { [integrationId]: actionName | null }
    const [loadingActions, setLoadingActions] = useState<Record<string, string | null>>({});

    const setLoading = (id: string, action: string | null) =>
        setLoadingActions(prev => ({ ...prev, [id]: action }));

    const withLoading = (id: string, actionKey: string, fn: () => void | Promise<void>) => async () => {
        setLoading(id, actionKey);
        try { await fn(); } finally { setLoading(id, null); }
    };

    const getPlaceholders = () => {
        switch (integrationForm.portalType) {
            case "facebook":
                return { name: "e.g. Official Facebook Page", url: "https://graph.facebook.com", client: "e.g. Meta App ID (Optional)", secret: "" };
            case "instagram":
                return { name: "e.g. Official Instagram Account", url: "https://graph.facebook.com", client: "e.g. Meta App ID (Optional)", secret: "" };
            case "tiktok":
                return { name: "e.g. TikTok Business", url: "https://business-api.tiktok.com", client: "e.g. TikTok App ID", secret: "" };
            case "gmail":
            case "email":
                return { name: "e.g. Support Inbox", url: "https://gmail.googleapis.com", client: "e.g. Google Client ID", secret: "Google Client Secret" };
            case "whatsapp":
                return { name: "e.g. Official WhatsApp", url: "https://graph.facebook.com/v19.0", client: "e.g. Phone Number ID", secret: "e.g. WABA ID" };
            case "sms_gateway":
                return { name: "e.g. Twilio / Africa's Talking", url: "https://api.africastalking.com/version1", client: "e.g. sms_client_key", secret: "" };
            case "erp":
                return { name: "e.g. Core Banking System / ERP", url: "https://api.erp-system.local/v1", client: "e.g. erp_client_123", secret: "" };
            default:
                return { name: "e.g. Custom API Gateway", url: "https://api.external-system.org/v1", client: "e.g. client_12345", secret: "e.g. secret_key" };
        }
    };
    const placeholders = getPlaceholders();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <Share2 className="h-6 w-6 text-[#004E98]" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 leading-none">Neural Bridge</h3>
                        <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-1.5 font-medium">
                            <Globe className="h-3.5 w-3.5 text-emerald-500" /> External Connectivity & Data Synergies
                        </p>
                    </div>
                </div>
                <Button onClick={() => onOpenIntegrationModal()} className="bg-[#004E98] hover:bg-[#003B73] shadow-md transition-all hover:scale-[1.02] font-bold">
                    <Plus className="h-4 w-4 mr-2" />Add New Integration
                </Button>
            </div>

            {integrations.length === 0 ? renderEmptyState("integrations", onOpenIntegrationModal) : (
                <Card className="overflow-hidden border-gray-200 shadow-xl bg-white">
                    <div className="overflow-x-auto">
                        <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80 border-b border-gray-100">
                                <TableHead className="font-bold text-gray-700 py-5 pl-6">Integration Name</TableHead>
                                <TableHead className="font-bold text-gray-700">Portal</TableHead>
                                <TableHead className="font-bold text-gray-700 hidden md:table-cell">Base URL</TableHead>
                                <TableHead className="font-bold text-gray-700 hidden lg:table-cell">Security Type</TableHead>
                                <TableHead className="font-bold text-gray-700">Status</TableHead>
                                <TableHead className="font-bold text-gray-700 pr-6 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {integrations.map((intg) => (
                                <TableRow key={intg.id} className="hover:bg-gray-50/30 transition-colors border-b border-gray-50 last:border-0 group">
                                    <TableCell className="py-5 pl-6">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#004E98] shadow-sm border border-blue-100">
                                                <Link className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{intg.name}</p>
                                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter mt-0.5">
                                                    ID: {intg.id.substring(0, 12)}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className="bg-[#004E98]/10 text-[#004E98] border-0 text-[10px] font-black tracking-widest uppercase py-0.5 px-2">
                                            {portalTypes.find((p) => p.value === intg.portalType)?.label || intg.portalType}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium max-w-[180px] truncate">
                                            <Server className="h-3 w-3 text-gray-300" /> {intg.baseUrl}
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{intg.authType?.replace(/_/g, " ")}</p>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1.5">
                                            {(() => {
                                                const status = getIntegrationStatus(intg);
                                                const StatusIcon = status.icon;
                                                return (
                                                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md w-fit ${status.bg}`}>
                                                        <StatusIcon className={`h-3 w-3 ${status.color} ${status.spin ? 'animate-spin' : ''}`} />
                                                        <span className={`text-[10px] font-black uppercase ${status.color}`}>{status.label}</span>
                                                    </div>
                                                );
                                            })()}
                                            {intg.lastSyncedAt && intg.isActive && intg.syncStatus !== 'pending_auth' && (
                                                <p className="text-[9px] text-gray-400 font-medium pl-1">
                                                    Synced: {new Date(intg.lastSyncedAt).toLocaleString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="pr-4 text-right">
                                        {(() => {
                                            const isMeta = ['facebook', 'instagram', 'meta'].includes(intg.portalType?.toLowerCase());
                                            const activeAction = loadingActions[intg.id];
                                            const isRowLoading = !!activeAction;

                                            const ActionItem = ({ actionKey, icon: Icon, label, className, onClick }: {
                                                actionKey: string;
                                                icon: React.ElementType;
                                                label: string;
                                                className?: string;
                                                onClick: () => void;
                                            }) => (
                                                <DropdownMenuItem
                                                    disabled={isRowLoading}
                                                    onClick={withLoading(intg.id, actionKey, onClick)}
                                                    className={`flex items-center gap-2.5 cursor-pointer text-[13px] font-medium py-2 px-3 ${className ?? "text-gray-700 hover:text-gray-900"} focus:bg-gray-50`}
                                                >
                                                    {activeAction === actionKey
                                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 opacity-70" />
                                                        : <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                                                    <span>{activeAction === actionKey ? "Working..." : label}</span>
                                                </DropdownMenuItem>
                                            );

                                            return (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className={`h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg ${
                                                                isRowLoading ? "opacity-100 text-blue-500" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                                                            }`}
                                                            title="Actions"
                                                        >
                                                            {isRowLoading
                                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                : <MoreVertical className="h-4 w-4" />}
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-52 shadow-xl border-gray-100 rounded-xl p-1.5">
                                                        <DropdownMenuLabel className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-1.5">
                                                            {intg.name}
                                                        </DropdownMenuLabel>
                                                        <DropdownMenuSeparator className="bg-gray-100" />

                                                        <ActionItem
                                                            actionKey="editing"
                                                            icon={Pencil}
                                                            label="Edit Configuration"
                                                            onClick={() => onOpenIntegrationModal(intg)}
                                                        />
                                                        <ActionItem
                                                            actionKey="testing"
                                                            icon={TestTubeDiagonal}
                                                            label="Test Connection"
                                                            onClick={() => onTestIntegration(intg.id)}
                                                        />
                                                        <ActionItem
                                                            actionKey="syncing"
                                                            icon={RefreshCw}
                                                            label="Trigger Sync"
                                                            onClick={() => onSyncIntegration(intg.id)}
                                                        />

                                                        {isMeta && (
                                                            <>
                                                                <DropdownMenuSeparator className="bg-gray-100" />
                                                                <DropdownMenuLabel className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-3 py-1 flex items-center gap-1.5">
                                                                    <span className="text-blue-400">●</span> Meta Actions
                                                                </DropdownMenuLabel>
                                                                <ActionItem
                                                                    actionKey="resubscribing"
                                                                    icon={Wifi}
                                                                    label="Re-subscribe Webhook"
                                                                    className="text-emerald-700 hover:text-emerald-800"
                                                                    onClick={() => onResubscribeIntegration?.(intg.id)}
                                                                />
                                                                <ActionItem
                                                                    actionKey="backfilling"
                                                                    icon={Download}
                                                                    label="Backfill Missed DMs"
                                                                    className="text-violet-700 hover:text-violet-800"
                                                                    onClick={() => onBackfillMessages?.(intg.id)}
                                                                />
                                                            </>
                                                        )}

                                                        <DropdownMenuSeparator className="bg-gray-100" />
                                                        <ActionItem
                                                            actionKey="deleting"
                                                            icon={Trash2}
                                                            label="Delete Integration"
                                                            className="text-rose-600 hover:text-rose-700 focus:bg-rose-50"
                                                            onClick={() => onDeleteIntegration(intg.id)}
                                                        />
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            );
                                        })()}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            {/* Integration Modal */}
            <Dialog open={integrationModalOpen} onOpenChange={onCloseIntegrationModal}>
                <DialogContent className="sm:max-w-[600px] p-0 border-0 shadow-2xl rounded-2xl bg-white overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="p-8 pb-4">
                        <DialogHeader>
                            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                <Share2 className="h-5 w-5 text-[#004E98]" />
                                <DialogTitle className="text-2xl font-bold text-gray-900">
                                    {editingIntegration ? "Refine Neural Link" : "Establish External Link"}
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-gray-500 text-sm mt-3">
                                Configure endpoints, security handshake, and data exchange protocols
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-8 pt-6 space-y-6 bg-white">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="col-span-2 space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Integration Name</Label>
                                <Input
                                    value={integrationForm.name}
                                    onChange={(e) => onIntegrationFormChange({ ...integrationForm, name: e.target.value })}
                                    placeholder={placeholders.name}
                                    className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white font-bold"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Portal</Label>
                                <Select value={integrationForm.portalType} onValueChange={(v: string) => onIntegrationFormChange({ ...integrationForm, portalType: v })}>
                                    <SelectTrigger className="h-11 bg-gray-50/50 border-gray-200"><SelectValue placeholder="System Type" /></SelectTrigger>
                                    <SelectContent>
                                        {portalTypes.map((pt) => <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            {integrationForm.portalType !== "gmail" && integrationForm.portalType !== "email" ? (
                                <>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Security Type</Label>
                                        <Select value={integrationForm.authType} onValueChange={(v: string) => onIntegrationFormChange({ ...integrationForm, authType: v })}>
                                            <SelectTrigger className="h-11 bg-gray-50/50 border-gray-200"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="api_key">Secure API Token</SelectItem>
                                                <SelectItem value="oauth2">OAuth 2.0 (Implicit/Grant)</SelectItem>
                                                <SelectItem value="basic_auth">Basic Auth (Legacy)</SelectItem>
                                                <SelectItem value="bearer_token">Bearer Authorization</SelectItem>
                                                <SelectItem value="none">Public (Unauthenticated)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="col-span-2 space-y-2">
                                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Base URL</Label>
                                        <div className="relative">
                                            <Input
                                                value={integrationForm.baseUrl}
                                                onChange={(e) => onIntegrationFormChange({ ...integrationForm, baseUrl: e.target.value })}
                                                placeholder={placeholders.url}
                                                className="h-11 bg-gray-50/50 border-gray-200 pl-10 focus:bg-white"
                                            />
                                            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Client ID / App ID {integrationForm.portalType === 'whatsapp' && "(Phone Number ID)"}</Label>
                                        <Input
                                            value={integrationForm.clientId || ""}
                                            onChange={(e) => onIntegrationFormChange({ ...integrationForm, clientId: e.target.value })}
                                            placeholder={placeholders.client}
                                            className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white"
                                        />
                                    </div>

                                    {(integrationForm.portalType === 'whatsapp' || integrationForm.authType === 'oauth2') && (
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">{integrationForm.portalType === 'whatsapp' ? "WABA ID" : "Client Secret"}</Label>
                                            <Input
                                                value={integrationForm.clientSecret || ""}
                                                onChange={(e) => onIntegrationFormChange({ ...integrationForm, clientSecret: e.target.value })}
                                                placeholder={placeholders.secret}
                                                type="text"
                                                className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">{integrationForm.portalType === 'whatsapp' ? 'System User Token' : 'Secret Key'}</Label>
                                        <Input
                                            value={integrationForm.apiKey}
                                            onChange={(e) => onIntegrationFormChange({ ...integrationForm, apiKey: e.target.value })}
                                            placeholder="••••••••••••••••"
                                            type="password"
                                            className="h-11 bg-gray-50/50 border-gray-200 focus:bg-white"
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="col-span-2 p-6 rounded-xl bg-blue-50/50 border border-blue-100 flex flex-col items-center justify-center text-center space-y-3">
                                    <div className="bg-white p-3 rounded-full shadow-sm border border-blue-100">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">Google OAuth 2.0</h4>
                                        <p className="text-xs text-gray-500 mt-1 max-w-sm">
                                            Saving this integration will configure the CRM to use Google's secure authentication flow. Users will connect their inboxes via the "Sign in with Google" prompt.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                            <div className="flex items-center gap-3">
                                <Activity className={`h-5 w-5 ${integrationForm.isActive ? 'text-emerald-500' : 'text-gray-300'}`} />
                                <div>
                                    <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">Operational Status</p>
                                    <p className="text-[10px] text-gray-400 font-medium">Enable real-time data sync with this provider</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={integrationForm.isActive}
                                    onChange={(e) => onIntegrationFormChange({ ...integrationForm, isActive: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>

                        <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 flex gap-3">
                            <ShieldCheck className="h-5 w-5 text-[#004E98] mt-0.5" />
                            <p className="text-[10px] text-blue-800 leading-relaxed font-medium">
                                All credentials are encrypted at rest using AES-256 GCM. The platform never exposes raw API keys after the initial commit.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 gap-3">
                        <Button variant="outline" onClick={onCloseIntegrationModal} className="px-6 font-bold border-gray-200" disabled={isSavingIntegration}>Cancel</Button>
                        <Button onClick={onSaveIntegration} disabled={isSavingIntegration} className="bg-[#004E98] hover:bg-[#003B73] text-white px-8 font-bold shadow-lg shadow-blue-500/10 transition-all active:scale-[0.98]">
                            {isSavingIntegration ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                            ) : editingIntegration ? "Update Link" : "Initialize Link"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
