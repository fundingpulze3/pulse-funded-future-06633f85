import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  Plus, Send, MessageSquare, Trash2, Sparkles, Lock, ShoppingCart,
  Bot, User as UserIcon, Loader2, PanelLeftClose, PanelLeft
} from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard-ai`;

const DashboardAI = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string | null } | null>(null);
  const [hasActiveAccount, setHasActiveAccount] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    if (!meta) { meta = document.createElement("meta"); meta.name = "robots"; document.head.appendChild(meta); }
    meta.content = "noindex, nofollow";
    return () => { if (meta) meta.remove(); };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth"); return; }
    if (user) checkAccess();
  }, [user, authLoading]);

  const checkAccess = async () => {
    if (!user) return;
    setCheckingAccess(true);
    const [profileRes, purchasesRes] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
      supabase.from("challenge_purchases").select("id").eq("user_id", user.id).in("payment_status", ["paid", "confirmed", "completed"]).limit(1),
    ]);
    setProfile(profileRes.data);
    setHasActiveAccount((purchasesRes.data?.length || 0) > 0);
    setCheckingAccess(false);
    if ((purchasesRes.data?.length || 0) > 0) loadConversations();
  };

  const loadConversations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setConversations((data as Conversation[]) || []);
  };

  const loadMessages = async (conversationId: string) => {
    const { data } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages((data as Message[]) || []);
  };

  const selectConversation = (id: string) => {
    setActiveConversationId(id);
    loadMessages(id);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const createNewChat = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({ user_id: user.id, title: "New Chat" })
      .select()
      .single();
    if (error) { toast.error("Failed to create chat"); return; }
    const conv = data as Conversation;
    setConversations(prev => [conv, ...prev]);
    setActiveConversationId(conv.id);
    setMessages([]);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const deleteConversation = async (id: string) => {
    await supabase.from("ai_conversations").delete().eq("id", id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setMessages([]);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming || !user) return;

    let convId = activeConversationId;

    // Auto-create conversation if none active
    if (!convId) {
      const { data, error } = await supabase
        .from("ai_conversations")
        .insert({ user_id: user.id, title: input.slice(0, 50) })
        .select()
        .single();
      if (error) { toast.error("Failed to create chat"); return; }
      const conv = data as Conversation;
      convId = conv.id;
      setConversations(prev => [conv, ...prev]);
      setActiveConversationId(conv.id);
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    // Save user message
    await supabase.from("ai_messages").insert({
      conversation_id: convId,
      role: "user",
      content: userMsg.content,
    });

    // Update conversation title if first message
    if (messages.length === 0) {
      await supabase.from("ai_conversations").update({ title: userMsg.content.slice(0, 60) }).eq("id", convId);
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: userMsg.content.slice(0, 60) } : c));
    }

    // Build conversation history
    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: userMsg.content }],
          conversationHistory: history,
        }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        toast.error(errData.error || "AI service error");
        setIsStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
      let streamDone = false;

      const assistantId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "", created_at: new Date().toISOString() }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev =>
                prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m)
              );
            }
          } catch { textBuffer = line + "\n" + textBuffer; break; }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev =>
                prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m)
              );
            }
          } catch {}
        }
      }

      // Save assistant message
      if (assistantContent) {
        await supabase.from("ai_messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: assistantContent,
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to get AI response");
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, user, activeConversationId, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (authLoading || checkingAccess) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,4%)] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[hsl(207,90%,77%)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Locked state for users without purchases
  if (!hasActiveAccount) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,4%)] text-[hsl(0,0%,92%)] flex flex-col">
        <DashboardSidebar profile={profile} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="hidden lg:block w-16 shrink-0" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md text-center"
          >
            <div className="w-20 h-20 rounded-2xl bg-[hsl(207,90%,77%)]/10 flex items-center justify-center mx-auto mb-6">
              <Lock size={32} className="text-[hsl(207,90%,77%)]" />
            </div>
            <h1 className="font-display text-2xl font-bold mb-3">Premium AI Assistant</h1>
            <p className="text-[hsl(220,15%,50%)] text-sm mb-6 leading-relaxed">
              Get a personalized AI trading assistant that knows your accounts, stats, and trading history.
              Purchase a challenge to unlock PulzeX AI.
            </p>
            <button
              onClick={() => navigate("/#rules")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[hsl(207,90%,77%)] hover:bg-[hsl(207,90%,72%)] text-white font-bold text-sm transition-colors"
            >
              <ShoppingCart size={16} /> Get a Challenge
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(220,20%,4%)] text-[hsl(0,0%,92%)] flex flex-col h-screen overflow-hidden">
      <DashboardSidebar profile={profile} />

      <div className="flex flex-1 overflow-hidden">
        {/* Spacer for nav */}
        <div className="hidden lg:block w-16 shrink-0" />

        {/* Chat History Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              {/* Mobile overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed lg:relative z-40 lg:z-auto top-14 bottom-0 left-0 lg:left-auto w-[280px] bg-[hsl(220,20%,5%)] border-r border-[hsl(220,15%,12%)] flex flex-col"
              >
                {/* New Chat Button */}
                <div className="p-3 border-b border-[hsl(220,15%,12%)]">
                  <button
                    onClick={createNewChat}
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-[hsl(220,15%,15%)] hover:bg-[hsl(220,15%,10%)] transition-colors text-sm font-medium"
                  >
                    <Plus size={16} /> New Chat
                  </button>
                </div>

                {/* Conversations List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                  {conversations.length === 0 && (
                    <div className="text-center py-8 text-[hsl(220,15%,35%)]">
                      <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No conversations yet</p>
                    </div>
                  )}
                  {conversations.map(conv => (
                    <div
                      key={conv.id}
                      className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        activeConversationId === conv.id
                          ? "bg-[hsl(220,15%,12%)] text-white"
                          : "text-[hsl(220,15%,50%)] hover:bg-[hsl(220,15%,8%)] hover:text-[hsl(220,15%,70%)]"
                      }`}
                      onClick={() => selectConversation(conv.id)}
                    >
                      <MessageSquare size={14} className="shrink-0" />
                      <span className="text-xs truncate flex-1">{conv.title}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[hsl(0,70%,55%)]/10 hover:text-[hsl(0,70%,55%)] transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Branding */}
                <div className="p-3 border-t border-[hsl(220,15%,12%)]">
                  <div className="flex items-center gap-2 px-2">
                    <Sparkles size={14} className="text-[hsl(207,90%,77%)]" />
                    <span className="text-[10px] font-bold text-[hsl(220,15%,40%)] uppercase tracking-wider">FP AI</span>
                  </div>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat Header */}
          <div className="h-12 border-b border-[hsl(220,15%,12%)] flex items-center px-4 gap-3 shrink-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-[hsl(220,15%,12%)] text-[hsl(220,15%,45%)] hover:text-white transition-colors"
            >
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
            </button>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[hsl(207,90%,77%)]" />
              <span className="text-sm font-bold">FP AI</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(207,90%,77%)]/10 text-[hsl(207,90%,77%)] font-medium">Premium</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full p-6">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(207,90%,77%)]/20 to-[hsl(207,85%,65%)]/10 flex items-center justify-center mx-auto mb-5">
                    <Sparkles size={28} className="text-[hsl(207,90%,77%)]" />
                  </div>
                  <h2 className="font-display text-xl font-bold mb-2">How can I help you today?</h2>
                  <p className="text-sm text-[hsl(220,15%,45%)] mb-6">
                    I know everything about your trading accounts, stats, and history. Ask me anything!
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      "How is my account performing?",
                      "What's my win rate and profit?",
                      "Am I close to hitting my targets?",
                      "Give me trading improvement tips",
                    ].map(q => (
                      <button
                        key={q}
                        onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 100); }}
                        className="text-left px-4 py-3 rounded-xl border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,7%)] hover:bg-[hsl(220,15%,10%)] text-xs text-[hsl(220,15%,60%)] hover:text-white transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto px-4 py-6 space-y-1">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 py-4 ${msg.role === "assistant" ? "" : ""}`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      msg.role === "assistant"
                        ? "bg-[hsl(207,90%,77%)]/15"
                        : "bg-[hsl(220,15%,15%)]"
                    }`}>
                      {msg.role === "assistant"
                        ? <Bot size={14} className="text-[hsl(207,90%,77%)]" />
                        : <UserIcon size={14} className="text-[hsl(220,15%,50%)]" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[hsl(220,15%,40%)] mb-1 uppercase tracking-wider">
                        {msg.role === "assistant" ? "FP AI" : profile?.display_name || "You"}
                      </p>
                      <div className="prose prose-sm prose-invert max-w-none text-[hsl(0,0%,85%)] text-sm leading-relaxed [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 [&_strong]:text-white [&_code]:bg-[hsl(220,15%,12%)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[hsl(207,90%,77%)] [&_pre]:bg-[hsl(220,15%,8%)] [&_pre]:rounded-xl [&_pre]:p-4">
                        <ReactMarkdown>{msg.content || "..."}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex gap-3 py-4">
                    <div className="w-7 h-7 rounded-lg bg-[hsl(207,90%,77%)]/15 flex items-center justify-center shrink-0">
                      <Loader2 size={14} className="text-[hsl(207,90%,77%)] animate-spin" />
                    </div>
                    <div className="flex items-center gap-1.5 pt-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[hsl(207,90%,77%)] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[hsl(207,90%,77%)] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[hsl(207,90%,77%)] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-[hsl(220,15%,12%)] p-3 sm:p-4">
            <div className="max-w-3xl mx-auto">
              <div className="relative flex items-end gap-2 bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,15%)] rounded-2xl p-2 focus-within:border-[hsl(207,90%,77%)]/30 transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask FP AI anything about your account..."
                  rows={1}
                  className="flex-1 bg-transparent text-sm resize-none border-0 outline-none placeholder:text-[hsl(220,15%,30%)] px-2 py-2 max-h-32 min-h-[36px]"
                  style={{ height: "36px" }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "36px";
                    target.style.height = Math.min(target.scrollHeight, 128) + "px";
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                  className={`p-2 rounded-xl transition-all shrink-0 ${
                    input.trim() && !isStreaming
                      ? "bg-[hsl(207,90%,77%)] text-white hover:bg-[hsl(207,90%,72%)]"
                      : "bg-[hsl(220,15%,12%)] text-[hsl(220,15%,30%)]"
                  }`}
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="text-[10px] text-[hsl(220,15%,25%)] text-center mt-2">
                FP AI has access to your account data. Responses are AI-generated and may not always be accurate.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardAI;
