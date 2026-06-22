import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/shared/dashboard-layout";
import { NavGroup } from "@/components/shared/dashboard-sidebar";
import { MessageSquare, Share2, PhoneCall, Facebook, Instagram, Mail, MessageCircle, Linkedin, Music2, Inbox } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConversationList } from "../components/communications/ConversationList";
import { ChatWindow } from "../components/communications/ChatWindow";
import { SocialPublisher } from "../components/communications/SocialPublisher";
import { AvayaMonitor } from "../components/communications/AvayaMonitor";
import { PostInsights } from "../components/communications/PostInsights";
import { EmailInbox } from "../components/communications/EmailInbox";
import { TriageTab } from "../components/cases/triage-tab";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/api-client";
import { cn } from "@/lib/utils";

export default function CommunicationsDashboard() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<string>("social-media");
  const [activeChannel, setActiveChannel] = useState<string>("messenger");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activeSocialTab, setActiveSocialTab] = useState<string>("facebook");

  const { data: signals } = useQuery({
    queryKey: ["triage", "signals"],
    queryFn: async () => {
      const response = await apiRequest("/api/triage/signals?status=pending");
      return response.json();
    },
    refetchInterval: 15000,
  });
  const pendingTriageCount = signals?.length || 0;

  useEffect(() => {
    const userData = localStorage.getItem("marketingUser");
    if (!userData) { setLocation("/marketing/login"); return; }
    try {
      setUser(JSON.parse(userData));
    } catch {
      setLocation("/marketing/login");
    }
  }, [setLocation]);

  // Clear active conversation when switching between inboxes
  useEffect(() => {
    setActiveConversationId(null);
  }, [activeSection]);

  const navGroups: NavGroup[] = [
    {
      title: "OmniComm Hub",
      items: [
        { id: "social-media", label: "Social Media", icon: MessageSquare },
        { id: "whatsapp-inbox", label: "WhatsApp Inbox", icon: MessageCircle },
        { id: "email-inbox", label: "Email Inbox", icon: Mail },
        { id: "social", label: "Social Publisher", icon: Share2 },
        { id: "voice", label: "Avaya Monitor", icon: PhoneCall },
      ],
    },
    {
      title: "Intake Pipeline",
      items: [
        { id: "triage", label: "Unassigned", icon: Inbox, badge: pendingTriageCount > 0 ? pendingTriageCount : undefined },
      ],
    }
  ];

  const handleLogout = () => {
    localStorage.removeItem("marketingToken");
    localStorage.removeItem("marketingUser");
    setLocation("/marketing/login");
  };

  const sectionDescriptions: Record<string, string> = {
    "facebook-inbox": "Manage and respond to Facebook Messenger and Comments",
    "instagram-inbox": "Manage and respond to Instagram DMs and Comments",
    "whatsapp-inbox": "Manage and respond to Official WhatsApp Business API messages",
    "email-inbox": "Manage external emails sorted by department address",
    social: "Schedule and publish content to Facebook and Instagram",
    voice: "Monitor active Avaya calls and agent statuses",
    triage: "Review and map raw signals from social media lead forms to service categories",
    post_insights: "Analyze engagement and performance metrics for your published post",
  };

  const breadcrumbs = activeSection === "post_insights" ? [
    { label: "Social Publisher", onClick: () => setActiveSection("social") },
    { label: "Post Insights", active: true }
  ] : undefined;

  if (!user) return null;

  return (
    <DashboardLayout
      title="CIC CRM"
      subtitle="COMMUNICATIONS DASHBOARD"
      navGroups={navGroups}
      activeTab={activeSection}
      setActiveTab={setActiveSection}
      user={user}
      onLogout={handleLogout}
      loading={false}
      tabDescriptions={sectionDescriptions}
      sidebarStorageKey="communicationsSidebarCollapsed"
      breadcrumbs={breadcrumbs}
      noPadding={(activeSection === "social-media" || activeSection === "whatsapp-inbox" || activeSection === "email-inbox")}
    >
      <>
        {activeSection === "social-media" && (
          <div className="flex-1 flex flex-col h-full bg-slate-50/50">
            <Tabs value={activeSocialTab} onValueChange={setActiveSocialTab} className="flex-1 flex flex-col h-full">
              <div className="bg-white border-b border-gray-100 px-6 shrink-0">
                <TabsList className="bg-transparent h-14 w-full justify-start rounded-none p-0 flex gap-8">
                  <TabsTrigger 
                    value="facebook" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent h-full text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"
                  >
                    <Facebook className="h-4 w-4" />
                    Facebook
                  </TabsTrigger>
                  <TabsTrigger 
                    value="instagram" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-purple-600 data-[state=active]:text-purple-600 rounded-none border-b-2 border-transparent h-full text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"
                  >
                    <Instagram className="h-4 w-4" />
                    Instagram
                  </TabsTrigger>
                  <TabsTrigger 
                    value="linkedin" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-sky-600 data-[state=active]:text-sky-600 rounded-none border-b-2 border-transparent h-full text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"
                  >
                    <Linkedin className="h-4 w-4" />
                    LinkedIn
                  </TabsTrigger>
                  <TabsTrigger 
                    value="tiktok" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:text-black rounded-none border-b-2 border-transparent h-full text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"
                  >
                    <Music2 className="h-4 w-4" />
                    TikTok
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 flex overflow-hidden">
                <TabsContent value="facebook" className="m-0 flex-1 flex h-full border-none p-0 outline-none w-full bg-white">
                  <ConversationList 
                    platform="facebook"
                    activeConversationId={activeConversationId}
                    onSelectConversation={setActiveConversationId}
                  />
                  <ChatWindow conversationId={activeConversationId} />
                </TabsContent>
                
                <TabsContent value="instagram" className="m-0 flex-1 flex h-full border-none p-0 outline-none w-full bg-white">
                  <ConversationList 
                    platform="instagram"
                    activeConversationId={activeConversationId}
                    onSelectConversation={setActiveConversationId}
                  />
                  <ChatWindow conversationId={activeConversationId} />
                </TabsContent>

                <TabsContent value="linkedin" className="m-0 flex-1 flex h-full border-none p-0 outline-none items-center justify-center bg-transparent">
                  <div className="text-center max-w-md mx-auto p-6 flex flex-col items-center">
                    <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mb-4">
                      <Linkedin className="h-8 w-8 text-sky-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">LinkedIn Integration</h3>
                    <p className="text-sm text-gray-500">Coming soon! You will be able to manage LinkedIn messages and interactions directly from this hub.</p>
                  </div>
                </TabsContent>

                <TabsContent value="tiktok" className="m-0 flex-1 flex h-full border-none p-0 outline-none items-center justify-center bg-transparent">
                  <div className="text-center max-w-md mx-auto p-6 flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Music2 className="h-8 w-8 text-black" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">TikTok Integration</h3>
                    <p className="text-sm text-gray-500">Coming soon! You will be able to manage TikTok direct messages and comments directly from this hub.</p>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}

        {activeSection === "whatsapp-inbox" && (
          <div className="flex-1 flex flex-col overflow-hidden h-full">
            <div className="p-4 pb-0 shrink-0">
              <div className="px-8 py-5 rounded-2xl text-white shadow-sm relative overflow-hidden flex items-center justify-between bg-gradient-to-br from-[#128C7E] to-[#075E54]">
                <div className="absolute top-0 right-0 p-4 opacity-10 scale-150 transform translate-x-1/4 -translate-y-1/4 pointer-events-none">
                  <MessageCircle size={120} />
                </div>
                <div className="relative z-10 flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white border border-white/30">
                      <MessageCircle size={16} />
                    </div>
                    <h2 className="font-black text-xl tracking-tight capitalize shadow-black/10 drop-shadow-sm">
                      WhatsApp Inbox
                    </h2>
                  </div>
                  <p className="text-xs font-medium text-white/80 leading-relaxed max-w-[400px]">
                    Manage all your WhatsApp Business messages in one place.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex w-full flex-1 overflow-hidden">
              <ConversationList 
                platform="whatsapp"
                activeConversationId={activeConversationId}
                onSelectConversation={setActiveConversationId}
              />
              <ChatWindow conversationId={activeConversationId} />
            </div>
          </div>
        )}

        {activeSection === "email-inbox" && (
          <div className="flex-1 overflow-hidden">
            <EmailInbox />
          </div>
        )}

        {activeSection === "social" && (
          <SocialPublisher onViewInsights={(postId: string) => {
            setActivePostId(postId);
            setActiveSection("post_insights");
          }} />
        )}

        {activeSection === "post_insights" && activePostId && (
          <PostInsights 
            postId={activePostId} 
            onBack={() => setActiveSection("social")} 
          />
        )}

        {activeSection === "voice" && (
          <AvayaMonitor />
        )}

        {activeSection === "triage" && (
          <TriageTab onRefreshCases={() => {}} />
        )}
      </>
    </DashboardLayout>
  );
}
