import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Award, Trash2, Eye, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface UserCertificate {
  id: string;
  user_id: string;
  certificate_type: string;
  account_number: string | null;
  stats: Record<string, any>;
  title: string;
  description: string | null;
  created_at: string;
}

const UserCertificatesCMS = () => {
  const [certificates, setCertificates] = useState<UserCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewCert, setPreviewCert] = useState<UserCertificate | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, any> | null>(null);

  useEffect(() => { fetchCerts(); }, []);

  const fetchCerts = async () => {
    const { data } = await supabase
      .from("user_certificates")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setCertificates(data as any);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setLastResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); setUploading(false); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/parse-mt5-statement`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      const result = await res.json();
      setLastResult(result);

      if (!res.ok || !result.success) {
        if (result.violations?.length > 0) {
          toast.error("Account did NOT pass. See details below.");
        } else {
          toast.error(result.error || result.message || "Failed to process statement");
        }
      } else {
        toast.success(result.message || "Certificate issued!");
        fetchCerts();
      }
    } catch (err) {
      toast.error("Upload failed: " + String(err));
    }

    setUploading(false);
    e.target.value = "";
  };

  const deleteCert = async (id: string) => {
    if (!confirm("Delete this certificate?")) return;
    const { error } = await supabase.from("user_certificates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    fetchCerts();
  };

  const typeLabels: Record<string, { label: string; color: string; emoji: string }> = {
    phase1_passed: { label: "Phase 1", color: "bg-blue-50 text-blue-600", emoji: "✅" },
    funded: { label: "Funded", color: "bg-green-50 text-green-600", emoji: "🏆" },
    payout: { label: "Payout", color: "bg-purple-50 text-purple-600", emoji: "💰" },
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-5 h-5 border-2 border-[hsl(0,0%,30%)] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <div className="bg-[hsl(0,0%,97%)] rounded-xl p-6 border border-dashed border-[hsl(0,0%,80%)]">
        <div className="text-center">
          <Upload size={32} className="mx-auto mb-3 text-[hsl(0,0%,50%)]" />
          <h3 className="font-semibold text-[hsl(0,0%,10%)] mb-1">Upload MT5 Statement</h3>
          <p className="text-xs text-[hsl(0,0%,50%)] mb-4 max-w-md mx-auto">
            Upload an HTML statement from MetaTrader 5. The system will automatically extract stats,
            evaluate pass/fail against the challenge rules, and issue the appropriate certificate.
          </p>

          <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[hsl(0,0%,0%)] text-white text-sm font-medium cursor-pointer hover:bg-[hsl(0,0%,15%)] transition-colors">
            <FileText size={14} />
            {uploading ? "Analyzing..." : "Upload Statement"}
            <input type="file" accept=".html,.htm,.txt" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      {/* Last Result */}
      {lastResult && (
        <div className={`rounded-xl p-5 border ${lastResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-start gap-3">
            {lastResult.success ? (
              <CheckCircle2 size={20} className="text-green-600 mt-0.5 shrink-0" />
            ) : (
              <XCircle size={20} className="text-red-600 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${lastResult.success ? "text-green-800" : "text-red-800"}`}>
                {lastResult.success ? lastResult.message : (lastResult.message || lastResult.error || "Failed")}
              </p>

              {/* Parsed Stats */}
              {lastResult.parsed && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {lastResult.parsed.accountNumber && (
                    <StatPill label="Account" value={`#${lastResult.parsed.accountNumber}`} />
                  )}
                  {lastResult.parsed.balance != null && (
                    <StatPill label="Balance" value={`$${Number(lastResult.parsed.balance).toLocaleString()}`} />
                  )}
                  {lastResult.parsed.profit != null && (
                    <StatPill label="Profit" value={`$${Number(lastResult.parsed.profit).toLocaleString()}`} />
                  )}
                  {lastResult.parsed.deposit != null && (
                    <StatPill label="Deposit" value={`$${Number(lastResult.parsed.deposit).toLocaleString()}`} />
                  )}
                </div>
              )}

              {/* Evaluation */}
              {lastResult.evaluation && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-[hsl(0,0%,45%)] uppercase tracking-wider mb-1.5">Evaluation</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {lastResult.evaluation.details && Object.entries(lastResult.evaluation.details).map(([key, val]) => (
                      <StatPill key={key} label={key.replace(/([A-Z])/g, " $1")} value={String(val)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Violations */}
              {lastResult.violations?.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">Violations</p>
                  {lastResult.violations.map((v: string, i: number) => (
                    <p key={i} className="text-xs text-red-700 flex items-center gap-1">
                      <XCircle size={12} /> {v}
                    </p>
                  ))}
                </div>
              )}

              {/* Certificate Type Issued */}
              {lastResult.certificateType && (
                <div className="mt-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${typeLabels[lastResult.certificateType]?.color || "bg-gray-50"}`}>
                    {typeLabels[lastResult.certificateType]?.emoji} {typeLabels[lastResult.certificateType]?.label || lastResult.certificateType} Certificate Issued
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700">
          <p className="font-medium mb-1">How it works:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Upload the MT5 HTML statement</li>
            <li>System extracts account number &amp; stats automatically</li>
            <li>Evaluates against challenge rules (profit target, drawdown limits)</li>
            <li>If passed → issues the next certificate in progression (Phase 1 → Funded → Payout)</li>
            <li>If failed → shows what violated and why</li>
          </ol>
        </div>
      </div>

      {/* Certificates Table */}
      <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[hsl(0,0%,92%)]">
          <h3 className="font-semibold text-sm text-[hsl(0,0%,10%)]">
            Issued Certificates ({certificates.length})
          </h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-[hsl(0,0%,50%)] border-b border-[hsl(0,0%,92%)]">
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {certificates.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-[hsl(0,0%,50%)] text-sm">No certificates issued yet</td></tr>
            ) : certificates.map(cert => {
              const typeInfo = typeLabels[cert.certificate_type] || { label: cert.certificate_type, color: "bg-gray-50 text-gray-600", emoji: "📄" };
              return (
                <tr key={cert.id} className="border-b border-[hsl(0,0%,95%)] last:border-0 text-sm">
                  <td className="px-4 py-3 font-mono text-[hsl(0,0%,20%)]">{cert.account_number || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${typeInfo.color}`}>{typeInfo.emoji} {typeInfo.label}</span>
                  </td>
                  <td className="px-4 py-3 text-[hsl(0,0%,20%)]">{cert.title}</td>
                  <td className="px-4 py-3 text-[hsl(0,0%,50%)]">{new Date(cert.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 flex items-center gap-1">
                    <button onClick={() => setPreviewCert(cert)} className="text-blue-400 hover:text-blue-600 transition-colors p-1">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => deleteCert(cert.id)} className="text-red-400 hover:text-red-600 transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewCert} onOpenChange={() => setPreviewCert(null)}>
        <DialogContent className="bg-white border-[hsl(0,0%,90%)] rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[hsl(0,0%,5%)] flex items-center gap-2">
              <Award size={18} /> {previewCert?.title}
            </DialogTitle>
          </DialogHeader>
          {previewCert && (
            <div className="space-y-4">
              <p className="text-sm text-[hsl(0,0%,50%)]">{previewCert.description}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[hsl(0,0%,97%)] rounded-lg p-3">
                  <p className="text-xs text-[hsl(0,0%,50%)]">Account</p>
                  <p className="font-mono font-medium text-[hsl(0,0%,10%)]">{previewCert.account_number || "—"}</p>
                </div>
                <div className="bg-[hsl(0,0%,97%)] rounded-lg p-3">
                  <p className="text-xs text-[hsl(0,0%,50%)]">Type</p>
                  <p className="font-medium text-[hsl(0,0%,10%)]">{typeLabels[previewCert.certificate_type]?.emoji} {typeLabels[previewCert.certificate_type]?.label || previewCert.certificate_type}</p>
                </div>
              </div>

              {previewCert.stats && (
                <div>
                  <p className="text-xs font-semibold text-[hsl(0,0%,45%)] uppercase tracking-wider mb-2">Stats</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(previewCert.stats)
                      .filter(([k]) => !["accountNumber", "evaluation"].includes(k))
                      .map(([key, value]) => (
                        <div key={key} className="bg-[hsl(0,0%,97%)] rounded-lg px-3 py-2">
                          <p className="text-[10px] text-[hsl(0,0%,50%)] capitalize">{key.replace(/([A-Z])/g, " $1")}</p>
                          <p className="text-sm font-medium text-[hsl(0,0%,10%)]">
                            {typeof value === "number" ? value.toLocaleString() : String(value)}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {previewCert.stats?.evaluation && (
                <div>
                  <p className="text-xs font-semibold text-[hsl(0,0%,45%)] uppercase tracking-wider mb-2">Evaluation</p>
                  <div className="flex items-center gap-2 mb-2">
                    {previewCert.stats.evaluation.passedPhase1 ? (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={12} /> Passed</span>
                    ) : (
                      <span className="text-xs text-red-600 font-medium flex items-center gap-1"><XCircle size={12} /> Failed</span>
                    )}
                  </div>
                  {previewCert.stats.evaluation.details && (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(previewCert.stats.evaluation.details).map(([key, val]) => (
                        <div key={key} className="bg-[hsl(0,0%,97%)] rounded-lg px-3 py-2">
                          <p className="text-[10px] text-[hsl(0,0%,50%)] capitalize">{key.replace(/([A-Z])/g, " $1")}</p>
                          <p className="text-sm font-medium text-[hsl(0,0%,10%)]">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatPill = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-white/80 rounded-lg px-2.5 py-1.5 border border-[hsl(0,0%,90%)]">
    <p className="text-[9px] text-[hsl(0,0%,50%)] capitalize">{label}</p>
    <p className="text-xs font-semibold text-[hsl(0,0%,10%)]">{value}</p>
  </div>
);

export default UserCertificatesCMS;
