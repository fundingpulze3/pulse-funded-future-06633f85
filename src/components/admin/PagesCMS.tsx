import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Save, Trash2, FileText, Shield, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface PageSection {
  id: string;
  page_slug: string;
  section_key: string;
  title: string | null;
  content: string;
  sort_order: number | null;
}

const PAGES = [
  { slug: "about", label: "About" },
  { slug: "privacy", label: "Privacy Policy" },
  { slug: "terms", label: "Terms & Conditions" },
];

const PagesCMS = () => {
  const [activePage, setActivePage] = useState("about");
  const [sections, setSections] = useState<PageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ section_key: "", title: "", content: "", sort_order: "0" });
  const [saving, setSaving] = useState(false);

  const fetchSections = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("page_content")
      .select("*")
      .eq("page_slug", activePage)
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    else setSections(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchSections(); }, [activePage]);

  const openCreate = () => {
    setForm({ section_key: "", title: "", content: "", sort_order: String(sections.length) });
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (s: PageSection) => {
    setForm({
      section_key: s.section_key,
      title: s.title || "",
      content: s.content,
      sort_order: String(s.sort_order || 0),
    });
    setEditingId(s.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.section_key.trim()) { toast.error("Section key is required"); return; }
    setSaving(true);
    const payload = {
      page_slug: activePage,
      section_key: form.section_key.trim(),
      title: form.title.trim() || null,
      content: form.content,
      sort_order: Number(form.sort_order) || 0,
    };

    if (editingId) {
      const { error } = await supabase.from("page_content").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Section updated!");
    } else {
      const { error } = await supabase.from("page_content").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Section created!");
    }
    setDialogOpen(false);
    setSaving(false);
    fetchSections();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this section?")) return;
    const { error } = await supabase.from("page_content").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Section deleted.");
    fetchSections();
  };

  return (
    <div className="space-y-6">
      {/* Page tabs */}
      <div className="flex items-center gap-2">
        {PAGES.map((p) => (
          <button
            key={p.slug}
            onClick={() => setActivePage(p.slug)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activePage === p.slug
                ? "bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]"
                : "bg-[hsl(0,0%,100%)] text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,15%)] border border-[hsl(0,0%,90%)]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[hsl(0,0%,5%)]">
            {PAGES.find(p => p.slug === activePage)?.label} Sections
          </h2>
          <p className="text-xs text-[hsl(0,0%,50%)]">
            Manage content sections for the {PAGES.find(p => p.slug === activePage)?.label} page
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="bg-[hsl(0,0%,0%)] hover:bg-[hsl(0,0%,15%)] text-[hsl(0,0%,100%)]">
          <Plus size={14} className="mr-1" /> Add Section
        </Button>
      </div>

      {/* Sections list */}
      {loading ? (
        <p className="text-sm text-[hsl(0,0%,50%)]">Loading...</p>
      ) : sections.length === 0 ? (
        <div className="border border-dashed border-[hsl(0,0%,85%)] rounded-xl p-10 text-center">
          <FileText size={32} className="mx-auto mb-3 text-[hsl(0,0%,70%)]" />
          <p className="text-sm text-[hsl(0,0%,50%)]">No sections yet. The page will use default content.</p>
          <p className="text-xs text-[hsl(0,0%,65%)] mt-1">Add sections to override the default text.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((s) => (
            <div
              key={s.id}
              className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl p-5 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[hsl(0,0%,94%)] text-[hsl(0,0%,45%)]">
                    {s.section_key}
                  </span>
                  <span className="text-[10px] text-[hsl(0,0%,65%)]">Order: {s.sort_order}</span>
                </div>
                {s.title && <p className="font-semibold text-sm text-[hsl(0,0%,10%)]">{s.title}</p>}
                <p className="text-xs text-[hsl(0,0%,50%)] mt-1 line-clamp-2">{s.content}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openEdit(s)} className="text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,10%)]">
                  <Save size={14} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="text-[hsl(0,0%,45%)] hover:text-red-500">
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Section" : "Add Section"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Section Key</Label>
              <Input
                value={form.section_key}
                onChange={(e) => setForm({ ...form, section_key: e.target.value })}
                placeholder="e.g. mission, vision, hero-subtitle"
                disabled={!!editingId}
              />
              <p className="text-[10px] text-[hsl(0,0%,55%)] mt-1">Unique identifier used to map content on the page</p>
            </div>
            <div>
              <Label>Title (optional)</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Section heading"
              />
            </div>
            <div>
              <Label>Content</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Section text content..."
                rows={6}
              />
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[hsl(0,0%,0%)] hover:bg-[hsl(0,0%,15%)] text-[hsl(0,0%,100%)]">
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PagesCMS;
