import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles, Copy, FileText, Search, Target, Link2, HelpCircle,
  Image, Code, BookOpen, Loader2, CheckCircle2, AlertTriangle,
  Brain, Save, Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface GeneratedBlog {
  seo_metadata: {
    seo_title: string;
    meta_description: string;
    url_slug: string;
  };
  keyword_strategy: {
    primary_keyword: string;
    secondary_keywords: string[];
    lsi_keywords: string[];
    search_intent: string;
  };
  blog_content: string;
  internal_linking_suggestions: string[];
  external_authority_sources: string[];
  faq_section: { question: string; answer: string }[];
  featured_snippet: string;
  image_seo_suggestions: { title: string; alt_text: string; caption: string; file_name: string }[];
  schema_markup_recommendations: string[];
  raw_content?: string;
  parse_error?: boolean;
}

interface TrainingEntry {
  id: string;
  content: string;
  label: string;
  created_at: string;
}

const TRAINING_STORAGE_KEY = "seo_ai_training_entries";

export default function SEOAIWriter() {
  const [topic, setTopic] = useState("");
  const [primaryKeyword, setPrimaryKeyword] = useState("");
  const [secondaryKeywords, setSecondaryKeywords] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedBlog | null>(null);
  const [activeTab, setActiveTab] = useState("generator");

  // Training state
  const [trainingEntries, setTrainingEntries] = useState<TrainingEntry[]>([]);
  const [newTrainingLabel, setNewTrainingLabel] = useState("");
  const [newTrainingContent, setNewTrainingContent] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(TRAINING_STORAGE_KEY);
    if (stored) {
      try { setTrainingEntries(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  const saveTrainingEntries = (entries: TrainingEntry[]) => {
    setTrainingEntries(entries);
    localStorage.setItem(TRAINING_STORAGE_KEY, JSON.stringify(entries));
  };

  const addTrainingEntry = () => {
    if (!newTrainingContent.trim()) { toast.error("Training content is required"); return; }
    const entry: TrainingEntry = {
      id: crypto.randomUUID(),
      label: newTrainingLabel.trim() || "Untitled",
      content: newTrainingContent.trim(),
      created_at: new Date().toISOString(),
    };
    saveTrainingEntries([...trainingEntries, entry]);
    setNewTrainingLabel("");
    setNewTrainingContent("");
    toast.success("Training entry added");
  };

  const removeTrainingEntry = (id: string) => {
    saveTrainingEntries(trainingEntries.filter(e => e.id !== id));
    toast.success("Training entry removed");
  };

  const generateBlog = async () => {
    if (!topic.trim() || !primaryKeyword.trim()) {
      toast.error("Topic and primary keyword are required");
      return;
    }
    setGenerating(true);
    setResult(null);

    try {
      const trainingContext = trainingEntries.map(e => `[${e.label}]: ${e.content}`).join("\n\n");

      const { data, error } = await supabase.functions.invoke("generate-seo-blog", {
        body: {
          topic: topic.trim(),
          primary_keyword: primaryKeyword.trim(),
          secondary_keywords: secondaryKeywords.trim(),
          training_context: trainingContext || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data as GeneratedBlog);
      toast.success("Blog article generated!");
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const publishToBlog = async () => {
    if (!result || result.parse_error) return;
    const slug = result.seo_metadata.url_slug;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); return; }

    const faqMarkdown = result.faq_section?.length
      ? "\n\n## Frequently Asked Questions\n\n" + result.faq_section.map(f => `### ${f.question}\n\n${f.answer}`).join("\n\n")
      : "";

    const { error } = await supabase.from("blog_posts").insert({
      title: result.seo_metadata.seo_title,
      slug,
      content: result.blog_content + faqMarkdown,
      excerpt: result.featured_snippet,
      author_id: user.id,
      meta_title: result.seo_metadata.seo_title,
      meta_description: result.seo_metadata.meta_description,
      focus_keyword: result.keyword_strategy.primary_keyword,
      meta_keywords: [
        ...result.keyword_strategy.secondary_keywords,
        ...result.keyword_strategy.lsi_keywords.slice(0, 5),
      ],
      is_published: false,
    });

    if (error) { toast.error(error.message); return; }
    toast.success("Blog post created as draft! Go to Blog CMS to review and publish.");
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[hsl(0,0%,95%)]">
          <TabsTrigger value="generator" className="gap-1.5">
            <Sparkles size={14} /> AI Writer
          </TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5">
            <Brain size={14} /> Training
          </TabsTrigger>
        </TabsList>

        {/* ===== GENERATOR TAB ===== */}
        <TabsContent value="generator" className="space-y-6 mt-4">
          {/* Input Form */}
          <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl p-6 space-y-4">
            <h3 className="font-display text-sm font-bold text-[hsl(0,0%,5%)] flex items-center gap-2">
              <Sparkles size={16} className="text-[hsl(45,90%,50%)]" />
              SEO Blog Generator
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-[hsl(0,0%,45%)]">Topic *</Label>
                <Input
                  value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="e.g. Prop Trading Firms in 2025"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-[hsl(0,0%,45%)]">Primary Keyword *</Label>
                <Input
                  value={primaryKeyword} onChange={e => setPrimaryKeyword(e.target.value)}
                  placeholder="e.g. best prop trading firms"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">Secondary Keywords (comma-separated)</Label>
              <Input
                value={secondaryKeywords} onChange={e => setSecondaryKeywords(e.target.value)}
                placeholder="e.g. funded trading, prop firm challenges, forex prop firms"
                className="mt-1"
              />
            </div>
            {trainingEntries.length > 0 && (
              <p className="text-[10px] text-[hsl(0,0%,55%)] flex items-center gap-1">
                <Brain size={10} /> {trainingEntries.length} training context{trainingEntries.length > 1 ? "s" : ""} will be applied
              </p>
            )}
            <Button
              onClick={generateBlog}
              disabled={generating}
              className="bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)] gap-2"
            >
              {generating ? <><Loader2 size={14} className="animate-spin" /> Generating (30-60s)...</> : <><Sparkles size={14} /> Generate SEO Blog</>}
            </Button>
          </div>

          {/* Results */}
          {result && !result.parse_error && (
            <div className="space-y-5">
              {/* SEO Metadata */}
              <ResultSection icon={<Search size={15} />} title="SEO Metadata">
                <MetaRow label="SEO Title" value={result.seo_metadata.seo_title} charLimit="50-60" onCopy={copyToClipboard} />
                <MetaRow label="Meta Description" value={result.seo_metadata.meta_description} charLimit="150-160" onCopy={copyToClipboard} />
                <MetaRow label="URL Slug" value={`/${result.seo_metadata.url_slug}`} onCopy={copyToClipboard} />
              </ResultSection>

              {/* Keyword Strategy */}
              <ResultSection icon={<Target size={15} />} title="Keyword Strategy">
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[hsl(0,0%,45%)] font-medium">Search Intent</span>
                    <span className="ml-2 text-xs font-semibold bg-[hsl(220,70%,94%)] text-[hsl(220,60%,35%)] px-2 py-0.5 rounded-full">{result.keyword_strategy.search_intent}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[hsl(0,0%,45%)] font-medium block mb-1">LSI Keywords</span>
                    <div className="flex flex-wrap gap-1.5">
                      {result.keyword_strategy.lsi_keywords?.map((kw, i) => (
                        <span key={i} className="text-[10px] bg-[hsl(0,0%,95%)] text-[hsl(0,0%,35%)] px-2 py-0.5 rounded">{kw}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </ResultSection>

              {/* Blog Content */}
              <ResultSection icon={<FileText size={15} />} title="Blog Content">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-[hsl(0,0%,55%)]">
                    {result.blog_content.split(/\s+/).length} words
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copyToClipboard(result.blog_content, "Blog content")}>
                      <Copy size={12} /> Copy Markdown
                    </Button>
                    <Button size="sm" className="h-7 text-xs gap-1 bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]" onClick={publishToBlog}>
                      <FileText size={12} /> Save as Draft
                    </Button>
                  </div>
                </div>
                <div className="bg-[hsl(0,0%,97%)] rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  <pre className="text-xs text-[hsl(0,0%,20%)] whitespace-pre-wrap font-sans leading-relaxed">{result.blog_content}</pre>
                </div>
              </ResultSection>

              {/* FAQ Section */}
              {result.faq_section?.length > 0 && (
                <ResultSection icon={<HelpCircle size={15} />} title="FAQ (Rich Snippets)">
                  <div className="space-y-3">
                    {result.faq_section.map((faq, i) => (
                      <div key={i} className="bg-[hsl(0,0%,97%)] rounded-lg p-3">
                        <p className="text-xs font-semibold text-[hsl(0,0%,10%)]">{faq.question}</p>
                        <p className="text-xs text-[hsl(0,0%,40%)] mt-1">{faq.answer}</p>
                      </div>
                    ))}
                  </div>
                </ResultSection>
              )}

              {/* Featured Snippet */}
              {result.featured_snippet && (
                <ResultSection icon={<CheckCircle2 size={15} />} title="Featured Snippet">
                  <div className="bg-[hsl(142,40%,95%)] border border-[hsl(142,30%,85%)] rounded-lg p-3">
                    <p className="text-xs text-[hsl(142,30%,25%)]">{result.featured_snippet}</p>
                  </div>
                </ResultSection>
              )}

              {/* Internal & External Links */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ResultSection icon={<Link2 size={15} />} title="Internal Links">
                  <ul className="space-y-1">
                    {result.internal_linking_suggestions?.map((link, i) => (
                      <li key={i} className="text-xs text-[hsl(0,0%,30%)] flex items-start gap-1.5">
                        <span className="text-[hsl(0,0%,60%)] mt-0.5">→</span> {link}
                      </li>
                    ))}
                  </ul>
                </ResultSection>
                <ResultSection icon={<BookOpen size={15} />} title="External Sources">
                  <ul className="space-y-1">
                    {result.external_authority_sources?.map((src, i) => (
                      <li key={i} className="text-xs text-[hsl(0,0%,30%)] flex items-start gap-1.5">
                        <span className="text-[hsl(0,0%,60%)] mt-0.5">→</span> {src}
                      </li>
                    ))}
                  </ul>
                </ResultSection>
              </div>

              {/* Image SEO */}
              {result.image_seo_suggestions?.length > 0 && (
                <ResultSection icon={<Image size={15} />} title="Image SEO Suggestions">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {result.image_seo_suggestions.map((img, i) => (
                      <div key={i} className="bg-[hsl(0,0%,97%)] rounded-lg p-3 space-y-1">
                        <p className="text-[10px] font-semibold text-[hsl(0,0%,10%)]">{img.title}</p>
                        <p className="text-[10px] text-[hsl(0,0%,50%)]">Alt: {img.alt_text}</p>
                        <p className="text-[10px] text-[hsl(0,0%,50%)]">File: {img.file_name}</p>
                      </div>
                    ))}
                  </div>
                </ResultSection>
              )}

              {/* Schema */}
              {result.schema_markup_recommendations?.length > 0 && (
                <ResultSection icon={<Code size={15} />} title="Schema Markup">
                  <div className="flex flex-wrap gap-2">
                    {result.schema_markup_recommendations.map((s, i) => (
                      <span key={i} className="text-[10px] bg-[hsl(260,40%,95%)] text-[hsl(260,40%,35%)] px-2 py-0.5 rounded-full font-medium">{s}</span>
                    ))}
                  </div>
                </ResultSection>
              )}
            </div>
          )}

          {result?.parse_error && result.raw_content && (
            <div className="bg-[hsl(40,80%,95%)] border border-[hsl(40,60%,80%)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-[hsl(40,70%,45%)]" />
                <span className="text-xs font-semibold text-[hsl(40,60%,30%)]">Partial result — JSON parsing failed</span>
              </div>
              <pre className="text-xs text-[hsl(0,0%,30%)] whitespace-pre-wrap max-h-[400px] overflow-y-auto">{result.raw_content}</pre>
            </div>
          )}
        </TabsContent>

        {/* ===== TRAINING TAB ===== */}
        <TabsContent value="training" className="space-y-6 mt-4">
          <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl p-6 space-y-4">
            <h3 className="font-display text-sm font-bold text-[hsl(0,0%,5%)] flex items-center gap-2">
              <Brain size={16} className="text-[hsl(260,60%,55%)]" />
              Train Your SEO AI
            </h3>
            <p className="text-xs text-[hsl(0,0%,50%)]">
              Add training context to shape the AI's writing style, brand voice, industry knowledge, and SEO approach.
              All entries are sent as context with every generation.
            </p>

            <div className="space-y-3 border-t border-[hsl(0,0%,92%)] pt-4">
              <div>
                <Label className="text-xs text-[hsl(0,0%,45%)]">Label</Label>
                <Input
                  value={newTrainingLabel} onChange={e => setNewTrainingLabel(e.target.value)}
                  placeholder="e.g. Brand Voice, Industry Context, Writing Style"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-[hsl(0,0%,45%)]">Training Content *</Label>
                <Textarea
                  value={newTrainingContent} onChange={e => setNewTrainingContent(e.target.value)}
                  placeholder="e.g. Always write in a professional but approachable tone. Our brand focuses on prop trading education. Use data-driven arguments. Mention our unique features like instant funding and low spreads..."
                  className="mt-1 min-h-[120px]"
                />
              </div>
              <Button onClick={addTrainingEntry} className="gap-1.5 bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]">
                <Save size={14} /> Add Training Entry
              </Button>
            </div>
          </div>

          {/* Existing Training Entries */}
          {trainingEntries.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-[hsl(0,0%,30%)] uppercase tracking-wider">
                Active Training Context ({trainingEntries.length})
              </h4>
              {trainingEntries.map(entry => (
                <div key={entry.id} className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Brain size={12} className="text-[hsl(260,60%,55%)]" />
                      <span className="text-xs font-semibold text-[hsl(0,0%,10%)]">{entry.label}</span>
                    </div>
                    <button onClick={() => removeTrainingEntry(entry.id)} className="p-1 rounded text-[hsl(0,0%,60%)] hover:text-[hsl(0,60%,50%)] hover:bg-[hsl(0,80%,95%)] transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p className="text-xs text-[hsl(0,0%,45%)] line-clamp-3">{entry.content}</p>
                  <p className="text-[10px] text-[hsl(0,0%,65%)] mt-2">{new Date(entry.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <Brain size={32} className="mx-auto text-[hsl(0,0%,80%)] mb-2" />
              <p className="text-xs text-[hsl(0,0%,55%)]">No training entries yet. Add context to improve AI output quality.</p>
            </div>
          )}

          {/* Pre-built Templates */}
          <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl p-6 space-y-3">
            <h4 className="text-xs font-semibold text-[hsl(0,0%,30%)] uppercase tracking-wider">Quick Templates</h4>
            {[
              { label: "Brand Voice", content: "Write in a professional, authoritative yet approachable tone. Use active voice. Be direct and confident. Avoid fluff and filler content." },
              { label: "Prop Trading Context", content: "Our company is a prop trading firm offering funded accounts to traders. We provide challenges where traders prove their skills before receiving real capital. Key features: instant funding, competitive profit splits, low spreads, and comprehensive trader education." },
              { label: "SEO Writing Rules", content: "Use short paragraphs (2-3 sentences max). Include bullet points for listicle content. Start with a compelling hook. Use transition words between sections. Include statistics and data when possible. End with a clear CTA." },
            ].map((tpl, i) => (
              <button
                key={i}
                onClick={() => {
                  setNewTrainingLabel(tpl.label);
                  setNewTrainingContent(tpl.content);
                  toast.success(`Template "${tpl.label}" loaded — edit and save`);
                }}
                className="w-full text-left bg-[hsl(0,0%,97%)] hover:bg-[hsl(0,0%,94%)] rounded-lg p-3 transition-colors"
              >
                <span className="text-xs font-medium text-[hsl(0,0%,10%)]">{tpl.label}</span>
                <p className="text-[10px] text-[hsl(0,0%,50%)] mt-0.5 line-clamp-1">{tpl.content}</p>
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper Components
function ResultSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl p-5">
      <h4 className="text-xs font-bold text-[hsl(0,0%,10%)] uppercase tracking-wider flex items-center gap-2 mb-3">
        {icon} {title}
      </h4>
      {children}
    </div>
  );
}

function MetaRow({ label, value, charLimit, onCopy }: { label: string; value: string; charLimit?: string; onCopy: (text: string, label: string) => void }) {
  const len = value.length;
  return (
    <div className="flex items-center justify-between py-2 border-b border-[hsl(0,0%,95%)] last:border-0">
      <div className="min-w-0 flex-1">
        <span className="text-[10px] text-[hsl(0,0%,50%)] uppercase tracking-wider">{label}</span>
        <p className="text-xs text-[hsl(0,0%,15%)] mt-0.5 truncate">{value}</p>
        {charLimit && <span className="text-[10px] text-[hsl(0,0%,60%)]">{len} chars (target: {charLimit})</span>}
      </div>
      <button onClick={() => onCopy(value, label)} className="ml-2 p-1.5 rounded text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,10%)] hover:bg-[hsl(0,0%,93%)] transition-colors">
        <Copy size={13} />
      </button>
    </div>
  );
}
