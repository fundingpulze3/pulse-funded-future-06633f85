import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, FolderOpen, FileText, ChevronRight, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import logo from "@/assets/logo.png";

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface Article {
  id: string;
  collection_id: string | null;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  is_published: boolean;
  updated_at: string;
}

const renderMarkdown = (md: string) => {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2 text-[hsl(0,0%,10%)]">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-8 mb-3 text-[hsl(0,0%,10%)]">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-4 text-[hsl(0,0%,5%)]">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-[hsl(0,0%,94%)] px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-[hsl(0,0%,80%)] pl-4 italic text-[hsl(0,0%,45%)] my-3">$1</blockquote>')
    .replace(/^---$/gm, '<hr class="my-6 border-[hsl(0,0%,90%)]" />')
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" class="rounded-lg max-w-full my-4" />')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-[hsl(0,0%,20%)] underline hover:text-[hsl(0,0%,0%)]" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-[hsl(0,0%,25%)]">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-[hsl(0,0%,25%)]">$1</li>')
    .replace(/\n\n/g, '<br/><br/>');
};

const HelpCenter = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

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

  const filteredArticles = useMemo(() => {
    let result = articles;
    if (selectedCollection) {
      result = result.filter(a => a.collection_id === selectedCollection);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.excerpt?.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q)
      );
    }
    return result;
  }, [articles, search, selectedCollection]);

  // Article detail view
  if (selectedArticle) {
    const collection = collections.find(c => c.id === selectedArticle.collection_id);
    return (
      <div className="min-h-screen bg-[hsl(0,0%,98%)]">
        <header className="border-b border-[hsl(0,0%,90%)] bg-[hsl(0,0%,100%)]">
          <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-3">
            <img src={logo} alt="Funding Pulze" className="h-7 w-7 rounded-lg" />
            <span className="font-display font-bold text-sm text-[hsl(0,0%,5%)]">Help Center</span>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-6 py-8">
          <button
            onClick={() => setSelectedArticle(null)}
            className="flex items-center gap-1 text-sm text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,15%)] mb-6 transition-colors"
          >
            <ArrowLeft size={14} /> Back to articles
          </button>
          {collection && (
            <span className="inline-block text-xs font-medium text-[hsl(0,0%,45%)] bg-[hsl(0,0%,93%)] px-2 py-0.5 rounded-full mb-3">
              {collection.name}
            </span>
          )}
          <h1 className="font-display text-3xl font-bold text-[hsl(0,0%,5%)] mb-2">{selectedArticle.title}</h1>
          <p className="text-xs text-[hsl(0,0%,50%)] mb-8">
            Updated {new Date(selectedArticle.updated_at).toLocaleDateString()}
          </p>
          <div
            className="text-[15px] leading-relaxed text-[hsl(0,0%,20%)]"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedArticle.content) }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(0,0%,98%)]">
      {/* Header */}
      <header className="border-b border-[hsl(0,0%,90%)] bg-[hsl(0,0%,100%)]">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-3">
          <img src={logo} alt="Funding Pulze" className="h-7 w-7 rounded-lg" />
          <span className="font-display font-bold text-sm text-[hsl(0,0%,5%)]">Help Center</span>
        </div>
      </header>

      {/* Hero + Search */}
      <section className="bg-[hsl(0,0%,100%)] border-b border-[hsl(0,0%,90%)] py-12">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h1 className="font-display text-3xl font-bold text-[hsl(0,0%,5%)] mb-3">How can we help?</h1>
          <p className="text-sm text-[hsl(0,0%,45%)] mb-6">Search our knowledge base or browse by category</p>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(0,0%,45%)]" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedCollection(null); }}
              placeholder="Search articles..."
              className="pl-10 h-11 bg-[hsl(0,0%,98%)] border-[hsl(0,0%,88%)] text-sm"
            />
          </div>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {loading ? (
          <p className="text-center text-sm text-[hsl(0,0%,50%)]">Loading...</p>
        ) : search.trim() || selectedCollection ? (
          /* Search results / filtered view */
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-[hsl(0,0%,10%)]">
                {selectedCollection
                  ? collections.find(c => c.id === selectedCollection)?.name
                  : `Results for "${search}"`}
              </h2>
              {selectedCollection && (
                <button onClick={() => setSelectedCollection(null)} className="text-xs text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,15%)]">
                  ← All categories
                </button>
              )}
            </div>
            {filteredArticles.length === 0 ? (
              <p className="text-sm text-[hsl(0,0%,50%)] py-8 text-center">No articles found.</p>
            ) : (
              <div className="space-y-2">
                {filteredArticles.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedArticle(a)}
                    className="w-full text-left bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-4 hover:shadow-md transition-shadow flex items-center justify-between group"
                  >
                    <div className="flex items-start gap-3">
                      <FileText size={16} className="text-[hsl(0,0%,45%)] mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-[hsl(0,0%,10%)]">{a.title}</p>
                        {a.excerpt && <p className="text-xs text-[hsl(0,0%,50%)] mt-1 line-clamp-1">{a.excerpt}</p>}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-[hsl(0,0%,70%)] group-hover:text-[hsl(0,0%,30%)] shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Collections grid */
          <div>
            <h2 className="font-display text-lg font-semibold text-[hsl(0,0%,10%)] mb-4">Browse by category</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {collections.map(c => {
                const count = articles.filter(a => a.collection_id === c.id).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCollection(c.id)}
                    className="text-left bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5 hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FolderOpen size={18} className="text-[hsl(0,0%,40%)]" />
                      <h3 className="text-sm font-semibold text-[hsl(0,0%,10%)]">{c.name}</h3>
                    </div>
                    {c.description && <p className="text-xs text-[hsl(0,0%,50%)] mb-2 line-clamp-2">{c.description}</p>}
                    <p className="text-xs text-[hsl(0,0%,45%)]">{count} article{count !== 1 ? "s" : ""}</p>
                  </button>
                );
              })}
            </div>

            {/* All articles */}
            {articles.length > 0 && (
              <div className="mt-10">
                <h2 className="font-display text-lg font-semibold text-[hsl(0,0%,10%)] mb-4">All articles</h2>
                <div className="space-y-2">
                  {articles.map(a => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedArticle(a)}
                      className="w-full text-left bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-4 hover:shadow-md transition-shadow flex items-center justify-between group"
                    >
                      <div className="flex items-start gap-3">
                        <FileText size={16} className="text-[hsl(0,0%,45%)] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-[hsl(0,0%,10%)]">{a.title}</p>
                          {a.excerpt && <p className="text-xs text-[hsl(0,0%,50%)] mt-1 line-clamp-1">{a.excerpt}</p>}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-[hsl(0,0%,70%)] group-hover:text-[hsl(0,0%,30%)] shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[hsl(0,0%,90%)] py-6 text-center">
        <p className="text-xs text-[hsl(0,0%,50%)]">© {new Date().getFullYear()} Funding Pulze. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HelpCenter;
