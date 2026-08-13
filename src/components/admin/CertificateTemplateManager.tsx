import { useState, useEffect } from "react";
import { db as supabase } from "@/integrations/db/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, Image, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CertTemplate {
  id: string;
  certificate_type: string;
  background_image_url: string;
  label: string;
  created_at: string;
}

const CERT_TYPES = [
  { value: "phase1_passed", label: "Phase 1 Passed" },
  { value: "phase2_passed", label: "Phase 2 Passed" },
  { value: "funded", label: "Lifetime Payout" },
  { value: "payout", label: "Payout" },
  { value: "max_allocation", label: "Max Allocation" },
];

const CertificateTemplateManager = () => {
  const [templates, setTemplates] = useState<CertTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("certificate_templates")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setTemplates(data as any);
    setLoading(false);
  };

  const handleUpload = async (certType: string, file: File) => {
    setUploading(certType);
    const ext = file.name.split(".").pop();
    const path = `${certType}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("certificate-templates")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error(uploadError.message);
      setUploading(null);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("certificate-templates")
      .getPublicUrl(path);

    const existing = templates.find(t => t.certificate_type === certType);
    const typeLabel = CERT_TYPES.find(t => t.value === certType)?.label || certType;

    if (existing) {
      await supabase
        .from("certificate_templates")
        .update({ background_image_url: urlData.publicUrl, label: typeLabel })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("certificate_templates")
        .insert({ certificate_type: certType, background_image_url: urlData.publicUrl, label: typeLabel });
    }

    toast.success(`Template for ${typeLabel} updated!`);
    setUploading(null);
    fetchTemplates();
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Remove this certificate background?")) return;
    await supabase.from("certificate_templates").delete().eq("id", id);
    toast.success("Template removed");
    fetchTemplates();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-5 h-5 border-2 border-[hsl(0,0%,30%)] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">Certificate Templates</h2>
        <p className="text-xs text-[hsl(0,0%,50%)] mt-0.5">Upload background images for each certificate type. The user's name will be overlaid in the center.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CERT_TYPES.map(type => {
          const template = templates.find(t => t.certificate_type === type.value);
          return (
            <div key={type.value} className="bg-white rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[hsl(0,0%,92%)] flex items-center justify-between">
                <h3 className="font-semibold text-sm text-[hsl(0,0%,10%)]">{type.label}</h3>
                {template && (
                  <button onClick={() => deleteTemplate(template.id)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              
              {template ? (
                <div className="relative">
                  <img src={template.background_image_url} alt={type.label} className="w-full h-48 object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white drop-shadow-lg bg-black/30 px-4 py-2 rounded-lg">
                      John Doe
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center bg-[hsl(0,0%,97%)]">
                  <Image size={32} className="text-[hsl(0,0%,80%)]" />
                </div>
              )}

              <div className="p-4">
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(0,0%,0%)] text-white text-xs font-medium cursor-pointer hover:bg-[hsl(0,0%,15%)] transition-colors w-full justify-center">
                  {uploading === type.value ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {template ? "Replace Background" : "Upload Background"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading === type.value}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(type.value, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CertificateTemplateManager;
