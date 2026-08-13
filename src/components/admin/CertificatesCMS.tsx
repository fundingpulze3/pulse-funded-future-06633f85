import { useState, useEffect } from "react";
import { db as supabase } from "@/integrations/db/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, GripVertical, Eye, EyeOff, Upload, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface Certificate {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
}

const CertificatesCMS = () => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({ title: "", description: "", image_url: "", sort_order: "0", is_visible: true });

  const fetchAll = async () => {
    const { data } = await supabase.from("certificates").select("*").order("sort_order", { ascending: true });
    if (data) setCertificates(data as Certificate[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const resetForm = () => setForm({ title: "", description: "", image_url: "", sort_order: "0", is_visible: true });

  const openCreate = () => { resetForm(); setEditingId(null); setDialogOpen(true); };

  const openEdit = (c: Certificate) => {
    setForm({ title: c.title, description: c.description || "", image_url: c.image_url, sort_order: String(c.sort_order), is_visible: c.is_visible });
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("certificates").upload(path, file);
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("certificates").getPublicUrl(path);
    setForm({ ...form, image_url: urlData.publicUrl });
    setUploading(false);
    toast.success("Image uploaded!");
  };

  const save = async () => {
    if (!form.title || !form.image_url) { toast.error("Title and image are required."); return; }
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description || null,
      image_url: form.image_url,
      sort_order: Number(form.sort_order) || 0,
      is_visible: form.is_visible,
    };
    if (editingId) {
      const { error } = await supabase.from("certificates").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Certificate updated!");
    } else {
      const { error } = await supabase.from("certificates").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Certificate added!");
    }
    setDialogOpen(false);
    setSaving(false);
    fetchAll();
  };

  const deleteCert = async (id: string) => {
    if (!confirm("Delete this certificate?")) return;
    const { error } = await supabase.from("certificates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Certificate deleted.");
    fetchAll();
  };

  const toggleVisibility = async (id: string, current: boolean) => {
    await supabase.from("certificates").update({ is_visible: !current }).eq("id", id);
    fetchAll();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-[hsl(0,0%,50%)]"><p className="text-sm">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[hsl(0,0%,5%)]">Certificates</h2>
          <p className="text-xs text-[hsl(0,0%,50%)]">{certificates.length} certificates</p>
        </div>
        <Button onClick={openCreate} className="rounded-lg bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]">
          <Plus size={16} className="mr-1.5" /> Add Certificate
        </Button>
      </div>

      {/* Grid */}
      {certificates.length === 0 ? (
        <div className="text-center py-16 text-[hsl(0,0%,50%)] text-sm">No certificates yet. Add your first one.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className={`group rounded-xl border bg-[hsl(0,0%,100%)] overflow-hidden transition-all hover:shadow-md ${
                cert.is_visible ? "border-[hsl(0,0%,88%)]" : "border-dashed border-[hsl(0,0%,80%)] opacity-60"
              }`}
            >
              <div className="aspect-[4/3] overflow-hidden bg-[hsl(0,0%,96%)] relative">
                <img src={cert.image_url} alt={cert.title} className="w-full h-full object-contain p-3" />
                {!cert.is_visible && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] text-[10px] font-medium">
                    Hidden
                  </div>
                )}
              </div>
              <div className="p-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-[hsl(0,0%,10%)] truncate">{cert.title}</p>
                  {cert.description && (
                    <p className="text-xs text-[hsl(0,0%,50%)] mt-0.5 truncate">{cert.description}</p>
                  )}
                  <p className="text-[10px] text-[hsl(0,0%,60%)] mt-1 font-mono">Order: {cert.sort_order}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleVisibility(cert.id, cert.is_visible)} className="p-1.5 rounded-lg hover:bg-[hsl(0,0%,93%)] transition-colors" title={cert.is_visible ? "Hide" : "Show"}>
                    {cert.is_visible ? <Eye size={14} className="text-[hsl(0,0%,40%)]" /> : <EyeOff size={14} className="text-[hsl(0,0%,40%)]" />}
                  </button>
                  <button onClick={() => openEdit(cert)} className="p-1.5 rounded-lg hover:bg-[hsl(0,0%,93%)] transition-colors">
                    <Pencil size={14} className="text-[hsl(0,0%,40%)]" />
                  </button>
                  <button onClick={() => deleteCert(cert.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[hsl(0,0%,100%)] border-[hsl(0,0%,90%)] rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[hsl(0,0%,5%)]">{editingId ? "Edit Certificate" : "Add Certificate"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="e.g. ISO 27001 Certification" />
            </div>
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">Description (optional)</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="Brief description" />
            </div>

            {/* Image upload */}
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">Certificate Image *</Label>
              {form.image_url ? (
                <div className="mt-2 relative rounded-xl overflow-hidden border border-[hsl(0,0%,88%)] bg-[hsl(0,0%,97%)]">
                  <img src={form.image_url} alt="Preview" className="w-full aspect-[16/10] object-contain p-4" />
                  <button
                    onClick={() => setForm({ ...form, image_url: "" })}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,85%)] flex items-center justify-center shadow-sm hover:bg-[hsl(0,0%,95%)]"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label className="mt-2 flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-[hsl(0,0%,85%)] bg-[hsl(0,0%,97%)] cursor-pointer hover:border-[hsl(0,0%,70%)] transition-colors">
                  <Upload size={20} className="text-[hsl(0,0%,50%)]" />
                  <span className="text-xs text-[hsl(0,0%,50%)]">{uploading ? "Uploading..." : "Click to upload image"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-[hsl(0,0%,45%)]">Sort Order</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_visible} onChange={(e) => setForm({ ...form, is_visible: e.target.checked })} className="rounded" />
                  <span className="text-sm text-[hsl(0,0%,30%)]">Visible on site</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg border-[hsl(0,0%,88%)] text-[hsl(0,0%,45%)]" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-lg bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]" onClick={save} disabled={saving || !form.title || !form.image_url}>
              {saving ? "Saving..." : editingId ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CertificatesCMS;
