
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    FileText, Plus, Trash2, Loader2, Download, 
    Paperclip, CheckCircle2, AlertCircle 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DOCUMENT_TYPES = [
    { value: "general", label: "General Attachment" },
    { value: "identification", label: "Identification (ID/Passport)" },
    { value: "proposal", label: "Proposal Form" },
    { value: "kyc", label: "KYC Document (ID/Passport)" },
    { value: "logbook", label: "Logbook" },
    { value: "pin", label: "PIN Certificate" }
];

interface Document {
    id: string;
    name: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    url: string;
    category: string;
    documentType?: string;
    createdAt: string;
}

interface DocumentAttachmentSectionProps {
    entityId: string;
    entityType: 'lead' | 'prospect' | 'expected_order' | 'sales_won' | 'cic_lead';
    title?: string;
}

export function DocumentAttachmentSection({ entityId, entityType, title = "Attachments" }: DocumentAttachmentSectionProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [selectedDocType, setSelectedDocType] = useState<string>("general");
    const [activeFilter, setActiveFilter] = useState<string>("all");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const token = () => localStorage.getItem("marketingToken");

    // Map entityType to database column mapping
    const propertyMap: Record<string, string> = {
        'lead': 'leadId',
        'prospect': 'prospectId',
        'expected_order': 'expectedOrderId',
        'sales_won': 'salesWonId',
        'cic_lead': 'leadId'
    };
    const propName = propertyMap[entityType] || `${entityType}Id`;

    // Fetch documents for this specific entity
    const { data: documents = [], isLoading } = useQuery<Document[]>({
        queryKey: ["marketing", "documents", entityType, entityId],
        queryFn: async () => {
            const res = await fetch(`/api/marketing/documents?${propName}=${entityId}`, {
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (!res.ok) throw new Error("Failed to fetch documents");
            const allDocs = await res.json();
            return allDocs.filter((doc: any) => doc[propName] === entityId);
        },
        enabled: !!entityId
    });

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            // In a real app, this would be a FormData upload to a storage service
            // For now, we simulate the upload and call the mocked backend
            const mockUrl = `/attached_assets/${file.name}`;
            
            const payload = {
                name: file.name.split('.')[0],
                category: 'attachment',
                fileName: file.name,
                fileType: file.type || 'application/octet-stream',
                fileSize: file.size,
                url: mockUrl,
                documentType: selectedDocType,
                [propName]: entityId
            };

            const res = await fetch("/api/marketing/documents", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token()}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Failed to save document record");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Document attached successfully." });
            queryClient.invalidateQueries({ queryKey: ["marketing", "documents"] });
            setIsUploading(false);
        },
        onError: (err: any) => {
            toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
            setIsUploading(false);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/marketing/documents/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (!res.ok) throw new Error("Failed to delete document");
        },
        onSuccess: () => {
            toast({ title: "Deleted", description: "Document removed." });
            queryClient.invalidateQueries({ queryKey: ["marketing", "documents"] });
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsUploading(true);
            uploadMutation.mutate(file);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + ["Bytes", "KB", "MB", "GB"][i];
    };

    const filteredDocuments = documents.filter(doc => activeFilter === "all" || (doc.documentType || "general") === activeFilter);

    return (
        <div className="space-y-4 py-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-[#004E98]" />
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-tight">{title}</h4>
                    <Badge variant="outline" className="ml-1 bg-gray-50 text-gray-500 border-none text-[10px] font-bold">
                        {documents.length}
                    </Badge>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={selectedDocType} onValueChange={setSelectedDocType} disabled={isUploading}>
                        <SelectTrigger className="h-8 w-[200px] text-[10px] font-bold uppercase tracking-widest border-gray-200">
                            <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                        <SelectContent>
                            {DOCUMENT_TYPES.map(type => (
                                <SelectItem key={type.value} value={type.value} className="text-xs font-medium">
                                    {type.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="relative">
                    <Input 
                        type="file" 
                        className="hidden" 
                        id={`file-upload-${entityId}`} 
                        onChange={handleFileChange}
                        disabled={isUploading}
                    />
                    <Label 
                        htmlFor={`file-upload-${entityId}`}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all",
                            isUploading ? "bg-gray-100 text-gray-400" : "bg-[#004E98]/10 text-[#004E98] hover:bg-[#004E98]/20"
                        )}
                    >
                        {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        {isUploading ? "Uploading..." : "Attach File"}
                    </Label>
                </div>
            </div>
        </div>

            {documents.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-2">
                    <Button 
                        variant={activeFilter === "all" ? "default" : "outline"}
                        size="sm"
                        className={`h-7 text-[10px] font-bold uppercase tracking-widest rounded-full ${activeFilter === "all" ? "bg-[#004E98] hover:bg-[#003B73]" : ""}`}
                        onClick={() => setActiveFilter("all")}
                    >
                        All
                    </Button>
                    {Array.from(new Set(documents.map(d => d.documentType || "general"))).map(type => {
                        const typeLabel = DOCUMENT_TYPES.find(t => t.value === type)?.label || type;
                        return (
                            <Button
                                key={type}
                                variant={activeFilter === type ? "default" : "outline"}
                                size="sm"
                                className={`h-7 text-[10px] font-bold uppercase tracking-widest rounded-full ${activeFilter === type ? "bg-[#004E98] hover:bg-[#003B73]" : ""}`}
                                onClick={() => setActiveFilter(type)}
                            >
                                {typeLabel}
                            </Button>
                        );
                    })}
                </div>
            )}

            {filteredDocuments.length > 0 ? (
                <div className="rounded-xl border border-gray-100 overflow-hidden bg-gray-50/30">
                    <Table>
                        <TableBody>
                            {filteredDocuments.map((doc) => (
                                <TableRow key={doc.id} className="hover:bg-white transition-colors border-b-gray-100 last:border-0 group">
                                    <TableCell className="py-2.5">
                                        <div className="flex items-center gap-3">
                                            <FileText className="h-4 w-4 text-gray-400 group-hover:text-[#004E98] transition-colors" />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[12px] font-bold text-gray-900 line-clamp-1">{doc.name}</p>
                                                    <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-widest bg-white">
                                                        {DOCUMENT_TYPES.find(t => t.value === (doc.documentType || "general"))?.label || doc.documentType || "General"}
                                                    </Badge>
                                                </div>
                                                <p className="text-[9px] font-medium text-gray-400 uppercase tracking-tighter mt-0.5">{formatSize(doc.fileSize)}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right py-2.5">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 rounded-lg hover:bg-[#004E98]/10 hover:text-[#004E98]"
                                                onClick={() => window.open(doc.url, "_blank")}
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 rounded-lg hover:bg-red-50 hover:text-red-600"
                                                onClick={() => deleteMutation.mutate(doc.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : !isUploading && (
                <div className="py-8 text-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
                    <Paperclip className="h-6 w-6 text-gray-200 mx-auto mb-2" />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No documents attached</p>
                </div>
            )}
        </div>
    );
}
