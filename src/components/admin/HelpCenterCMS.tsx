import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, FolderOpen, FileText, Eye, EyeOff,
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered,
  Code, Link, Image, Quote, Minus, ArrowLeft, Search, Star,
  BarChart3, ThumbsUp, ThumbsDown, Globe, Copy, ExternalLink,
  GripVertical, ChevronDown, ChevronUp, AlertCircle, Check,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
}

interface Article {
  id: string;
  collection_id: string | null;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  is_published: boolean;
  is_featured: boolean;
  sort_order: number;
  author_id: string;
  meta_title: string | null;
  meta_description: string | null;
  featured_image_url: string | null;
  views_count: number;
  created_at: string;
  updated_at: string;
}

interface FeedbackStats {
  article_id: string;
  helpful: number;
  not_helpful: number;
}

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type CMSView = "dashboard" | "editor" | "feedback";

const HelpCenterCMS = () => {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CMSView>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCollection, setFilterCollection] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Collection dialog
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [collectionForm, setCollectionForm] = useState({ name: "", slug: "", description: "", icon: "folder" });

  // Article editor
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [articleForm, setArticleForm] = useState({
    title: "", slug: "", content: "", excerpt: "", collection_id: "",
    is_published: false, is_featured: false, meta_title: "", meta_description: "",
    featured_image_url: "",
  });
  const [previewMode, setPreviewMode] = useState(false);
  const [autoSlug, setAutoSlug] = useState(true);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const fetchData = useCallback(async () => {
    const [c, a] = await Promise.all([
      supabase.from("help_collections").select("*").order("sort_order"),
      supabase.from("help_articles").select("*").order("sort_order"),
    ]);
    if (c.data) setCollections(c.data as Collection[]);
    if (a.data) setArticles(a.data as Article[]);
    setLoading(false);
  }, []);

  const fetchFeedback = useCallback(async () => {
    const { data } = await supabase.from("help_article_feedback").select("article_id, is_helpful");
    if (data) {
      const map: Record<string, FeedbackStats> = {};
      data.forEach((f: any) => {
        if (!map[f.article_id]) map[f.article_id] = { article_id: f.article_id, helpful: 0, not_helpful: 0 };
        if (f.is_helpful) map[f.article_id].helpful++;
        else map[f.article_id].not_helpful++;
      });
      setFeedbackStats(Object.values(map));
    }
  }, []);

  useEffect(() => { fetchData(); fetchFeedback(); }, [fetchData, fetchFeedback]);

  useEffect(() => {
    const words = articleForm.content.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
    setCharCount(articleForm.content.length);
  }, [articleForm.content]);

  // ---- Collection CRUD ----
  const openCreateCollection = () => {
    setCollectionForm({ name: "", slug: "", description: "", icon: "folder" });
    setEditingCollection(null);
    setCollectionDialogOpen(true);
  };
  const openEditCollection = (c: Collection) => {
    setCollectionForm({ name: c.name, slug: c.slug, description: c.description || "", icon: c.icon || "folder" });
    setEditingCollection(c);
    setCollectionDialogOpen(true);
  };
  const saveCollection = async () => {
    const slug = collectionForm.slug || slugify(collectionForm.name);
    const payload = { name: collectionForm.name, slug, description: collectionForm.description || null, icon: collectionForm.icon || "folder" };
    if (editingCollection) {
      const { error } = await supabase.from("help_collections").update(payload).eq("id", editingCollection.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Collection updated");
    } else {
      const { error } = await supabase.from("help_collections").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Collection created");
    }
    setCollectionDialogOpen(false);
    fetchData();
  };
  const deleteCollection = async (id: string) => {
    if (!confirm("Delete this collection? Articles will become uncategorized.")) return;
    const { error } = await supabase.from("help_collections").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Collection deleted");
    fetchData();
  };

  // ---- Article CRUD ----
  const openCreateArticle = (collectionId?: string) => {
    setArticleForm({
      title: "", slug: "", content: "", excerpt: "", collection_id: collectionId || "",
      is_published: false, is_featured: false, meta_title: "", meta_description: "",
      featured_image_url: "",
    });
    setEditingArticle(null);
    setAutoSlug(true);
    setView("editor");
    setPreviewMode(false);
  };
  const openEditArticle = (a: Article) => {
    setArticleForm({
      title: a.title, slug: a.slug, content: a.content, excerpt: a.excerpt || "",
      collection_id: a.collection_id || "", is_published: a.is_published,
      is_featured: a.is_featured, meta_title: a.meta_title || "",
      meta_description: a.meta_description || "", featured_image_url: a.featured_image_url || "",
    });
    setEditingArticle(a);
    setAutoSlug(false);
    setView("editor");
    setPreviewMode(false);
  };
  const saveArticle = async () => {
    if (!user) return;
    if (!articleForm.title.trim()) { toast.error("Title is required"); return; }
    const slug = articleForm.slug || slugify(articleForm.title);
    const payload: any = {
      title: articleForm.title, slug, content: articleForm.content,
      excerpt: articleForm.excerpt || null, collection_id: articleForm.collection_id || null,
      is_published: articleForm.is_published, is_featured: articleForm.is_featured,
      author_id: user.id, meta_title: articleForm.meta_title || null,
      meta_description: articleForm.meta_description || null,
      featured_image_url: articleForm.featured_image_url || null,
    };
    if (editingArticle) {
      const { error } = await supabase.from("help_articles").update(payload).eq("id", editingArticle.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Article saved");
    } else {
      const { error } = await supabase.from("help_articles").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Article created");
    }
    setView("dashboard");
    fetchData();
  };
  const deleteArticle = async (id: string) => {
    if (!confirm("Delete this article permanently?")) return;
    const { error } = await supabase.from("help_articles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Article deleted");
    fetchData();
  };
  const togglePublish = async (a: Article) => {
    const { error } = await supabase.from("help_articles").update({ is_published: !a.is_published }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success(a.is_published ? "Unpublished" : "Published");
    fetchData();
  };
  const duplicateArticle = async (a: Article) => {
    if (!user) return;
    const { error } = await supabase.from("help_articles").insert({
      title: `${a.title} (Copy)`, slug: `${a.slug}-copy`, content: a.content,
      excerpt: a.excerpt, collection_id: a.collection_id, is_published: false,
      author_id: user.id, meta_title: a.meta_title, meta_description: a.meta_description,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Article duplicated");
    fetchData();
  };

  // Markdown toolbar
  const insertMarkdown = (prefix: string, suffix = "", placeholder = "") => {
    const textarea = document.getElementById("article-content") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = articleForm.content.substring(start, end) || placeholder;
    const newContent = articleForm.content.substring(0, start) + prefix + selected + suffix + articleForm.content.substring(end);
    setArticleForm({ ...articleForm, content: newContent });
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

  // Filtered articles
  const filteredArticles = articles.filter(a => {
    if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterCollection && a.collection_id !== filterCollection) return false;
    if (filterStatus === "published" && !a.is_published) return false;
    if (filterStatus === "draft" && a.is_published) return false;
    if (filterStatus === "featured" && !a.is_featured) return false;
    return true;
  });

  const getFeedback = (articleId: string) => feedbackStats.find(f => f.article_id === articleId);

  const stats = {
    total: articles.length,
    published: articles.filter(a => a.is_published).length,
    drafts: articles.filter(a => !a.is_published).length,
    totalViews: articles.reduce((s, a) => s + (a.views_count || 0), 0),
    totalFeedback: feedbackStats.reduce((s, f) => s + f.helpful + f.not_helpful, 0),
    helpfulRate: feedbackStats.length > 0
      ? Math.round((feedbackStats.reduce((s, f) => s + f.helpful, 0) / Math.max(1, feedbackStats.reduce((s, f) => s + f.helpful + f.not_helpful, 0))) * 100)
      : 0,
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-6 w-6 border-2 border-foreground border-t-transparent rounded-full" /></div>;

  // ---- FEEDBACK VIEW ----
  if (view === "feedback") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView("dashboard")}><ArrowLeft size={16} className="mr-1" /> Back</Button>
          <h2 className="font-display text-lg font-bold text-foreground">Article Feedback</h2>
        </div>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Article</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">👍 Helpful</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">👎 Not Helpful</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Score</th>
              </tr>
            </thead>
            <tbody>
              {feedbackStats.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">No feedback yet</td></tr>
              ) : (
                feedbackStats.sort((a, b) => (b.helpful + b.not_helpful) - (a.helpful + a.not_helpful)).map(f => {
                  const article = articles.find(a => a.id === f.article_id);
                  const total = f.helpful + f.not_helpful;
                  const score = total > 0 ? Math.round((f.helpful / total) * 100) : 0;
                  return (
                    <tr key={f.article_id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 font-medium text-foreground">{article?.title || "Unknown"}</td>
                      <td className="p-3 text-center text-green-600 font-medium">{f.helpful}</td>
                      <td className="p-3 text-center text-red-500 font-medium">{f.not_helpful}</td>
                      <td className="p-3 text-center">
                        <Badge variant={score >= 70 ? "default" : score >= 40 ? "secondary" : "destructive"}>
                          {score}%
                        </Badge>
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
  }

  // ---- EDITOR VIEW ----
  if (view === "editor") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setView("dashboard")}><ArrowLeft size={16} className="mr-1" /> Back</Button>
            <h2 className="font-display text-lg font-bold text-foreground">
              {editingArticle ? "Edit Article" : "New Article"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono">{wordCount} words · {charCount} chars</Badge>
            <Button onClick={saveArticle} size="sm" className="bg-foreground text-background hover:bg-foreground/90">
              <Check size={14} className="mr-1" /> {editingArticle ? "Save Changes" : "Create Article"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main editor */}
          <div className="lg:col-span-2 space-y-4">
            {/* Title */}
            <Input
              value={articleForm.title}
              onChange={e => {
                const title = e.target.value;
                setArticleForm({ ...articleForm, title, ...(autoSlug ? { slug: slugify(title) } : {}) });
              }}
              placeholder="Article title"
              className="text-lg font-display font-bold h-12 bg-card border-border"
            />

            {/* Content editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Content</Label>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Markdown</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPreviewMode(!previewMode)} className="text-xs h-7">
                  {previewMode ? <><Pencil size={12} className="mr-1" /> Edit</> : <><Eye size={12} className="mr-1" /> Preview</>}
                </Button>
              </div>

              {!previewMode && (
                <div className="flex flex-wrap gap-0.5 p-1.5 bg-muted/60 rounded-t-lg border border-b-0 border-border">
                  {toolbarButtons.map((btn, i) => (
                    <button key={i} onClick={btn.action} title={btn.title}
                      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                      {btn.icon}
                    </button>
                  ))}
                </div>
              )}

              {previewMode ? (
                <div className="min-h-[500px] p-6 bg-card border border-border rounded-lg prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(articleForm.content) }} />
              ) : (
                <textarea
                  id="article-content"
                  value={articleForm.content}
                  onChange={e => setArticleForm({ ...articleForm, content: e.target.value })}
                  placeholder="Write your article content in Markdown..."
                  className="w-full min-h-[500px] p-4 bg-card border border-border rounded-b-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Publish settings */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-4">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Publish</h3>
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Published</Label>
                <Switch checked={articleForm.is_published} onCheckedChange={v => setArticleForm({ ...articleForm, is_published: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Featured</Label>
                <Switch checked={articleForm.is_featured} onCheckedChange={v => setArticleForm({ ...articleForm, is_featured: v })} />
              </div>
            </div>

            {/* URL / Slug */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">URL & Slug</h3>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs text-muted-foreground">Slug</Label>
                  <button onClick={() => setAutoSlug(!autoSlug)}
                    className="text-[10px] text-muted-foreground hover:text-foreground">
                    {autoSlug ? "Manual" : "Auto"}
                  </button>
                </div>
                <Input
                  value={articleForm.slug}
                  onChange={e => { setAutoSlug(false); setArticleForm({ ...articleForm, slug: e.target.value }); }}
                  className="bg-muted/50 border-border text-sm font-mono"
                  placeholder="article-slug"
                />
                <p className="text-[10px] text-muted-foreground mt-1 truncate">
                  help.fundingpulze.com/{articleForm.slug || "..."}
                </p>
              </div>
            </div>

            {/* Collection */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Organization</h3>
              <div>
                <Label className="text-xs text-muted-foreground">Collection</Label>
                <select value={articleForm.collection_id}
                  onChange={e => setArticleForm({ ...articleForm, collection_id: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-border bg-muted/50 text-sm mt-1">
                  <option value="">Uncategorized</option>
                  {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Excerpt</Label>
                <Textarea value={articleForm.excerpt}
                  onChange={e => setArticleForm({ ...articleForm, excerpt: e.target.value })}
                  placeholder="Brief summary for listings..."
                  className="bg-muted/50 border-border text-sm min-h-[60px] mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">{articleForm.excerpt.length}/160 chars</p>
              </div>
            </div>

            {/* SEO */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-1.5">
                <Globe size={12} className="text-muted-foreground" />
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">SEO</h3>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Meta Title</Label>
                <Input value={articleForm.meta_title}
                  onChange={e => setArticleForm({ ...articleForm, meta_title: e.target.value })}
                  placeholder={articleForm.title || "Page title for search engines"}
                  className="bg-muted/50 border-border text-sm mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">{(articleForm.meta_title || articleForm.title).length}/60 chars</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Meta Description</Label>
                <Textarea value={articleForm.meta_description}
                  onChange={e => setArticleForm({ ...articleForm, meta_description: e.target.value })}
                  placeholder={articleForm.excerpt || "Description for search engines"}
                  className="bg-muted/50 border-border text-sm min-h-[60px] mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">{(articleForm.meta_description || articleForm.excerpt).length}/160 chars</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Featured Image URL</Label>
                <Input value={articleForm.featured_image_url}
                  onChange={e => setArticleForm({ ...articleForm, featured_image_url: e.target.value })}
                  placeholder="https://..."
                  className="bg-muted/50 border-border text-sm mt-1" />
              </div>
              {/* SEO Preview */}
              <div className="mt-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                <p className="text-[10px] text-muted-foreground mb-1">Search Preview</p>
                <p className="text-sm text-blue-600 font-medium truncate">
                  {articleForm.meta_title || articleForm.title || "Article Title"}
                </p>
                <p className="text-[11px] text-green-700 truncate">
                  help.fundingpulze.com/{articleForm.slug || "article-slug"}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {articleForm.meta_description || articleForm.excerpt || "Article description will appear here..."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- DASHBOARD VIEW ----
  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total", value: stats.total, icon: <FileText size={14} /> },
          { label: "Published", value: stats.published, icon: <Eye size={14} /> },
          { label: "Drafts", value: stats.drafts, icon: <EyeOff size={14} /> },
          { label: "Collections", value: collections.length, icon: <FolderOpen size={14} /> },
          { label: "Views", value: stats.totalViews, icon: <BarChart3 size={14} /> },
          { label: "Helpful", value: `${stats.helpfulRate}%`, icon: <ThumbsUp size={14} /> },
        ].map((s, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">{s.icon}<span className="text-[10px] uppercase tracking-wider">{s.label}</span></div>
            <p className="font-display text-xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => openCreateArticle()} size="sm" className="bg-foreground text-background hover:bg-foreground/90">
          <Plus size={14} className="mr-1" /> New Article
        </Button>
        <Button onClick={openCreateCollection} variant="outline" size="sm" className="border-border">
          <Plus size={14} className="mr-1" /> New Collection
        </Button>
        <Button onClick={() => setView("feedback")} variant="outline" size="sm" className="border-border">
          <BarChart3 size={14} className="mr-1" /> Feedback
        </Button>
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search articles..." className="pl-8 h-8 w-48 text-sm bg-card border-border" />
        </div>
        <select value={filterCollection} onChange={e => setFilterCollection(e.target.value)}
          className="h-8 px-2 rounded-md border border-border bg-card text-sm">
          <option value="">All Collections</option>
          {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="h-8 px-2 rounded-md border border-border bg-card text-sm">
          <option value="">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="featured">Featured</option>
        </select>
      </div>

      {/* Collections */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Collections</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {collections.map(c => {
            const count = articles.filter(a => a.collection_id === c.id).length;
            const published = articles.filter(a => a.collection_id === c.id && a.is_published).length;
            return (
              <div key={c.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <FolderOpen size={14} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">/{c.slug}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditCollection(c)} className="p-1 hover:bg-muted rounded"><Pencil size={12} className="text-muted-foreground" /></button>
                    <button onClick={() => deleteCollection(c.id)} className="p-1 hover:bg-destructive/10 rounded"><Trash2 size={12} className="text-destructive" /></button>
                  </div>
                </div>
                {c.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{c.description}</p>}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground">{count} articles</span>
                  <span className="text-[10px] text-muted-foreground">{published} published</span>
                  <div className="flex-1" />
                  <Button onClick={() => openCreateArticle(c.id)} variant="ghost" size="sm" className="h-6 text-[10px] px-2">
                    <Plus size={10} className="mr-0.5" /> Add
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Articles Table */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Articles ({filteredArticles.length})
        </h3>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {filteredArticles.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {searchQuery ? "No articles match your search" : "No articles yet"}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs">Article</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Collection</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs">Status</th>
                  <th className="text-center p-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Views</th>
                  <th className="text-center p-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Feedback</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Updated</th>
                  <th className="text-right p-3 font-medium text-muted-foreground text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredArticles.map(a => {
                  const fb = getFeedback(a.id);
                  const col = collections.find(c => c.id === a.collection_id);
                  return (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 group">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {a.is_featured && <Star size={12} className="text-amber-500 fill-amber-500 shrink-0" />}
                          <div>
                            <p className="font-medium text-foreground">{a.title}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">/{a.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground hidden md:table-cell">{col?.name || "—"}</td>
                      <td className="p-3">
                        <Badge variant={a.is_published ? "default" : "secondary"} className="text-[10px]">
                          {a.is_published ? "Live" : "Draft"}
                        </Badge>
                      </td>
                      <td className="p-3 text-center text-muted-foreground hidden lg:table-cell">{a.views_count || 0}</td>
                      <td className="p-3 text-center hidden lg:table-cell">
                        {fb ? (
                          <span className="text-xs">
                            <span className="text-green-600">{fb.helpful}</span>
                            <span className="text-muted-foreground mx-0.5">/</span>
                            <span className="text-red-500">{fb.not_helpful}</span>
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">
                        {new Date(a.updated_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => togglePublish(a)} className="p-1.5 hover:bg-muted rounded" title={a.is_published ? "Unpublish" : "Publish"}>
                            {a.is_published ? <EyeOff size={13} className="text-muted-foreground" /> : <Eye size={13} className="text-muted-foreground" />}
                          </button>
                          <button onClick={() => duplicateArticle(a)} className="p-1.5 hover:bg-muted rounded" title="Duplicate">
                            <Copy size={13} className="text-muted-foreground" />
                          </button>
                          <button onClick={() => openEditArticle(a)} className="p-1.5 hover:bg-muted rounded" title="Edit">
                            <Pencil size={13} className="text-muted-foreground" />
                          </button>
                          <button onClick={() => deleteArticle(a.id)} className="p-1.5 hover:bg-destructive/10 rounded" title="Delete">
                            <Trash2 size={13} className="text-destructive" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Collection Dialog */}
      <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">{editingCollection ? "Edit Collection" : "New Collection"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={collectionForm.name}
                onChange={e => setCollectionForm({ ...collectionForm, name: e.target.value, slug: slugify(e.target.value) })}
                placeholder="e.g. Getting Started" />
            </div>
            <div>
              <Label className="text-xs">Slug</Label>
              <Input value={collectionForm.slug}
                onChange={e => setCollectionForm({ ...collectionForm, slug: e.target.value })}
                className="font-mono" />
              <p className="text-[10px] text-muted-foreground mt-1">help.fundingpulze.com/collection/{collectionForm.slug}</p>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={collectionForm.description}
                onChange={e => setCollectionForm({ ...collectionForm, description: e.target.value })}
                placeholder="Brief description..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollectionDialogOpen(false)} className="border-border">Cancel</Button>
            <Button onClick={saveCollection} className="bg-foreground text-background hover:bg-foreground/90">
              {editingCollection ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HelpCenterCMS;
