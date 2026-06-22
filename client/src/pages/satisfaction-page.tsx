import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function SatisfactionPage() {
  const [token, setToken] = useState<string>("");
  const [caseInfo, setCaseInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const pathParts = window.location.pathname.split("/");
    const tokenFromUrl = pathParts[pathParts.length - 1];
    setToken(tokenFromUrl);

    fetch(`/api/satisfaction/rate/${tokenFromUrl}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Invalid link");
          return;
        }
        if (data.alreadyRated) {
          setAlreadyRated(true);
          setCaseInfo(data);
        } else {
          setCaseInfo(data);
        }
      })
      .catch(() => setError("Unable to load rating form"))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/satisfaction/rate/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, feedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  const ratingLabels = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-lg font-medium">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl shadow-red-500/5 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link Expired or Invalid</h2>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (alreadyRated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl shadow-blue-500/5 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✅</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Already Rated</h2>
          <p className="text-gray-500 text-sm">You have already submitted feedback for case {caseInfo?.caseNumber}. Thank you!</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl shadow-emerald-500/10 p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">🎉</span>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-500 text-sm mb-1">Your feedback for case <strong>{caseInfo?.caseNumber}</strong> has been recorded.</p>
          <p className="text-gray-400 text-xs">You can close this page now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl shadow-blue-500/10 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#004E98] to-[#003366] p-6 text-center">
          <h1 className="text-white text-lg font-black tracking-tight">KASNEB CRM</h1>
          <p className="text-white/60 text-[10px] uppercase tracking-[3px] mt-1">Service Feedback</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Case info card */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Case Reference</p>
            <p className="text-base font-black text-gray-900">{caseInfo?.caseNumber}</p>
            <p className="text-sm text-gray-500 mt-1">{caseInfo?.title}</p>
          </div>

          {/* Star rating */}
          <div className="text-center space-y-3">
            <p className="text-sm font-bold text-gray-700">How was your experience?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-all duration-200 hover:scale-125 active:scale-95"
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      star <= (hoveredRating || rating)
                        ? "fill-amber-400 text-amber-400"
                        : "fill-none text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            {(hoveredRating || rating) > 0 && (
              <p className="text-xs font-bold text-amber-600 animate-in fade-in">
                {ratingLabels[hoveredRating || rating]}
              </p>
            )}
          </div>

          {/* Feedback */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
              Additional Comments (Optional)
            </label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us more about your experience..."
              className="rounded-xl border-gray-200 bg-gray-50/50 min-h-[80px] text-sm resize-none"
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!rating || submitting}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#004E98] to-[#003366] text-white font-bold text-sm shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:shadow-none"
          >
            {submitting ? "Submitting..." : "Submit Feedback"}
          </Button>

          <p className="text-center text-[11px] text-gray-400">
            Your feedback helps us improve our services.
          </p>
        </div>
      </div>
    </div>
  );
}
