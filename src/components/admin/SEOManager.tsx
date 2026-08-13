import { useEffect, useState, useMemo } from "react";
import { db as supabase } from "@/integrations/db/client";
import {
  Search, CheckCircle2, AlertTriangle, XCircle, Pencil, Save, FileText, Image,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SEOItem {
  id: string;
  type: "blog" | "page";
  title: string;
  slug: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url?: string | null;
  canonical_url?: string | null;
  focus_keyword?: string | null;
}

function calcSEOScore(item: SEOItem): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  // Meta title
  const titleLen = (item.meta_title || "").length;
  if (!item.meta_title) { issues.push("Missing meta title"); score -= 25; }
  else if (titleLen < 30) { issues.push("Meta title too short (<30)"); score -= 15; }
  else if (titleLen > 60) { issues.push("Meta title too long (>60)"); score -= 10; }

  // Meta description
  const descLen = (item.meta_description || "").length;
  if (!item.meta_description) { issues.push("Missing meta description"); score -= 25; }
  else if (descLen < 120) { issues.push("Meta description too short (<120)"); score -= 15; }
  else if (descLen > 160) { issues.push("Meta description too long (>160)"); score -= 10; }

  // OG Image
  if (item.type === "blog" && !item.og_image_url) { issues.push("No OG image"); score -= 15; }

  // Canonical
  if (item.type === "blog" && !item.canonical_url) { issues.push("No canonical URL"); score -= 10; }

  // Focus keyword
  if (item.type === "blog" && !item.focus_keyword) { issues.push("No focus keyword"); score -= 10; }

  return { score: Math.max(0, score), issues };
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "bg-[hsl(142,40%,90%)] text-[hsl(142,50%,30%)]"
    : score >= 50 ? "bg-[hsl(40,70%,90%)] text-[hsl(40,60%,30%)]"
    : "bg-[hsl(0,60%,93%)] text-[hsl(0,50%,40%)]";
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${color}`}>{score}</span>;
}

export default function SEOManager() {
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ meta_title: string; meta_description: string }>({ meta_title: "", meta_description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: blogs } = await supabase.from("blog_posts").select("id, title, slug, meta_title, meta_description, og_image_url, canonical_url, focus_keyword, is_published");
    setBlogPosts(blogs || []);
    setLoading(false);
  };

  const seoItems: SEOItem[] = useMemo(() => {
    return (blogPosts || []).map(b => ({
      id: b.id,
      type: "blog" as const,
      title: b.title,
      slug: b.slug,
      meta_title: b.meta_title,
      meta_description: b.meta_description,
      og_image_url: b.og_image_url,
      canonical_url: b.canonical_url,
      focus_keyword: b.focus_keyword,
    }));
  }, [blogPosts]);

  const filteredItems = useMemo(() => {
    if (!search) return seoItems;
    const q = search.toLowerCase();
    return seoItems.filter(i => i.title.toLowerCase().includes(q) || i.slug.toLowerCase().includes(q));
  }, [seoItems, search]);

  const avgScore = useMemo(() => {
    if (seoItems.length === 0) return 0;
    return Math.round(seoItems.reduce((s, i) => s + calcSEOScore(i).score, 0) / seoItems.length);
  }, [seoItems]);

  const goodCount = useMemo(() => seoItems.filter(i => calcSEOScore(i).score >= 80).length, [seoItems]);
  const warnCount = useMemo(() => seoItems.filter(i => { const s = calcSEOScore(i).score; return s >= 50 && s < 80; }).length, [seoItems]);
  const badCount = useMemo(() => seoItems.filter(i => calcSEOScore(i).score < 50).length, [seoItems]);

  const startEdit = (item: SEOItem) => {
    setEditingId(item.id);
    setEditForm({ meta_title: item.meta_title || "", meta_description: item.meta_description || "" });
  };

  const saveEdit = async (item: SEOItem) => {
    setSaving(true);
    const table = item.type === "blog" ? "blog_posts" : "page_content";
    const { error } = await supabase.from(table).update({
      meta_title: editForm.meta_title || null,
      meta_description: editForm.meta_description || null,
    }).eq("id", item.id);
    if (error) toast.error(error.message);
    else { toast.success("SEO data updated!"); setEditingId(null); fetchData(); }
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-[hsl(0,0%,55%)] text-center py-12">Loading SEO data...</p>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-4">
          <span className="text-[10px] font-medium text-[hsl(0,0%,45%)] uppercase tracking-wider">Avg SEO Score</span>
          <p className="text-2xl font-display font-bold text-[hsl(0,0%,5%)] mt-1">{avgScore}/100</p>
        </div>
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-4">
          <span className="text-[10px] font-medium text-[hsl(0,0%,45%)] uppercase tracking-wider flex items-center gap-1"><CheckCircle2 size={12} className="text-[hsl(142,50%,40%)]" /> Good</span>
          <p className="text-2xl font-display font-bold text-[hsl(142,50%,35%)] mt-1">{goodCount}</p>
        </div>
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-4">
          <span className="text-[10px] font-medium text-[hsl(0,0%,45%)] uppercase tracking-wider flex items-center gap-1"><AlertTriangle size={12} className="text-[hsl(40,70%,45%)]" /> Needs Work</span>
          <p className="text-2xl font-display font-bold text-[hsl(40,60%,40%)] mt-1">{warnCount}</p>
        </div>
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-4">
          <span className="text-[10px] font-medium text-[hsl(0,0%,45%)] uppercase tracking-wider flex items-center gap-1"><XCircle size={12} className="text-[hsl(0,60%,50%)]" /> Poor</span>
          <p className="text-2xl font-display font-bold text-[hsl(0,55%,45%)] mt-1">{badCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(0,0%,55%)]" />
        <Input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search pages and posts..."
          className="pl-9 bg-[hsl(0,0%,100%)] border-[hsl(0,0%,90%)] rounded-lg"
        />
      </div>

      {/* SEO Items Table */}
      <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-[hsl(0,0%,45%)] border-b border-[hsl(0,0%,92%)]">
              <th className="px-5 py-3 font-medium">Page / Post</th>
              <th className="px-5 py-3 font-medium">Score</th>
              <th className="px-5 py-3 font-medium">Meta Title</th>
              <th className="px-5 py-3 font-medium">Meta Description</th>
              <th className="px-5 py-3 font-medium">Checklist</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => {
              const { score, issues } = calcSEOScore(item);
              const isEditing = editingId === item.id;

              return (
                <tr key={item.id} className="border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-[hsl(0,0%,55%)] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[hsl(0,0%,10%)] truncate">{item.title}</p>
                        <p className="text-[10px] text-[hsl(0,0%,55%)] font-mono">/{item.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3"><ScoreBadge score={score} /></td>
                  <td className="px-5 py-3">
                    {isEditing ? (
                      <Input value={editForm.meta_title} onChange={e => setEditForm({ ...editForm, meta_title: e.target.value })}
                        className="text-xs h-8 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)]" placeholder="Meta title (50-60 chars)" />
                    ) : (
                      <div>
                        <p className="text-xs text-[hsl(0,0%,30%)] truncate max-w-[200px]">{item.meta_title || "—"}</p>
                        <p className="text-[10px] text-[hsl(0,0%,60%)]">{(item.meta_title || "").length} chars</p>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {isEditing ? (
                      <Input value={editForm.meta_description} onChange={e => setEditForm({ ...editForm, meta_description: e.target.value })}
                        className="text-xs h-8 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)]" placeholder="Meta description (120-160 chars)" />
                    ) : (
                      <div>
                        <p className="text-xs text-[hsl(0,0%,30%)] truncate max-w-[250px]">{item.meta_description || "—"}</p>
                        <p className="text-[10px] text-[hsl(0,0%,60%)]">{(item.meta_description || "").length} chars</p>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {issues.length === 0 ? (
                        <span className="text-[10px] text-[hsl(142,50%,40%)] flex items-center gap-0.5"><CheckCircle2 size={10} /> All good</span>
                      ) : (
                        issues.slice(0, 3).map((issue, i) => (
                          <span key={i} className="text-[10px] bg-[hsl(0,0%,95%)] text-[hsl(0,0%,40%)] px-1.5 py-0.5 rounded">{issue}</span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs">Cancel</Button>
                        <Button size="sm" onClick={() => saveEdit(item)} disabled={saving} className="h-7 text-xs bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]">
                          <Save size={12} className="mr-1" />{saving ? "..." : "Save"}
                        </Button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,10%)] hover:bg-[hsl(0,0%,93%)] transition-colors">
                        <Pencil size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No pages or posts found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
