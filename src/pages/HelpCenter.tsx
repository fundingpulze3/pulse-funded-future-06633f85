import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, ChevronRight, ArrowLeft, ThumbsUp, ThumbsDown, Star, Clock, Eye,
  FolderOpen, FileText, HelpCircle, TrendingUp, BookOpen, Settings, Shield,
  CreditCard, Users, Printer, Link2, Share2, Mail, Send, BookMarked, X,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

interface Collection {
  id: string; name: string; slug: string; description: string | null; icon: string | null;
}
interface Article {
  id: string; collection_id: string | null; title: string; slug: string; content: string;
  excerpt: string | null; is_published: boolean; is_featured: boolean;
  meta_title: string | null; meta_description: string | null;
  featured_image_url: string | null; views_count: number; updated_at: string;
}

const iconMap: Record<string, React.ReactNode> = {
  folder: <FolderOpen size={22} />, help: <HelpCircle size={22} />,
  trending: <TrendingUp size={22} />, book: <BookOpen size={22} />,
  settings: <Settings size={22} />, shield: <Shield size={22} />,
  credit: <CreditCard size={22} />, users: <Users size={22} />, star: <Star size={22} />,
};

const renderMarkdown = (md: string) => {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 id="$1" class="text-lg font-semibold mt-8 mb-3 scroll-mt-24">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 id="$1" class="text-xl font-bold mt-10 mb-4 scroll-mt-24">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 id="$1" class="text-2xl font-bold mt-10 mb-4 scroll-mt-24">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code style="background:hsl(0,0%,94%);padding:2px 6px;border-radius:4px;font-size:13px;font-family:monospace">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid hsl(0,0%,82%);padding-left:16px;font-style:italic;color:hsl(0,0%,40%);margin:16px 0">$1</blockquote>')
    .replace(/^---$/gm, '<hr style="margin:32px 0;border-color:hsl(0,0%,90%)" />')
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" style="border-radius:12px;max-width:100%;margin:24px 0" />')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:hsl(0,0%,20%);text-decoration:underline" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:20px;list-style:disc;line-height:1.8">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:20px;list-style:decimal;line-height:1.8">$1</li>')
    .replace(/\n\n/g, '<div style="height:16px"></div>');
};

