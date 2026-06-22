import { useState, useEffect } from "react";
import { ArrowLeft, BarChart2, Eye, Heart, MessageCircle, Share2, Bookmark, MousePointerClick, RefreshCw, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface PostInsightsProps {
  postId: string;
  onBack: () => void;
}

export function PostInsights({ postId, onBack }: PostInsightsProps) {
  const { data: insightsData, isLoading, error, refetch } = useQuery({
    queryKey: ["social", "insights", postId],
    queryFn: async () => {
      const token = localStorage.getItem("marketingToken");
      const res = await fetch(`/api/social/posts/${postId}/insights`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch insights");
      }
      return res.json();
    },
    staleTime: 60000,
  });

  const post = insightsData?.post;
  const metrics = insightsData?.metrics;
  const platform = post?.platforms?.[0] || "facebook"; // Default fallback

  return (
    <div className="flex-1 overflow-auto bg-[#f8fafc] p-6 custom-scrollbar h-full w-full">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={onBack} className="rounded-xl shadow-sm border-gray-200">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Button>
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">Post Analytics</h2>
              <p className="text-sm text-gray-500 font-medium">Real-time performance metrics</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading} className="rounded-xl shadow-sm border-gray-200 gap-2 font-bold text-gray-700">
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh Data
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <RefreshCw className="h-10 w-10 text-[#004E98] animate-spin" />
            <p className="text-sm font-bold text-gray-500">Syncing with Meta Graph API...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
            <h3 className="text-lg font-bold text-red-800 mb-2">Failed to load insights</h3>
            <p className="text-sm text-red-600 mb-6 max-w-md">{(error as Error).message}</p>
            <Button variant="outline" onClick={() => refetch()} className="border-red-200 text-red-700 hover:bg-red-100">Try Again</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            {/* Post Preview Card */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-6">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-500">Post Preview</span>
                  <span className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest",
                    platform === "facebook" ? "bg-blue-100 text-[#004E98]" : "bg-pink-100 text-pink-700"
                  )}>
                    {platform}
                  </span>
                </div>
                {post?.imageUrl && (
                  <div className="aspect-square bg-black overflow-hidden relative group">
                    {post.imageUrl.match(/\.(mp4|mov|avi)$/i) ? (
                       <video src={post.imageUrl} className="w-full h-full object-cover" controls />
                    ) : (
                       <img src={post.imageUrl} alt="Post content" className="w-full h-full object-cover" />
                    )}
                  </div>
                )}
                <div className="p-5">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{post?.content}</p>
                  <p className="text-xs text-gray-400 mt-4 font-medium">Published on {new Date(post?.scheduledTime || post?.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Metrics Dashboard */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Primary Score */}
              <div className="bg-gradient-to-br from-[#004E98] to-[#003A70] rounded-2xl p-8 text-white shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 p-8 opacity-10">
                  <BarChart2 size={120} />
                </div>
                <div className="relative z-10">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white/80 mb-2">Success Score</h3>
                  <div className="flex items-end gap-3">
                    <span className="text-6xl font-black tracking-tighter">{metrics?.successScore || 0}</span>
                    <span className="text-lg font-medium text-white/70 mb-2">/ 100</span>
                  </div>
                  <p className="text-xs font-medium text-white/70 mt-4 max-w-sm">
                    Based on relative engagement rates, reach, and interaction quality compared to your average performance.
                  </p>
                </div>
              </div>

              {/* Grid Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Card className="border-gray-100 shadow-sm rounded-2xl">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs font-bold text-gray-500 uppercase">Reach</CardTitle>
                    <Eye className="h-4 w-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-black text-gray-900">{metrics?.reach?.toLocaleString() || 0}</div>
                    <p className="text-[10px] font-bold text-gray-400 mt-1">Unique accounts</p>
                  </CardContent>
                </Card>

                <Card className="border-gray-100 shadow-sm rounded-2xl">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs font-bold text-gray-500 uppercase">Engagement</CardTitle>
                    <MousePointerClick className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-black text-gray-900">{metrics?.engagement?.toLocaleString() || 0}</div>
                    <p className="text-[10px] font-bold text-gray-400 mt-1">Total interactions</p>
                  </CardContent>
                </Card>

                <Card className="border-gray-100 shadow-sm rounded-2xl">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs font-bold text-gray-500 uppercase">Likes</CardTitle>
                    <Heart className="h-4 w-4 text-pink-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-black text-gray-900">{metrics?.likes?.toLocaleString() || 0}</div>
                  </CardContent>
                </Card>

                <Card className="border-gray-100 shadow-sm rounded-2xl">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs font-bold text-gray-500 uppercase">Comments</CardTitle>
                    <MessageCircle className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-black text-gray-900">{metrics?.comments?.toLocaleString() || 0}</div>
                  </CardContent>
                </Card>

                <Card className="border-gray-100 shadow-sm rounded-2xl">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs font-bold text-gray-500 uppercase">Shares</CardTitle>
                    <Share2 className="h-4 w-4 text-indigo-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-black text-gray-900">{metrics?.shares?.toLocaleString() || 0}</div>
                  </CardContent>
                </Card>

                <Card className="border-gray-100 shadow-sm rounded-2xl">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs font-bold text-gray-500 uppercase">Saves</CardTitle>
                    <Bookmark className="h-4 w-4 text-cyan-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-black text-gray-900">{metrics?.saves?.toLocaleString() || 0}</div>
                  </CardContent>
                </Card>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
