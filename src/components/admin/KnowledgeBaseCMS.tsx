import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface KBArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

interface KBForm {
  title: string;
  content: string;
  category: string;
  is_active: boolean;
  sort_order: string;
}

const emptyForm: KBForm = {
  title: "",
  content: "",
  category: "general",
  is_active: true,
  sort_order: "0",
};

const CATEGORIES = ["general", "challenges", "payouts", "trading-rules", "account", "billing", "platform", "troubleshooting"];

const KnowledgeBaseCMS = () => {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<KBForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchArticles = async () => {
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .order("category")
      .order("sort_order");
    if (error) toast.error(error.message);
    else setArticles((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchArticles(); }, []);

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (a: KBArticle) => {
    setForm({ title: a.title, content: a.content, category: a.category, is_active: a.is_active, sort_order: String(a.sort_order || 0) });
    setEditingId(a.id); setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast.error("Title and content required"); return; }
    setSaving(true);
    const payload = { title: form.title.trim(), content: form.content.trim(), category: form.category, is_active: form.is_active, sort_order: Number(form.sort_order) || 0 };
    if (editingId) {
      const { error } = await supabase.from("knowledge_base").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Article updated!");
    } else {
      const { error } = await supabase.from("knowledge_base").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Article created!");
    }
    setDialogOpen(false); setSaving(false); fetchArticles();
  };

  const deleteArticle = async (id: string) => {
    if (!confirm("Delete this KB article?")) return;
    const { error } = await supabase.from("knowledge_base").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Article deleted."); fetchArticles();
  };

  const filtered = articles.filter(a => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.content.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || a.category === filterCat;
    return matchSearch && matchCat;
  });

  const categoryCounts = articles.reduce<Record<string, number>>((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-bold flex items-center gap-2">
            <BookOpen size={20} /> PULZEX Knowledge Base
          </h2>
          <p className="text-xs text-[hsl(0,0%,50%)] mt-1">
            {articles.length} articles · {articles.filter(a => a.is_active).length} active · Powers PULZEX AI responses
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5 bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]">
          <Plus size={14} /> Add Article
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(0,0%,50%)]" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles..." className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilterCat("all")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCat === "all" ? "bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]" : "bg-[hsl(0,0%,94%)] text-[hsl(0,0%,40%)] hover:bg-[hsl(0,0%,88%)]"}`}>
            All ({articles.length})
          </button>
          {CATEGORIES.filter(c => categoryCounts[c]).map(c => (
            <button key={c} onClick={() => setFilterCat(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filterCat === c ? "bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]" : "bg-[hsl(0,0%,94%)] text-[hsl(0,0%,40%)] hover:bg-[hsl(0,0%,88%)]"}`}>
              {c} ({categoryCounts[c]})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-[hsl(0,0%,50%)]">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[hsl(0,0%,50%)]">
          <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No knowledge base articles yet</p>
          <p className="text-xs mt-1">Add articles to train PULZEX AI</p>
        </div>
      ) : (
        <div className="border border-[hsl(0,0%,90%)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[hsl(0,0%,97%)] border-b border-[hsl(0,0%,90%)]">
                <th className="text-left px-4 py-3 font-medium text-[hsl(0,0%,40%)] text-xs uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 font-medium text-[hsl(0,0%,40%)] text-xs uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-3 font-medium text-[hsl(0,0%,40%)] text-xs uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 font-medium text-[hsl(0,0%,40%)] text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} className="border-b border-[hsl(0,0%,94%)] last:border-0 hover:bg-[hsl(0,0%,98%)] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[hsl(0,0%,10%)]">{a.title}</p>
                    <p className="text-xs text-[hsl(0,0%,50%)] mt-0.5 line-clamp-1">{a.content.slice(0, 80)}...</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-md text-xs bg-[hsl(0,0%,94%)] text-[hsl(0,0%,40%)] capitalize">{a.category}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-md text-xs ${a.is_active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                      {a.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(a)} className="p-1.5 rounded-md hover:bg-[hsl(0,0%,90%)] text-[hsl(0,0%,40%)] transition-colors mr-1"><Pencil size={14} /></button>
                    <button onClick={() => deleteArticle(a.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-400 transition-colors"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{editingId ? "Edit" : "New"} KB Article</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[hsl(0,0%,40%)] mb-1 block">Title</label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. How payouts work" />
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(0,0%,40%)] mb-1 block">Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[hsl(0,0%,88%)] bg-white text-sm">
                {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(0,0%,40%)] mb-1 block">Content</label>
              <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Detailed answer that PULZEX AI will use..." rows={6} />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
                Active
              </label>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[hsl(0,0%,40%)]">Order:</label>
                <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} className="w-20 h-8 text-sm" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]">
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KnowledgeBaseCMS;
