
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
    FileText, Upload, Loader2, Paperclip, 
    FileIcon, XCircle, CheckCircle2 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const documentSchema = z.object({
    name: z.string().min(1, "Document name is required").max(200),
    category: z.string().min(1, "Category is required"),
    documentType: z.string().optional(),
    leadId: z.string().optional(),
    prospectId: z.string().optional(),
    expectedOrderId: z.string().optional(),
    salesWonId: z.string().optional(),
});

type DocumentFormData = z.infer<typeof documentSchema>;

interface MarketingDocumentFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function MarketingDocumentForm({ isOpen, onClose, onSuccess }: MarketingDocumentFormProps) {
    const [file, setFile] = useState<File | null>(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    
    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<DocumentFormData>({
        resolver: zodResolver(documentSchema),
        defaultValues: {
            category: 'business_registration',
            documentType: 'general'
        }
    });

    const token = () => localStorage.getItem("marketingToken");

    const mutation = useMutation({
        mutationFn: async (data: DocumentFormData) => {
            if (!file) throw new Error("Please select a file to upload");

            const payload = {
                ...data,
                fileName: file.name,
                fileType: file.type || 'application/octet-stream',
                fileSize: file.size,
                url: `/attached_assets/${file.name}` // Placeholder URL
            };

            const res = await fetch("/api/marketing/documents", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token()}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to upload document");
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Document uploaded successfully." });
            queryClient.invalidateQueries({ queryKey: ["marketing", "documents"] });
            reset();
            setFile(null);
            onSuccess?.();
            onClose();
        },
        onError: (err: any) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            if (!watch("name")) {
                setValue("name", selectedFile.name.split('.')[0]);
            }
        }
    };

    const categories = [
        { id: 'business_registration', label: 'Business Registration' },
        { id: 'tax_compliance', label: 'Tax Compliance' },
        { id: 'financial_statement', label: 'Financial Statement' },
        { id: 'proposal', label: 'Proposal' },
        { id: 'contract', label: 'Contract' },
        { id: 'other', label: 'Other' }
    ];

    const documentTypes = [
        { id: "general", label: "General Attachment" },
        { id: "identification", label: "Identification (ID/Passport)" },
        { id: "proposal", label: "Proposal Form" },
        { id: "kyc", label: "KYC Document (ID/Passport)" },
        { id: "logbook", label: "Logbook" },
        { id: "pin", label: "PIN Certificate" }
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[850px] p-0 border-0 shadow-2xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
                <div className="max-h-[92vh] overflow-y-auto custom-scrollbar flex flex-col">
                    {/* Header Section */}
                    <div className="p-8 pb-6 border-b border-gray-50">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-4">
                                <div className="bg-[#01a64e]/10 p-3.5 rounded-[1.25rem]">
                                    <Upload className="h-7 w-7 text-[#01a64e]" />
                                </div>
                                <div className="space-y-1">
                                    <DialogTitle className="text-3xl font-black text-gray-900 tracking-tight leading-none">
                                        Upload Artifacts
                                    </DialogTitle>
                                    <DialogDescription className="text-gray-400 text-[11px] font-black uppercase tracking-[0.2em] mt-0.5">
                                        Securely add new documents to the DNA repository
                                    </DialogDescription>
                                </div>
                            </div>
                            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Repository Sync Active</span>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="p-8 space-y-8 bg-gray-50/30">
                        {/* File Upload Section - Large DNA Area */}
                        <div className="space-y-4">
                            <Label className="text-[11px] font-black uppercase tracking-[0.15em] text-[#01a64e] flex items-center gap-2 ml-1">
                                <Paperclip className="h-3.5 w-3.5" /> Select Repository Item
                            </Label>
                            <div 
                                className={cn(
                                    "relative border-2 border-dashed rounded-[2rem] p-12 transition-all text-center cursor-pointer group overflow-hidden",
                                    file 
                                        ? "border-[#01a64e]/30 bg-white" 
                                        : "border-gray-100 bg-white hover:border-[#01a64e]/20 hover:bg-emerald-50/10 shadow-sm"
                                )}
                                onClick={() => document.getElementById('file-input')?.click()}
                            >
                                <input 
                                    id="file-input"
                                    type="file" 
                                    className="hidden" 
                                    onChange={handleFileChange}
                                />
                                
                                {file ? (
                                    <div className="flex flex-col items-center gap-4 relative z-10">
                                        <div className="bg-emerald-50 p-4 rounded-2xl ring-1 ring-emerald-100">
                                            <FileIcon className="h-10 w-10 text-emerald-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-black text-gray-900">{file.name}</p>
                                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                                                {(file.size / 1024 / 1024).toFixed(2)} MB • READY FOR INDEXING
                                            </p>
                                        </div>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            className="h-10 px-4 rounded-xl text-[10px] font-black uppercase text-red-500 hover:text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFile(null);
                                            }}
                                        >
                                            <XCircle className="h-4 w-4 mr-2" /> Discard Selection
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4 relative z-10">
                                        <div className="bg-gray-50 p-4 rounded-2xl group-hover:bg-emerald-50 transition-colors">
                                            <Paperclip className="h-10 w-10 text-gray-300 group-hover:text-[#01a64e]/50 transition-colors" />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[11px] font-black text-gray-900 uppercase tracking-widest">Click to browse or drop file here</p>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider italic">Supports PDF, JPG, PNG, DOCX (Max 10MB)</p>
                                        </div>
                                    </div>
                                )}
                                {/* Background Decorative element */}
                                <div className="absolute top-0 right-0 p-4 opacity-5">
                                    <CheckCircle2 className="h-32 w-32 -mr-16 -mt-16 text-[#01a64e]" />
                                </div>
                            </div>
                        </div>

