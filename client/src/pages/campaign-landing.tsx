import { useQuery } from "@tanstack/react-query";
import { LeadCaptureForm } from "@/components/marketing/lead-capture-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar, Info, Mail } from "lucide-react";
import { format } from "date-fns";
import DOMPurify from "dompurify";

interface Campaign {
  id: string;
  name: string;
  type: string;
  subject?: string;
  content?: string;
  scheduledAt?: string;
}

export default function CampaignLanding({ id }: { id: string }) {
  const { data: campaign, isLoading } = useQuery<Campaign>({
    queryKey: [`/api/public/campaigns/${id}`],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full space-y-4">
          <Skeleton className="h-12 w-3/4 mx-auto" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-3xl overflow-hidden">
          <CardContent className="pt-12 pb-12 text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <Info className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Campaign Not Found</h1>
              <p className="text-gray-500 font-medium">This link may have expired or the campaign has been concluded.</p>
            </div>
            <Button variant="outline" className="rounded-xl h-12" onClick={() => window.location.href = 'https://kasneb.or.ke'}>
              Visit KASNEB Website
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans">
      {/* Premium Hero Header */}
      <div className="bg-gradient-to-br from-[#004E98] via-[#003B73] to-[#01a64e] text-white py-24 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#01a64e] rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        
        <div className="max-w-4xl mx-auto space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-xs font-black uppercase tracking-[0.2em]">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Official KASNEB Campaign
          </div>
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none">
            {campaign.name}
          </h1>
          {campaign.subject && (
            <p className="text-xl md:text-2xl text-blue-50 font-medium max-w-2xl mx-auto border-l-4 border-emerald-400 pl-6 text-left">
              {campaign.subject}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto -mt-16 px-4 grid grid-cols-1 gap-12 relative z-20">
        {/* Main Content Card */}
        <Card className="border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[2.5rem] overflow-hidden bg-white">
          <CardContent className="p-8 md:p-16">
            <div 
              className="prose prose-lg max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-p:text-gray-600 prose-p:leading-relaxed"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(campaign.content || '') }} 
            />
            
            {campaign.type === 'event' && campaign.scheduledAt && (
              <div className="mt-12 p-8 bg-blue-50/50 rounded-3xl border border-blue-100/50 flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="w-16 h-16 bg-white shadow-lg rounded-2xl flex items-center justify-center">
                  <Calendar className="w-8 h-8 text-[#004E98]" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-[#004E98]/40 mb-1">Event Schedule</p>
                  <p className="text-2xl font-black text-[#004E98]">
                    {format(new Date(campaign.scheduledAt), 'PPPP')}
                  </p>
                  <p className="text-gray-500 font-bold">{format(new Date(campaign.scheduledAt), 'p')} (EAT)</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dynamic Action Section */}
        <div id="cta-section" className="scroll-mt-20">
          {campaign.type === 'promotional' || campaign.type === 'other' ? (
            <div className="space-y-6">
              <div className="text-center space-y-2 mb-8">
                <h2 className="text-3xl font-black uppercase tracking-tight text-gray-900">Get Started Today</h2>
                <p className="text-gray-500 font-medium">Complete the form below to receive detailed information.</p>
              </div>
              <LeadCaptureForm 
                campaignId={campaign.id} 
                campaignType={campaign.type} 
              />
            </div>
          ) : campaign.type === 'event' ? (
            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-gray-900 text-white p-8 md:p-12">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <h2 className="text-3xl font-black uppercase tracking-tight">Reserve Your Spot</h2>
                    <p className="text-gray-400 font-medium">Join us for this transformative session. Limited slots available on a first-come basis.</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Button className="h-16 bg-emerald-500 hover:bg-emerald-600 text-white text-lg font-black uppercase tracking-wider rounded-2xl transition-all active:scale-95">
                      Register Now
                    </Button>
                    <Button variant="outline" className="h-16 border-white/20 bg-white/5 hover:bg-white/10 text-white text-lg font-black uppercase tracking-wider rounded-2xl transition-all">
                      Add to Calendar
                    </Button>
                  </div>
               </div>
            </Card>
          ) : (
            <div className="text-center p-12 bg-white rounded-[2.5rem] shadow-xl border border-gray-100">
               <Mail className="w-12 h-12 text-[#004E98] mx-auto mb-4 opacity-20" />
               <h3 className="text-xl font-black uppercase tracking-tight text-gray-900">Stay Connected</h3>
               <p className="text-gray-500 font-medium mb-6">For further enquiries, please contact our support team.</p>
               <Button className="bg-[#004E98] rounded-xl px-8 h-12 font-bold" onClick={() => window.location.href='mailto:info@kasneb.or.ke'}>
                  info@kasneb.or.ke
               </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modern Footer Branding */}
      <footer className="mt-24 pt-12 pb-12 border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8 opacity-60">
           <img src="/kasneb-logo.png" alt="KASNEB Logo" className="h-10 grayscale hover:grayscale-0 transition-all cursor-pointer" />
           <div className="text-center md:text-right space-y-1">
              <p className="text-xs font-black uppercase tracking-widest text-gray-900">KASNEB Towers</p>
              <p className="text-[10px] font-bold text-gray-500">Hospital Road, Upper Hill, Nairobi, Kenya</p>
              <p className="text-[10px] font-bold text-gray-400">© {new Date().getFullYear()} All Rights Reserved</p>
           </div>
        </div>
      </footer>
    </div>
  );
}
