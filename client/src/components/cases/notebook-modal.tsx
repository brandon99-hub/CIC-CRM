import { useState, useEffect, forwardRef, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, CheckCircle2 } from "lucide-react";

interface NotebookModalProps {
    caseItem: {
        id: string;
        caseNumber: string;
        personalNotes?: string;
    };
    children: React.ReactNode;
}

export const NotebookModal = forwardRef<HTMLDivElement, NotebookModalProps>(
    ({ caseItem, children, ...props }, ref) => {
        const [notes, setNotes] = useState(caseItem.personalNotes || "");
        const [isSaving, setIsSaving] = useState(false);
        const [open, setOpen] = useState(false);
        const [isLoading, setIsLoading] = useState(false);
        const hasTypedRef = useRef(false);
        const lastSavedNotesRef = useRef<string>(caseItem.personalNotes || "");
        const pendingNotesRef = useRef<string | undefined>(undefined);
        const lastFetchedIdRef = useRef<string | null>(null);

        // Fetch latest notes when modal opens (optimized)
        useEffect(() => {
            if (open && lastFetchedIdRef.current !== caseItem.id) {
                const fetchNotes = async () => {
                    setIsLoading(true);
                    try {
                        const token = localStorage.getItem("marketingToken");
                        const res = await fetch(`/api/cases/${caseItem.id}/personal-notes`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const data = await res.json();
                        const serverNotes = data.notes || "";

                        if (!hasTypedRef.current) {
                            setNotes(serverNotes);
                            lastSavedNotesRef.current = serverNotes;
                            pendingNotesRef.current = serverNotes;
                        }
                        lastFetchedIdRef.current = caseItem.id;
                    } catch (err) {
                        console.error("Failed to fetch latest notes:", err);
                    } finally {
                        setIsLoading(false);
                    }
                };
                fetchNotes();
            } else if (!open) {
                hasTypedRef.current = false;
                pendingNotesRef.current = undefined;
            }
        }, [open, caseItem.id]);

        // Auto-save logic
        useEffect(() => {
            if (!open) return;
            const currentNotes = notes || "";

            // Track if we actually have variations from what was loaded/initially there
            if (pendingNotesRef.current !== undefined && currentNotes !== pendingNotesRef.current) {
                hasTypedRef.current = true;
            }

            pendingNotesRef.current = currentNotes;

            const saveNotes = async (notesToSave: string) => {
                if (notesToSave === lastSavedNotesRef.current) return;
                setIsSaving(true);
                try {
                    const token = localStorage.getItem("marketingToken");
                    await fetch(`/api/cases/${caseItem.id}/personal-notes`, {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({ personalNotes: notesToSave }),
                    });
                    lastSavedNotesRef.current = notesToSave;
                } catch (err) {
                    console.error("Failed to auto-save notes:", err);
                } finally {
                    setIsSaving(false);
                }
            };

            const timer = setTimeout(() => {
                saveNotes(currentNotes);
            }, 500);

            return () => clearTimeout(timer);
        }, [notes, caseItem.id, open]);

        // Exit protection for the modal
        useEffect(() => {
            return () => {
                if (pendingNotesRef.current !== undefined && pendingNotesRef.current !== lastSavedNotesRef.current) {
                    const token = localStorage.getItem("marketingToken");
                    fetch(`/api/cases/${caseItem.id}/personal-notes`, {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({ personalNotes: pendingNotesRef.current }),
                        keepalive: true
                    }).catch(console.error);
                }
            };
        }, [open, caseItem.id]);

        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <div ref={ref} {...props} className="inline-flex">
                        {children}
                    </div>
                </DialogTrigger>
                <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl bg-[#fffdf9]">
                    <DialogHeader className="p-6 bg-white border-b flex flex-row items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                                <BookOpen className="h-6 w-6 text-amber-600" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black text-gray-900 tracking-tight uppercase">Personal Notebook</DialogTitle>
                                <DialogDescription className="text-gray-500 font-medium">Private reflections for Case {caseItem.caseNumber}</DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mr-8">
                            {isSaving ? (
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 animate-pulse">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Syncing</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-50 border border-gray-100">
                                    <CheckCircle2 className="h-3 w-3 text-gray-300" />
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Saved</span>
                                </div>
                            )}
                        </div>
                    </DialogHeader>
                    <div className="h-[60vh] overflow-hidden flex flex-col relative">
                        <div
                            className="flex-1 relative"
                            style={{
                                backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px)',
                                backgroundSize: '100% 2.8rem',
                                backgroundPosition: '0 2.25rem'
                            }}
                        >
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder={isLoading ? "Loading your reflections..." : "Write your private reflections here directly on the rows..."}
                                className={`w-full h-full bg-transparent border-none focus:ring-0 p-8 pt-[0.2rem] text-gray-700 font-medium italic text-xl leading-[2.8rem] resize-none placeholder:text-gray-300 transition-colors selection:bg-amber-100 outline-none shadow-none ring-0 ${isLoading ? 'opacity-50' : ''}`}
                                autoFocus
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }
);
