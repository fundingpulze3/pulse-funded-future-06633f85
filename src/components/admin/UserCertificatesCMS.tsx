import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Award, Trash2, Eye, CheckCircle2, AlertCircle } from "lucide-react";
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
  const [selectedType, setSelectedType] = useState("phase1_passed");
  const [previewCert, setPreviewCert] = useState<UserCertificate | null>(null);

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

    const validTypes = ["text/html", "application/pdf", "text/plain"];
    if (!validTypes.includes(file.type) && !file.name.endsWith(".htm") && !file.name.endsWith(".html")) {
      toast.error("Please upload an HTML or PDF file (MT5 statement)");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("certificate_type", selectedType);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Not authenticated"); setUploading(false); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/parse-mt5-statement`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Failed to parse statement");
        if (result.parsed) {
          console.log("Parsed data:", result.parsed);
          toast.info("Partial data was extracted - check console for details");
        }
      } else {
        toast.success(`Certificate created for account #${result.parsed?.accountNumber}`);
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

  const typeLabels: Record<string, { label: string; color: string }> = {
    phase1_passed: { label: "Phase 1", color: "bg-blue-50 text-blue-600" },
    funded: { label: "Funded", color: "bg-green-50 text-green-600" },
    payout: { label: "Payout", color: "bg-purple-50 text-purple-600" },
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-5 h-5 border-2 border-[hsl(0,0%,30%)] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <div className="bg-[hsl(0,0%,97%)] rounded-xl p-6 border border-dashed border-[hsl(0,0%,80%)]">
        <div className="text-center">
          <Upload size={32} className="mx-auto mb-3 text-[hsl(0,0%,50%)]" />
          <h3 className="font-semibold text-[hsl(0,0%,10%)] mb-1">Upload MT5 Statement</h3>
          <p className="text-xs text-[hsl(0,0%,50%)] mb-4">
            Upload an HTML statement from MetaTrader 5. The system will extract the account number,
            match it to a user, and create a certificate.
          </p>

          <div className="flex items-center justify-center gap-3 mb-4">
            <Label className="text-xs text-[hsl(0,0%,45%)]">Certificate Type:</Label>
            <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
              className="rounded-lg bg-white border border-[hsl(0,0%,88%)] px-3 py-1.5 text-sm">
              <option value="phase1_passed">Phase 1 Passed</option>
              <option value="funded">Funded Account</option>
              <option value="payout">Payout</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(0,0%,0%)] text-white text-sm font-medium cursor-pointer hover:bg-[hsl(0,0%,15%)] transition-colors">
            <FileText size={14} />
            {uploading ? "Processing..." : "Choose File"}
            <input type="file" accept=".html,.htm,.pdf,.txt" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700">
          <p className="font-medium mb-1">How it works:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Add MT5 credentials to the <strong>Credentials Manager</strong> and assign them to user purchases</li>
            <li>Upload the MT5 HTML statement here</li>
            <li>System extracts account number &amp; stats, matches to the user, creates certificate</li>
            <li>User sees the certificate in their Dashboard → Certificates tab</li>
          </ol>
        </div>
      </div>

      {/* Certificates Table */}
      <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[hsl(0,0%,92%)] flex items-center justify-between">
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
              const typeInfo = typeLabels[cert.certificate_type] || { label: cert.certificate_type, color: "bg-gray-50 text-gray-600" };
              return (
                <tr key={cert.id} className="border-b border-[hsl(0,0%,95%)] last:border-0 text-sm">
                  <td className="px-4 py-3 font-mono text-[hsl(0,0%,20%)]">{cert.account_number || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${typeInfo.color}`}>{typeInfo.label}</span>
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
              <Award size={18} /> Certificate Details
            </DialogTitle>
          </DialogHeader>
          {previewCert && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[hsl(0,0%,97%)] rounded-lg p-3">
                  <p className="text-xs text-[hsl(0,0%,50%)]">Account</p>
                  <p className="font-mono font-medium text-[hsl(0,0%,10%)]">{previewCert.account_number || "—"}</p>
                </div>
                <div className="bg-[hsl(0,0%,97%)] rounded-lg p-3">
                  <p className="text-xs text-[hsl(0,0%,50%)]">Type</p>
                  <p className="font-medium text-[hsl(0,0%,10%)]">{previewCert.certificate_type}</p>
                </div>
              </div>

              {previewCert.stats && Object.keys(previewCert.stats).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[hsl(0,0%,45%)] uppercase tracking-wider mb-2">Extracted Stats</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(previewCert.stats).filter(([k]) => k !== "accountNumber").map(([key, value]) => (
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