const extractHeadings = (md: string) => {
  const headings: { level: number; text: string; id: string }[] = [];
  const regex = /^(#{1,3}) (.+)$/gm;
  let match;
  while ((match = regex.exec(md)) !== null) {
    headings.push({ level: match[1].length, text: match[2], id: match[2] });
  }
  return headings;
};

const getReadingTime = (content: string) => {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
};

// ---- SEARCH SUGGESTIONS COMPONENT ----
const SearchSuggestions = ({ articles, query, onSelect, isDark }: {
  articles: Article[]; query: string; onSelect: (a: Article) => void; isDark?: boolean;
}) => {
  if (!query.trim() || query.length < 2) return null;
  const q = query.toLowerCase();
  const matches = articles.filter(a =>
    a.title.toLowerCase().includes(q) || a.excerpt?.toLowerCase().includes(q)
  ).slice(0, 5);
  if (matches.length === 0) return null;

  return (
    <div className={`absolute left-0 right-0 top-full mt-1 rounded-xl border shadow-xl z-50 overflow-hidden ${
      isDark ? "bg-primary border-border" : "bg-card border-border"
    }`}>
      {matches.map(a => (
        <button key={a.id} onClick={() => onSelect(a)}
          className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
            isDark
              ? "hover:bg-accent text-primary-foreground"
              : "hover:bg-muted text-foreground"
          }`}>
          <FileText size={14} className="text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{a.title}</p>
            {a.excerpt && <p className="text-xs truncate mt-0.5 text-muted-foreground">{a.excerpt}</p>}
          </div>
        </button>
      ))}
    </div>
  );
};

// ---- READING PROGRESS BAR ----
const ReadingProgressBar = () => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  return (
    <div className="fixed top-14 left-0 right-0 z-40 h-[3px] bg-border">
      <div className="h-full bg-foreground transition-[width] duration-100" style={{ width: `${progress}%` }} />
    </div>
  );
};

// ---- SHARE / PRINT TOOLBAR ----
const ArticleToolbar = ({ title, slug }: { title: string; slug: string }) => {
  const articleUrl = `https://help.fundingpulze.com/${slug}`;
  const copyLink = () => {
    navigator.clipboard.writeText(articleUrl);
    toast.success("Link copied!");
  };
  const shareTwitter = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(articleUrl)}`, "_blank");
  const shareFacebook = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`, "_blank");
  const printArticle = () => window.print();

  return (
    <div className="flex items-center gap-1">
      <button onClick={copyLink} title="Copy link" className="p-2 hover:bg-muted rounded-lg transition-colors">
        <Link2 size={15} className="text-muted-foreground" />
      </button>
      <button onClick={shareTwitter} title="Share on X" className="p-2 hover:bg-muted rounded-lg transition-colors">
        <Share2 size={15} className="text-muted-foreground" />
      </button>
      <button onClick={printArticle} title="Print article" className="p-2 hover:bg-muted rounded-lg transition-colors">
        <Printer size={15} className="text-muted-foreground" />
      </button>
    </div>
  );
};

// ---- CONTACT SUPPORT FORM ----
const ContactSupportForm = ({ articleId, articleTitle }: { articleId?: string; articleTitle?: string }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: articleTitle ? `Question about: ${articleTitle}` : "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("help_support_tickets").insert({
      name: form.name, email: form.email, subject: form.subject || "General inquiry",
      message: form.message, article_id: articleId || null,
    });
    setSubmitting(false);
    if (error) { toast.error("Failed to submit. Please try again."); return; }
    setSubmitted(true);
  };

  if (!open) {
    return (
      <div className="backdrop-blur-xl bg-background/60 border border-border/50 rounded-2xl p-8 text-center shadow-[0_8px_32px_-8px_hsl(0_0%_0%/0.08)]">
        <Mail size={28} className="text-muted-foreground mx-auto mb-3" />
        <p className="font-display font-semibold text-foreground text-lg mb-1">Still need help?</p>
        <p className="text-sm text-muted-foreground mb-5">Our support team is ready to assist you</p>
        <button onClick={() => setOpen(true)}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          Contact Support
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="backdrop-blur-xl bg-background/60 border border-border/50 rounded-2xl p-8 text-center shadow-[0_8px_32px_-8px_hsl(0_0%_0%/0.08)]">
        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
          <Send size={20} className="text-foreground" />
        </div>
        <p className="font-display font-semibold text-foreground">Message sent!</p>
        <p className="text-sm text-muted-foreground mt-1">We'll get back to you as soon as possible.</p>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-background/60 border border-border/50 rounded-2xl p-6 lg:p-8 shadow-[0_8px_32px_-8px_hsl(0_0%_0%/0.08)]">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display font-semibold text-foreground">Contact Support</h3>
        <button onClick={() => setOpen(false)} className="p-1 hover:bg-muted rounded-lg transition-colors">
          <X size={16} className="text-muted-foreground" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full h-10 px-3 bg-muted/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Your name" required />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Email *</label>
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email"
              className="w-full h-10 px-3 bg-muted/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="your@email.com" required />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject</label>
          <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
            className="w-full h-10 px-3 bg-muted/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="What do you need help with?" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Message *</label>
          <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
            className="w-full min-h-[120px] p-3 bg-muted/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Describe your issue in detail..." required />
        </div>
        <button type="submit" disabled={submitting}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {submitting ? "Sending..." : "Send Message"}
        </button>
      </form>
    </div>
  );
};

