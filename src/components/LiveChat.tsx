import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, X, Send, Minimize2, Sparkles, TicketPlus,
  ThumbsUp, ThumbsDown, RotateCcw, Zap, HelpCircle, CreditCard, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  time: string;
  rating?: "up" | "down" | null;
  isStreaming?: boolean;
}

const QUICK_ACTIONS = [
  { label: "How do challenges work?", icon: <HelpCircle size={12} /> },
  { label: "Payout process", icon: <CreditCard size={12} /> },
  { label: "Trading rules", icon: <TrendingUp size={12} /> },
  { label: "Create a ticket", icon: <TicketPlus size={12} /> },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`;

const LiveChat = () => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Hey there! 👋 I'm **PULZEX**, your AI trading assistant. Ask me anything about challenges, payouts, or trading rules — or tap a quick action below!",
      sender: "bot",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"info" | "chat">("info");
  const [sending, setSending] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketCreated, setTicketCreated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [unread, setUnread] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [showRatingFor, setShowRatingFor] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (open && !minimized) setUnread(0);
  }, [open, minimized]);

  const createTicket = () => {
    if (!name.trim() || !email.trim()) return;
    setStep("chat");
  };

  const createSupportTicket = async (context: string) => {
    if (ticketCreated) return;
    try {
      const { data, error } = await supabase
        .from("help_support_tickets")
        .insert({
          name: name.trim(),
          email: email.trim(),
          subject: `Live Chat Ticket: ${context.slice(0, 60)}`,
          message: `Chat transcript:\n\n${messages.map(m => `[${m.sender === "user" ? name : "PULZEX"}]: ${m.text}`).join("\n")}`,
          source: "live_chat",
          status: "open",
          priority: "medium",
        })
        .select("id")
        .single();

      if (error) throw error;
      setTicketId(data.id);
      setTicketCreated(true);

      const botMsg: Message = {
        id: crypto.randomUUID(),
        text: `✅ Support ticket created! (Ref: #${data.id.slice(0, 8)}). Our team will reach out to **${email}** shortly. You can continue chatting with me in the meantime!`,
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

      // Create initial streaming message
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

      // Add AI response to ticket thread if exists
      if (ticketId) {
        await addMessageToTicket(assistantText, "ai");
      }

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
  }, [messages, name, email, ticketId, ticketCreated]);

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

    // Add to ticket if exists
    if (ticketId) {
      await addMessageToTicket(msgText, "customer");
    }

    await streamAIResponse(msgText);
  };

  const rateMessage = (msgId: string, rating: "up" | "down") => {
    setMessages(prev =>
      prev.map(m => m.id === msgId ? { ...m, rating } : m)
    );
    setShowRatingFor(null);
  };

  const retryLast = () => {
    const lastUser = [...messages].reverse().find(m => m.sender === "user");
    if (lastUser) {
      setMessages(prev => prev.filter(m => m.sender === "user" || m.id === "welcome"));
      streamAIResponse(lastUser.text);
    }
  };

  const requestTicket = () => {
    sendMessage("I'd like to create a support ticket for human assistance please.");
  };

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
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg glow-box group"
          >
            <Sparkles size={22} className="group-hover:rotate-12 transition-transform" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
            {/* Pulse ring */}
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
            className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border/40 bg-card shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: minimized ? "auto" : "min(580px, calc(100vh - 6rem))" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-foreground text-background">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-background/15 flex items-center justify-center">
                  <Sparkles size={16} />
                </div>
                <div>
                  <span className="font-display font-semibold text-sm">PULZEX</span>
                  <p className="text-[10px] text-background/60">AI Trading Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={requestTicket} className="p-1.5 rounded-md hover:bg-background/10 text-background/70 transition-colors" title="Create ticket">
                  <TicketPlus size={14} />
                </button>
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
                {step === "info" ? (
                  <div className="p-5 space-y-4">
                    <div className="text-center mb-2">
                      <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center mx-auto mb-3">
                        <Sparkles size={24} />
                      </div>
                      <h3 className="font-display font-bold text-lg">Meet PULZEX</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        AI-powered support · Instant answers · 24/7
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                        className="w-full px-3 py-2.5 rounded-xl border border-border/40 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                        className="w-full px-3 py-2.5 rounded-xl border border-border/40 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    </div>
                    <Button onClick={createTicket} disabled={!name.trim() || !email.trim()} className="w-full rounded-xl h-11 gap-2">
                      <Zap size={16} /> Start Chatting
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                      {messages.map(msg => (
                        <div key={msg.id}>
                          <div className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              msg.sender === "user"
                                ? "bg-foreground text-background rounded-br-md"
                                : "bg-muted/60 text-foreground rounded-bl-md"
                            }`}>
                              <p className="whitespace-pre-wrap">{msg.text.replace(/\*\*(.*?)\*\*/g, "$1")}</p>
                              {msg.isStreaming && (
                                <span className="inline-block w-1.5 h-4 bg-foreground/50 animate-pulse ml-0.5 align-middle" />
                              )}
                              <p className={`text-[10px] mt-1 ${msg.sender === "user" ? "text-background/40" : "text-muted-foreground/40"}`}>
                                {msg.time}
                              </p>
                            </div>
                          </div>
                          {/* Rating */}
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

                      {/* Typing indicator */}
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="bg-muted/60 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      )}

                      {/* Quick actions - show only at start */}
                      {messages.length <= 1 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {QUICK_ACTIONS.map(a => (
                            <button
                              key={a.label}
                              onClick={() => sendMessage(a.label)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/40 bg-background text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
                            >
                              {a.icon} {a.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Ticket badge */}
                    {ticketCreated && (
                      <div className="mx-4 mb-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/20 flex items-center gap-2 text-xs text-muted-foreground">
                        <TicketPlus size={12} />
                        <span>Ticket #{ticketId?.slice(0, 8)} active</span>
                      </div>
                    )}

                    {/* Input */}
                    <div className="p-3 border-t border-border/30">
                      <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={input}
                          onChange={e => setInput(e.target.value)}
                          placeholder="Ask PULZEX anything..."
                          disabled={sending}
                          className="flex-1 px-3.5 py-2.5 rounded-xl border border-border/40 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
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
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LiveChat;
