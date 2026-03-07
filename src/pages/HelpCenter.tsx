import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, FolderOpen, FileText, ChevronRight, ArrowLeft, ThumbsUp, ThumbsDown, Star, Clock, Eye, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import logo from "@/assets/logo.png";

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
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
  meta_title: string | null;
  meta_description: string | null;
  featured_image_url: string | null;
  views_count: number;
  updated_at: string;
}

// Markdown renderer
const renderMarkdown = (md: string) => {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 id="$1" class="text-lg font-semibold mt-8 mb-3 text-[hsl(0,0%,10%)] scroll-mt-20">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 id="$1" class="text-xl font-bold mt-10 mb-4 text-[hsl(0,0%,8%)] scroll-mt-20">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 id="$1" class="text-2xl font-bold mt-10 mb-4 text-[hsl(0,0%,5%)] scroll-mt-20">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-[hsl(0,0%,93%)] px-1.5 py-0.5 rounded text-[13px] font-mono text-[hsl(0,0%,25%)]">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-[3px] border-[hsl(0,0%,82%)] pl-4 italic text-[hsl(0,0%,40%)] my-4 py-1">$1</blockquote>')
    .replace(/^---$/gm, '<hr class="my-8 border-[hsl(0,0%,92%)]" />')
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" class="rounded-xl max-w-full my-6 shadow-sm" />')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-[hsl(0,0%,15%)] underline decoration-[hsl(0,0%,70%)] underline-offset-2 hover:decoration-[hsl(0,0%,30%)] transition-colors" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-5 list-disc text-[hsl(0,0%,20%)] leading-relaxed">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-5 list-decimal text-[hsl(0,0%,20%)] leading-relaxed">$1</li>')
    .replace(/\n\n/g, '<div class="h-4"></div>');
};

