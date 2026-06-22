
import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MarketingDocumentForm } from "./document-form";
import { MarketingPageHeader } from "./marketing-page-header";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
    FileText, Download, Trash2, Search, Filter, 
    MoreVertical, FileIcon, ExternalLink, Calendar,
    User, Tag, HardDrive, Plus, FolderOpen, Upload
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
import { MarketingUser } from "@/types/marketing-types";
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";

interface Document {
    id: string;
    name: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    url: string;
    category: string;
    documentType?: string;
    marketerId: string;
    bdName: string;
    createdAt: string;
    leadId?: string;
    prospectId?: string;
    expectedOrderId?: string;
    salesWonId?: string;
}

interface MarketingDocumentsTableProps {
    currentUser: MarketingUser;
    showMarketerInfo: boolean;
    selectedMarketer?: string;
    onMarketerChange?: (id: string) => void;
}

export function MarketingDocumentsTable({ 
    currentUser, 
    showMarketerInfo, 
    selectedMarketer, 
    onMarketerChange 
}: MarketingDocumentsTableProps) {
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const token = () => localStorage.getItem("marketingToken");

    const { data: documents = [], isLoading } = useQuery<Document[]>({
        queryKey: ["marketing", "documents"],
        queryFn: async () => {
            const res = await fetch("/api/marketing/documents", {
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (!res.ok) throw new Error("Failed to fetch documents");
            return res.json();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/marketing/documents/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token()}` }
            });
            if (!res.ok) throw new Error("Failed to delete document");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Document Deleted", description: "Successfully removed the document." });
            queryClient.invalidateQueries({ queryKey: ["marketing", "documents"] });
        },
        onError: (error: any) => {
            toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
        }
    });

    const filteredDocs = documents.filter(doc => {
        const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase()) || 
                             doc.fileName.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const formatSize = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const getIcon = (type: string) => {
        if (type.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
        if (type.includes("sheet") || type.includes("excel")) return <FileIcon className="h-4 w-4 text-green-600" />;
        if (type.includes("word") || type.includes("document")) return <FileIcon className="h-4 w-4 text-blue-600" />;
        return <FileIcon className="h-4 w-4 text-gray-400" />;
    };

    return (
        <div className="space-y-4">
            <MarketingPageHeader
                title="Marketing Documents"
                subtitle="Manage and access all marketing assets and artifacts"
                icon={HardDrive}
                actionButton={{
                    label: "Upload Document",
                    onClick: () => setIsUploadOpen(true),
                    icon: Upload
                }}
                searchValue={search}
                onSearchChange={setSearch}
            />

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Classification</Label>
                    <div className="flex gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
                        {['all', 'proposal', 'contract', 'business_registration'].map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                    categoryFilter === cat 
                                        ? "bg-white text-[#004E98] shadow-sm ring-1 ring-black/5" 
                                        : "text-gray-400 hover:text-gray-600"
                                )}
                            >
                                {cat.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <MarketingDocumentForm 
                isOpen={isUploadOpen} 
                onClose={() => setIsUploadOpen(false)} 
            />

            <div className="bg-white rounded-3xl border-none shadow-sm overflow-hidden ring-1 ring-black/[0.03]">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow className="border-b-gray-100 hover:bg-transparent">
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 py-4">Document</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Category</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Size</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Uploaded</TableHead>
                            {showMarketerInfo && (
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400">Marketer</TableHead>
                            )}
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-gray-400">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [1, 2, 3].map(i => (
                                <TableRow key={i} className="animate-pulse border-b-gray-50">
                                    <TableCell colSpan={6} className="py-8"><div className="h-4 bg-gray-100 rounded w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredDocs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={showMarketerInfo ? 6 : 5} className="py-20 text-center">
                                    <FolderOpen className="h-10 w-10 text-gray-200 mx-auto mb-4" />
                                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No documents found</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredDocs.map((doc) => (
                                <TableRow key={doc.id} className="border-b-gray-50 hover:bg-gray-50/30 transition-colors group">
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-white transition-colors">
                                                {getIcon(doc.fileType)}
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-black text-gray-900 leading-none">{doc.name}</p>
                                                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tight">{doc.fileName}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="outline" className="w-fit text-[9px] font-black uppercase tracking-widest border-gray-100 bg-white text-gray-500">
                                                <Tag className="h-2.5 w-2.5 mr-1" /> {doc.category}
                                            </Badge>
                                            {doc.documentType && (
                                                <Badge variant="outline" className="w-fit text-[8px] font-bold uppercase tracking-widest bg-blue-50 text-[#004E98] border-none">
                                                    {doc.documentType.replace('_', ' ')}
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1.5">
                                            <HardDrive className="h-3 w-3 text-gray-300" /> {formatSize(doc.fileSize)}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1.5">
                                            <Calendar className="h-3 w-3 text-gray-300" /> {format(new Date(doc.createdAt), "MMM d, yyyy")}
                                        </span>
                                    </TableCell>
                                    {showMarketerInfo && (
                                        <TableCell>
                                            <span className="text-[11px] font-black text-[#004E98] flex items-center gap-1.5 uppercase">
                                                <User className="h-3 w-3" /> {doc.bdName}
                                            </span>
                                        </TableCell>
                                    )}
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-white">
                                                    <MoreVertical className="h-4 w-4 text-gray-400" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48 rounded-2xl border-none shadow-2xl p-2 ring-1 ring-black/5 bg-white/95 backdrop-blur-md">
                                                <DropdownMenuItem 
                                                    className="text-[10px] font-black uppercase tracking-tight py-2 px-3 rounded-xl focus:bg-blue-50 focus:text-[#004E98] cursor-pointer gap-2"
                                                    onClick={() => window.open(doc.url, "_blank")}
                                                >
                                                    <Download className="h-3.5 w-3.5" /> Download
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-[10px] font-black uppercase tracking-tight py-2 px-3 rounded-xl focus:bg-blue-50 focus:text-[#004E98] cursor-pointer gap-2">
                                                    <ExternalLink className="h-3.5 w-3.5" /> View Link
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    className="text-[10px] font-black uppercase tracking-tight py-2 px-3 rounded-xl focus:bg-red-50 focus:text-red-600 cursor-pointer gap-2"
                                                    onClick={() => deleteMutation.mutate(doc.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
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