// ---- MAIN COMPONENT ----
const HelpCenter = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [feedbackType, setFeedbackType] = useState<boolean | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Determine base path (either /help or / for help subdomain)
  const isHelpDomain = window.location.hostname.startsWith("help.");
  const basePath = isHelpDomain ? "" : "/help";

  // Parse the current path to determine view
  const pathSegments = useMemo(() => {
    const fullPath = location.pathname;
    const relative = isHelpDomain ? fullPath : fullPath.replace(/^\/help\/?/, "/");
    return relative.split("/").filter(Boolean);
  }, [location.pathname, isHelpDomain]);

  useEffect(() => {
    const fetchData = async () => {
      const [c, a] = await Promise.all([
        supabase.from("help_collections").select("*").order("sort_order"),
        supabase.from("help_articles").select("*").eq("is_published", true).order("sort_order"),
      ]);
      if (c.data) setCollections(c.data as Collection[]);
      if (a.data) setArticles(a.data as Article[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Derive selected article and collection from URL path
  const selectedCollection = useMemo(() => {
    if (pathSegments.length >= 1) {
      return collections.find(c => c.slug === pathSegments[0]) || null;
    }
    return null;
  }, [pathSegments, collections]);

  const selectedArticle = useMemo(() => {
    if (pathSegments.length >= 2) {
      return articles.find(a => a.slug === pathSegments[1]) || null;
    }
    return null;
  }, [pathSegments, articles]);

  useEffect(() => {
    document.title = selectedArticle
      ? (selectedArticle.meta_title || `${selectedArticle.title} | Funding Pulze Help`)
      : "Funding Pulze Help Center";
  }, [selectedArticle]);

  useEffect(() => {
    if (selectedArticle) {
      supabase.from("help_articles").update({ views_count: (selectedArticle.views_count || 0) + 1 }).eq("id", selectedArticle.id).then(() => {});
    }
  }, [selectedArticle?.id]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredArticles = useMemo(() => {
    let result = articles;
    if (selectedCollection && !selectedArticle) result = result.filter(a => a.collection_id === selectedCollection.id);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a => a.title.toLowerCase().includes(q) || a.excerpt?.toLowerCase().includes(q) || a.content.toLowerCase().includes(q));
    }
    return result;
  }, [articles, search, selectedCollection, selectedArticle]);

  const mostViewed = useMemo(() => [...articles].sort((a, b) => (b.views_count || 0) - (a.views_count || 0)).slice(0, 6), [articles]);

  const sendFeedback = async (isHelpful: boolean) => {
    if (!selectedArticle || feedbackSent === selectedArticle.id) return;
    setFeedbackType(isHelpful);
    if (!isHelpful) { setShowCommentBox(true); return; }
    await supabase.from("help_article_feedback").insert({ article_id: selectedArticle.id, is_helpful: true });
    setFeedbackSent(selectedArticle.id);
  };

  const submitFeedbackWithComment = async () => {
    if (!selectedArticle) return;
    await supabase.from("help_article_feedback").insert({
      article_id: selectedArticle.id, is_helpful: feedbackType ?? false, comment: feedbackComment || null,
    });
    setFeedbackSent(selectedArticle.id);
    setShowCommentBox(false);
    setFeedbackComment("");
  };

  const selectArticle = useCallback((a: Article) => {
    const col = collections.find(c => c.id === a.collection_id);
    const colSlug = col?.slug || "general";
    setFeedbackSent(null);
    setShowCommentBox(false);
    setFeedbackComment("");
    setFeedbackType(null);
    setShowSuggestions(false);
    setSearch("");
    navigate(`${basePath}/${colSlug}/${a.slug}`);
    window.scrollTo(0, 0);
  }, [collections, navigate, basePath]);

  const selectCollection = useCallback((id: string) => {
    const col = collections.find(c => c.id === id);
    if (col) {
      navigate(`${basePath}/${col.slug}`);
    }
  }, [collections, navigate, basePath]);

  const goHome = useCallback(() => {
    setSearch("");
    navigate(basePath || "/");
  }, [navigate, basePath]);

  const relatedArticles = useMemo(() => {
    if (!selectedArticle) return [];
    return articles.filter(a => a.id !== selectedArticle.id && a.collection_id === selectedArticle.collection_id).slice(0, 3);
  }, [selectedArticle, articles]);

  const headings = useMemo(() => selectedArticle ? extractHeadings(selectedArticle.content) : [], [selectedArticle]);

  // ---- ARTICLE DETAIL ----
  if (selectedArticle) {
    const collection = collections.find(c => c.id === selectedArticle.collection_id);
    const readingTime = getReadingTime(selectedArticle.content);

    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-primary text-primary-foreground">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <button onClick={goHome} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <img src={logo} alt="Funding Pulze" className="h-7 w-7 rounded-lg" />
              <span className="font-display font-bold text-sm">Funding Pulze Help Center</span>
            </button>
            <div className="relative w-56 hidden sm:block" ref={searchRef}>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search}
                onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search..."
                className="w-full h-8 pl-9 pr-3 bg-foreground/10 border border-foreground/15 rounded-lg text-sm text-primary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              {showSuggestions && <SearchSuggestions articles={articles} query={search} onSelect={selectArticle} isDark />}
            </div>
          </div>
        </header>
        <ReadingProgressBar />

        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-10">
            <main>
              {/* Breadcrumbs + Toolbar */}
              <div className="flex items-center justify-between mb-6">
              <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <button onClick={goHome} className="hover:text-foreground transition-colors">Help Center</button>
                  <ChevronRight size={10} />
                  {collection && (
                    <>
                      <button onClick={() => selectCollection(collection.id)}
                        className="hover:text-foreground transition-colors">{collection.name}</button>
                      <ChevronRight size={10} />
                    </>
                  )}
                  <span className="text-foreground/70 truncate max-w-[180px]">{selectedArticle.title}</span>
                </nav>
                <ArticleToolbar title={selectedArticle.title} slug={selectedArticle.slug} />
              </div>

              <div className="bg-card rounded-2xl border border-border p-8 lg:p-10 shadow-sm">
                {selectedArticle.featured_image_url && (
                  <img src={selectedArticle.featured_image_url} alt={selectedArticle.title}
                    className="w-full h-48 object-cover rounded-xl mb-6" />
                )}
                <h1 className="font-display text-3xl lg:text-[34px] font-bold text-foreground mb-3 leading-tight">
                  {selectedArticle.title}
                </h1>
                <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground mb-8 pb-6 border-b border-border">
                  <span className="flex items-center gap-1"><Clock size={11} /> {new Date(selectedArticle.updated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                  <span className="flex items-center gap-1"><BookMarked size={11} /> {readingTime} min read</span>
                  <span className="flex items-center gap-1"><Eye size={11} /> {selectedArticle.views_count || 0} views</span>
                  {collection && (
                    <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full">
                      <FolderOpen size={10} /> {collection.name}
                    </span>
                  )}
                </div>
                <article className="text-[15px] leading-[1.85] text-foreground/85 max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedArticle.content) }} />
              </div>

              {/* Feedback */}
              <div className="mt-8">
                <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
                  {feedbackSent === selectedArticle.id ? (
                    <div className="text-center py-4">
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                        <ThumbsUp size={20} className="text-foreground" />
                      </div>
                      <p className="font-display font-semibold text-foreground">Thanks for your feedback!</p>
                      <p className="text-sm text-muted-foreground mt-1">Your input helps us improve.</p>
                    </div>
                  ) : showCommentBox ? (
                    <div>
                      <p className="font-display font-semibold text-foreground mb-3">What could be improved?</p>
                      <textarea value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)}
                        placeholder="Tell us how we can make this article better..."
                        className="w-full min-h-[100px] p-3 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                      <div className="flex gap-2 mt-3">
                        <button onClick={submitFeedbackWithComment}
                          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">Submit</button>
                        <button onClick={() => { setShowCommentBox(false); setFeedbackComment(""); }}
                          className="px-4 py-2.5 text-muted-foreground text-sm hover:text-foreground">Skip</button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <p className="font-display font-semibold text-lg text-foreground mb-1">Was this article helpful?</p>
                      <p className="text-sm text-muted-foreground mb-5">Let us know if you found what you were looking for</p>
                      <div className="flex items-center justify-center gap-3">
                        <button onClick={() => sendFeedback(true)}
                          className="flex items-center gap-2 px-6 py-3 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-all group">
                          <ThumbsUp size={16} className="text-muted-foreground group-hover:text-foreground" /> Yes, it helped
                        </button>
                        <button onClick={() => sendFeedback(false)}
                          className="flex items-center gap-2 px-6 py-3 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-all group">
                          <ThumbsDown size={16} className="text-muted-foreground group-hover:text-foreground" /> Not really
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Support */}
              <div className="mt-8">
                <ContactSupportForm articleId={selectedArticle.id} articleTitle={selectedArticle.title} />
              </div>

              {/* Related */}
              {relatedArticles.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-display text-lg font-semibold text-foreground mb-4">Related Articles</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {relatedArticles.map(a => (
                      <button key={a.id} onClick={() => selectArticle(a)}
                        className="text-left p-4 bg-card border border-border rounded-xl hover:shadow-md transition-all group">
                        <p className="text-sm font-medium text-foreground">{a.title}</p>
                        {a.excerpt && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.excerpt}</p>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </main>

            {/* TOC sidebar */}
            {headings.length > 1 && (
              <aside className="hidden lg:block">
                <div className="sticky top-20">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">On this page</p>
                  <nav className="space-y-1.5">
                    {headings.map((h, i) => (
                      <a key={i} href={`#${h.id}`}
                        className={`block text-xs text-muted-foreground hover:text-foreground transition-colors truncate ${
                          h.level === 1 ? "font-medium" : h.level === 2 ? "pl-3" : "pl-6"
                        }`}>
                        {h.text}
                      </a>
                    ))}
                  </nav>
                </div>
              </aside>
            )}
          </div>
        </div>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org", "@type": "Article",
          headline: selectedArticle.meta_title || selectedArticle.title,
          description: selectedArticle.meta_description || selectedArticle.excerpt || "",
          dateModified: selectedArticle.updated_at,
          publisher: { "@type": "Organization", name: "Funding Pulze" },
        })}} />
      </div>
    );
  }

  // ---- LANDING PAGE ----
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={goHome} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <img src={logo} alt="Funding Pulze" className="h-7 w-7 rounded-lg" />
            <span className="font-display font-bold text-sm">Funding Pulze Help Center</span>
          </button>
        </div>
      </header>

      <section className="bg-primary pb-16 pt-10">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-primary-foreground mb-8">Funding Pulze Help Centre</h1>
          <div className="relative max-w-2xl mx-auto" ref={searchRef}>
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search}
              onChange={e => { setSearch(e.target.value); if (selectedCollection) goHome(); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search for articles..."
              className="w-full h-13 pl-12 pr-4 py-3.5 bg-foreground/10 border border-foreground/15 rounded-xl text-primary-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all" />
            {showSuggestions && <SearchSuggestions articles={articles} query={search} onSelect={selectArticle} isDark />}
          </div>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-6 -mt-2 pb-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : search.trim() || (selectedCollection && !selectedArticle) ? (
          <div className="pt-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold text-foreground">
                {selectedCollection ? selectedCollection.name : `Results for "${search}"`}
              </h2>
              {selectedCollection && (
                <button onClick={goHome}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft size={12} /> All categories
                </button>
              )}
            </div>
            {selectedCollection && (() => {
              return selectedCollection.description ? <p className="text-sm text-muted-foreground mb-6 -mt-2">{selectedCollection.description}</p> : null;
            })()}
            {filteredArticles.length === 0 ? (
              <div className="text-center py-16 bg-card rounded-2xl border border-border">
                <Search size={32} className="text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">No articles found</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden divide-y divide-border">
                {filteredArticles.map(a => (
                  <button key={a.id} onClick={() => selectArticle(a)}
                    className="w-full text-left px-6 py-4 hover:bg-muted/50 transition-colors flex items-center justify-between group">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{a.title}</p>
                      {a.excerpt && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.excerpt}</p>}
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 ml-3" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8 pt-8">
            {mostViewed.length > 0 && (
              <div className="bg-card rounded-2xl border border-border shadow-sm p-6 lg:p-8">
                <h2 className="font-display text-xl font-bold text-foreground mb-5">Most Viewed Articles</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                  {mostViewed.map(a => (
                    <button key={a.id} onClick={() => selectArticle(a)}
                      className="text-left py-3 flex items-center justify-between border-b border-border last:border-0 hover:text-foreground transition-colors group">
                      <span className="text-sm text-foreground/80 group-hover:text-foreground">{a.title}</span>
                      <ChevronRight size={14} className="text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {collections.map(c => {
                const count = articles.filter(a => a.collection_id === c.id).length;
                const icon = iconMap[c.icon || "folder"] || iconMap.folder;
                return (
                  <button key={c.id} onClick={() => selectCollection(c.id)}
                    className="text-left bg-card rounded-2xl border border-border p-6 hover:shadow-lg hover:border-border/70 transition-all group">
                    <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center mb-4 text-foreground/60 group-hover:border-muted-foreground transition-colors">
                      {icon}
                    </div>
                    <h3 className="font-display text-base font-bold text-foreground mb-1">{c.name}</h3>
                    {c.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{c.description}</p>}
                    <p className="text-xs text-muted-foreground">{count} article{count !== 1 ? "s" : ""}</p>
                  </button>
                );
              })}
            </div>

            {collections.length === 0 && articles.length > 0 && (
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden divide-y divide-border">
                {articles.map(a => (
                  <button key={a.id} onClick={() => selectArticle(a)}
                    className="w-full text-left px-6 py-4 hover:bg-muted/50 transition-colors flex items-center justify-between group">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{a.title}</p>
                      {a.excerpt && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.excerpt}</p>}
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 ml-3" />
                  </button>
                ))}
              </div>
            )}

            {/* Contact Support on landing */}
            <ContactSupportForm />
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-card py-8 mt-4">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Funding Pulze" className="h-5 w-5 rounded" />
            <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} Funding Pulze. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://fundingpulze.com" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Main Site</a>
            <a href="https://fundingpulze.com/faq" className="text-xs text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HelpCenter;
