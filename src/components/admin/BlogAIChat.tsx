import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Sparkles, Copy, Loader2, Image as ImageIcon, Trash2, Bot, User,
  Plus, MessageSquare, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { db as supabase } from "@/integrations/db/client";

type Msg = { role: "user" | "assistant"; content: string; image?: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/blog-ai-chat`;

type Convo = { id: string; title: string; created_at: string; updated_at: string };

export default function BlogAIChat() {
  const [conversations, setConversations] = useState<Convo[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from("blog_ai_conversations")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setConversations(data as Convo[]);
    setLoadingConvos(false);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load messages for active conversation
  const loadMessages = useCallback(async (convoId: string) => {
    const { data } = await supabase
      .from("blog_ai_messages")
      .select("*")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data.map((m: any) => ({ role: m.role, content: m.content, image: m.image || undefined })));
    }
  }, []);

  useEffect(() => {
    if (activeConvoId) loadMessages(activeConvoId);
    else setMessages([]);
  }, [activeConvoId, loadMessages]);

  const createNewChat = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("blog_ai_conversations")
      .insert({ user_id: user.id, title: "New Chat" })
      .select()
      .single();
    if (error) { toast.error("Failed to create chat"); return; }
    const convo = data as Convo;
    setConversations(prev => [convo, ...prev]);
    setActiveConvoId(convo.id);
    setMessages([]);
  };

  const deleteConvo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("blog_ai_conversations").delete().eq("id", id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvoId === id) { setActiveConvoId(null); setMessages([]); }
    toast.success("Chat deleted");
  };

  const saveMessage = async (convoId: string, msg: Msg) => {
    await supabase.from("blog_ai_messages").insert({
      conversation_id: convoId,
      role: msg.role,
      content: msg.content,
      image: msg.image || null,
    });
  };

  const updateConvoTitle = async (convoId: string, firstMsg: string) => {
    const title = firstMsg.slice(0, 60) + (firstMsg.length > 60 ? "…" : "");
    await supabase.from("blog_ai_conversations").update({ title, updated_at: new Date().toISOString() }).eq("id", convoId);
    setConversations(prev => prev.map(c => c.id === convoId ? { ...c, title } : c));
  };

  const streamChat = async (userMessages: Msg[]) => {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        messages: userMessages.map(m => ({ role: m.role, content: m.content })),
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || "AI service error");
    }
    if (!resp.body) throw new Error("No response body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantSoFar = "";

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.image) {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    let done = false;
    while (!done) {
      const { done: readerDone, value } = await reader.read();
      if (readerDone) break;
      textBuffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") { done = true; break; }
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) upsert(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }
    return assistantSoFar;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    let convoId = activeConvoId;
    // Auto-create conversation if none active
    if (!convoId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("blog_ai_conversations")
        .insert({ user_id: user.id, title: text.slice(0, 60) })
        .select()
        .single();
      if (error || !data) { toast.error("Failed to create chat"); return; }
      const convo = data as Convo;
      convoId = convo.id;
      setConversations(prev => [convo, ...prev]);
      setActiveConvoId(convoId);
    }

    const userMsg: Msg = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsStreaming(true);

    // Save user message
    await saveMessage(convoId, userMsg);

    // Update title if first message
    if (messages.length === 0) await updateConvoTitle(convoId, text);

    try {
      const assistantContent = await streamChat(updated);
      if (assistantContent) {
        const assistantMsg: Msg = { role: "assistant", content: assistantContent };
        await saveMessage(convoId, assistantMsg);
        await supabase.from("blog_ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convoId);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to get response");
    } finally {
      setIsStreaming(false);
    }
  };

  const generateImage = async () => {
    if (!imagePrompt.trim()) { toast.error("Enter an image description"); return; }

    let convoId = activeConvoId;
    if (!convoId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("blog_ai_conversations")
        .insert({ user_id: user.id, title: `🖼️ ${imagePrompt.slice(0, 50)}` })
        .select().single();
      if (!data) { toast.error("Failed to create chat"); return; }
      const convo = data as Convo;
      convoId = convo.id;
      setConversations(prev => [convo, ...prev]);
      setActiveConvoId(convoId);
    }

    setImageLoading(true);
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: imagePrompt.trim() }],
          generateImage: true,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Image generation failed");
      }
      const data = await resp.json();
      const imgUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!imgUrl) throw new Error("No image returned");

      const userMsg: Msg = { role: "user", content: `🖼️ Generate image: ${imagePrompt}` };
      const assistantMsg: Msg = { role: "assistant", content: "Here's your generated image:", image: imgUrl };

      setMessages(prev => [...prev, userMsg, assistantMsg]);
      await saveMessage(convoId, userMsg);
      await saveMessage(convoId, assistantMsg);

      setImagePrompt("");
      setShowImageInput(false);
      toast.success("Image generated!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImageLoading(false);
    }
  };

  const copyContent = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-background border border-border rounded-xl overflow-hidden">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-64" : "w-0"} transition-all duration-200 bg-[hsl(0,0%,4%)] border-r border-border flex flex-col overflow-hidden`}>
        <div className="p-3 border-b border-[hsl(0,0%,12%)]">
          <Button
            onClick={createNewChat}
            className="w-full h-9 text-xs bg-gradient-to-r from-[hsl(45,90%,50%)] to-[hsl(35,90%,45%)] text-[hsl(0,0%,0%)] hover:opacity-90 gap-1.5 font-semibold"
          >
            <Plus size={14} /> New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
          {loadingConvos ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="animate-spin text-[hsl(0,0%,40%)]" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-[10px] text-[hsl(0,0%,40%)] text-center py-8">No conversations yet</p>
          ) : (
            conversations.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveConvoId(c.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left group transition-colors ${
                  activeConvoId === c.id
                    ? "bg-[hsl(0,0%,14%)] text-[hsl(0,0%,95%)]"
                    : "text-[hsl(0,0%,55%)] hover:bg-[hsl(0,0%,10%)] hover:text-[hsl(0,0%,80%)]"
                }`}
              >
                <MessageSquare size={13} className="shrink-0" />
                <span className="text-[11px] truncate flex-1">{c.title}</span>
                <button
                  onClick={(e) => deleteConvo(c.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity p-0.5"
                >
                  <Trash2 size={11} />
                </button>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-[hsl(0,0%,2%)] to-[hsl(0,0%,10%)]">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,20%)]"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </Button>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(45,90%,50%)] to-[hsl(35,90%,45%)] flex items-center justify-center">
              <Sparkles size={16} className="text-[hsl(0,0%,0%)]" />
            </div>
            <div>
              <h2 className="text-sm font-display font-bold text-[hsl(0,0%,100%)]">BLOG AI</h2>
              <p className="text-[10px] text-[hsl(0,0%,55%)]">SEO-optimized blog content generator</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon"
              className="h-7 w-7 text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,20%)]"
              onClick={() => setShowImageInput(!showImageInput)} title="Generate Image">
              <ImageIcon size={14} />
            </Button>
          </div>
        </div>

        {/* Image Generator Bar */}
        {showImageInput && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[hsl(45,60%,96%)] border-b border-[hsl(45,40%,85%)]">
            <ImageIcon size={14} className="text-[hsl(45,70%,40%)] shrink-0" />
            <input
              value={imagePrompt}
              onChange={e => setImagePrompt(e.target.value)}
              placeholder="Describe the blog image you want..."
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              onKeyDown={e => e.key === "Enter" && generateImage()}
            />
            <Button size="sm"
              className="h-7 text-[10px] bg-[hsl(45,80%,50%)] text-[hsl(0,0%,0%)] hover:bg-[hsl(45,80%,45%)] gap-1"
              onClick={generateImage} disabled={imageLoading}>
              {imageLoading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
              Generate
            </Button>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(45,90%,50%)] to-[hsl(35,80%,45%)] flex items-center justify-center">
                <Sparkles size={24} className="text-[hsl(0,0%,0%)]" />
              </div>
              <div>
                <h3 className="text-sm font-display font-bold text-foreground">BLOG AI</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Give me a rough idea and I'll craft a full SEO-optimized blog post scoring 90+. I can also generate images!
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-sm w-full">
                {[
                  "Write a blog about prop trading vs retail trading",
                  "Create an article on risk management strategies for funded traders",
                  "Blog post about how to pass a prop firm challenge",
                  "Write about the top 5 forex trading mistakes",
                ].map((suggestion, i) => (
                  <button key={i}
                    className="text-left text-[10px] text-muted-foreground bg-muted/50 hover:bg-muted rounded-lg px-3 py-2.5 border border-border transition-colors"
                    onClick={() => { setInput(suggestion); textareaRef.current?.focus(); }}>
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[hsl(45,90%,50%)] to-[hsl(35,80%,45%)] flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={14} className="text-[hsl(0,0%,0%)]" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
                msg.role === "user"
                  ? "bg-[hsl(0,0%,5%)] text-[hsl(0,0%,95%)]"
                  : "bg-muted text-foreground"
              }`}>
                {msg.image ? (
                  <div className="space-y-2">
                    <p className="text-xs">{msg.content}</p>
                    <img src={msg.image} alt="Generated" className="rounded-lg max-w-full max-h-[300px]" />
                    <Button size="sm" variant="ghost"
                      className="h-6 text-[10px] gap-1 text-muted-foreground"
                      onClick={() => copyContent(msg.image!)}>
                      <Copy size={10} /> Copy image URL
                    </Button>
                  </div>
                ) : msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none text-xs leading-relaxed [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_blockquote]:border-l-2 [&_blockquote]:border-[hsl(45,80%,50%)] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[10px] [&_hr]:my-2 [&_strong]:font-bold [&_table]:text-[10px] [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_td]:border [&_td]:border-border">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-border">
                      <Button size="sm" variant="ghost"
                        className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                        onClick={() => copyContent(msg.content)}>
                        <Copy size={10} /> Copy MD
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-[hsl(0,0%,15%)] flex items-center justify-center shrink-0 mt-0.5">
                  <User size={14} className="text-[hsl(0,0%,70%)]" />
                </div>
              )}
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[hsl(45,90%,50%)] to-[hsl(35,80%,45%)] flex items-center justify-center shrink-0">
                <Bot size={14} className="text-[hsl(0,0%,0%)]" />
              </div>
              <div className="bg-muted rounded-xl px-3.5 py-2.5">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border px-4 py-3 bg-background">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Give me a rough blog idea..."
              className="min-h-[44px] max-h-[120px] resize-none text-xs border-border focus-visible:ring-[hsl(45,80%,50%)]"
              rows={1}
            />
            <Button
              onClick={send}
              disabled={!input.trim() || isStreaming}
              className="h-[44px] w-[44px] shrink-0 bg-[hsl(0,0%,5%)] hover:bg-[hsl(0,0%,15%)] text-[hsl(0,0%,100%)]"
              size="icon">
              {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </Button>
          </div>
          <p className="text-[9px] text-muted-foreground mt-1.5 text-center">
            BLOG AI generates SEO-optimized content. Always review before publishing.
          </p>
        </div>
      </div>
    </div>
  );
}
