import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, User, Loader2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface IssueLead {
  id: string;
  client: string;
  contactEmail: string;
  contactNumber: string;
  institution: string;
  qualificationOfInterest: string;
  issuesReported: string;
  createdAt: string;
  isEscalatedToCase?: boolean;
}

interface ForensicGroup {
  institution: string;
  issues: IssueLead[];
}

interface ForensicIssuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string | null;
  eventName: string;
}

export function ForensicIssuesModal({ isOpen, onClose, eventId, eventName }: ForensicIssuesModalProps) {
  const [feed, setFeed] = useState<ForensicGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && eventId) {
      fetchFeed();
    }
  }, [isOpen, eventId]);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/marketing/events/${eventId}/forensic-feed`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("marketingToken")}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setFeed(data.feed || []);
      }
    } catch (error) {
      console.error("Error fetching forensic feed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async (leadId: string) => {
    try {
      const res = await fetch(`/api/marketing/leads/${leadId}/escalate-to-case`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("marketingToken")}`
        }
      });
      
      if (res.ok) {
        toast({
          title: "Escalated",
          description: "Issue successfully escalated to a formal Case.",
        });
        // Optimistically update the UI
        setFeed(prev => prev.map(group => ({
          ...group,
          issues: group.issues.map(issue => 
            issue.id === leadId ? { ...issue, isEscalatedToCase: true } : issue
          )
        })));
      } else {
        const error = await res.json();
        toast({
          title: "Escalation Failed",
          description: error.error || "Failed to escalate issue.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Escalation error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred during escalation.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border-0">
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-50 p-3 rounded-xl">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-gray-900">
                Forensic Issues Feed
              </DialogTitle>
              <DialogDescription className="text-gray-500 font-medium">
                Qualitative feedback and challenges reported during <span className="font-bold text-[#004E98]">{eventName}</span>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#004E98]" />
          </div>
        ) : feed.length === 0 ? (
          <div className="text-center py-16 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No issues reported for this event.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {feed.map((group) => (
              <div key={group.institution} className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    {group.institution}
                    <Badge variant="secondary" className="bg-white text-xs">{group.issues.length} Issues</Badge>
                  </h3>
                </div>
                <div className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/30">
                        <TableHead className="w-[300px]">Registrant Context</TableHead>
                        <TableHead className="w-[180px]">Mapped Department</TableHead>
                        <TableHead>Qualitative Issue</TableHead>
                        <TableHead className="text-right w-[150px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.issues.map(issue => {
                        const QUALIFICATION_DEPT_MAP: Record<string, string> = {
                          CFFE: "Forensic Investigations",
                          CPA: "Accountancy",
                          CS: "Corporate Secretarial",
                          CIFA: "Finance",
                          CCP: "Credit Management",
                          CISSE: "Information Systems",
                          CQP: "Quality Management",
                          ATD: "Accounting Technicians",
                          DDMA: "Data Management",
                          DCNSA: "Computer Networks",
                          CAMS: "Accounting and Management",
                        };
                        const dept = QUALIFICATION_DEPT_MAP[issue.qualificationOfInterest] || "General Core";
                        
                        const daysSince = Math.max(0, Math.floor((Date.now() - new Date(issue.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
                        const isAged = daysSince > 7;

                        return (
                          <TableRow key={issue.id} className="hover:bg-gray-50/35">
                            <TableCell>
                              <div className="font-black text-gray-900">{issue.client}</div>
                              <div className="text-[11px] text-gray-500 font-medium mt-1.5 flex flex-wrap items-center gap-1">
                                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-800">{issue.contactNumber || "No Phone"}</span>
                                <span className="text-gray-300">•</span>
                                <span className="text-gray-600 select-all">{issue.contactEmail}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge variant="outline" className="text-[#004E98] border-[#004E98]/20 bg-[#004E98]/5 font-black uppercase text-[10px]">
                                  {issue.qualificationOfInterest}
                                </Badge>
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{dept} Department</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-2">
                                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                  {issue.issuesReported}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className={`text-[9px] font-black border-0 ${isAged ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                                    {daysSince === 0 ? "Registered today" : `Registered ${daysSince} days ago`}
                                  </Badge>
                                  <span className="text-[10px] text-gray-300">|</span>
                                  <span className="text-[10px] font-bold text-[#004E98] uppercase">Origin: {eventName}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {issue.isEscalatedToCase ? (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 font-black uppercase text-[10px] tracking-wider border-0 px-3 py-1">
                                  Escalated
                                </Badge>
                              ) : (
                                <Button 
                                  size="sm" 
                                  onClick={() => handleEscalate(issue.id)}
                                  className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 shadow-none border-0 font-bold uppercase text-[10px] tracking-wide"
                                >
                                  Escalate
                                  <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
