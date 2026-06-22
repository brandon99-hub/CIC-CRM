import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Star, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface Survey {
    id: string;
    name: string;
    description?: string;
    isActive: boolean;
    questions?: unknown[];
    googleFormLink?: string;
    targetAudience?: {
        segment: string;
        stakeholderType: string;
    };
    totalResponses?: number;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

interface SurveysTabProps {
    surveys: Survey[];
    pagination?: Pagination;
    onPageChange?: (page: number) => void;
    onOpenModal: (survey?: Survey) => void;
}

export function SurveysTab({ surveys, pagination, onPageChange, onOpenModal }: SurveysTabProps) {
    return (
        <div className="space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="rounded-2xl border-gray-100 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-black text-[#004E98]">{pagination?.total || surveys.length}</p><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Surveys</p></CardContent></Card>
                <Card className="rounded-2xl border-gray-100 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-black text-[#01a64e]">{surveys.filter((s) => s.isActive).length}</p><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Active</p></CardContent></Card>
                <Card className="rounded-2xl border-gray-100 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-black text-[#D0AC01]">{surveys.reduce((acc, s) => acc + (s.totalResponses || 0), 0)}</p><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Responses</p></CardContent></Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {surveys.length === 0 ? (
                    <Card className="col-span-full"><CardContent className="p-8 text-center text-gray-500">No surveys yet. Create your first feedback survey.</CardContent></Card>
                ) : surveys.map((survey) => (
                    <Card key={survey.id} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-lg">{survey.name}</CardTitle>
                                <Badge className={survey.isActive ? "bg-[#01a64e]" : "bg-gray-400"}>{survey.isActive ? "Active" : "Inactive"}</Badge>
                            </div>
                            <CardDescription>{survey.description || "No description"}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <ClipboardList className="h-4 w-4" />
                                    <span>{Array.isArray(survey.questions) ? survey.questions.length : 0} questions</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <Star className="h-4 w-4" />
                                    <span>{survey.totalResponses || 0} responses</span>
                                </div>
                            </div>
                            <div className="flex gap-1 mt-3">
                                <Button size="sm" variant="outline" onClick={() => onOpenModal(survey)}>
                                    <Pencil className="h-3 w-3 mr-1" />Edit
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {pagination && pagination.pages > 1 && (
                <div className="p-6 border-t bg-gray-50/30 rounded-2xl border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 mt-6">
                    <p className="text-xs text-gray-500 font-medium tracking-tight">
                        Showing <span className="font-bold text-gray-900">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="font-bold text-gray-900">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-bold text-gray-900">{pagination.total}</span> surveys
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 min-w-[100px] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                            onClick={() => onPageChange?.(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                        >
                            Previous
                        </Button>
                        <div className="flex items-center gap-1.5 px-2">
                            {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
                                const pageNum = i + 1;
                                return (
                                    <Button
                                        key={pageNum}
                                        variant={pagination.page === pageNum ? "default" : "outline"}
                                        size="sm"
                                        className={cn(
                                            "h-9 w-9 rounded-xl text-[10px] font-black transition-all active:scale-95",
                                            pagination.page === pageNum ? "bg-[#004E98] text-white shadow-lg shadow-blue-900/20" : "text-gray-500 hover:bg-gray-100 border-gray-200"
                                        )}
                                        onClick={() => onPageChange?.(pageNum)}
                                    >
                                        {pageNum}
                                    </Button>
                                );
                            })}
                            {pagination.pages > 5 && <span className="text-gray-400 text-xs px-1">...</span>}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 min-w-[100px] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                            onClick={() => onPageChange?.(pagination.page + 1)}
                            disabled={pagination.page >= pagination.pages}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}

        </div>
    );
}
