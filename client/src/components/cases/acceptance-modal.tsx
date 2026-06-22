import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Timer, CheckCircle, ArrowUpCircle, Dna, Clock, ShieldCheck } from "lucide-react";

interface AcceptanceModalProps {
    isOpen: boolean;
    caseId: string;
    deadline: string | null;
    onAccept: () => Promise<void>;
    onEscalate: () => Promise<void>;
}

export function AcceptanceModal({ isOpen, caseId, deadline, onAccept, onEscalate }: AcceptanceModalProps) {
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (!isOpen || !deadline) return;

        const updateTimer = () => {
            const now = new Date();
            const end = new Date(deadline);
            const diff = end.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeLeft("Expired");
                return;
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${minutes}m ${seconds}s`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [isOpen, deadline]);

    const handleAction = async (action: () => Promise<void>) => {
        setIsProcessing(true);
        try {
            await action();
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-[500px] p-0 border-0 shadow-2xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-black/5">
                <div className="flex flex-col">
                    {/* Header Section - Clean & White */}
                    <div className="p-8 pb-6 border-b border-gray-50 bg-white">
                        <div className="flex items-center gap-4">
                            <div className="bg-emerald-500/10 p-3.5 rounded-[1.25rem]">
                                <ShieldCheck className="h-7 w-7 text-emerald-600" />
                            </div>
                            <div className="space-y-1">
                                <DialogTitle className="text-2xl font-black text-gray-900 tracking-tight leading-none">
                                    Protocol Acceptance Required
                                </DialogTitle>
                                <DialogDescription className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5 leading-tight">
                                    Acknowledge responsibility to halt automated escalation
                                </DialogDescription>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-8 bg-gray-50/30">
                        {/* Countdown Section - Premium Styling */}
                        <div className="relative p-8 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                                <Timer className="h-16 w-16 text-[#004E98]" />
                            </div>
                            <div className="flex flex-col items-center justify-center text-center">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] mb-3">Grace Period Remaining</p>
                                <div className="flex items-baseline gap-2">
                                    <Clock className="h-5 w-5 text-amber-500 mb-1" />
                                    <span className={`text-4xl font-black tracking-tighter tabular-nums ${
                                        timeLeft === "Expired" ? "text-red-600" : "text-[#004E98]"
                                    }`}>
                                        {timeLeft || "Calculating..."}
                                    </span>
                                </div>
                                <div className="mt-4 px-4 py-1.5 bg-amber-50 rounded-full border border-amber-100">
                                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Auto-escalation active</p>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-1 gap-4">
                            <Button
                                onClick={() => handleAction(onAccept)}
                                disabled={isProcessing}
                                className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-[0.1em] text-[13px] gap-3 rounded-2xl shadow-xl shadow-emerald-500/10 transition-all hover:scale-[1.02] active:scale-95"
                            >
                                <CheckCircle className="h-5 w-5" />
                                Accept Responsibility
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => handleAction(onEscalate)}
                                disabled={isProcessing}
                                className="w-full h-14 border-2 border-gray-100 bg-white text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 font-black uppercase tracking-[0.1em] text-[11px] gap-2 rounded-2xl transition-all"
                            >
                                <ArrowUpCircle className="h-4 w-4" />
                                Escalate Immediately
                            </Button>
                        </div>

                        {/* Footer Context */}
                        <div className="flex flex-col items-center gap-1.5 pt-2">
                            <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.3em]">Institutional Guardrail Protocol</p>
                            <p className="text-[10px] font-bold text-gray-400">Case ID: {caseId}</p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