// Extract headings for TOC
const extractHeadings = (md: string) => {
  const headings: { level: number; text: string; id: string }[] = [];
  const regex = /^(#{1,3}) (.+)$/gm;
  let match;
  while ((match = regex.exec(md)) !== null) {
    headings.push({ level: match[1].length, text: match[2], id: match[2] });
  }
  return headings;
};

const HelpCenter = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [feedbackType, setFeedbackType] = useState<boolean | null>(null);

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

  // Update SEO meta tags
  useEffect(() => {
    if (selectedArticle) {
      document.title = selectedArticle.meta_title || `${selectedArticle.title} | Funding Pulze Help`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute("content", selectedArticle.meta_description || selectedArticle.excerpt || "");
    } else {
      document.title = "Funding Pulze Help Center";
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute("content", "Find answers, guides, and support for Funding Pulze.");
    }
  }, [selectedArticle]);

  // Track views
  useEffect(() => {
    if (selectedArticle) {
      supabase.from("help_articles").update({ views_count: (selectedArticle.views_count || 0) + 1 }).eq("id", selectedArticle.id).then(() => {});
    }
  }, [selectedArticle?.id]);

  const filteredArticles = useMemo(() => {
    let result = articles;
    if (selectedCollection) result = result.filter(a => a.collection_id === selectedCollection);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a => a.title.toLowerCase().includes(q) || a.excerpt?.toLowerCase().includes(q) || a.content.toLowerCase().includes(q));
    }
    return result;
  }, [articles, search, selectedCollection]);

  const featuredArticles = useMemo(() => articles.filter(a => a.is_featured), [articles]);

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
      article_id: selectedArticle.id,
      is_helpful: feedbackType ?? false,
      comment: feedbackComment || null,
    });
    setFeedbackSent(selectedArticle.id);
    setShowCommentBox(false);
    setFeedbackComment("");
  };

  const selectArticle = (a: Article) => {
    setSelectedArticle(a);
    setFeedbackSent(null);
    setShowCommentBox(false);
    setFeedbackComment("");
    setFeedbackType(null);
    window.scrollTo(0, 0);
  };

  const relatedArticles = useMemo(() => {
    if (!selectedArticle) return [];
    return articles
      .filter(a => a.id !== selectedArticle.id && a.collection_id === selectedArticle.collection_id)
      .slice(0, 3);
  }, [selectedArticle, articles]);

  const headings = useMemo(() => selectedArticle ? extractHeadings(selectedArticle.content) : [], [selectedArticle]);

  // ---- Header ----
  const Header = () => (
    <header className="sticky top-0 z-50 border-b border-[hsl(0,0%,91%)] bg-[hsl(0,0%,100%)]/95 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <button onClick={() => { setSelectedArticle(null); setSelectedCollection(null); setSearch(""); }}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <img src={logo} alt="Funding Pulze" className="h-7 w-7 rounded-lg" />
          <span className="font-display font-bold text-sm text-[hsl(0,0%,5%)]">Help Center</span>
        </button>
        <div className="relative w-64 hidden sm:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(0,0%,50%)]" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setSelectedCollection(null); setSelectedArticle(null); }}
            placeholder="Search..."
            className="w-full h-8 pl-9 pr-3 bg-[hsl(0,0%,96%)] border border-[hsl(0,0%,90%)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(0,0%,20%)] transition-shadow"
          />
        </div>
      </div>
    </header>
  );

  // ---- Article Detail ----
  if (selectedArticle) {
    const collection = collections.find(c => c.id === selectedArticle.collection_id);
    return (
      <div className="min-h-screen bg-[hsl(0,0%,99%)]">
        <Header />
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-10">
            <main>
              {/* Breadcrumbs */}
              <nav className="flex items-center gap-1.5 text-xs text-[hsl(0,0%,50%)] mb-6">
                <button onClick={() => { setSelectedArticle(null); setSelectedCollection(null); }}
                  className="hover:text-[hsl(0,0%,15%)] transition-colors">Help Center</button>
                <ChevronRight size={10} />
                {collection && (
                  <>
                    <button onClick={() => { setSelectedArticle(null); setSelectedCollection(collection.id); }}
                      className="hover:text-[hsl(0,0%,15%)] transition-colors">{collection.name}</button>
                    <ChevronRight size={10} />
                  </>
                )}
                <span className="text-[hsl(0,0%,30%)] truncate max-w-[200px]">{selectedArticle.title}</span>
              </nav>

              {/* Featured image */}
              {selectedArticle.featured_image_url && (
                <img src={selectedArticle.featured_image_url} alt={selectedArticle.title}
                  className="w-full h-48 object-cover rounded-xl mb-6" />
              )}

              {/* Title */}
              <h1 className="font-display text-3xl lg:text-4xl font-bold text-[hsl(0,0%,5%)] mb-3 leading-tight">
                {selectedArticle.title}
              </h1>
              <div className="flex items-center gap-4 text-xs text-[hsl(0,0%,50%)] mb-8 pb-6 border-b border-[hsl(0,0%,92%)]">
                <span className="flex items-center gap-1"><Clock size={11} /> {new Date(selectedArticle.updated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                <span className="flex items-center gap-1"><Eye size={11} /> {selectedArticle.views_count || 0} views</span>
                {collection && (
                  <span className="inline-flex items-center gap-1 bg-[hsl(0,0%,94%)] px-2 py-0.5 rounded-full">
                    <FolderOpen size={10} /> {collection.name}
                  </span>
                )}
              </div>

              {/* Content */}
              <article className="text-[15px] leading-[1.8] text-[hsl(0,0%,18%)] max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedArticle.content) }} />

              {/* Feedback Widget */}
              <div className="mt-12 pt-8 border-t border-[hsl(0,0%,92%)]">
                {feedbackSent === selectedArticle.id ? (
                  <div className="bg-[hsl(0,0%,97%)] rounded-2xl p-8 text-center">
                    <div className="w-12 h-12 bg-[hsl(142,70%,92%)] rounded-full flex items-center justify-center mx-auto mb-3">
                      <ThumbsUp size={20} className="text-[hsl(142,70%,35%)]" />
                    </div>
                    <p className="font-display font-semibold text-[hsl(0,0%,10%)]">Thanks for your feedback!</p>
                    <p className="text-sm text-[hsl(0,0%,50%)] mt-1">Your input helps us improve our content.</p>
                  </div>
                ) : showCommentBox ? (
                  <div className="bg-[hsl(0,0%,97%)] rounded-2xl p-8">
                    <p className="font-display font-semibold text-[hsl(0,0%,10%)] mb-3">What could be improved?</p>
                    <textarea
                      value={feedbackComment}
                      onChange={e => setFeedbackComment(e.target.value)}
                      placeholder="Tell us how we can make this article better..."
                      className="w-full min-h-[100px] p-3 bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,88%)] rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(0,0%,20%)]"
                    />
                    <div className="flex gap-2 mt-3">
                      <button onClick={submitFeedbackWithComment}
                        className="px-4 py-2 bg-[hsl(0,0%,5%)] text-[hsl(0,0%,100%)] rounded-lg text-sm font-medium hover:bg-[hsl(0,0%,15%)] transition-colors">
                        Submit
                      </button>
                      <button onClick={() => { setShowCommentBox(false); setFeedbackComment(""); }}
                        className="px-4 py-2 text-[hsl(0,0%,50%)] text-sm hover:text-[hsl(0,0%,20%)] transition-colors">
                        Skip
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[hsl(0,0%,97%)] rounded-2xl p-8 text-center">
                    <p className="font-display font-semibold text-lg text-[hsl(0,0%,10%)] mb-1">Was this article helpful?</p>
                    <p className="text-sm text-[hsl(0,0%,50%)] mb-5">Let us know if you found what you were looking for</p>
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => sendFeedback(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,88%)] rounded-xl text-sm font-medium text-[hsl(0,0%,20%)] hover:border-[hsl(142,70%,50%)] hover:bg-[hsl(142,70%,97%)] transition-all group">
                        <ThumbsUp size={16} className="text-[hsl(0,0%,40%)] group-hover:text-[hsl(142,70%,40%)]" />
                        Yes, it helped
                      </button>
                      <button onClick={() => sendFeedback(false)}
                        className="flex items-center gap-2 px-6 py-3 bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,88%)] rounded-xl text-sm font-medium text-[hsl(0,0%,20%)] hover:border-[hsl(0,84%,60%)] hover:bg-[hsl(0,84%,98%)] transition-all group">
                        <ThumbsDown size={16} className="text-[hsl(0,0%,40%)] group-hover:text-[hsl(0,84%,55%)]" />
                        Not really
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Related Articles */}
              {relatedArticles.length > 0 && (
                <div className="mt-10">
                  <h3 className="font-display text-lg font-semibold text-[hsl(0,0%,10%)] mb-4">Related Articles</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {relatedArticles.map(a => (
                      <button key={a.id} onClick={() => selectArticle(a)}
                        className="text-left p-4 bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl hover:shadow-md transition-all group">
                        <p className="text-sm font-medium text-[hsl(0,0%,10%)] group-hover:text-[hsl(0,0%,0%)]">{a.title}</p>
                        {a.excerpt && <p className="text-xs text-[hsl(0,0%,50%)] mt-1 line-clamp-2">{a.excerpt}</p>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </main>

            {/* Table of Contents */}
            {headings.length > 1 && (
              <aside className="hidden lg:block">
                <div className="sticky top-20">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(0,0%,45%)] mb-3">On this page</p>
                  <nav className="space-y-1">
                    {headings.map((h, i) => (
                      <a key={i} href={`#${h.id}`}
                        className={`block text-xs text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,10%)] transition-colors truncate ${
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

        {/* JSON-LD */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org", "@type": "Article",
          headline: selectedArticle.meta_title || selectedArticle.title,
          description: selectedArticle.meta_description || selectedArticle.excerpt || "",
          dateModified: selectedArticle.updated_at,
          image: selectedArticle.featured_image_url || undefined,
          publisher: { "@type": "Organization", name: "Funding Pulze" },
        })}} />
      </div>
    );
  }

  // ---- Landing / Browse ----
  return (
    <div className="min-h-screen bg-[hsl(0,0%,99%)]">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-[hsl(0,0%,100%)] to-[hsl(0,0%,98%)] border-b border-[hsl(0,0%,92%)] py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h1 className="font-display text-4xl lg:text-5xl font-bold text-[hsl(0,0%,5%)] mb-4 leading-tight">
            How can we help?
          </h1>
          <p className="text-[hsl(0,0%,45%)] mb-8 text-lg">Find answers, guides, and everything you need to get started</p>
          <div className="relative max-w-lg mx-auto">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(0,0%,45%)]" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedCollection(null); }}
              placeholder="Search for articles, guides, topics..."
              className="w-full h-12 pl-11 pr-4 bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,86%)] rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(0,0%,20%)] focus:shadow-md transition-all"
            />
          </div>
          {search.trim() && (
            <p className="text-xs text-[hsl(0,0%,50%)] mt-3">
              {filteredArticles.length} result{filteredArticles.length !== 1 ? "s" : ""} for "{search}"
            </p>
          )}
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-6 w-6 border-2 border-[hsl(0,0%,20%)] border-t-transparent rounded-full" />
          </div>
        ) : search.trim() || selectedCollection ? (
          /* Search / collection results */
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold text-[hsl(0,0%,8%)]">
                {selectedCollection
                  ? collections.find(c => c.id === selectedCollection)?.name
                  : `Results for "${search}"`}
              </h2>
              {selectedCollection && (
                <button onClick={() => setSelectedCollection(null)}
                  className="flex items-center gap-1 text-xs text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,15%)] transition-colors">
                  <ArrowLeft size={12} /> All categories
                </button>
              )}
            </div>
            {selectedCollection && (() => {
              const col = collections.find(c => c.id === selectedCollection);
              return col?.description ? <p className="text-sm text-[hsl(0,0%,45%)] mb-6 -mt-2">{col.description}</p> : null;
            })()}
            {filteredArticles.length === 0 ? (
              <div className="text-center py-16">
                <Search size={32} className="text-[hsl(0,0%,80%)] mx-auto mb-3" />
                <p className="text-[hsl(0,0%,40%)]">No articles found</p>
                <p className="text-xs text-[hsl(0,0%,55%)] mt-1">Try a different search term or browse categories</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredArticles.map(a => (
                  <button key={a.id} onClick={() => selectArticle(a)}
                    className="w-full text-left bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,91%)] p-4 hover:shadow-md hover:border-[hsl(0,0%,82%)] transition-all flex items-center justify-between group">
                    <div className="flex items-start gap-3 min-w-0">
                      <FileText size={16} className="text-[hsl(0,0%,50%)] mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {a.is_featured && <Star size={11} className="text-amber-500 fill-amber-500 shrink-0" />}
                          <p className="text-sm font-medium text-[hsl(0,0%,10%)] truncate">{a.title}</p>
                        </div>
                        {a.excerpt && <p className="text-xs text-[hsl(0,0%,50%)] mt-1 line-clamp-1">{a.excerpt}</p>}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-[hsl(0,0%,75%)] group-hover:text-[hsl(0,0%,30%)] shrink-0 ml-2 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-12">
            {/* Featured Articles */}
            {featuredArticles.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Star size={14} className="text-amber-500 fill-amber-500" />
                  <h2 className="font-display text-lg font-bold text-[hsl(0,0%,8%)]">Featured</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {featuredArticles.slice(0, 3).map(a => (
                    <button key={a.id} onClick={() => selectArticle(a)}
                      className="text-left bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,88%)] p-5 hover:shadow-lg hover:border-[hsl(0,0%,78%)] transition-all group">
                      {a.featured_image_url && (
                        <img src={a.featured_image_url} alt={a.title} className="w-full h-28 object-cover rounded-lg mb-3" />
                      )}
                      <p className="text-sm font-semibold text-[hsl(0,0%,8%)] group-hover:text-[hsl(0,0%,0%)]">{a.title}</p>
                      {a.excerpt && <p className="text-xs text-[hsl(0,0%,50%)] mt-1.5 line-clamp-2">{a.excerpt}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Collections Grid */}
            <div>
              <h2 className="font-display text-lg font-bold text-[hsl(0,0%,8%)] mb-4">Browse by Category</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {collections.map(c => {
                  const count = articles.filter(a => a.collection_id === c.id).length;
                  return (
                    <button key={c.id} onClick={() => setSelectedCollection(c.id)}
                      className="text-left bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,91%)] p-5 hover:shadow-lg hover:border-[hsl(0,0%,78%)] transition-all group">
                      <div className="w-10 h-10 rounded-xl bg-[hsl(0,0%,96%)] flex items-center justify-center mb-3 group-hover:bg-[hsl(0,0%,92%)] transition-colors">
                        <FolderOpen size={18} className="text-[hsl(0,0%,35%)]" />
                      </div>
                      <h3 className="text-sm font-semibold text-[hsl(0,0%,8%)]">{c.name}</h3>
                      {c.description && <p className="text-xs text-[hsl(0,0%,50%)] mt-1 line-clamp-2">{c.description}</p>}
                      <p className="text-[11px] text-[hsl(0,0%,50%)] mt-2">{count} article{count !== 1 ? "s" : ""}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* All Articles */}
            {articles.length > 0 && (
              <div>
                <h2 className="font-display text-lg font-bold text-[hsl(0,0%,8%)] mb-4">All Articles</h2>
                <div className="space-y-2">
                  {articles.map(a => (
                    <button key={a.id} onClick={() => selectArticle(a)}
                      className="w-full text-left bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,91%)] p-4 hover:shadow-md hover:border-[hsl(0,0%,82%)] transition-all flex items-center justify-between group">
                      <div className="flex items-start gap-3 min-w-0">
                        <FileText size={16} className="text-[hsl(0,0%,50%)] mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {a.is_featured && <Star size={11} className="text-amber-500 fill-amber-500 shrink-0" />}
                            <p className="text-sm font-medium text-[hsl(0,0%,10%)] truncate">{a.title}</p>
                          </div>
                          {a.excerpt && <p className="text-xs text-[hsl(0,0%,50%)] mt-1 line-clamp-1">{a.excerpt}</p>}
                          <div className="flex items-center gap-3 mt-1.5">
                            {(() => { const col = collections.find(c => c.id === a.collection_id); return col ? <span className="text-[10px] text-[hsl(0,0%,55%)]">{col.name}</span> : null; })()}
                            <span className="text-[10px] text-[hsl(0,0%,60%)]">{new Date(a.updated_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-[hsl(0,0%,75%)] group-hover:text-[hsl(0,0%,30%)] shrink-0 ml-2 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[hsl(0,0%,92%)] bg-[hsl(0,0%,100%)] py-8 mt-10">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Funding Pulze" className="h-5 w-5 rounded" />
            <span className="text-xs text-[hsl(0,0%,50%)]">© {new Date().getFullYear()} Funding Pulze. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://fundingpulze.com" className="text-xs text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,20%)] transition-colors">Main Site</a>
            <a href="https://fundingpulze.com/faq" className="text-xs text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,20%)] transition-colors">FAQ</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HelpCenter;
