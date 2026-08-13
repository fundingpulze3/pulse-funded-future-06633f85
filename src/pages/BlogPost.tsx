import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db as supabase } from "@/integrations/db/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowLeft, Clock, Eye, Calendar, Printer, Download, Share2, List, ArrowRight, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  thumbnail_url: string | null;
  thumbnail_alt: string | null;
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
  views_count: number;
  reading_time: number;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string[] | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  focus_keyword: string | null;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

// Extract TOC headings from markdown
const extractToc = (md: string): TocItem[] => {
  const items: TocItem[] = [];
  const regex = /^(#{1,3}) (.+)$/gm;
  let match;
  while ((match = regex.exec(md)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    items.push({ id, text, level });
  }
  return items;
};

// Highlight focus keyword / meta keywords inside body copy (FTMO-style blue accents),
// skipping anything already inside an HTML tag.
const highlightKeywords = (html: string, keywords: string[]) => {
  const uniq = Array.from(new Set(keywords.map(k => k.trim()).filter(k => k.length > 2)))
    .sort((a, b) => b.length - a.length)
    .slice(0, 8);
  let out = html;
  for (const kw of uniq) {
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?![^<]*>)\\b(${esc})\\b`, "gi");
    let count = 0;
    out = out.replace(re, (m) => {
      count += 1;
      if (count > 2) return m; // avoid spamming the page
      return `<span class="fp-hl">${m}</span>`;
    });
  }
  return out;
};

const renderMarkdown = (md: string) => {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, (_m, t) => {
      const id = t.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return `<h3 id="${id}" class="text-xl md:text-2xl font-bold mt-8 mb-3 font-display scroll-mt-24 tracking-tight">${t}</h3>`;
    })
    .replace(/^## (.+)$/gm, (_m: string, t: string) => {
      const id = t.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return `<h2 id="${id}" class="text-2xl md:text-3xl font-bold mt-12 mb-4 font-display scroll-mt-24 tracking-tight">${t}</h2>`;
    })
    .replace(/^# (.+)$/gm, (_m: string, t: string) => {
      const id = t.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return `<h1 id="${id}" class="text-3xl md:text-4xl font-bold mt-12 mb-5 font-display scroll-mt-24 tracking-tight">${t}</h1>`;
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong class="fp-hl font-bold">$1</strong>')
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>')
    .replace(/^> \*\*CTA:\*\*\s*(.+?)\s*\[([^\]]+)\]\(([^)]+)\)\s*$/gm,
      '<div class="fp-cta my-6 rounded-xl border border-primary/30 bg-primary/5 p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between not-prose">' +
      '<p class="m-0 font-medium text-foreground">$1</p>' +
      '<a href="$3" data-cta="$2" class="fp-cta-btn shrink-0 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground no-underline hover:opacity-90 transition">$2</a></div>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-border pl-4 italic text-muted-foreground my-4">$1</blockquote>')
    .replace(/^---$/gm, '<hr class="my-6 border-border" />')
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" class="rounded-xl max-w-full my-4" />')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="fp-hl font-semibold underline decoration-primary/40 underline-offset-4 hover:decoration-primary">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\n\n/g, '<br/><br/>');
};

function sessionId() {
  try {
    let id = localStorage.getItem("fp_sid");
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("fp_sid", id); }
    return id;
  } catch { return "anon"; }
}

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(true);
  const [post, setPost] = useState<Post | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [tocOpen, setTocOpen] = useState(true);
  const [activeHeading, setActiveHeading] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // read time + CTA clicks
  useEffect(() => {
    if (!post?.id) return;
    const start = Date.now();
    let sent = false;
    const flush = () => {
      if (sent) return;
      const secs = Math.round((Date.now() - start) / 1000);
      if (secs < 3) return;
      sent = true;
      supabase.from("blog_events").insert({ post_id: post.id, type: "read", seconds: secs, session_id: sessionId() }).then(() => {});
    };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest("[data-cta]") as HTMLElement | null;
      if (!el) return;
      supabase.from("blog_events").insert({ post_id: post.id, type: "cta_click", cta_label: el.getAttribute("data-cta"), session_id: sessionId() }).then(() => {});
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("click", onClick);
    return () => {
      flush();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("click", onClick);
    };
  }, [post?.id]);

  useEffect(() => {
    if (!slug) return;
    const fetchPost = async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .single();

      if (data) {
        setPost(data as Post);
        supabase.from("blog_posts").update({ views_count: (data.views_count || 0) + 1 }).eq("id", data.id).then(() => {});
        supabase.from("blog_events").insert({ post_id: data.id, type: "view", session_id: sessionId() }).then(() => {});
        document.title = data.meta_title || `${data.title} — FP Blog`;

        const { data: related } = await supabase
          .from("blog_posts")
          .select("*")
          .eq("is_published", true)
          .neq("id", data.id)
          .order("published_at", { ascending: false })
          .limit(3);
        if (related) setRelatedPosts(related as unknown as Post[]);
      }
      setLoading(false);
    };
    fetchPost();
  }, [slug]);

  const toc = useMemo(() => (post ? extractToc(post.content) : []), [post]);

  // Intersection observer for active heading tracking
  useEffect(() => {
    if (!toc.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHeading(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0.1 }
    );
    toc.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [toc, post]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const exportMarkdown = () => {
    if (!post) return;
    const blob = new Blob([`# ${post.title}\n\n${post.content}`], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${post.slug}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const jsonLd = post ? {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.og_title || post.title,
    description: post.og_description || post.meta_description || post.excerpt || "",
    image: post.og_image_url || post.thumbnail_url || "",
    datePublished: post.published_at || post.created_at,
    keywords: post.meta_keywords?.join(", ") || post.focus_keyword || "",
    url: post.canonical_url || `${window.location.origin}/blog/${post.slug}`,
    publisher: { "@type": "Organization", name: "Funding Pulze" },
  } : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin h-8 w-8 border-2 border-foreground border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />
        <div className="text-center py-32">
          <p className="text-xl text-muted-foreground">Article not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/blog")}>
            <ArrowLeft size={16} className="mr-2" /> Back to Blog
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />

      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}

      {/* Hero Image */}
      {post.thumbnail_url && (
        <div className="w-full max-h-[480px] overflow-hidden">
          <img
            src={post.thumbnail_url}
            alt={post.thumbnail_alt || post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 pt-12 pb-20 flex gap-10">
        {/* ── Table of Contents — Desktop Sidebar ── */}
        {toc.length > 2 && (
          <aside className="hidden xl:block w-56 shrink-0">
            <div className="sticky top-28">
              <button
                onClick={() => setTocOpen(!tocOpen)}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 hover:text-foreground transition-colors"
              >
                <List size={14} />
                Contents
              </button>
              {tocOpen && (
                <motion.nav
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-0.5"
                >
                  {toc.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className={`text-[13px] leading-snug py-1.5 border-l-2 transition-all duration-200 ${
                        activeHeading === item.id
                          ? "border-foreground text-foreground font-medium"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                      } ${item.level === 1 ? "pl-3" : item.level === 2 ? "pl-5" : "pl-7"}`}
                    >
                      {item.text}
                    </a>
                  ))}
                </motion.nav>
              )}
            </div>
          </aside>
        )}

        {/* ── Main Article Content ── */}
        <article className="max-w-3xl w-full mx-auto min-w-0">
          {/* Back */}
          <Button
            variant="ghost"
            size="sm"
            className="mb-6 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/blog")}
          >
            <ArrowLeft size={16} className="mr-1" /> Back to Blog
          </Button>

          {/* Meta */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {formatDate(post.published_at || post.created_at)}
              </span>
              {post.reading_time > 0 && (
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {post.reading_time} min read
                </span>
              )}
              <span className="flex items-center gap-1">
                <Eye size={14} />
                {post.views_count} views
              </span>
            </div>

            <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">{post.title}</h1>

            {post.excerpt && (
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{post.excerpt}</p>
            )}

            {post.meta_keywords && post.meta_keywords.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {post.meta_keywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex items-center gap-2 border-b border-border pb-6">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer size={14} className="mr-1" /> Print
              </Button>
              <Button variant="outline" size="sm" onClick={exportMarkdown}>
                <Download size={14} className="mr-1" /> Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(window.location.href)}
              >
                <Share2 size={14} className="mr-1" /> Share
              </Button>
            </div>
          </motion.div>

          {/* ── Mobile TOC (collapsible) ── */}
          {toc.length > 2 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="xl:hidden mt-6 rounded-xl border border-border bg-card p-4"
            >
              <button
                onClick={() => setTocOpen(!tocOpen)}
                className="flex items-center justify-between w-full text-sm font-semibold"
              >
                <span className="flex items-center gap-2">
                  <List size={15} /> Table of Contents
                </span>
                <span className="text-muted-foreground text-xs">{tocOpen ? "Hide" : "Show"}</span>
              </button>
              {tocOpen && (
                <nav className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
                  {toc.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className={`text-sm py-1 text-muted-foreground hover:text-foreground transition-colors ${
                        item.level === 1 ? "" : item.level === 2 ? "pl-4" : "pl-8"
                      }`}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>
              )}
            </motion.div>
          )}

          {/* Content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-8 prose prose-neutral dark:prose-invert max-w-none leading-relaxed text-foreground"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
          />

          {/* ── Glassmorphic CTA → /challenges ── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-16 relative overflow-hidden rounded-2xl border border-border/50"
          >
            {/* Glass background */}
            <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.03] via-foreground/[0.06] to-foreground/[0.02] backdrop-blur-xl" />
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-foreground/[0.04] blur-3xl" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-foreground/[0.03] blur-3xl" />

            <div className="relative px-8 py-10 md:px-12 md:py-14 flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-foreground/[0.06] border border-border/50 text-xs font-medium text-muted-foreground mb-4">
                  <Rocket size={12} />
                  Start Trading Today
                </div>
                <h3 className="font-display text-2xl md:text-3xl font-bold leading-tight">
                  Ready to get funded?
                </h3>
                <p className="mt-2 text-muted-foreground text-sm md:text-base max-w-md">
                  Choose your challenge size, prove your skills, and trade with our capital. No risk to your own funds.
                </p>
              </div>
              <Button
                size="lg"
                className="rounded-xl px-8 h-12 font-semibold bg-foreground text-background hover:bg-foreground/90 shrink-0"
                onClick={() => navigate("/#challenges")}
              >
                View Challenges
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </div>
          </motion.div>

          {/* ── Recommended Articles ── */}
          {relatedPosts.length > 0 && (
            <div className="mt-16 pt-8 border-t border-border">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-bold">Recommended for you</h2>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => navigate("/blog")}>
                  All articles <ArrowRight size={14} className="ml-1" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {relatedPosts.map((rp, i) => (
                  <motion.div
                    key={rp.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="group cursor-pointer rounded-xl border border-border bg-card hover:shadow-lg transition-all duration-300 overflow-hidden"
                    onClick={() => navigate(`/blog/${rp.slug}`)}
                  >
                    {rp.thumbnail_url && (
                      <div className="aspect-[4/5] overflow-hidden">
                        <img
                          src={rp.thumbnail_url}
                          alt={rp.thumbnail_alt || rp.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-display text-sm font-bold line-clamp-2 group-hover:underline decoration-1 underline-offset-2">
                        {rp.title}
                      </h3>
                      {rp.excerpt && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{rp.excerpt}</p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>{formatDateShort(rp.published_at || rp.created_at)}</span>
                        {rp.reading_time > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock size={10} /> {rp.reading_time} min
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>

      <Footer />
    </div>
  );
};

export default BlogPost;
