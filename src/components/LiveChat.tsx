import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, X, Send, Minimize2, Sparkles, TicketPlus,
  ThumbsUp, ThumbsDown, RotateCcw, Zap, HelpCircle, CreditCard, TrendingUp,
  BookOpen, Search, ChevronRight, ChevronLeft, ArrowLeft, FileText,
  Clock, Eye, Loader2, Home, MessagesSquare, Headphones, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import pulzexLogo from "@/assets/pulzex-logo.png";

/* ─── Types ─── */
interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  time: string;
  rating?: "up" | "down" | null;
  isStreaming?: boolean;
}

interface HelpCollection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  articleCount?: number;
}

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  views_count: number;
  collection_id: string | null;
  created_at: string;
}

type WidgetView = "chat" | "help" | "ticket-form";
type HelpSubView = "collections" | "articles" | "article-detail";
type TicketStep = "subject" | "detail" | "submitting" | "done";

/* ─── Constants ─── */
const QUICK_ACTIONS: { label: string; icon: React.ReactNode; action?: "help" }[] = [
  { label: "How do challenges work?", icon: <HelpCircle size={12} /> },
  { label: "Payout process", icon: <CreditCard size={12} /> },
  { label: "Trading rules", icon: <TrendingUp size={12} /> },
  { label: "Browse Help Center", icon: <BookOpen size={12} />, action: "help" },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`;

const LiveChat = () => {
  /* ─── Core state ─── */
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [view, setView] = useState<WidgetView>("chat");
  const [unread, setUnread] = useState(0);

  /* ─── User info ─── */
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [infoCollected, setInfoCollected] = useState(false);

  /* ─── Chat state ─── */
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Hey there! 👋 I'm **PULZEX**, your AI trading assistant. Ask me anything about challenges, payouts, or trading rules — or explore the Help Center!",
      sender: "bot",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showRatingFor, setShowRatingFor] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketCreated, setTicketCreated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ─── Help Center state ─── */
  const [helpSubView, setHelpSubView] = useState<HelpSubView>("collections");
  const [collections, setCollections] = useState<HelpCollection[]>([]);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<HelpCollection | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [helpSearch, setHelpSearch] = useState("");
  const [searchResults, setSearchResults] = useState<HelpArticle[]>([]);
  const [helpLoading, setHelpLoading] = useState(false);
  const [featuredArticles, setFeaturedArticles] = useState<HelpArticle[]>([]);

  /* ─── Ticket form state ─── */
  const [ticketStep, setTicketStep] = useState<TicketStep>("subject");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDetail, setTicketDetail] = useState("");
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [createdTicketRef, setCreatedTicketRef] = useState<string | null>(null);

  /* ─── Effects ─── */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  useEffect(() => {
    if (open && !minimized) setUnread(0);
  }, [open, minimized]);

  // Load help center data when view changes
  useEffect(() => {
    if (view === "help" && collections.length === 0) fetchHelpData();
  }, [view]);

  /* ─── Help Center data ─── */
  const fetchHelpData = async () => {
    setHelpLoading(true);
    const [colRes, featRes] = await Promise.all([
      supabase.from("help_collections").select("*").order("sort_order"),
      supabase.from("help_articles").select("*").eq("is_published", true).eq("is_featured", true).order("views_count", { ascending: false }).limit(5),
    ]);

    if (colRes.data) {
      // Get article counts
      const { data: allArticles } = await supabase
        .from("help_articles")
        .select("collection_id")
        .eq("is_published", true);

      const counts: Record<string, number> = {};
      allArticles?.forEach(a => { if (a.collection_id) counts[a.collection_id] = (counts[a.collection_id] || 0) + 1; });
      setCollections(colRes.data.map(c => ({ ...c, articleCount: counts[c.id] || 0 })));
    }
    if (featRes.data) setFeaturedArticles(featRes.data as HelpArticle[]);
    setHelpLoading(false);
  };

  const loadCollectionArticles = async (col: HelpCollection) => {
    setSelectedCollection(col);
    setHelpSubView("articles");
    setHelpLoading(true);
    const { data } = await supabase
      .from("help_articles")
      .select("*")
      .eq("is_published", true)
      .eq("collection_id", col.id)
      .order("sort_order");
    setArticles((data as HelpArticle[]) || []);
    setHelpLoading(false);
  };

  const loadArticle = async (article: HelpArticle) => {
    setSelectedArticle(article);
    setHelpSubView("article-detail");
    // Increment views
    supabase.from("help_articles").update({ views_count: article.views_count + 1 }).eq("id", article.id).then();
  };

  const searchHelp = async (query: string) => {
    setHelpSearch(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    const { data } = await supabase
      .from("help_articles")
      .select("*")
      .eq("is_published", true)
      .or(`title.ilike.%${query}%,excerpt.ilike.%${query}%,content.ilike.%${query}%`)
      .limit(10);
    setSearchResults((data as HelpArticle[]) || []);
  };

  /* ─── Ticket creation flow ─── */
  const handleTicketFormSubmit = async () => {
    if (!ticketSubject.trim() || !ticketDetail.trim()) return;
    setTicketStep("submitting");
    setTicketSubmitting(true);

    // First, try AI resolution
    const aiCheckMsg: Message = {
      id: crypto.randomUUID(),
      text: `Let me check if I can help with: **${ticketSubject}**\n\n${ticketDetail}`,
      sender: "user",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Switch to chat view and send the message through AI
    setView("chat");
    setMessages(prev => [...prev, aiCheckMsg]);

    // Add a bot message indicating it's trying to help first
    const tryingMsg: Message = {
      id: crypto.randomUUID(),
      text: "Let me see if I can resolve this for you before creating a ticket... 🔍",
      sender: "bot",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages(prev => [...prev, tryingMsg]);

    await streamAIResponse(`The user wants to create a support ticket about: "${ticketSubject}". Their details: "${ticketDetail}". Please try to help them first. If you truly cannot resolve it, include [CREATE_TICKET] at the end.`);

    setTicketSubmitting(false);
    setTicketStep("subject");
    setTicketSubject("");
    setTicketDetail("");
  };

  /* ─── Chat functions ─── */
  const collectInfo = () => {
    if (!name.trim() || !email.trim()) return;
    setInfoCollected(true);
  };

  const createSupportTicket = async (context: string) => {
    if (ticketCreated) return;
    try {
      const { data, error } = await supabase
        .from("help_support_tickets")
        .insert({
          name: name.trim(),
          email: email.trim(),
          subject: ticketSubject.trim() || `Live Chat: ${context.slice(0, 60)}`,
          message: ticketDetail.trim() || `Chat transcript:\n\n${messages.map(m => `[${m.sender === "user" ? name : "PULZEX"}]: ${m.text}`).join("\n")}`,
          source: "live_chat",
          status: "open",
          priority: "medium",
        })
        .select("id")
        .single();

      if (error) throw error;
      setTicketId(data.id);
      setTicketCreated(true);
      setCreatedTicketRef(data.id.slice(0, 8));

      const botMsg: Message = {
        id: crypto.randomUUID(),
        text: `✅ **Ticket created!** (Ref: #${data.id.slice(0, 8)})\n\nOur team will reach out to **${email}** shortly. You can keep chatting with me here in the meantime!`,
        sender: "bot",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      toast({ title: "Failed to create ticket", variant: "destructive" });
    }
  };

  const addMessageToTicket = async (text: string, senderType: "customer" | "ai") => {
    if (!ticketId) return;
    try {
      await supabase.from("support_ticket_messages").insert({
        ticket_id: ticketId,
        message: text,
        sender_type: senderType,
        sender_name: senderType === "customer" ? name.trim() : "PULZEX AI",
        sender_email: senderType === "customer" ? email.trim() : "ai@fundingpulze.com",
      });
    } catch { /* silent */ }
  };

  const streamAIResponse = useCallback(async (userText: string) => {
    setIsTyping(true);
    setSending(true);

    const conversationHistory = messages
      .filter(m => m.id !== "welcome")
      .map(m => ({
        role: m.sender === "user" ? "user" as const : "assistant" as const,
        content: m.text,
      }));

    const controller = new AbortController();
    abortRef.current = controller;

    let assistantText = "";
    const assistantId = crypto.randomUUID();

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: userText }],
          conversationHistory,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "AI service error");
      }

      if (!resp.body) throw new Error("No stream body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      setIsTyping(false);

      setMessages(prev => [...prev, {
        id: assistantId,
        text: "",
        sender: "bot",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isStreaming: true,
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, text: assistantText } : m)
              );
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Finalize
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m)
      );
      setShowRatingFor(assistantId);

      // Check for ticket creation trigger
      if (assistantText.includes("[CREATE_TICKET]")) {
        assistantText = assistantText.replace("[CREATE_TICKET]", "").trim();
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, text: assistantText } : m)
        );
        await createSupportTicket(userText);
      }

      if (ticketId) await addMessageToTicket(assistantText, "ai");

    } catch (e: any) {
      if (e.name === "AbortError") return;
      setIsTyping(false);
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        text: "Sorry, I'm having trouble connecting right now. Please try again or create a support ticket! 🙏",
        sender: "bot",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== assistantId);
        return [...filtered, errorMsg];
      });
    } finally {
      setSending(false);
      setIsTyping(false);
      abortRef.current = null;
    }
  }, [messages, name, email, ticketId, ticketCreated, ticketSubject, ticketDetail]);

  const sendMessage = async (text?: string) => {
    const msgText = (text || input).trim();
    if (!msgText || sending) return;
    setInput("");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      text: msgText,
      sender: "user",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages(prev => [...prev, userMsg]);

    if (ticketId) await addMessageToTicket(msgText, "customer");
    await streamAIResponse(msgText);
  };

  const rateMessage = (msgId: string, rating: "up" | "down") => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, rating } : m));
    setShowRatingFor(null);
  };

  const retryLast = () => {
    const lastUser = [...messages].reverse().find(m => m.sender === "user");
    if (lastUser) {
      setMessages(prev => prev.filter(m => m.sender === "user" || m.id === "welcome"));
      streamAIResponse(lastUser.text);
    }
  };

  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
    if (action.action === "help") {
      setView("help");
    } else {
      sendMessage(action.label);
    }
  };

  /* ─── Icon resolver ─── */
  const getCollectionIcon = (icon: string | null) => {
    switch (icon) {
      case "help-circle": return <HelpCircle size={18} />;
      case "credit-card": return <CreditCard size={18} />;
      case "trending-up": return <TrendingUp size={18} />;
      case "book-open": return <BookOpen size={18} />;
      case "file-text": return <FileText size={18} />;
      case "headphones": return <Headphones size={18} />;
      default: return <BookOpen size={18} />;
    }
  };

  /* ─── Tab nav ─── */
  const tabs: { id: WidgetView; label: string; icon: React.ReactNode }[] = [
    { id: "chat", label: "Chat", icon: <MessagesSquare size={14} /> },
    { id: "help", label: "Help", icon: <BookOpen size={14} /> },
    { id: "ticket-form", label: "Ticket", icon: <TicketPlus size={14} /> },
  ];

  return (
    <>
      {/* Floating bubble */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg glow-box group overflow-hidden"
          >
            <img src={pulzexLogo} alt="PULZEX" className="w-full h-full object-cover" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
            <span className="absolute inset-0 rounded-full bg-foreground/20 animate-ping" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border/40 bg-card shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: minimized ? "auto" : "min(640px, calc(100vh - 6rem))" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-foreground text-background">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full overflow-hidden">
                  <img src={pulzexLogo} alt="PULZEX" className="w-full h-full object-cover" />
                </div>
                <div>
                  <span className="font-display font-semibold text-sm">PULZEX</span>
                  <p className="text-[10px] text-background/60">
                    {view === "help" ? "Help Center" : view === "ticket-form" ? "Create Ticket" : "AI Trading Assistant"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setMinimized(!minimized)} className="p-1.5 rounded-md hover:bg-background/10 text-background/70 transition-colors">
                  <Minimize2 size={14} />
                </button>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-md hover:bg-background/10 text-background/70 transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* Tab bar */}
                <div className="flex border-b border-border/30 bg-muted/20">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setView(tab.id); if (tab.id === "help") { setHelpSubView("collections"); setHelpSearch(""); } }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
                        view === tab.id
                          ? "border-foreground text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground/70"
                      }`}
                    >
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>

                {/* ─── Info collection (shared across views) ─── */}
                {!infoCollected ? (
                  <div className="p-5 space-y-4">
                    <div className="text-center mb-2">
                      <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center mx-auto mb-3">
                        <Sparkles size={24} />
                      </div>
                      <h3 className="font-display font-bold text-lg text-foreground">Meet PULZEX</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        AI-powered support · Help Center · 24/7
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                        className="w-full px-3 py-2.5 rounded-xl border border-border/40 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                        className="w-full px-3 py-2.5 rounded-xl border border-border/40 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                        onKeyDown={e => { if (e.key === "Enter") collectInfo(); }} />
                    </div>
                    <Button onClick={collectInfo} disabled={!name.trim() || !email.trim()} className="w-full rounded-xl h-11 gap-2">
                      <Zap size={16} /> Get Started
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* ─── CHAT VIEW ─── */}
                    {view === "chat" && (
                      <>
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
                          {messages.map(msg => (
                            <div key={msg.id}>
                              <div className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                  msg.sender === "user"
                                    ? "bg-foreground text-background rounded-br-md"
                                    : "bg-muted/60 text-foreground rounded-bl-md"
                                }`}>
                                  <div className="whitespace-pre-wrap prose prose-sm prose-invert max-w-none [&>p]:m-0 [&>ul]:mt-1 [&>ol]:mt-1">
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                  </div>
                                  {msg.isStreaming && (
                                    <span className="inline-block w-1.5 h-4 bg-foreground/50 animate-pulse ml-0.5 align-middle" />
                                  )}
                                  <p className={`text-[10px] mt-1 ${msg.sender === "user" ? "text-background/40" : "text-muted-foreground/40"}`}>
                                    {msg.time}
                                  </p>
                                </div>
                              </div>
                              {msg.sender === "bot" && msg.id !== "welcome" && showRatingFor === msg.id && !msg.rating && (
                                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1 mt-1 ml-1">
                                  <button onClick={() => rateMessage(msg.id, "up")} className="p-1 rounded hover:bg-muted/50 text-muted-foreground/40 hover:text-foreground transition-colors">
                                    <ThumbsUp size={12} />
                                  </button>
                                  <button onClick={() => rateMessage(msg.id, "down")} className="p-1 rounded hover:bg-muted/50 text-muted-foreground/40 hover:text-foreground transition-colors">
                                    <ThumbsDown size={12} />
                                  </button>
                                </motion.div>
                              )}
                              {msg.rating && (
                                <p className="text-[10px] text-muted-foreground/30 ml-1 mt-0.5">
                                  {msg.rating === "up" ? "👍 Thanks!" : "👎 We'll improve!"}
                                </p>
                              )}
                            </div>
                          ))}

                          {isTyping && (
                            <div className="flex justify-start">
                              <div className="bg-muted/60 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                            </div>
                          )}

                          {messages.length <= 1 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {QUICK_ACTIONS.map(a => (
                                <button
                                  key={a.label}
                                  onClick={() => handleQuickAction(a)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/40 bg-background text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
                                >
                                  {a.icon} {a.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {ticketCreated && (
                          <div className="mx-4 mb-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/20 flex items-center gap-2 text-xs text-muted-foreground">
                            <TicketPlus size={12} />
                            <span>Ticket #{ticketId?.slice(0, 8)} active</span>
                          </div>
                        )}

                        <div className="p-3 border-t border-border/30">
                          <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={input}
                              onChange={e => setInput(e.target.value)}
                              placeholder="Ask PULZEX anything..."
                              disabled={sending}
                              className="flex-1 px-3.5 py-2.5 rounded-xl border border-border/40 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
                            />
                            {messages.length > 2 && !sending && (
                              <button type="button" onClick={retryLast} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Retry last">
                                <RotateCcw size={14} />
                              </button>
                            )}
                            <Button type="submit" size="icon" disabled={!input.trim() || sending} className="rounded-xl shrink-0 h-10 w-10">
                              <Send size={16} />
                            </Button>
                          </form>
                          <p className="text-[9px] text-muted-foreground/30 text-center mt-1.5">
                            Powered by PULZEX AI · Funding Pulze
                          </p>
                        </div>
                      </>
                    )}

                    {/* ─── HELP CENTER VIEW ─── */}
                    {view === "help" && (
                      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
                        {/* Search bar */}
                        <div className="p-3 border-b border-border/20">
                          <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                            <input
                              type="text"
                              value={helpSearch}
                              onChange={e => searchHelp(e.target.value)}
                              placeholder="Search help articles..."
                              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border/40 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                            />
                          </div>
                        </div>

                        {/* Search results */}
                        {helpSearch.trim().length >= 2 ? (
                          <div className="p-3 space-y-2">
                            <p className="text-xs text-muted-foreground font-medium px-1">
                              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{helpSearch}"
                            </p>
                            {searchResults.map(article => (
                              <button
                                key={article.id}
                                onClick={() => { loadArticle(article); setHelpSearch(""); }}
                                className="w-full text-left p-3 rounded-xl border border-border/30 hover:border-foreground/20 hover:bg-muted/30 transition-all group"
                              >
                                <p className="text-sm font-medium text-foreground group-hover:text-foreground truncate">{article.title}</p>
                                {article.excerpt && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{article.excerpt}</p>
                                )}
                              </button>
                            ))}
                            {searchResults.length === 0 && (
                              <div className="text-center py-6">
                                <Search size={24} className="mx-auto text-muted-foreground/30 mb-2" />
                                <p className="text-xs text-muted-foreground">No articles found</p>
                                <button onClick={() => { setView("ticket-form"); setTicketSubject(helpSearch); setHelpSearch(""); }}
                                  className="text-xs text-foreground underline mt-2">
                                  Create a ticket instead
                                </button>
                              </div>
                            )}
                          </div>
                        ) : helpSubView === "collections" ? (
                          <div className="p-3 space-y-3">
                            {/* Featured articles */}
                            {featuredArticles.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Popular Articles</p>
                                <div className="space-y-1">
                                  {featuredArticles.map(article => (
                                    <button
                                      key={article.id}
                                      onClick={() => loadArticle(article)}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors text-left group"
                                    >
                                      <FileText size={14} className="text-muted-foreground/50 shrink-0" />
                                      <span className="text-sm text-foreground truncate group-hover:text-foreground">{article.title}</span>
                                      <ChevronRight size={12} className="ml-auto text-muted-foreground/30 shrink-0" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Collections */}
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Browse Topics</p>
                              {helpLoading ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {collections.map(col => (
                                    <button
                                      key={col.id}
                                      onClick={() => loadCollectionArticles(col)}
                                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/30 hover:border-foreground/20 hover:bg-muted/30 transition-all group"
                                    >
                                      <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:text-foreground shrink-0">
                                        {getCollectionIcon(col.icon)}
                                      </div>
                                      <div className="text-left flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{col.name}</p>
                                        {col.description && (
                                          <p className="text-[11px] text-muted-foreground truncate">{col.description}</p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <span className="text-[10px] text-muted-foreground/50">{col.articleCount}</span>
                                        <ChevronRight size={14} className="text-muted-foreground/30" />
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : helpSubView === "articles" ? (
                          <div className="p-3">
                            <button onClick={() => setHelpSubView("collections")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
                              <ArrowLeft size={12} /> Back to Topics
                            </button>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-foreground">
                                {getCollectionIcon(selectedCollection?.icon || null)}
                              </div>
                              <h3 className="font-semibold text-sm text-foreground">{selectedCollection?.name}</h3>
                            </div>
                            {helpLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 size={20} className="animate-spin text-muted-foreground" />
                              </div>
                            ) : articles.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-6">No articles in this collection yet.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {articles.map(article => (
                                  <button
                                    key={article.id}
                                    onClick={() => loadArticle(article)}
                                    className="w-full text-left p-3 rounded-xl border border-border/30 hover:border-foreground/20 hover:bg-muted/30 transition-all group"
                                  >
                                    <p className="text-sm font-medium text-foreground truncate">{article.title}</p>
                                    {article.excerpt && (
                                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{article.excerpt}</p>
                                    )}
                                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground/40">
                                      <span className="flex items-center gap-0.5"><Eye size={10} /> {article.views_count}</span>
                                      <span className="flex items-center gap-0.5"><Clock size={10} /> {new Date(article.created_at).toLocaleDateString()}</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : helpSubView === "article-detail" && selectedArticle ? (
                          <div className="p-3">
                            <button onClick={() => setHelpSubView(selectedCollection ? "articles" : "collections")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
                              <ArrowLeft size={12} /> Back
                            </button>
                            <h3 className="font-bold text-base text-foreground mb-3 leading-tight">{selectedArticle.title}</h3>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50 mb-4">
                              <span className="flex items-center gap-0.5"><Eye size={10} /> {selectedArticle.views_count} views</span>
                              <span className="flex items-center gap-0.5"><Clock size={10} /> {new Date(selectedArticle.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="prose prose-sm max-w-none text-foreground [&>p]:text-sm [&>p]:leading-relaxed [&>p]:text-foreground [&>h2]:text-foreground [&>h3]:text-foreground [&>ul]:text-foreground [&>ol]:text-foreground [&_a]:text-primary">
                              <ReactMarkdown>{selectedArticle.content}</ReactMarkdown>
                            </div>
                            <div className="mt-6 pt-4 border-t border-border/20 space-y-2">
                              <p className="text-xs text-muted-foreground text-center">Still need help?</p>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="flex-1 rounded-xl text-xs h-9" onClick={() => { setView("chat"); sendMessage(`I have a question about: ${selectedArticle.title}`); }}>
                                  <MessagesSquare size={12} className="mr-1" /> Ask PULZEX
                                </Button>
                                <Button size="sm" className="flex-1 rounded-xl text-xs h-9" onClick={() => { setView("ticket-form"); setTicketSubject(`Question about: ${selectedArticle.title}`); }}>
                                  <TicketPlus size={12} className="mr-1" /> Create Ticket
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* ─── TICKET FORM VIEW ─── */}
                    {view === "ticket-form" && (
                      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: 0 }}>
                        <div className="text-center">
                          <div className="w-11 h-11 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                            <TicketPlus size={20} className="text-foreground" />
                          </div>
                          <h3 className="font-display font-bold text-base text-foreground">Create Support Ticket</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            I'll try to help via AI first — if needed, it'll be escalated to our team.
                          </p>
                        </div>

                        {createdTicketRef && (
                          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center">
                            <p className="text-sm text-primary font-medium">✅ Ticket #{createdTicketRef} created!</p>
                            <p className="text-xs text-muted-foreground mt-1">Check your email for updates.</p>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">Subject</label>
                          <input
                            type="text"
                            value={ticketSubject}
                            onChange={e => setTicketSubject(e.target.value)}
                            placeholder="What do you need help with?"
                            className="w-full px-3 py-2.5 rounded-xl border border-border/40 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">Details</label>
                          <textarea
                            value={ticketDetail}
                            onChange={e => setTicketDetail(e.target.value)}
                            placeholder="Please describe your issue in detail..."
                            rows={4}
                            className="w-full px-3 py-2.5 rounded-xl border border-border/40 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
                          />
                        </div>

                        <Button
                          onClick={handleTicketFormSubmit}
                          disabled={!ticketSubject.trim() || !ticketDetail.trim() || ticketSubmitting}
                          className="w-full rounded-xl h-11 gap-2"
                        >
                          {ticketSubmitting ? (
                            <><Loader2 size={16} className="animate-spin" /> Processing...</>
                          ) : (
                            <><Sparkles size={16} /> Submit & Try AI First</>
                          )}
                        </Button>

                        <p className="text-[10px] text-muted-foreground/40 text-center">
                          Our AI will attempt to resolve your issue instantly. If it can't, a ticket will be created automatically.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LiveChat;
