import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  time: string;
}

const AUTO_REPLIES: Record<string, string> = {
  default:
    "Thanks for reaching out! Our team typically responds within 2 hours. In the meantime, check our Help Center for instant answers.",
  payout:
    "Payouts are processed within 24 hours of request. If yours is pending longer, we'll escalate it right away.",
  challenge:
    "Our challenges range from $5K to $100K accounts. Visit the Challenges section on our homepage to compare options!",
};

function detectTopic(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("payout") || lower.includes("withdraw")) return "payout";
  if (lower.includes("challenge") || lower.includes("account") || lower.includes("funded"))
    return "challenge";
  return "default";
}

const LiveChat = () => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Hi there! 👋 How can we help you today?",
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Reset unread when opened
  useEffect(() => {
    if (open && !minimized) setUnread(0);
  }, [open, minimized]);

  const createTicket = async () => {
    if (!name.trim() || !email.trim()) return;
    setStep("chat");
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      text,
      sender: "user",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      // Create ticket on first message
      if (!ticketId) {
        const { data, error } = await supabase
          .from("help_support_tickets")
          .insert({
            name: name.trim(),
            email: email.trim(),
            subject: `Live Chat: ${text.slice(0, 60)}`,
            message: text,
            source: "live_chat",
            status: "open",
            priority: "medium",
          })
          .select("id")
          .single();

        if (error) throw error;
        setTicketId(data.id);
      } else {
        // Add message to existing ticket thread
        await supabase.from("support_ticket_messages").insert({
          ticket_id: ticketId,
          message: text,
          sender_type: "customer",
          sender_name: name.trim(),
          sender_email: email.trim(),
        });
      }
    } catch {
      toast({
        title: "Failed to send",
        description: "Please try again or email support@fundingpulze.com",
        variant: "destructive",
      });
    }

    // Auto reply
    setTimeout(() => {
      const topic = detectTopic(text);
      const botMsg: Message = {
        id: crypto.randomUUID(),
        text: AUTO_REPLIES[topic],
        sender: "bot",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
      if (!open || minimized) setUnread((u) => u + 1);
    }, 1200);

    setSending(false);
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
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg glow-box"
          >
            <MessageCircle size={24} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              height: minimized ? "auto" : undefined,
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border/40 bg-card shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: minimized ? "auto" : "min(520px, calc(100vh - 6rem))" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-display font-semibold text-sm">Funding Pulze Support</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMinimized(!minimized)}
                  className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground transition-colors"
                >
                  <Minimize2 size={14} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {step === "info" ? (
                  /* Info collection step */
                  <div className="p-5 space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Enter your details to start chatting with our team.
                      </p>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="w-full px-3 py-2 rounded-lg border border-border/40 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3 py-2 rounded-lg border border-border/40 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <Button
                      onClick={createTicket}
                      disabled={!name.trim() || !email.trim()}
                      className="w-full rounded-lg"
                    >
                      Start Chat
                    </Button>
                  </div>
                ) : (
                  /* Chat step */
                  <>
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                              msg.sender === "user"
                                ? "bg-foreground text-background rounded-br-md"
                                : "bg-muted/60 text-foreground rounded-bl-md"
                            }`}
                          >
                            <p>{msg.text}</p>
                            <p
                              className={`text-[10px] mt-1 ${
                                msg.sender === "user" ? "text-background/50" : "text-muted-foreground/50"
                              }`}
                            >
                              {msg.time}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Input */}
                    <div className="p-3 border-t border-border/30">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          sendMessage();
                        }}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder="Type a message..."
                          className="flex-1 px-3 py-2 rounded-lg border border-border/40 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <Button
                          type="submit"
                          size="icon"
                          disabled={!input.trim() || sending}
                          className="rounded-lg shrink-0"
                        >
                          <Send size={16} />
                        </Button>
                      </form>
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
