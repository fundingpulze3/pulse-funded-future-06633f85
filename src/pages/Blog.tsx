import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db as supabase } from "@/integrations/db/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Search, Clock, Eye, ArrowRight, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  thumbnail_url: string | null;
  thumbnail_alt: string | null;
  thumbnail_ratio: string | null;
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
  views_count: number;
  reading_time: number;
  meta_keywords: string[] | null;
  focus_keyword: string | null;
}

const Blog = () => {
  const [isDark, setIsDark] = useState(true);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [carouselIndex, setCarouselIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, thumbnail_url, thumbnail_alt, thumbnail_ratio, is_featured, published_at, created_at, views_count, reading_time, meta_keywords, focus_keyword")
        .eq("is_published", true)
        .order("published_at", { ascending: false });
      if (data) setPosts(data as BlogPost[]);
      setLoading(false);
    };
    fetchPosts();

    // Increment page view
    document.title = "FP Blog — Funding Pulze";
  }, []);

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt?.toLowerCase().includes(q) ||
        p.focus_keyword?.toLowerCase().includes(q) ||
        p.meta_keywords?.some((k) => k.toLowerCase().includes(q))
    );
  }, [posts, searchQuery]);

  const featuredPost = useMemo(() => filteredPosts.find((p) => p.is_featured) || filteredPosts[0], [filteredPosts]);
  const restPosts = useMemo(() => filteredPosts.filter((p) => p.id !== featuredPost?.id), [filteredPosts, featuredPost]);

  const postsPerPage = 3;
  const maxCarouselIndex = Math.max(0, Math.ceil(restPosts.length / postsPerPage) - 1);
  const visiblePosts = restPosts.slice(carouselIndex * postsPerPage, carouselIndex * postsPerPage + postsPerPage);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "FP Blog",
    description: "Trading insights, market analysis, and funded trading tips from Funding Pulze",
    url: `${window.location.origin}/blog`,
    publisher: {
      "@type": "Organization",
      name: "Funding Pulze",
    },
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero Section */}
      <section className="pt-24 sm:pt-32 pb-8 sm:pb-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight"
          >
            FP Blog
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-muted-foreground text-lg max-w-xl"
          >
            Trading insights, market analysis, and funded trading strategies.
          </motion.p>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 max-w-md relative"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCarouselIndex(0); }}
              className="pl-11 h-12 rounded-xl bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
          </motion.div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin h-8 w-8 border-2 border-foreground border-t-transparent rounded-full" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-32 text-muted-foreground">
          <p className="text-xl">No articles found</p>
          {searchQuery && <p className="mt-2 text-sm">Try adjusting your search terms</p>}
        </div>
      ) : (
        <>
          {/* Featured + Latest Layout */}
          <section className="px-4 sm:px-6 pb-16">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Featured / Latest Post — Large Card */}
              {featuredPost && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="group cursor-pointer"
                  onClick={() => navigate(`/blog/${featuredPost.slug}`)}
                >
                  <div className="relative overflow-hidden rounded-2xl aspect-[4/5] bg-card border border-border">
                    {featuredPost.thumbnail_url ? (
                      <img
                        src={featuredPost.thumbnail_url}
                        alt={featuredPost.thumbnail_alt || featuredPost.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">No thumbnail</span>
                      </div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    {/* Content */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                      {featuredPost.is_featured && (
                        <Badge className="mb-3 bg-foreground text-background border-0 text-xs font-medium">
                          Featured
                        </Badge>
                      )}
                      <h2 className="text-white font-display text-2xl md:text-3xl font-bold leading-tight group-hover:underline decoration-1 underline-offset-4">
                        {featuredPost.title}
                      </h2>
                      {featuredPost.excerpt && (
                        <p className="mt-3 text-white/70 text-sm md:text-base line-clamp-3">
                          {featuredPost.excerpt}
                        </p>
                      )}
                      <div className="mt-4 flex items-center gap-4 text-white/50 text-xs">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(featuredPost.published_at || featuredPost.created_at)}
                        </span>
                        {featuredPost.reading_time > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {featuredPost.reading_time} min read
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Eye size={12} />
                          {featuredPost.views_count}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Right Column — List of recent posts */}
              <div className="flex flex-col gap-6 justify-center">
                {restPosts.slice(0, 4).map((post, i) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="group cursor-pointer flex gap-5 items-start"
                    onClick={() => navigate(`/blog/${post.slug}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-1.5">
                        {formatDate(post.published_at || post.created_at)}
                      </p>
                      <h3 className="font-display text-lg font-bold leading-snug group-hover:underline decoration-1 underline-offset-4 line-clamp-2">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        {post.reading_time > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {post.reading_time} min
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Eye size={11} />
                          {post.views_count}
                        </span>
                      </div>
                    </div>
                    {post.thumbnail_url && (
                      <div className="w-28 h-28 shrink-0 rounded-xl overflow-hidden border border-border">
                        <img
                          src={post.thumbnail_url}
                          alt={post.thumbnail_alt || post.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Carousel Section — More Articles */}
          {restPosts.length > 4 && (
            <section className="px-6 pb-20">
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="font-display text-2xl font-bold">More Articles</h2>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full h-9 w-9"
                      onClick={() => setCarouselIndex(Math.max(0, carouselIndex - 1))}
                      disabled={carouselIndex === 0}
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full h-9 w-9"
                      onClick={() => setCarouselIndex(Math.min(maxCarouselIndex, carouselIndex + 1))}
                      disabled={carouselIndex >= maxCarouselIndex}
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <AnimatePresence mode="wait">
                    {restPosts.slice(4 + carouselIndex * postsPerPage, 4 + carouselIndex * postsPerPage + postsPerPage).map((post, i) => (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: i * 0.05 }}
                        className="group cursor-pointer"
                        onClick={() => navigate(`/blog/${post.slug}`)}
                      >
                        <div className="rounded-xl overflow-hidden border border-border bg-card hover:shadow-lg transition-shadow">
                          {post.thumbnail_url ? (
                            <div className="aspect-video overflow-hidden">
                              <img
                                src={post.thumbnail_url}
                                alt={post.thumbnail_alt || post.title}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div className="aspect-video bg-muted flex items-center justify-center">
                              <span className="text-muted-foreground text-xs">No thumbnail</span>
                            </div>
                          )}
                          <div className="p-5">
                            <p className="text-xs text-muted-foreground mb-2">
                              {formatDate(post.published_at || post.created_at)}
                            </p>
                            <h3 className="font-display text-base font-bold leading-snug group-hover:underline line-clamp-2">
                              {post.title}
                            </h3>
                            {post.excerpt && (
                              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
                            )}
                            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                              {post.reading_time > 0 && (
                                <span className="flex items-center gap-1">
                                  <Clock size={11} /> {post.reading_time} min
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Eye size={11} /> {post.views_count}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      <Footer />
    </div>
  );
};

export default Blog;
