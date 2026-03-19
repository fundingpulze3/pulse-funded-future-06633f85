import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Award, Trash2, Eye, CheckCircle2, XCircle, AlertCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
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

interface BulkResult {
  fileName: string;
  accountNumber?: string;
  status: "success" | "in_progress" | "breached" | "error";
  message: string;
  certificateType?: string;
}

const UserCertificatesCMS = () => {
  const [certificates, setCertificates] = useState<UserCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewCert, setPreviewCert] = useState<UserCertificate | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  useEffect(() => { fetchCerts(); }, []);

  const fetchCerts = async () => {
    const { data } = await supabase
      .from("user_certificates")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setCertificates(data as any);
    setLoading(false);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    setUploading(true);
    setBulkResults([]);
    setBulkProgress({ current: 0, total: fileArray.length });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Not authenticated"); setUploading(false); return; }

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const results: BulkResult[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setBulkProgress({ current: i + 1, total: fileArray.length });

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/parse-mt5-statement`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: formData,
          }
        );

        const result = await res.json();

        if (result.success && result.status === "in_progress") {
          results.push({
            fileName: file.name,
            accountNumber: result.parsed?.accountNumber,
            status: "in_progress",
            message: result.message || "Dashboard updated — account in progress",
            certificateType: "latest_stats",
          });
        } else if (result.success) {
          results.push({
            fileName: file.name,
            accountNumber: result.parsed?.accountNumber,
            status: "success",
            message: result.message || "Certificate issued",
            certificateType: result.certificateType,
          });
        } else if (result.violations?.length > 0) {
          results.push({
            fileName: file.name,
            accountNumber: result.parsed?.accountNumber,
            status: "breached",
            message: result.message || "Breached",
          });
        } else {
          results.push({
            fileName: file.name,
            accountNumber: result.parsed?.accountNumber,
            status: "error",
            message: result.error || result.message || "Failed",
          });
        }
      } catch (err) {
        results.push({
          fileName: file.name,
          status: "error",
          message: String(err),
        });
      }

      setBulkResults([...results]);
    }

    const successCount = results.filter(r => r.status === "success").length;
    const progressCount = results.filter(r => r.status === "in_progress").length;
    const failCount = results.filter(r => r.status === "error" || r.status === "breached").length;

    toast.success(`Bulk upload complete: ${successCount} passed, ${progressCount} in progress, ${failCount} failed`);
    fetchCerts();
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
    phase1_passed: { label: "Phase 1 Passed", color: "bg-blue-50 text-blue-600", emoji: "✅" },
    phase2_passed: { label: "Phase 2 Passed", color: "bg-cyan-50 text-cyan-600", emoji: "✅" },
    funded: { label: "Lifetime Payout", color: "bg-green-50 text-green-600", emoji: "🏆" },
    payout: { label: "Payout", color: "bg-purple-50 text-purple-600", emoji: "💰" },
    max_allocation: { label: "Max Allocation", color: "bg-amber-50 text-amber-600", emoji: "🚀" },
  };

  const statusIcon = (status: BulkResult["status"]) => {
    switch (status) {
      case "success": return <CheckCircle2 size={14} className="text-green-500" />;
      case "in_progress": return <Clock size={14} className="text-amber-500" />;
      case "breached": return <XCircle size={14} className="text-red-500" />;
      case "error": return <AlertCircle size={14} className="text-red-500" />;
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-5 h-5 border-2 border-[hsl(0,0%,30%)] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Bulk Upload Section */}
      <div className="bg-[hsl(0,0%,97%)] rounded-xl p-6 border border-dashed border-[hsl(0,0%,80%)]">
        <div className="text-center">
          <Upload size={32} className="mx-auto mb-3 text-[hsl(0,0%,50%)]" />
          <h3 className="font-semibold text-[hsl(0,0%,10%)] mb-1">Bulk Upload MT5 Statements</h3>
          <p className="text-xs text-[hsl(0,0%,50%)] mb-4 max-w-md mx-auto">
            Select hundreds of HTML statements at once. Each file is parsed, matched to its account by MT5 login number, and evaluated automatically.
          </p>

          <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[hsl(0,0%,0%)] text-white text-sm font-medium cursor-pointer hover:bg-[hsl(0,0%,15%)] transition-colors">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {uploading ? `Processing ${bulkProgress.current}/${bulkProgress.total}...` : "Select Statements"}
            <input type="file" accept=".html,.htm,.txt" multiple onChange={handleBulkUpload} className="hidden" disabled={uploading} />
          </label>
        </div>

        {/* Progress Bar */}
        {uploading && bulkProgress.total > 0 && (
          <div className="mt-4 max-w-md mx-auto">
            <Progress value={(bulkProgress.current / bulkProgress.total) * 100} className="h-2" />
            <p className="text-xs text-center text-[hsl(0,0%,50%)] mt-1">
              {bulkProgress.current} of {bulkProgress.total} files processed
            </p>
          </div>
        )}
      </div>

      {/* Bulk Results */}
      {bulkResults.length > 0 && (
        <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(0,0%,92%)] flex items-center justify-between">
            <h3 className="font-semibold text-sm text-[hsl(0,0%,10%)]">
              Upload Results ({bulkResults.length} files)
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-green-600 font-medium">{bulkResults.filter(r => r.status === "success").length} ✅ Passed</span>
              <span className="text-amber-600 font-medium">{bulkResults.filter(r => r.status === "in_progress").length} ⏳ In Progress</span>
              <span className="text-red-600 font-medium">{bulkResults.filter(r => r.status === "breached" || r.status === "error").length} ❌ Failed</span>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-[hsl(0,0%,50%)] border-b border-[hsl(0,0%,92%)] sticky top-0 bg-white">
                  <th className="px-4 py-2 w-8"></th>
                  <th className="px-4 py-2">File</th>
                  <th className="px-4 py-2">Account</th>
                  <th className="px-4 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {bulkResults.map((r, i) => (
                  <tr key={i} className="border-b border-[hsl(0,0%,95%)] last:border-0 text-sm">
                    <td className="px-4 py-2">{statusIcon(r.status)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-[hsl(0,0%,30%)] truncate max-w-[200px]">{r.fileName}</td>
                    <td className="px-4 py-2 font-mono text-[hsl(0,0%,20%)]">{r.accountNumber || "—"}</td>
                    <td className="px-4 py-2 text-xs text-[hsl(0,0%,40%)]">
                      {r.certificateType && (
                        <span className={`inline-flex items-center gap-1 mr-2 text-xs font-medium px-2 py-0.5 rounded-full ${typeLabels[r.certificateType]?.color || "bg-gray-50"}`}>
                          {typeLabels[r.certificateType]?.emoji} {typeLabels[r.certificateType]?.label}
                        </span>
                      )}
                      {r.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700">
          <p className="font-medium mb-1">Bulk Processing Rules:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Each HTML file is matched to a user by the MT5 account number in the statement</li>
            <li>The system auto-detects whether the account is Phase 1, Phase 2, Funded, or Payout stage</li>
            <li>Only drawdown breaches fail an account — profit target not reached = "In Progress"</li>
            <li>Stats are stored and visible on each user's dashboard immediately</li>
          </ul>
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
                      .filter(([k]) => !["accountNumber", "evaluation", "balanceChart", "growthChart", "drawdownChart", "drawdownDetailChart", "profitByDay", "symbols"].includes(k))
                      .slice(0, 12)
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserCertificatesCMS;
