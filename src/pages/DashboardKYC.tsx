import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { motion } from "framer-motion";
import {
  ShieldCheck, Upload, Camera, FileText, CheckCircle2,
  Clock, XCircle, Loader2, Video
} from "lucide-react";

type KYCStatus = "pending" | "approved" | "rejected" | "not_started";

const DOC_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID Card" },
  { value: "drivers_license", label: "Driver's License" },
];

const STRATEGY_OPTIONS = [
  "Scalping", "Day Trading", "Swing Trading", "Position Trading",
  "News Trading", "Algorithmic / EA Trading", "Other",
];

const EXPERIENCE_OPTIONS = [
  "Less than 1 year", "1-3 years", "3-5 years", "5-10 years", "10+ years",
];

const TRADING_STYLE_OPTIONS = [
  "Aggressive", "Moderate", "Conservative", "Mixed",
];

const DashboardKYC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string | null } | null>(null);
  const [checking, setChecking] = useState(true);
  const [kycStatus, setKycStatus] = useState<KYCStatus>("not_started");
  const [kycData, setKycData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [documentType, setDocumentType] = useState("passport");
  const [docFrontFile, setDocFrontFile] = useState<File | null>(null);
  const [docBackFile, setDocBackFile] = useState<File | null>(null);
  const [faceVideoFile, setFaceVideoFile] = useState<File | null>(null);
  const [strategy, setStrategy] = useState("");
  const [experience, setExperience] = useState("");
  const [tradingStyle, setTradingStyle] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    if (!meta) { meta = document.createElement("meta"); meta.name = "robots"; document.head.appendChild(meta); }
    meta.content = "noindex, nofollow";
    return () => { if (meta) meta.remove(); };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth"); return; }
    if (user) checkAccess();
  }, [user, authLoading]);

  const checkAccess = async () => {
    if (!user) return;
    setChecking(true);
    const [profileRes, kycRes] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
      supabase.from("kyc_submissions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
    ]);
    setProfile(profileRes.data);
    if (kycRes.data && kycRes.data.length > 0) {
      const kyc = kycRes.data[0] as any;
      setKycData(kyc);
      setKycStatus(kyc.status as KYCStatus);
      setDocumentType(kyc.document_type || "passport");
      setStrategy(kyc.preferred_trading_strategy || "");
      setExperience(kyc.trading_experience || "");
      setTradingStyle(kyc.occupation || "");
    }
    setChecking(false);
  };

  const uploadFile = async (file: File, path: string) => {
    const { data, error } = await supabase.storage
      .from("kyc-documents")
      .upload(path, file, { upsert: true });
    if (error) throw error;
    return data.path;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecordedBlob(blob);
        stream.getTracks().forEach(t => t.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.src = URL.createObjectURL(blob);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      // Auto stop after 30 seconds
      setTimeout(() => { if (mediaRecorderRef.current?.state === "recording") stopRecording(); }, 30000);
    } catch {
      toast.error("Camera access denied. Please allow camera permissions.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!docFrontFile && !kycData?.document_front_url) {
      toast.error("Please upload the front of your document");
      return;
    }
    if (!recordedBlob && !faceVideoFile && !kycData?.face_video_url) {
      toast.error("Please record a face verification video");
      return;
    }
    if (!strategy || !experience || !tradingStyle) {
      toast.error("Please fill in all additional questions");
      return;
    }

    setSaving(true);
    try {
      let frontUrl = kycData?.document_front_url || "";
      let backUrl = kycData?.document_back_url || "";
      let videoUrl = kycData?.face_video_url || "";

      if (docFrontFile) {
        frontUrl = await uploadFile(docFrontFile, `${user.id}/doc-front-${Date.now()}.${docFrontFile.name.split('.').pop()}`);
      }
      if (docBackFile) {
        backUrl = await uploadFile(docBackFile, `${user.id}/doc-back-${Date.now()}.${docBackFile.name.split('.').pop()}`);
      }
      const videoFile = recordedBlob ? new File([recordedBlob], "face-video.webm", { type: "video/webm" }) : faceVideoFile;
      if (videoFile) {
        videoUrl = await uploadFile(videoFile, `${user.id}/face-video-${Date.now()}.webm`);
      }

      const payload = {
        user_id: user.id,
        status: "pending" as const,
        document_type: documentType,
        document_front_url: frontUrl,
        document_back_url: backUrl,
        face_video_url: videoUrl,
        preferred_trading_strategy: strategy,
        trading_experience: experience,
        occupation: tradingStyle,
        source_of_funds: "",
      };

      if (kycData?.id && kycData.status === "pending") {
        await supabase.from("kyc_submissions").update(payload).eq("id", kycData.id);
      } else {
        await supabase.from("kyc_submissions").insert(payload);
      }

      toast.success("KYC submitted successfully! We'll review it shortly.");
      setKycStatus("pending");
      checkAccess();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to submit KYC: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,4%)] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[hsl(207,90%,77%)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }


  const statusBadge = {
    pending: { icon: Clock, label: "Under Review", color: "text-[hsl(45,90%,55%)]", bg: "bg-[hsl(45,90%,55%)]/10" },
    approved: { icon: CheckCircle2, label: "Approved", color: "text-[hsl(142,60%,50%)]", bg: "bg-[hsl(142,60%,50%)]/10" },
    rejected: { icon: XCircle, label: "Rejected — Please resubmit", color: "text-[hsl(0,70%,55%)]", bg: "bg-[hsl(0,70%,55%)]/10" },
    not_started: { icon: ShieldCheck, label: "Not Started", color: "text-[hsl(220,15%,50%)]", bg: "bg-[hsl(220,15%,15%)]" },
  }[kycStatus];

  const isEditable = kycStatus === "not_started" || kycStatus === "pending" || kycStatus === "rejected";

  return (
    <div className="min-h-screen bg-[hsl(220,20%,4%)] text-[hsl(0,0%,92%)] flex flex-col">
      <DashboardSidebar profile={profile} />
      <div className="flex flex-1 overflow-auto">
        <div className="hidden lg:block w-16 shrink-0" />
        <div className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck size={24} className="text-[hsl(207,90%,77%)]" />
              <h1 className="font-display text-xl sm:text-2xl font-bold">KYC Verification</h1>
            </div>
            <p className="text-sm text-[hsl(220,15%,50%)]">Complete your identity verification for secure trading and payouts.</p>
            <div className={`inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.color}`}>
              <statusBadge.icon size={14} />
              {statusBadge.label}
            </div>
            {kycData?.review_note && kycStatus === "rejected" && (
              <p className="mt-2 text-xs text-[hsl(0,70%,55%)] bg-[hsl(0,70%,55%)]/5 border border-[hsl(0,70%,55%)]/20 rounded-lg px-3 py-2">
                Admin note: {kycData.review_note}
              </p>
            )}
          </motion.div>

          {kycStatus === "approved" ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <CheckCircle2 size={48} className="text-[hsl(142,60%,50%)] mx-auto mb-4" />
              <h2 className="font-display text-xl font-bold mb-2">Verification Complete</h2>
              <p className="text-sm text-[hsl(220,15%,50%)]">Your identity has been verified. You're all set for payouts.</p>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {/* Section 1: Legal Document */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] rounded-2xl p-5 sm:p-6">
                <h2 className="font-display font-bold text-base mb-1 flex items-center gap-2">
                  <FileText size={18} className="text-[hsl(207,90%,77%)]" />
                  Legal Document
                </h2>
                <p className="text-xs text-[hsl(220,15%,45%)] mb-4">Upload a government-issued photo ID (passport, national ID, or driver's license).</p>

                <div className="mb-4">
                  <label className="text-xs font-medium text-[hsl(220,15%,60%)] mb-1.5 block">Document Type</label>
                  <select value={documentType} onChange={e => setDocumentType(e.target.value)} disabled={!isEditable}
                    className="w-full bg-[hsl(220,20%,10%)] border border-[hsl(220,15%,15%)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[hsl(207,90%,77%)]/40 disabled:opacity-50">
                    {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FileUploadBox
                    label="Front Side"
                    file={docFrontFile}
                    existingUrl={kycData?.document_front_url}
                    onSelect={setDocFrontFile}
                    disabled={!isEditable}
                  />
                  <FileUploadBox
                    label="Back Side (optional)"
                    file={docBackFile}
                    existingUrl={kycData?.document_back_url}
                    onSelect={setDocBackFile}
                    disabled={!isEditable}
                  />
                </div>
              </motion.div>

              {/* Section 2: Face Video */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] rounded-2xl p-5 sm:p-6">
                <h2 className="font-display font-bold text-base mb-1 flex items-center gap-2">
                  <Camera size={18} className="text-[hsl(207,90%,77%)]" />
                  Face Verification Video
                </h2>
                <p className="text-xs text-[hsl(220,15%,45%)] mb-4">Record a short video (max 30s) showing your face clearly. Hold your ID next to your face.</p>

                {isEditable && (
                  <div className="space-y-3">
                    <video ref={videoRef} className="w-full max-w-sm rounded-xl bg-black aspect-video mx-auto" playsInline muted={isRecording} />
                    <div className="flex items-center gap-3 justify-center">
                      {!isRecording ? (
                        <button onClick={startRecording}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[hsl(0,70%,50%)] hover:bg-[hsl(0,70%,45%)] text-white text-sm font-medium transition-colors">
                          <Video size={16} /> Start Recording
                        </button>
                      ) : (
                        <button onClick={stopRecording}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[hsl(220,15%,20%)] hover:bg-[hsl(220,15%,25%)] text-white text-sm font-medium transition-colors">
                          <XCircle size={16} /> Stop Recording
                        </button>
                      )}
                    </div>
                    {recordedBlob && (
                      <p className="text-xs text-[hsl(142,60%,50%)] text-center">✓ Video recorded ({(recordedBlob.size / 1024 / 1024).toFixed(1)} MB)</p>
                    )}
                    <div className="text-center text-xs text-[hsl(220,15%,35%)]">— or upload a video file —</div>
                    <label className="block cursor-pointer">
                      <input type="file" accept="video/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { setFaceVideoFile(e.target.files[0]); setRecordedBlob(null); } }} />
                      <div className="border border-dashed border-[hsl(220,15%,20%)] rounded-xl px-4 py-3 text-center text-xs text-[hsl(220,15%,45%)] hover:border-[hsl(207,90%,77%)]/30 transition-colors">
                        <Upload size={14} className="inline mr-1" /> Click to upload video
                        {faceVideoFile && <span className="block mt-1 text-[hsl(142,60%,50%)]">✓ {faceVideoFile.name}</span>}
                      </div>
                    </label>
                  </div>
                )}
                {!isEditable && kycData?.face_video_url && (
                  <p className="text-xs text-[hsl(142,60%,50%)]">✓ Face video uploaded</p>
                )}
              </motion.div>

              {/* Section 3: Additional Questions */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] rounded-2xl p-5 sm:p-6">
                <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
                  <FileText size={18} className="text-[hsl(207,90%,77%)]" />
                  Trading Strategy
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[hsl(220,15%,60%)] mb-1.5 block">Trading Style *</label>
                    <select value={tradingStyle} onChange={e => setTradingStyle(e.target.value)} disabled={!isEditable}
                      className="w-full bg-[hsl(220,20%,10%)] border border-[hsl(220,15%,15%)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[hsl(207,90%,77%)]/40 disabled:opacity-50">
                      <option value="">Select...</option>
                      {TRADING_STYLE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[hsl(220,15%,60%)] mb-1.5 block">Preferred Trading Strategy *</label>
                    <select value={strategy} onChange={e => setStrategy(e.target.value)} disabled={!isEditable}
                      className="w-full bg-[hsl(220,20%,10%)] border border-[hsl(220,15%,15%)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[hsl(207,90%,77%)]/40 disabled:opacity-50">
                      <option value="">Select...</option>
                      {STRATEGY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[hsl(220,15%,60%)] mb-1.5 block">Trading Experience *</label>
                    <select value={experience} onChange={e => setExperience(e.target.value)} disabled={!isEditable}
                      className="w-full bg-[hsl(220,20%,10%)] border border-[hsl(220,15%,15%)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[hsl(207,90%,77%)]/40 disabled:opacity-50">
                      <option value="">Select...</option>
                      {EXPERIENCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </motion.div>

              {/* Submit */}
              {isEditable && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                  <button onClick={handleSubmit} disabled={saving}
                    className="w-full py-3.5 rounded-xl bg-[hsl(207,90%,77%)] hover:bg-[hsl(207,90%,72%)] text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    {saving ? "Submitting..." : kycData ? "Update KYC Submission" : "Submit KYC Verification"}
                  </button>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Reusable file upload box
const FileUploadBox = ({ label, file, existingUrl, onSelect, disabled }: {
  label: string; file: File | null; existingUrl?: string; onSelect: (f: File) => void; disabled: boolean;
}) => (
  <div>
    <label className="text-xs font-medium text-[hsl(220,15%,60%)] mb-1.5 block">{label}</label>
    <label className={`block cursor-pointer ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) onSelect(e.target.files[0]); }} />
      <div className="border border-dashed border-[hsl(220,15%,20%)] rounded-xl px-4 py-6 text-center hover:border-[hsl(207,90%,77%)]/30 transition-colors">
        <Upload size={20} className="mx-auto mb-2 text-[hsl(220,15%,35%)]" />
        <p className="text-xs text-[hsl(220,15%,45%)]">Click to upload</p>
        {file && <p className="text-xs text-[hsl(142,60%,50%)] mt-1">✓ {file.name}</p>}
        {!file && existingUrl && <p className="text-xs text-[hsl(142,60%,50%)] mt-1">✓ Previously uploaded</p>}
      </div>
    </label>
  </div>
);

export default DashboardKYC;
