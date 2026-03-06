import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Code, Link, Image, Quote, Minus, ArrowLeft,
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
  sort_order: number;
  author_id: string;
  created_at: string;
  updated_at: string;
}

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const HelpCenterCMS = () => {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  // Collection dialog
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [collectionForm, setCollectionForm] = useState({ name: "", slug: "", description: "" });

  // Article editor
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [articleForm, setArticleForm] = useState({
    title: "", slug: "", content: "", excerpt: "", collection_id: "", is_published: false,
  });
  const [showEditor, setShowEditor] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const fetchData = useCallback(async () => {
    const [c, a] = await Promise.all([
      supabase.from("help_collections").select("*").order("sort_order"),
      supabase.from("help_articles").select("*").order("sort_order"),
    ]);
    if (c.data) setCollections(c.data as Collection[]);
    if (a.data) setArticles(a.data as Article[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---- Collection CRUD ----
  const openCreateCollection = () => {
    setCollectionForm({ name: "", slug: "", description: "" });
    setEditingCollection(null);
    setCollectionDialogOpen(true);
  };
  const openEditCollection = (c: Collection) => {
    setCollectionForm({ name: c.name, slug: c.slug, description: c.description || "" });
    setEditingCollection(c);
    setCollectionDialogOpen(true);
  };
  const saveCollection = async () => {
    const slug = collectionForm.slug || slugify(collectionForm.name);
    const payload = { name: collectionForm.name, slug, description: collectionForm.description || null };
    if (editingCollection) {
      const { error } = await supabase.from("help_collections").update(payload).eq("id", editingCollection.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Collection updated!");
    } else {
      const { error } = await supabase.from("help_collections").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Collection created!");
    }
    setCollectionDialogOpen(false);
    fetchData();
  };
  const deleteCollection = async (id: string) => {
    if (!confirm("Delete this collection? Articles will become uncategorized.")) return;
    const { error } = await supabase.from("help_collections").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Collection deleted.");
    fetchData();
  };

  // ---- Article CRUD ----
  const openCreateArticle = (collectionId?: string) => {
    setArticleForm({ title: "", slug: "", content: "", excerpt: "", collection_id: collectionId || "", is_published: false });
    setEditingArticle(null);
    setShowEditor(true);
    setPreviewMode(false);
  };
  const openEditArticle = (a: Article) => {
    setArticleForm({
      title: a.title, slug: a.slug, content: a.content, excerpt: a.excerpt || "",
      collection_id: a.collection_id || "", is_published: a.is_published,
    });
    setEditingArticle(a);
    setShowEditor(true);
    setPreviewMode(false);
  };
  const saveArticle = async () => {
    if (!user) return;
    const slug = articleForm.slug || slugify(articleForm.title);
    const payload = {
      title: articleForm.title,
      slug,
      content: articleForm.content,
      excerpt: articleForm.excerpt || null,
      collection_id: articleForm.collection_id || null,
      is_published: articleForm.is_published,
      author_id: user.id,
    };
    if (editingArticle) {
      const { error } = await supabase.from("help_articles").update(payload).eq("id", editingArticle.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Article updated!");
    } else {
      const { error } = await supabase.from("help_articles").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Article created!");
    }
    setShowEditor(false);
    fetchData();
  };
  const deleteArticle = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    const { error } = await supabase.from("help_articles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Article deleted.");
    fetchData();
  };
  const togglePublish = async (a: Article) => {
    const { error } = await supabase.from("help_articles").update({ is_published: !a.is_published }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success(a.is_published ? "Article unpublished" : "Article published!");
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
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  };

  const toolbarButtons = [
    { icon: <Bold size={14} />, action: () => insertMarkdown("**", "**", "bold text"), title: "Bold" },
    { icon: <Italic size={14} />, action: () => insertMarkdown("*", "*", "italic text"), title: "Italic" },
    { icon: <Heading1 size={14} />, action: () => insertMarkdown("# ", "", "Heading 1"), title: "H1" },
    { icon: <Heading2 size={14} />, action: () => insertMarkdown("## ", "", "Heading 2"), title: "H2" },
    { icon: <Heading3 size={14} />, action: () => insertMarkdown("### ", "", "Heading 3"), title: "H3" },
    { icon: <List size={14} />, action: () => insertMarkdown("- ", "", "list item"), title: "Bullet List" },
    { icon: <ListOrdered size={14} />, action: () => insertMarkdown("1. ", "", "list item"), title: "Numbered List" },
    { icon: <Quote size={14} />, action: () => insertMarkdown("> ", "", "quote"), title: "Blockquote" },
    { icon: <Code size={14} />, action: () => insertMarkdown("`", "`", "code"), title: "Inline Code" },
    { icon: <Link size={14} />, action: () => insertMarkdown("[", "](url)", "link text"), title: "Link" },
    { icon: <Image size={14} />, action: () => insertMarkdown("![alt](", ")", "image-url"), title: "Image" },
    { icon: <Minus size={14} />, action: () => insertMarkdown("\n---\n"), title: "Divider" },
  ];

  // Simple markdown renderer
  const renderMarkdown = (md: string) => {
    let html = md
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-5 mb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-3">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, '<code class="bg-[hsl(0,0%,92%)] px-1.5 py-0.5 rounded text-sm">$1</code>')
      .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-[hsl(0,0%,80%)] pl-4 italic text-[hsl(0,0%,45%)] my-2">$1</blockquote>')
      .replace(/^---$/gm, '<hr class="my-4 border-[hsl(0,0%,88%)]" />')
      .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" class="rounded-lg max-w-full my-2" />')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-[hsl(0,0%,20%)] underline">$1</a>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
      .replace(/\n\n/g, '<br/><br/>');
    return html;
  };

  if (loading) return <p className="text-sm text-[hsl(0,0%,50%)]">Loading help center...</p>;

  // ---- Article Editor View ----
  if (showEditor) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowEditor(false)}>
            <ArrowLeft size={16} className="mr-1" /> Back
          </Button>
          <h2 className="font-display text-lg font-bold text-[hsl(0,0%,5%)]">
            {editingArticle ? "Edit Article" : "New Article"}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main editor */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">Title</Label>
              <Input
                value={articleForm.title}
                onChange={e => setArticleForm({ ...articleForm, title: e.target.value, slug: slugify(e.target.value) })}
                placeholder="Article title"
                className="bg-[hsl(0,0%,100%)] border-[hsl(0,0%,88%)]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-[hsl(0,0%,45%)]">Content</Label>
                <Button variant="ghost" size="sm" onClick={() => setPreviewMode(!previewMode)} className="text-xs">
                  {previewMode ? <><Pencil size={12} className="mr-1" /> Edit</> : <><Eye size={12} className="mr-1" /> Preview</>}
                </Button>
              </div>

              {!previewMode && (
                <div className="flex flex-wrap gap-0.5 mb-1 p-1 bg-[hsl(0,0%,96%)] rounded-t-lg border border-b-0 border-[hsl(0,0%,88%)]">
                  {toolbarButtons.map((btn, i) => (
                    <button
                      key={i}
                      onClick={btn.action}
                      title={btn.title}
                      className="p-1.5 rounded hover:bg-[hsl(0,0%,88%)] text-[hsl(0,0%,30%)] transition-colors"
                    >
                      {btn.icon}
                    </button>
                  ))}
                </div>
              )}

              {previewMode ? (
                <div
                  className="min-h-[400px] p-4 bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,88%)] rounded-lg prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(articleForm.content) }}
                />
              ) : (
                <textarea
                  id="article-content"
                  value={articleForm.content}
                  onChange={e => setArticleForm({ ...articleForm, content: e.target.value })}
                  placeholder="Write your article in Markdown..."
                  className="w-full min-h-[400px] p-4 bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,88%)] rounded-b-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[hsl(0,0%,20%)]"
                />
              )}
            </div>
          </div>

          {/* Sidebar settings */}
          <div className="space-y-4">
            <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,88%)] p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[hsl(0,0%,10%)]">Settings</h3>

              <div>
                <Label className="text-xs text-[hsl(0,0%,45%)]">Slug</Label>
                <Input
                  value={articleForm.slug}
                  onChange={e => setArticleForm({ ...articleForm, slug: e.target.value })}
                  className="bg-[hsl(0,0%,98%)] border-[hsl(0,0%,88%)] text-sm"
                />
              </div>

              <div>
                <Label className="text-xs text-[hsl(0,0%,45%)]">Collection</Label>
                <select
                  value={articleForm.collection_id}
                  onChange={e => setArticleForm({ ...articleForm, collection_id: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-[hsl(0,0%,88%)] bg-[hsl(0,0%,98%)] text-sm"
                >
                  <option value="">Uncategorized</option>
                  {collections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs text-[hsl(0,0%,45%)]">Excerpt</Label>
                <Textarea
                  value={articleForm.excerpt}
                  onChange={e => setArticleForm({ ...articleForm, excerpt: e.target.value })}
                  placeholder="Short description..."
                  className="bg-[hsl(0,0%,98%)] border-[hsl(0,0%,88%)] text-sm min-h-[60px]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={articleForm.is_published}
                  onChange={e => setArticleForm({ ...articleForm, is_published: e.target.checked })}
                  className="rounded"
                />
                <Label className="text-xs text-[hsl(0,0%,45%)]">Published</Label>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={saveArticle} size="sm" className="flex-1 bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]">
                  {editingArticle ? "Update" : "Create"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowEditor(false)} className="border-[hsl(0,0%,88%)]">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Main CMS View ----
  return (
    <div className="space-y-6">
      {/* Collections */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-bold text-[hsl(0,0%,5%)]">Collections</h2>
          <Button onClick={openCreateCollection} size="sm" className="bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]">
            <Plus size={14} className="mr-1" /> New Collection
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {collections.map(c => (
            <div key={c.id} className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen size={16} className="text-[hsl(0,0%,40%)]" />
                  <div>
                    <p className="text-sm font-semibold text-[hsl(0,0%,10%)]">{c.name}</p>
                    <p className="text-xs text-[hsl(0,0%,50%)]">{articles.filter(a => a.collection_id === c.id).length} articles</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditCollection(c)} className="p-1 hover:bg-[hsl(0,0%,93%)] rounded">
                    <Pencil size={13} className="text-[hsl(0,0%,40%)]" />
                  </button>
                  <button onClick={() => deleteCollection(c.id)} className="p-1 hover:bg-[hsl(0,84%,95%)] rounded">
                    <Trash2 size={13} className="text-[hsl(0,84%,60%)]" />
                  </button>
                </div>
              </div>
              {c.description && <p className="text-xs text-[hsl(0,0%,50%)] mt-2">{c.description}</p>}
              <Button onClick={() => openCreateArticle(c.id)} variant="ghost" size="sm" className="mt-2 text-xs text-[hsl(0,0%,40%)]">
                <Plus size={12} className="mr-1" /> Add Article
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Articles */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-bold text-[hsl(0,0%,5%)]">Articles</h2>
          <Button onClick={() => openCreateArticle()} size="sm" className="bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]">
            <Plus size={14} className="mr-1" /> New Article
          </Button>
        </div>
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
          {articles.length === 0 ? (
            <p className="p-6 text-center text-sm text-[hsl(0,0%,50%)]">No articles yet. Create your first one!</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(0,0%,92%)] bg-[hsl(0,0%,98%)]">
                  <th className="text-left p-3 font-medium text-[hsl(0,0%,40%)] text-xs">Title</th>
                  <th className="text-left p-3 font-medium text-[hsl(0,0%,40%)] text-xs">Collection</th>
                  <th className="text-left p-3 font-medium text-[hsl(0,0%,40%)] text-xs">Status</th>
                  <th className="text-left p-3 font-medium text-[hsl(0,0%,40%)] text-xs">Updated</th>
                  <th className="text-right p-3 font-medium text-[hsl(0,0%,40%)] text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {articles.map(a => (
                  <tr key={a.id} className="border-b border-[hsl(0,0%,95%)] hover:bg-[hsl(0,0%,98%)]">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-[hsl(0,0%,50%)]" />
                        <span className="font-medium text-[hsl(0,0%,10%)]">{a.title}</span>
                      </div>
                    </td>
                    <td className="p-3 text-[hsl(0,0%,50%)]">
                      {collections.find(c => c.id === a.collection_id)?.name || "—"}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        a.is_published
                          ? "bg-[hsl(142,70%,92%)] text-[hsl(142,70%,30%)]"
                          : "bg-[hsl(0,0%,93%)] text-[hsl(0,0%,45%)]"
                      }`}>
                        {a.is_published ? <Eye size={10} /> : <EyeOff size={10} />}
                        {a.is_published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-[hsl(0,0%,50%)]">
                      {new Date(a.updated_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => togglePublish(a)} className="p-1.5 hover:bg-[hsl(0,0%,93%)] rounded" title={a.is_published ? "Unpublish" : "Publish"}>
                          {a.is_published ? <EyeOff size={13} className="text-[hsl(0,0%,40%)]" /> : <Eye size={13} className="text-[hsl(0,0%,40%)]" />}
                        </button>
                        <button onClick={() => openEditArticle(a)} className="p-1.5 hover:bg-[hsl(0,0%,93%)] rounded">
                          <Pencil size={13} className="text-[hsl(0,0%,40%)]" />
                        </button>
                        <button onClick={() => deleteArticle(a.id)} className="p-1.5 hover:bg-[hsl(0,84%,95%)] rounded">
                          <Trash2 size={13} className="text-[hsl(0,84%,60%)]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Collection Dialog */}
      <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
        <DialogContent className="bg-[hsl(0,0%,100%)] border-[hsl(0,0%,90%)]">
          <DialogHeader>
            <DialogTitle className="font-display">{editingCollection ? "Edit Collection" : "New Collection"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={collectionForm.name}
                onChange={e => setCollectionForm({ ...collectionForm, name: e.target.value, slug: slugify(e.target.value) })}
                placeholder="e.g. Getting Started"
              />
            </div>
            <div>
              <Label className="text-xs">Slug</Label>
              <Input
                value={collectionForm.slug}
                onChange={e => setCollectionForm({ ...collectionForm, slug: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={collectionForm.description}
                onChange={e => setCollectionForm({ ...collectionForm, description: e.target.value })}
                placeholder="Brief description..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveCollection} className="bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]">
              {editingCollection ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HelpCenterCMS;
