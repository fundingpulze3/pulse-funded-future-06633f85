import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateBlog, runAutoPublishNow } from "@/lib/blogEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, FileText, Eye, EyeOff,
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered,
  Code, Link, Image, Quote, Minus, ArrowLeft, Search, Star,
  BarChart3, Globe, Copy, Upload, X, AlertCircle, Check,
  TrendingUp, BookOpen, Sparkles, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  author_id: string;
  thumbnail_url: string | null;
  thumbnail_alt: string | null;
  thumbnail_ratio: string | null;
  is_published: boolean;
  is_featured: boolean;
  published_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string[] | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  focus_keyword: string | null;
  views_count: number;
  reading_time: number;
  created_at: string;
  updated_at: string;
}

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const THUMBNAIL_RATIOS = [
  { value: "4:5", label: "4:5 (Portrait)", aspect: "aspect-[4/5]" },
];

type CMSView = "dashboard" | "editor";

const BlogCMS = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CMSView>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Editor
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [form, setForm] = useState({
    title: "", slug: "", content: "", excerpt: "",
    is_published: false, is_featured: false,
    thumbnail_url: "", thumbnail_alt: "", thumbnail_ratio: "4:5",
    meta_title: "", meta_description: "", meta_keywords: "",
    canonical_url: "", og_title: "", og_description: "", og_image_url: "",
    focus_keyword: "", published_at: "",
  });
  const [autoSlug, setAutoSlug] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [seoTab, setSeoTab] = useState<"basic" | "og" | "advanced">("basic");
  const [wordCount, setWordCount] = useState(0);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [usage, setUsage] = useState({ count: 0, spent: 0 });
  const fetchUsage = useCallback(async () => {
    const day = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from("blog_engine_usage").select("cost_usd").eq("day", day).eq("ok", true);
    const count = data?.length ?? 0;
    const spent = (data ?? []).reduce((sum: number, r: any) => sum + Number(r.cost_usd || 0), 0);
    setUsage({ count, spent });
  }, []);

  const generateWithAI = async () => {
    if (!form.title.trim()) { toast.error("Enter a title first"); return; }
    setAiGenerating(true);
    try {
      const data = await generateBlog({
        topic: form.title.trim(),
        primary_keyword: form.focus_keyword || form.title.trim(),
        secondary_keywords: form.meta_keywords || "",
      });
      if (data?.parse_error) {
        toast.error("AI returned unparseable content");
        return;
      }

      const faqMarkdown = data.faq_section?.length
        ? "\n\n## Frequently Asked Questions\n\n" + data.faq_section.map((f: any) => `### ${f.question}\n\n${f.answer}`).join("\n\n")
        : "";

      setForm(prev => ({
        ...prev,
        content: data.blog_content + faqMarkdown,
        excerpt: data.featured_snippet || prev.excerpt,
        meta_title: data.seo_metadata?.seo_title || prev.meta_title,
        meta_description: data.seo_metadata?.meta_description || prev.meta_description,
        focus_keyword: data.keyword_strategy?.primary_keyword || prev.focus_keyword,
        meta_keywords: [
          ...(data.keyword_strategy?.secondary_keywords || []),
          ...(data.keyword_strategy?.lsi_keywords?.slice(0, 5) || []),
        ].join(", ") || prev.meta_keywords,
        slug: autoSlug ? (data.seo_metadata?.url_slug || prev.slug) : prev.slug,
      }));
      toast.success("Content generated! Review and edit before publishing.");
      fetchUsage();
    } catch (err: any) {
      toast.error(err.message || "AI generation failed");
    } finally {
      setAiGenerating(false);
    }
  };

  const fetchPosts = useCallback(async () => {
    const { data } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
    if (data) setPosts(data as BlogPost[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);
  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  useEffect(() => {
    setWordCount(form.content.trim().split(/\s+/).filter(Boolean).length);
  }, [form.content]);

  // Calculate reading time
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  // SEO Score
  const seoScore = (() => {
    let score = 0;
    if (form.meta_title) score += 15;
    if (form.meta_description) score += 15;
    if (form.meta_description && form.meta_description.length >= 120 && form.meta_description.length <= 160) score += 10;
    if (form.meta_title && form.meta_title.length <= 60) score += 10;
    if (form.focus_keyword) score += 15;
    if (form.focus_keyword && form.title.toLowerCase().includes(form.focus_keyword.toLowerCase())) score += 10;
    if (form.focus_keyword && form.content.toLowerCase().includes(form.focus_keyword.toLowerCase())) score += 10;
    if (form.thumbnail_url) score += 5;
    if (form.thumbnail_alt) score += 5;
    if (form.og_title) score += 5;
    return Math.min(100, score);
  })();

  const seoColor = seoScore >= 70 ? "text-green-600" : seoScore >= 40 ? "text-yellow-600" : "text-red-500";

  // CRUD
  const openCreate = () => {
    setForm({
      title: "", slug: "", content: "", excerpt: "",
      is_published: false, is_featured: false,
      thumbnail_url: "", thumbnail_alt: "", thumbnail_ratio: "4:5",
      meta_title: "", meta_description: "", meta_keywords: "",
      canonical_url: "", og_title: "", og_description: "", og_image_url: "",
      focus_keyword: "", published_at: "",
    });
    setEditingPost(null);
    setAutoSlug(true);
    setView("editor");
    setPreviewMode(false);
  };

  const openEdit = (p: BlogPost) => {
    setForm({
      title: p.title, slug: p.slug, content: p.content, excerpt: p.excerpt || "",
      is_published: p.is_published, is_featured: p.is_featured,
      thumbnail_url: p.thumbnail_url || "", thumbnail_alt: p.thumbnail_alt || "",
      thumbnail_ratio: p.thumbnail_ratio || "4:5",
      meta_title: p.meta_title || "", meta_description: p.meta_description || "",
      meta_keywords: (p.meta_keywords || []).join(", "),
      canonical_url: p.canonical_url || "", og_title: p.og_title || "",
      og_description: p.og_description || "", og_image_url: p.og_image_url || "",
      focus_keyword: p.focus_keyword || "",
      published_at: p.published_at ? p.published_at.slice(0, 16) : "",
    });
    setEditingPost(p);
    setAutoSlug(false);
    setView("editor");
    setPreviewMode(false);
  };

  const save = async () => {
    if (!user) return;
    // Efficiency: nothing is mandatory but a scrap of title OR content — the rest auto-fills.
    let title = form.title.trim();
    if (!title && form.content.trim()) {
      title = (form.content.trim().split("\n").find((l) => l.trim()) || "").replace(/^#+\s*/, "").slice(0, 90).trim();
    }
    if (!title) { toast.error("Add a title or some content first"); return; }
    const slug = form.slug || slugify(title);
    const keywords = form.meta_keywords
      ? form.meta_keywords.split(",").map((k) => k.trim()).filter(Boolean)
      : [];
    const plain = form.content.replace(/[#>*_`~[\]()!]/g, " ").replace(/\s+/g, " ").trim();
    const autoExcerpt = (form.excerpt || plain.slice(0, 155)).trim();

    const payload: any = {
      title, slug, content: form.content,
      excerpt: autoExcerpt || null, author_id: user.id,
      is_published: form.is_published, is_featured: form.is_featured,
      thumbnail_url: form.thumbnail_url || null,
      thumbnail_alt: form.thumbnail_alt || null,
      thumbnail_ratio: form.thumbnail_ratio,
      meta_title: form.meta_title || title,
      meta_description: form.meta_description || autoExcerpt || null,
      meta_keywords: keywords,
      canonical_url: form.canonical_url || null,
      og_title: form.og_title || null,
      og_description: form.og_description || null,
      og_image_url: form.og_image_url || null,
      focus_keyword: form.focus_keyword || null,
      reading_time: readingTime,
      published_at: form.is_published ? new Date().toISOString() : null,
    };

    if (editingPost) {
      const { error } = await supabase.from("blog_posts").update(payload).eq("id", editingPost.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Post saved");
    } else {
      const { error } = await supabase.from("blog_posts").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Post created");
    }
    setView("dashboard");
    fetchPosts();
  };

  const deletePost = async (id: string) => {
    if (!confirm("Delete this post permanently?")) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Post deleted");
    fetchPosts();
  };

  const togglePublish = async (p: BlogPost) => {
    const updates: any = { is_published: !p.is_published };
    if (!p.is_published) updates.published_at = new Date().toISOString();
    const { error } = await supabase.from("blog_posts").update(updates).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(p.is_published ? "Unpublished" : "Published");
    fetchPosts();
  };

  const duplicatePost = async (p: BlogPost) => {
    if (!user) return;
    const { error } = await supabase.from("blog_posts").insert({
      title: `${p.title} (Copy)`, slug: `${p.slug}-copy`, content: p.content,
      excerpt: p.excerpt, author_id: user.id, is_published: false,
      meta_title: p.meta_title, meta_description: p.meta_description,
      meta_keywords: p.meta_keywords, focus_keyword: p.focus_keyword,
      thumbnail_url: p.thumbnail_url, thumbnail_alt: p.thumbnail_alt,
      thumbnail_ratio: p.thumbnail_ratio,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Post duplicated");
    fetchPosts();
  };

  // Thumbnail upload
  const uploadThumbnail = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("blog-thumbnails").upload(filePath, file);
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("blog-thumbnails").getPublicUrl(filePath);
    setForm({ ...form, thumbnail_url: urlData.publicUrl });
    setUploading(false);
    toast.success("Thumbnail uploaded");
  };

  // Markdown toolbar
  const insertMarkdown = (prefix: string, suffix = "", placeholder = "") => {
    const textarea = document.getElementById("blog-content") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = form.content.substring(start, end) || placeholder;
    const newContent = form.content.substring(0, start) + prefix + selected + suffix + form.content.substring(end);
    setForm({ ...form, content: newContent });
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length); }, 0);
  };

  const toolbarButtons = [
    { icon: <Bold size={14} />, action: () => insertMarkdown("**", "**", "bold"), title: "Bold" },
    { icon: <Italic size={14} />, action: () => insertMarkdown("*", "*", "italic"), title: "Italic" },
    { icon: <Heading1 size={14} />, action: () => insertMarkdown("\n# ", "\n", "Heading"), title: "H1" },
    { icon: <Heading2 size={14} />, action: () => insertMarkdown("\n## ", "\n", "Heading"), title: "H2" },
    { icon: <Heading3 size={14} />, action: () => insertMarkdown("\n### ", "\n", "Heading"), title: "H3" },
    { icon: <List size={14} />, action: () => insertMarkdown("\n- ", "", "item"), title: "Bullet" },
    { icon: <ListOrdered size={14} />, action: () => insertMarkdown("\n1. ", "", "item"), title: "Numbered" },
    { icon: <Quote size={14} />, action: () => insertMarkdown("\n> ", "", "quote"), title: "Quote" },
    { icon: <Code size={14} />, action: () => insertMarkdown("`", "`", "code"), title: "Code" },
    { icon: <Link size={14} />, action: () => insertMarkdown("[", "](url)", "text"), title: "Link" },
    { icon: <Image size={14} />, action: () => insertMarkdown("![alt](", ")", "image-url"), title: "Image" },
    { icon: <Minus size={14} />, action: () => insertMarkdown("\n---\n"), title: "Divider" },
  ];

  const renderMarkdown = (md: string) => {
    return md
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-5 mb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-3">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, '<code class="bg-secondary px-1.5 py-0.5 rounded text-sm">$1</code>')
      .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-border pl-4 italic text-muted-foreground my-2">$1</blockquote>')
      .replace(/^---$/gm, '<hr class="my-4 border-border" />')
      .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" class="rounded-lg max-w-full my-2" />')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-foreground underline">$1</a>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
      .replace(/\n\n/g, '<br/><br/>');
  };

  const filteredPosts = posts.filter(p => {
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStatus === "published" && !p.is_published) return false;
    if (filterStatus === "draft" && p.is_published) return false;
    if (filterStatus === "featured" && !p.is_featured) return false;
    return true;
  });

  const stats = {
    total: posts.length,
    published: posts.filter(p => p.is_published).length,
    drafts: posts.filter(p => !p.is_published).length,
    totalViews: posts.reduce((s, p) => s + (p.views_count || 0), 0),
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-6 w-6 border-2 border-foreground border-t-transparent rounded-full" /></div>;

  // ---- EDITOR VIEW ----
  if (view === "editor") {
    const selectedRatio = THUMBNAIL_RATIOS.find(r => r.value === form.thumbnail_ratio) || THUMBNAIL_RATIOS[0];

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setView("dashboard")}>
              <ArrowLeft size={16} className="mr-1" /> Back
            </Button>
            <h2 className="font-display text-lg font-bold text-[hsl(0,0%,5%)]">
              {editingPost ? "Edit Post" : "New Post"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className={`text-xs font-mono font-bold ${seoColor}`}>
              SEO: {seoScore}/100
            </div>
            <Button variant="outline" size="sm" onClick={() => setPreviewMode(!previewMode)}>
              {previewMode ? <><Pencil size={14} className="mr-1" /> Edit</> : <><Eye size={14} className="mr-1" /> Preview</>}
            </Button>
            <Button size="sm" className="bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]" onClick={save}>
              {editingPost ? "Update" : "Create"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Editor */}
          <div className="lg:col-span-2 space-y-4">
            {/* Title */}
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">Title</Label>
              <Input
                value={form.title}
                onChange={(e) => {
                  setForm({ ...form, title: e.target.value, ...(autoSlug ? { slug: slugify(e.target.value) } : {}) });
                }}
                className="mt-1 text-lg font-display font-bold"
                placeholder="Your awesome blog post title"
              />
            </div>

            {/* Slug */}
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => { setForm({ ...form, slug: e.target.value }); setAutoSlug(false); }}
                className="mt-1 font-mono text-sm"
                placeholder="your-post-slug"
              />
            </div>

            {/* Content */}
            {previewMode ? (
              <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,88%)] p-6 min-h-[400px] prose max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(form.content) }} />
            ) : (
              <div>
                <div className="flex items-center justify-between p-1 bg-[hsl(0,0%,96%)] rounded-t-lg border border-b-0 border-[hsl(0,0%,88%)]">
                  <div className="flex items-center gap-0.5">
                    {toolbarButtons.map((btn, i) => (
                      <button key={i} onClick={btn.action} title={btn.title} className="p-2 rounded hover:bg-[hsl(0,0%,88%)] text-[hsl(0,0%,35%)] transition-colors">{btn.icon}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mr-1">
                    <span className="text-[10px] text-[hsl(0,0%,45%)] whitespace-nowrap" title="AI posts generated today / daily cap · spend today">{usage.count}/10 today · ${usage.spent.toFixed(2)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={generateWithAI}
                      disabled={aiGenerating}
                      className="h-7 text-xs gap-1 border-[hsl(45,80%,55%)] text-[hsl(45,70%,35%)] hover:bg-[hsl(45,80%,92%)]"
                    >
                      {aiGenerating ? <><Loader2 size={12} className="animate-spin" /> Generating...</> : <><Sparkles size={12} /> AI Write</>}
                    </Button>
                  </div>
                </div>
                <Textarea
                  id="blog-content"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="rounded-t-none min-h-[400px] font-mono text-sm resize-y"
                  placeholder="Write your blog post content in Markdown..."
                />
                <div className="flex items-center gap-4 mt-1 text-xs text-[hsl(0,0%,50%)]">
                  <span>{wordCount} words</span>
                  <span>~{readingTime} min read</span>
                </div>
              </div>
            )}

            {/* Excerpt */}
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">Excerpt</Label>
              <Textarea
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                className="mt-1"
                rows={3}
                placeholder="Brief summary of the post (displayed in cards & search results)"
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Publishing */}
            <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,88%)] p-4 space-y-4">
              <h3 className="font-display text-sm font-bold text-[hsl(0,0%,5%)]">Publishing</h3>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Published</Label>
                <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Featured</Label>
                <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
              </div>
              <p className="text-[11px] text-[hsl(0,0%,55%)]">Publishing sets the date to now automatically — nothing to fill.</p>
            </div>

            {/* Thumbnail Manager */}
            <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,88%)] p-4 space-y-4">
              <h3 className="font-display text-sm font-bold text-[hsl(0,0%,5%)]">Thumbnail</h3>
              
              {/* Ratio Selector */}
              <div>
                <Label className="text-xs text-[hsl(0,0%,45%)]">Aspect Ratio</Label>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  {THUMBNAIL_RATIOS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setForm({ ...form, thumbnail_ratio: r.value })}
                      className={`text-[10px] font-mono px-2 py-1.5 rounded-md border transition-colors ${
                        form.thumbnail_ratio === r.value
                          ? "bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] border-[hsl(0,0%,0%)]"
                          : "border-[hsl(0,0%,88%)] text-[hsl(0,0%,45%)] hover:bg-[hsl(0,0%,96%)]"
                      }`}
                    >
                      {r.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {form.thumbnail_url ? (
                <div className="relative">
                  <div className={`${selectedRatio.aspect} overflow-hidden rounded-lg border border-[hsl(0,0%,88%)]`}>
                    <img src={form.thumbnail_url} alt={form.thumbnail_alt || "Preview"} className="w-full h-full object-cover" />
                  </div>
                  <button
                    onClick={() => setForm({ ...form, thumbnail_url: "" })}
                    className="absolute top-2 right-2 bg-[hsl(0,0%,0%)]/70 text-[hsl(0,0%,100%)] rounded-full p-1"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label className={`${selectedRatio.aspect} flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[hsl(0,0%,88%)] cursor-pointer hover:border-[hsl(0,0%,60%)] transition-colors`}>
                  <Upload size={20} className="text-[hsl(0,0%,60%)] mb-1" />
                  <span className="text-[10px] text-[hsl(0,0%,50%)]">{uploading ? "Uploading..." : "Upload thumbnail"}</span>
                  <input type="file" accept="image/*" onChange={uploadThumbnail} className="hidden" disabled={uploading} />
                </label>
              )}

              {/* Alt text */}
              <div>
                <Label className="text-xs text-[hsl(0,0%,45%)]">Alt Text</Label>
                <Input
                  value={form.thumbnail_alt}
                  onChange={(e) => setForm({ ...form, thumbnail_alt: e.target.value })}
                  className="mt-1 text-xs"
                  placeholder="Describe the image for SEO & accessibility"
                />
              </div>

              {/* URL (manual) */}
              <div>
                <Label className="text-xs text-[hsl(0,0%,45%)]">Or paste URL</Label>
                <Input
                  value={form.thumbnail_url}
                  onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                  className="mt-1 text-xs"
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* SEO Panel */}
            <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,88%)] p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-[hsl(0,0%,5%)]">SEO</h3>
                <span className={`text-xs font-mono font-bold ${seoColor}`}>{seoScore}%</span>
              </div>

              {/* SEO Score Bar */}
              <div className="w-full bg-[hsl(0,0%,90%)] rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${seoScore >= 70 ? "bg-green-500" : seoScore >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${seoScore}%` }}
                />
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-[hsl(0,0%,96%)] rounded-lg p-0.5">
                {(["basic", "og", "advanced"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSeoTab(t)}
                    className={`flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors capitalize ${
                      seoTab === t ? "bg-[hsl(0,0%,100%)] text-[hsl(0,0%,5%)] shadow-sm" : "text-[hsl(0,0%,50%)]"
                    }`}
                  >
                    {t === "og" ? "Open Graph" : t}
                  </button>
                ))}
              </div>

              {seoTab === "basic" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-[hsl(0,0%,45%)]">Focus Keyword</Label>
                    <Input
                      value={form.focus_keyword}
                      onChange={(e) => setForm({ ...form, focus_keyword: e.target.value })}
                      className="mt-1 text-xs"
                      placeholder="Main keyword to target"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[hsl(0,0%,45%)]">
                      Meta Title <span className="text-[hsl(0,0%,70%)]">({form.meta_title.length}/60)</span>
                    </Label>
                    <Input
                      value={form.meta_title}
                      onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
                      className="mt-1 text-xs"
                      placeholder="Page title for search engines"
                    />
                    {form.meta_title.length > 60 && <p className="text-[10px] text-red-500 mt-0.5">Too long — aim for under 60 characters</p>}
                  </div>
                  <div>
                    <Label className="text-xs text-[hsl(0,0%,45%)]">
                      Meta Description <span className="text-[hsl(0,0%,70%)]">({form.meta_description.length}/160)</span>
                    </Label>
                    <Textarea
                      value={form.meta_description}
                      onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
                      className="mt-1 text-xs"
                      rows={3}
                      placeholder="Brief description for search results"
                    />
                    {form.meta_description.length > 160 && <p className="text-[10px] text-red-500 mt-0.5">Too long — aim for 120-160 characters</p>}
                  </div>
                  <div>
                    <Label className="text-xs text-[hsl(0,0%,45%)]">Keywords <span className="text-[hsl(0,0%,70%)]">(comma-separated)</span></Label>
                    <Input
                      value={form.meta_keywords}
                      onChange={(e) => setForm({ ...form, meta_keywords: e.target.value })}
                      className="mt-1 text-xs"
                      placeholder="trading, forex, funded account"
                    />
                  </div>
                </div>
              )}

              {seoTab === "og" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-[hsl(0,0%,45%)]">OG Title</Label>
                    <Input value={form.og_title} onChange={(e) => setForm({ ...form, og_title: e.target.value })} className="mt-1 text-xs" placeholder="Title for social sharing" />
                  </div>
                  <div>
                    <Label className="text-xs text-[hsl(0,0%,45%)]">OG Description</Label>
                    <Textarea value={form.og_description} onChange={(e) => setForm({ ...form, og_description: e.target.value })} className="mt-1 text-xs" rows={3} placeholder="Description for social sharing" />
                  </div>
                  <div>
                    <Label className="text-xs text-[hsl(0,0%,45%)]">OG Image URL</Label>
                    <Input value={form.og_image_url} onChange={(e) => setForm({ ...form, og_image_url: e.target.value })} className="mt-1 text-xs" placeholder="https://... (1200x630 recommended)" />
                  </div>
                </div>
              )}

              {seoTab === "advanced" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-[hsl(0,0%,45%)]">Canonical URL</Label>
                    <Input value={form.canonical_url} onChange={(e) => setForm({ ...form, canonical_url: e.target.value })} className="mt-1 text-xs" placeholder="https://yourdomain.com/blog/..." />
                  </div>
                  {/* SEO Checklist */}
                  <div className="space-y-2 pt-2">
                    <p className="text-[10px] font-semibold text-[hsl(0,0%,30%)] uppercase tracking-wider">SEO Checklist</p>
                    {[
                      { label: "Focus keyword set", ok: !!form.focus_keyword },
                      { label: "Keyword in title", ok: form.focus_keyword ? form.title.toLowerCase().includes(form.focus_keyword.toLowerCase()) : false },
                      { label: "Keyword in content", ok: form.focus_keyword ? form.content.toLowerCase().includes(form.focus_keyword.toLowerCase()) : false },
                      { label: "Meta title ≤ 60 chars", ok: form.meta_title.length > 0 && form.meta_title.length <= 60 },
                      { label: "Meta desc 120-160 chars", ok: form.meta_description.length >= 120 && form.meta_description.length <= 160 },
                      { label: "Thumbnail uploaded", ok: !!form.thumbnail_url },
                      { label: "Alt text set", ok: !!form.thumbnail_alt },
                      { label: "OG title set", ok: !!form.og_title },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2 text-xs">
                        {item.ok ? <Check size={12} className="text-green-600" /> : <AlertCircle size={12} className="text-[hsl(0,0%,60%)]" />}
                        <span className={item.ok ? "text-[hsl(0,0%,20%)]" : "text-[hsl(0,0%,55%)]"}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- DASHBOARD VIEW ----
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Posts", value: stats.total, icon: <FileText size={16} /> },
          { label: "Published", value: stats.published, icon: <Globe size={16} /> },
          { label: "Drafts", value: stats.drafts, icon: <EyeOff size={16} /> },
          { label: "Total Views", value: stats.totalViews.toLocaleString(), icon: <BarChart3 size={16} /> },
        ].map((s) => (
          <div key={s.label} className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-4">
            <div className="flex items-center gap-2 text-[hsl(0,0%,45%)] text-xs mb-1">{s.icon}{s.label}</div>
            <p className="font-display text-2xl font-bold text-[hsl(0,0%,5%)]">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(0,0%,60%)]" size={14} />
            <Input
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm h-9"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 px-3 text-xs border border-[hsl(0,0%,88%)] rounded-lg bg-[hsl(0,0%,100%)] text-[hsl(0,0%,30%)]"
          >
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
            <option value="featured">Featured</option>
          </select>
        </div>
        <Button size="sm" className="bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]" onClick={openCreate}>
          <Plus size={14} className="mr-1" /> New Post
        </Button>
      </div>

      {/* Posts Table */}
      <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[hsl(0,0%,90%)] bg-[hsl(0,0%,98%)]">
              <th className="text-left p-3 font-medium text-[hsl(0,0%,45%)] text-xs">Post</th>
              <th className="text-center p-3 font-medium text-[hsl(0,0%,45%)] text-xs">Status</th>
              <th className="text-center p-3 font-medium text-[hsl(0,0%,45%)] text-xs">SEO</th>
              <th className="text-center p-3 font-medium text-[hsl(0,0%,45%)] text-xs">Views</th>
              <th className="text-right p-3 font-medium text-[hsl(0,0%,45%)] text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPosts.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-sm text-[hsl(0,0%,55%)]">No posts yet. Create your first blog post!</td></tr>
            ) : (
              filteredPosts.map((post) => {
                const hasKeyword = !!post.focus_keyword;
                const hasMeta = !!post.meta_title && !!post.meta_description;
                const postSeo = (hasKeyword ? 50 : 0) + (hasMeta ? 50 : 0);
                return (
                  <tr key={post.id} className="border-b border-[hsl(0,0%,94%)] hover:bg-[hsl(0,0%,98%)]">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {post.thumbnail_url && (
                          <img src={post.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-[hsl(0,0%,90%)]" />
                        )}
                        <div>
                          <p className="font-medium text-[hsl(0,0%,10%)] flex items-center gap-1.5">
                            {post.title}
                            {post.is_featured && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
                          </p>
                          <p className="text-xs text-[hsl(0,0%,55%)] font-mono">/{post.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={post.is_published ? "default" : "secondary"} className="text-[10px]">
                        {post.is_published ? "Published" : "Draft"}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-xs font-mono font-bold ${postSeo >= 70 ? "text-green-600" : postSeo >= 40 ? "text-yellow-600" : "text-red-500"}`}>
                        {postSeo}%
                      </span>
                    </td>
                    <td className="p-3 text-center text-xs text-[hsl(0,0%,45%)]">{post.views_count}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(post)} className="p-1.5 rounded hover:bg-[hsl(0,0%,93%)] text-[hsl(0,0%,45%)]" title="Edit"><Pencil size={13} /></button>
                        <button onClick={() => togglePublish(post)} className="p-1.5 rounded hover:bg-[hsl(0,0%,93%)] text-[hsl(0,0%,45%)]" title={post.is_published ? "Unpublish" : "Publish"}>
                          {post.is_published ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        <button onClick={() => duplicatePost(post)} className="p-1.5 rounded hover:bg-[hsl(0,0%,93%)] text-[hsl(0,0%,45%)]" title="Duplicate"><Copy size={13} /></button>
                        <button onClick={() => deletePost(post.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600" title="Delete"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BlogCMS;
