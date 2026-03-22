import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Smartphone, Upload, Loader2, Save } from "lucide-react";

export default function UPISettings() {
  const [upiId, setUpiId] = useState("");
  const [scannerUrl, setScannerUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.from("page_content").select("section_key, content, id")
      .eq("page_slug", "settings")
      .in("section_key", ["upi_id", "upi_scanner_url"])
      .then(({ data }) => {
        if (data) {
          setUpiId(data.find(d => d.section_key === "upi_id")?.content || "");
          setScannerUrl(data.find(d => d.section_key === "upi_scanner_url")?.content || "");
        }
      });
  }, []);

  const save = async () => {
    setSaving(true);
    await Promise.all([
      supabase.from("page_content").update({ content: upiId }).eq("page_slug", "settings").eq("section_key", "upi_id"),
      supabase.from("page_content").update({ content: scannerUrl }).eq("page_slug", "settings").eq("section_key", "upi_scanner_url"),
    ]);
    toast.success("UPI settings saved!");
    setSaving(false);
  };

  const uploadScanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `upi-scanner-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("email-assets").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("email-assets").getPublicUrl(path);
    setScannerUrl(publicUrl);
    toast.success("Scanner uploaded!");
    setUploading(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">UPI Payment Settings</h2>
        <p className="text-xs text-[hsl(0,0%,50%)] mt-0.5">Configure UPI payment for manual checkout</p>
      </div>

      <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl p-5 space-y-5 max-w-lg">
        <div>
          <label className="text-xs font-semibold text-[hsl(0,0%,30%)] mb-1.5 block">UPI ID</label>
          <Input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@upi"
            className="h-10 rounded-lg border-[hsl(0,0%,88%)] text-sm" />
        </div>

        <div>
          <label className="text-xs font-semibold text-[hsl(0,0%,30%)] mb-1.5 block">QR Scanner Image</label>
          {scannerUrl && (
            <div className="mb-3 bg-[hsl(0,0%,96%)] rounded-lg p-3 inline-block">
              <img src={scannerUrl} alt="UPI Scanner" className="w-40 h-40 object-contain rounded" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" onChange={uploadScanner} className="hidden" />
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[hsl(0,0%,88%)] text-xs font-medium text-[hsl(0,0%,30%)] hover:bg-[hsl(0,0%,96%)] transition-colors">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {scannerUrl ? "Replace" : "Upload"} Scanner
              </div>
            </label>
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="rounded-lg bg-[hsl(0,0%,5%)] text-white hover:bg-[hsl(0,0%,15%)] text-xs h-9 px-4">
          {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
