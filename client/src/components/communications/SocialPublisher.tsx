import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Image as ImageIcon, Link2, Send, Clock, Facebook, Instagram, Loader2, AlertCircle, RefreshCw, BarChart2, CheckCircle2, EyeOff, UploadCloud, X, Edit3, ImagePlus, Share2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { apiRequest } from "../../lib/api-client";
import { useToast } from "../../hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SocialPublisherProps {
  onViewInsights?: (postId: string) => void;
}

export function SocialPublisher({ onViewInsights }: SocialPublisherProps = {}) {
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["facebook"]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string>("");

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: pagesData } = useQuery({
    queryKey: ["social", "pages"],
    queryFn: async () => {
      const res = await apiRequest("/api/social/pages");
      if (!res.ok) throw new Error("Failed to load pages");
      return res.json();
    }
  });

  const fbPages = pagesData?.pages?.filter((p: any) => p.platform === "facebook") || [];
  
  useEffect(() => {
    if (fbPages.length > 0 && !selectedPageId) {
      setSelectedPageId(fbPages[0].id);
    }
  }, [fbPages]);

  const { data: postsData, isLoading: historyLoading } = useQuery({
    queryKey: ["social", "posts"],
    queryFn: async () => {
      const res = await apiRequest("/api/social/posts?limit=50");
      if (!res.ok) throw new Error("Failed to load posts");
      return res.json();
    }
  });

  const publishMutation = useMutation({
    mutationFn: async ({ publishNow }: { publishNow: boolean }) => {
      const platform = selectedPlatforms.length === 2 ? "both" : selectedPlatforms[0];
      if (!platform) throw new Error("Select at least one platform");

      const body: any = {
        platform,
        contentText: content,
        mediaUrls: imageUrl ? [imageUrl] : [],
        publishNow,
      };

      if (selectedPlatforms.includes("facebook")) {
        body.pageId = selectedPageId;
      }

      if (!publishNow && scheduledDate) {
        body.scheduledFor = new Date(scheduledDate).toISOString();
      }

      const res = await apiRequest("/api/social/posts", {
        method: "POST",
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to publish");
      }
      return res.json();
    },
    onSuccess: (data, { publishNow }) => {
      toast({ title: publishNow ? "Published" : "Scheduled", description: publishNow ? "Your post is now live!" : "Your post has been scheduled." });
      setContent("");
      setImageUrl("");
      setScheduledDate("");
      setShowSchedule(false);
      qc.invalidateQueries({ queryKey: ["social", "posts"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const togglePlatform = (platform: string) => {
    if (selectedPlatforms.includes(platform)) {
      if (selectedPlatforms.length > 1) {
        setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
      }
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 100MB", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const token = localStorage.getItem("marketingToken");
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/social/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setImageUrl(data.url);
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isPublishing = publishMutation.isPending;
  const canPublish = content.trim().length > 0 && selectedPlatforms.length > 0 && (selectedPlatforms.includes("instagram") ? imageUrl.length > 0 : true);

  const pendingPosts = postsData?.posts?.filter((p: any) => p.status === "scheduled" || p.status === "draft") || [];
  const publishedPosts = postsData?.posts?.filter((p: any) => p.status === "published" || p.status === "failed") || [];

  return (
    <div className="flex-1 overflow-auto bg-[#f8fafc] p-4 md:p-6 custom-scrollbar h-full w-full">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* Header Card mimicking Campaigns Tab */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-[#004E98]">
              <Share2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Social Publisher</h2>
              <p className="text-sm text-gray-500 mt-1">Create, schedule, and manage posts across Facebook and Instagram.</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="compose" className="w-full">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 bg-transparent px-6 pt-2">
            <TabsList className="bg-transparent h-12 gap-8 border-none p-0 flex">
              <TabsTrigger 
                value="compose" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"
              >
                <Edit3 className="h-4 w-4" />
                Compose Post
              </TabsTrigger>
              <TabsTrigger 
                value="queue" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                Scheduled Queue ({pendingPosts.length})
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#004E98] data-[state=active]:text-[#004E98] rounded-none border-b-2 border-transparent px-2 h-full text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Published History
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="compose" className="mt-4 outline-none w-full">
            <div className="flex flex-col gap-8">
              
              {/* Section 1: Target Platforms */}
              <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-6 h-6 rounded-full bg-blue-50 text-[#004E98] flex items-center justify-center text-xs font-black">1</div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Target Platforms</h3>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => togglePlatform("facebook")}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 transition-all text-sm font-bold",
                      selectedPlatforms.includes("facebook") 
                        ? "border-[#004E98] bg-blue-50 text-[#004E98]" 
                        : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                    )}
                  >
                    <Facebook size={16} />
                    Facebook Page
                  </button>
                  <button 
                    onClick={() => togglePlatform("instagram")}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 transition-all text-sm font-bold",
                      selectedPlatforms.includes("instagram") 
                        ? "border-pink-500 bg-pink-50 text-pink-700" 
                        : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                    )}
                  >
                    <Instagram size={16} />
                    Instagram Profile
                  </button>
                  
                  {/* Future platforms disabled */}
                  <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-200 border-dashed text-slate-400 bg-slate-50/50 cursor-not-allowed text-sm font-bold opacity-70">
                    <span className="font-serif italic font-bold">X</span> (Twitter)
                  </div>
                  <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-200 border-dashed text-slate-400 bg-slate-50/50 cursor-not-allowed text-sm font-bold opacity-70">
                    LinkedIn
                  </div>
                  <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-200 border-dashed text-slate-400 bg-slate-50/50 cursor-not-allowed text-sm font-bold opacity-70">
                    TikTok
                  </div>
                </div>

                {selectedPlatforms.includes("facebook") && fbPages.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-100 flex items-center gap-4">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Selected Facebook Page:</label>
                    <select 
                      className="w-64 bg-white border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#004E98]/20 focus:border-[#004E98] transition-all outline-none shadow-sm"
                      value={selectedPageId}
                      onChange={(e) => setSelectedPageId(e.target.value)}
                    >
                      {fbPages.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.pageName}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Section 2: Media Upload */}
              <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm flex flex-col relative overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-50 text-[#004E98] flex items-center justify-center text-xs font-black">2</div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Media Upload</h3>
                  </div>
                  
                  {/* Dynamic validation helper */}
                  {selectedPlatforms.includes("instagram") ? (
                    <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 bg-amber-50 text-amber-700 rounded-full flex items-center gap-1.5 border border-amber-200">
                      <AlertCircle size={12} /> Required for Instagram
                    </span>
                  ) : (
                    <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 bg-slate-50 text-slate-500 rounded-full border border-slate-200">
                      Optional
                    </span>
                  )}
                </div>
                
                {!imageUrl ? (
                  <div 
                    className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 hover:border-[#004E98]/50 transition-all group relative overflow-hidden bg-slate-50/30"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <Loader2 className="h-12 w-12 text-[#004E98] animate-spin mb-4" />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center mb-5 group-hover:bg-blue-50 group-hover:text-[#004E98] transition-colors text-slate-400">
                        <ImagePlus size={24} />
                      </div>
                    )}
                    <h4 className="text-base font-bold text-slate-800 mb-1">
                      {isUploading ? "Uploading media..." : "Click or drag to upload media"}
                    </h4>
                    <p className="text-xs font-medium text-slate-500 max-w-sm mt-2 leading-relaxed">
                      Supports JPG, PNG, and MP4 formats. Max file size is 100MB. <br/>
                      {selectedPlatforms.includes("instagram") && <span className="text-amber-600 font-bold">An image or video is mandatory because Instagram is selected.</span>}
                    </p>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*,video/mp4,video/quicktime"
                      onChange={handleFileUpload} 
                    />
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex justify-center items-center p-6">
                    {imageUrl.match(/\.(mp4|mov|avi)$/i) ? (
                       <video src={imageUrl} controls className="w-full max-w-lg rounded-xl shadow-md border border-slate-200 bg-black" />
                    ) : (
                       <img src={imageUrl} alt="Uploaded media" className="w-full max-w-lg rounded-xl shadow-md border border-slate-200" />
                    )}
                    <button 
                      onClick={() => setImageUrl("")}
                      className="absolute top-4 right-4 h-10 w-10 bg-white/90 backdrop-blur hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-full flex items-center justify-center transition-colors shadow-sm border border-slate-200"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>

              {/* Section 3: Content & Schedule */}
              <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm flex flex-col relative overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-6 h-6 rounded-full bg-blue-50 text-[#004E98] flex items-center justify-center text-xs font-black">3</div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Content & Schedule</h3>
                </div>

                <div className="relative">
                  <textarea
                    className="w-full min-h-[200px] p-5 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#004E98]/10 focus:border-[#004E98] resize-none text-sm font-medium text-slate-800 placeholder:text-slate-400 shadow-sm transition-all leading-relaxed"
                    placeholder="Write an engaging caption for your audience..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                  <div className="absolute bottom-4 right-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white/80 backdrop-blur px-2 py-1 rounded">
                    {content.length} characters
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setShowSchedule(!showSchedule)}
                        className={cn(
                          "flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 transition-all text-sm font-bold", 
                          showSchedule 
                            ? "border-[#004E98] text-[#004E98] bg-blue-50"
                            : "bg-white border-slate-200 hover:border-slate-300 text-slate-600"
                        )}
                      >
                        <Clock size={16} />
                        {showSchedule ? "Cancel Schedule" : "Schedule for Later"}
                      </button>
                      
                      {showSchedule && (
                        <div className="flex items-center gap-3">
                          <Calendar size={16} className="text-slate-400" />
                          <input
                            type="datetime-local"
                            className="bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-[#004E98]/10 focus:border-[#004E98] transition-all outline-none"
                            value={scheduledDate}
                            onChange={e => setScheduledDate(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                          />
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => publishMutation.mutate({ publishNow: !showSchedule })}
                      disabled={isPublishing || !canPublish || (showSchedule && !scheduledDate) || isUploading}
                      className="flex items-center gap-2 px-8 py-3.5 text-white bg-[#004E98] rounded-xl hover:bg-[#003d7a] transition-all font-bold shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:shadow-none text-sm"
                    >
                      {isPublishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      {showSchedule ? "Schedule Post" : "Publish Now"}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </TabsContent>

          <TabsContent value="queue" className="mt-0 outline-none w-full">
             <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Scheduled Queue</h3>
                  <button onClick={() => qc.invalidateQueries({ queryKey: ["social", "posts"] })} className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-[#004E98] hover:bg-blue-50 transition-colors">
                    <RefreshCw size={14} className={historyLoading ? "animate-spin" : ""} />
                  </button>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pendingPosts.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center col-span-full py-12 font-medium">No posts in queue.</p>
                  ) : (
                    pendingPosts.map((post: any) => (
                      <div key={post.id} className="p-5 border border-slate-100 rounded-2xl bg-slate-50/50 hover:bg-white hover:shadow-lg transition-all group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                               {post.platform === "facebook" ? <Facebook size={16} className="text-[#004E98]" /> : <Instagram size={16} className="text-pink-600" />}
                            </div>
                            <span className="text-xs font-bold text-slate-700 capitalize">{post.platform}</span>
                          </div>
                          <span className="text-[10px] uppercase tracking-widest font-black text-amber-600 bg-amber-100 px-2 py-1 rounded-md flex items-center gap-1"><Clock size={10}/> Scheduled</span>
                        </div>
                        {post.mediaUrls?.[0] && (
                           <div className="w-full h-32 bg-slate-200 rounded-xl mb-4 overflow-hidden">
                              {post.mediaUrls[0].match(/\.(mp4|mov|avi)$/i) ? (
                                 <video src={post.mediaUrls[0]} className="w-full h-full object-cover" />
                              ) : (
                                 <img src={post.mediaUrls[0]} className="w-full h-full object-cover" />
                              )}
                           </div>
                        )}
                        <p className="text-sm text-slate-600 line-clamp-3 font-medium">{post.contentText}</p>
                        <div className="mt-4 pt-4 border-t border-slate-200 text-xs font-bold text-slate-400">
                          {post.scheduledFor ? `Scheduled: ${new Date(post.scheduledFor).toLocaleString()}` : 'Draft'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
             </div>
          </TabsContent>

          <TabsContent value="history" className="mt-0 outline-none w-full">
             <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Published History</h3>
                  <button onClick={() => qc.invalidateQueries({ queryKey: ["social", "posts"] })} className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-[#004E98] hover:bg-blue-50 transition-colors">
                    <RefreshCw size={14} className={historyLoading ? "animate-spin" : ""} />
                  </button>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {publishedPosts.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center col-span-full py-12 font-medium">No published posts yet.</p>
                  ) : (
                    publishedPosts.map((post: any) => (
                      <div 
                        key={post.id} 
                        className={cn(
                          "p-5 border border-slate-100 rounded-2xl bg-white transition-all group relative overflow-hidden",
                          post.status === "published" ? "cursor-pointer hover:shadow-xl hover:border-[#004E98]/30" : "hover:shadow-md"
                        )}
                        onClick={() => {
                          if (post.status === "published" && onViewInsights) {
                            onViewInsights(post.id);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-4 relative z-10">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                               {post.platform === "facebook" ? <Facebook size={16} className="text-[#004E98]" /> : <Instagram size={16} className="text-pink-600" />}
                            </div>
                            <span className="text-xs font-bold text-slate-700 capitalize">{post.platform}</span>
                          </div>
                          {post.status === "published" ? (
                            <span className="text-[10px] uppercase tracking-widest font-black text-[#01a64e] bg-[#01a64e]/10 px-2 py-1 rounded-md flex items-center gap-1"><CheckCircle2 size={10}/> Published</span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-widest font-black text-red-600 bg-red-100 px-2 py-1 rounded-md flex items-center gap-1"><AlertCircle size={10}/> Failed</span>
                          )}
                        </div>
                        {post.mediaUrls?.[0] && (
                           <div className="w-full h-40 bg-slate-100 rounded-xl mb-4 overflow-hidden relative z-10">
                              {post.mediaUrls[0].match(/\.(mp4|mov|avi)$/i) ? (
                                 <video src={post.mediaUrls[0]} className="w-full h-full object-cover" />
                              ) : (
                                 <img src={post.mediaUrls[0]} className="w-full h-full object-cover" />
                              )}
                           </div>
                        )}
                        <p className="text-sm text-slate-700 line-clamp-3 font-medium relative z-10">{post.contentText}</p>
                        <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 relative z-10">
                          {post.publishedAt ? new Date(post.publishedAt).toLocaleString() : new Date(post.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
             </div>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
