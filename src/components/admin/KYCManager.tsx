import { useState, useEffect } from "react";
import { db as supabase } from "@/integrations/db/client";
import { toast } from "sonner";
import {
  ShieldCheck, CheckCircle2, XCircle, Clock, Eye, ChevronDown,
  ChevronUp, FileText, Video, User, Search, Filter
} from "lucide-react";

interface KYCSubmission {
  id: string;
  user_id: string;
  status: string;
  document_type: string | null;
  document_front_url: string | null;
  document_back_url: string | null;
  face_video_url: string | null;
  preferred_trading_strategy: string | null;
  trading_experience: string | null;
  occupation: string | null;
  source_of_funds: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Profile {
  user_id: string;
  display_name: string | null;
  email: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: "Pending", color: "text-amber-600", bg: "bg-amber-50", icon: Clock },
  approved: { label: "Approved", color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "text-red-600", bg: "bg-red-50", icon: XCircle },
};

const KYCManager = () => {
  const [submissions, setSubmissions] = useState<KYCSubmission[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [kycRes, profilesRes] = await Promise.all([
      supabase.from("kyc_submissions").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, display_name, email"),
    ]);
    setSubmissions((kycRes.data as KYCSubmission[]) || []);
    setProfiles((profilesRes.data as Profile[]) || []);
    setLoading(false);
  };

  const getProfile = (userId: string) => profiles.find(p => p.user_id === userId);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    const sub = submissions.find(s => s.id === id);
    const { error } = await supabase.from("kyc_submissions").update({
      status,
      review_note: reviewNote || null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error(error.message); setUpdating(null); return; }

    // Send email notification
    if (sub && (status === "approved" || status === "rejected")) {
      const profile = getProfile(sub.user_id);
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            type: status === "approved" ? "kyc_approved" : "kyc_rejected",
            recipientUserId: sub.user_id,
            data: {
              displayName: profile?.display_name || "",
              reviewNote: reviewNote || "",
            },
          },
        });
      } catch (err) {
        console.error("Failed to send KYC email:", err);
      }
    }

    toast.success(`KYC ${status}!`);
    setExpandedId(null);
    setReviewNote("");
    fetchData();
    setUpdating(null);
  };

  const getSignedUrl = async (path: string) => {
    const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Could not generate download link");
  };

  const filtered = submissions.filter(s => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (search) {
      const p = getProfile(s.user_id);
      const q = search.toLowerCase();
      if (!(p?.display_name?.toLowerCase().includes(q) || p?.email?.toLowerCase().includes(q) || s.user_id.includes(q))) return false;
    }
    return true;
  });

  const counts = {
    all: submissions.length,
    pending: submissions.filter(s => s.status === "pending").length,
    approved: submissions.filter(s => s.status === "approved").length,
    rejected: submissions.filter(s => s.status === "rejected").length,
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-[hsl(0,0%,50%)]"><Clock className="animate-spin mr-2" size={18} /> Loading KYC submissions...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["all", "pending", "approved", "rejected"] as const).map(key => {
          const cfg = key === "all" ? { label: "Total", color: "text-gray-700", bg: "bg-gray-50", icon: ShieldCheck } : STATUS_CONFIG[key];
          return (
            <button key={key} onClick={() => setStatusFilter(key)}
              className={`p-4 rounded-xl border transition-all text-left ${statusFilter === key ? "border-[hsl(0,0%,0%)] shadow-sm" : "border-[hsl(0,0%,90%)]"} ${cfg.bg}`}>
              <div className="flex items-center gap-2 mb-1">
                <cfg.icon size={16} className={cfg.color} />
                <span className="text-xs font-medium text-[hsl(0,0%,50%)]">{cfg.label}</span>
              </div>
              <p className="text-2xl font-bold text-[hsl(0,0%,10%)]">{counts[key]}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(0,0%,50%)]" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or user ID..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[hsl(0,0%,88%)] text-sm outline-none focus:border-[hsl(0,0%,50%)]" />
      </div>

      {/* Submissions list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[hsl(0,0%,50%)]">
          <ShieldCheck size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No KYC submissions found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sub => {
            const profile = getProfile(sub.user_id);
            const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.pending;
            const isExpanded = expandedId === sub.id;

            return (
              <div key={sub.id} className="border border-[hsl(0,0%,90%)] rounded-xl overflow-hidden bg-white">
                {/* Row header */}
                <button onClick={() => { setExpandedId(isExpanded ? null : sub.id); setReviewNote(sub.review_note || ""); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[hsl(0,0%,97%)] transition-colors text-left">
                  <div className="w-8 h-8 rounded-full bg-[hsl(0,0%,93%)] flex items-center justify-center text-xs font-bold text-[hsl(0,0%,40%)]">
                    {(profile?.display_name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[hsl(0,0%,10%)] truncate">{profile?.display_name || "Unknown User"}</p>
                    <p className="text-[11px] text-[hsl(0,0%,50%)] truncate">{profile?.email || sub.user_id}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
                    <cfg.icon size={12} /> {cfg.label}
                  </span>
                  <span className="text-[11px] text-[hsl(0,0%,50%)] hidden sm:inline">{new Date(sub.created_at).toLocaleDateString()}</span>
                  {isExpanded ? <ChevronUp size={16} className="text-[hsl(0,0%,50%)]" /> : <ChevronDown size={16} className="text-[hsl(0,0%,50%)]" />}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-[hsl(0,0%,93%)] px-4 py-4 space-y-4 bg-[hsl(0,0%,99%)]">
                    {/* Documents */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-white border border-[hsl(0,0%,90%)] rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-[hsl(0,0%,50%)] uppercase mb-1">Document Type</p>
                        <p className="text-sm font-medium">{sub.document_type || "—"}</p>
                      </div>
                      <div className="bg-white border border-[hsl(0,0%,90%)] rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-[hsl(0,0%,50%)] uppercase mb-1">Front Side</p>
                        {sub.document_front_url ? (
                          <button onClick={() => getSignedUrl(sub.document_front_url!)}
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                            <Eye size={14} /> View Document
                          </button>
                        ) : <p className="text-sm text-[hsl(0,0%,60%)]">Not uploaded</p>}
                      </div>
                      <div className="bg-white border border-[hsl(0,0%,90%)] rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-[hsl(0,0%,50%)] uppercase mb-1">Back Side</p>
                        {sub.document_back_url ? (
                          <button onClick={() => getSignedUrl(sub.document_back_url!)}
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                            <Eye size={14} /> View Document
                          </button>
                        ) : <p className="text-sm text-[hsl(0,0%,60%)]">Not uploaded</p>}
                      </div>
                    </div>

                    {/* Face Video */}
                    <div className="bg-white border border-[hsl(0,0%,90%)] rounded-lg p-3">
                      <p className="text-[10px] font-semibold text-[hsl(0,0%,50%)] uppercase mb-1">Face Verification Video</p>
                      {sub.face_video_url ? (
                        <button onClick={() => getSignedUrl(sub.face_video_url!)}
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                          <Video size={14} /> Watch Video
                        </button>
                      ) : <p className="text-sm text-[hsl(0,0%,60%)]">Not recorded</p>}
                    </div>

                    {/* Additional Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: "Trading Strategy", value: sub.preferred_trading_strategy },
                        { label: "Experience", value: sub.trading_experience },
                        { label: "Occupation", value: sub.occupation },
                        { label: "Source of Funds", value: sub.source_of_funds },
                      ].map(item => (
                        <div key={item.label} className="bg-white border border-[hsl(0,0%,90%)] rounded-lg p-3">
                          <p className="text-[10px] font-semibold text-[hsl(0,0%,50%)] uppercase mb-1">{item.label}</p>
                          <p className="text-sm">{item.value || "—"}</p>
                        </div>
                      ))}
                    </div>

                    {/* Review Section */}
                    <div className="border-t border-[hsl(0,0%,90%)] pt-4">
                      <label className="text-xs font-semibold text-[hsl(0,0%,40%)] block mb-1.5">Admin Review Note</label>
                      <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                        placeholder="Add a note (visible to user on rejection)..."
                        rows={2}
                        className="w-full border border-[hsl(0,0%,88%)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[hsl(0,0%,50%)] resize-none" />
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => updateStatus(sub.id, "approved")} disabled={updating === sub.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                          <CheckCircle2 size={14} /> Approve
                        </button>
                        <button onClick={() => updateStatus(sub.id, "rejected")} disabled={updating === sub.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                          <XCircle size={14} /> Reject
                        </button>
                        {sub.status !== "pending" && (
                          <button onClick={() => updateStatus(sub.id, "pending")} disabled={updating === sub.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
                            <Clock size={14} /> Reset to Pending
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default KYCManager;