                        {/* Metadata Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <Label htmlFor="category" className="text-[11px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2 ml-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Item Classification
                                </Label>
                                <Select 
                                    value={watch("category")} 
                                    onValueChange={(val) => setValue("category", val)}
                                >
                                    <SelectTrigger className="h-14 bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-emerald-500/10 transition-all rounded-2xl px-6 font-bold text-gray-900">
                                        <SelectValue placeholder="Select classification" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-0 shadow-2xl p-2 bg-white ring-1 ring-black/5">
                                        {categories.map(cat => (
                                            <SelectItem 
                                                key={cat.id} 
                                                value={cat.id}
                                                className="text-[10px] font-black uppercase py-3 px-4 rounded-xl focus:bg-emerald-50 focus:text-emerald-700 cursor-pointer mb-1 last:mb-0"
                                            >
                                                {cat.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.category && <p className="text-[10px] font-bold text-red-500 uppercase ml-1">{errors.category.message}</p>}
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="documentType" className="text-[11px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2 ml-1">
                                    <FileIcon className="h-3.5 w-3.5" /> Document Type
                                </Label>
                                <Select 
                                    value={watch("documentType")} 
                                    onValueChange={(val) => setValue("documentType", val)}
                                >
                                    <SelectTrigger className="h-14 bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-emerald-500/10 transition-all rounded-2xl px-6 font-bold text-gray-900">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-0 shadow-2xl p-2 bg-white ring-1 ring-black/5">
                                        {documentTypes.map(type => (
                                            <SelectItem 
                                                key={type.id} 
                                                value={type.id}
                                                className="text-[10px] font-black uppercase py-3 px-4 rounded-xl focus:bg-emerald-50 focus:text-emerald-700 cursor-pointer mb-1 last:mb-0"
                                            >
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3 md:col-span-2">
                                <Label htmlFor="name" className="text-[11px] font-black uppercase tracking-widest text-[#01a64e] flex items-center gap-2 ml-1">
                                    <FileText className="h-3.5 w-3.5" /> Artifact Title
                                </Label>
                                <Input 
                                    id="name"
                                    {...register("name")}
                                    placeholder="Index name in repository..."
                                    className="h-14 font-bold bg-white border-0 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-[#01a64e]/10 transition-all rounded-2xl px-6"
                                />
                                {errors.name && <p className="text-[10px] font-bold text-red-500 uppercase ml-1">{errors.name.message}</p>}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between pt-4 pb-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                className="font-black text-gray-400 uppercase tracking-widest text-[11px] hover:text-gray-900 hover:bg-gray-100 h-14 px-10 rounded-2xl transition-all"
                            >
                                Cancel Indexing
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={mutation.isPending || !file}
                                className="bg-[#01a64e] hover:bg-[#008d41] text-white font-black rounded-2xl shadow-xl shadow-emerald-500/10 transition-all uppercase tracking-[0.15em] text-[12px] h-14 px-12 gap-3"
                            >
                                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                Commit to Repository
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
