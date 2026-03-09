import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Search, Mail, Clock, User, Send, X, RefreshCw,
  AlertCircle, CheckCircle2, MessageCircle, ExternalLink, Filter,
  Inbox, MailOpen, Archive, Sparkles, Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Ticket {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  source: string;
  auto_reply_sent: boolean;
  gmail_thread_id: string | null;
  last_reply_at: string | null;
  created_at: string;
  article_id: string | null;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_type: string;
  sender_email: string | null;
  sender_name: string | null;
  message: string;
  created_at: string;
}

type ViewMode = "list" | "detail";
type FilterStatus = "all" | "open" | "in_progress" | "closed";

// Notification sound (short beep using Web Audio API)
const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
};

const showBrowserNotification = (ticket: Ticket) => {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification("New Support Ticket", {
      body: `${ticket.name}: ${ticket.subject}`,
      icon: "/favicon.png",
    });
  }
};

// Sanitize HTML for safe rendering
const createSafeHTML = (html: string) => {
  // Strip script tags, event handlers, and dangerous elements
  let safe = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "");
  return safe;
};

const isHTML = (str: string) => /<\/?[a-z][\s\S]*>/i.test(str);

const SupportTicketsCMS = () => {
  const { session } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [polling, setPolling] = useState(false);
  const [closeOnReply, setCloseOnReply] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const prevTicketIdsRef = useRef<Set<string>>(new Set());

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(p => setNotificationsEnabled(p === "granted"));
    } else if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    const { data, error } = await supabase
      .from("help_support_tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    const newTickets = (data || []) as Ticket[];

    // Check for new open tickets
    if (prevTicketIdsRef.current.size > 0) {
      const newOpenTickets = newTickets.filter(
        t => t.status === "open" && !prevTicketIdsRef.current.has(t.id)
      );
      if (newOpenTickets.length > 0) {
        playNotificationSound();
        newOpenTickets.forEach(t => showBrowserNotification(t));
        toast.info(`${newOpenTickets.length} new ticket${newOpenTickets.length > 1 ? 's' : ''} received`);
      }
    }
    prevTicketIdsRef.current = new Set(newTickets.map(t => t.id));
    setTickets(newTickets);
    setLoading(false);
  }, []);

  const fetchMessages = useCallback(async (ticketId: string) => {
    const { data, error } = await supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (error) { toast.error(error.message); return; }
    setMessages((data || []) as TicketMessage[]);
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    const interval = setInterval(fetchTickets, 60000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const openTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setViewMode("detail");
    setReplyText("");
    setCloseOnReply(false);
    fetchMessages(ticket.id);
  };

  const enhanceReply = async () => {
    if (!selectedTicket) return;
    setEnhancing(true);
    try {
      const res = await supabase.functions.invoke("enhance-reply", {
        body: {
          draft: replyText,
          customer_name: selectedTicket.name,
          customer_message: selectedTicket.message,
          subject: selectedTicket.subject,
        },
      });
      if (res.error) throw new Error(res.error.message);
      const data = res.data as { enhanced?: string; error?: string };
      if (data.error) throw new Error(data.error);
      if (data.enhanced) {
        setReplyText(data.enhanced);
        toast.success("Reply enhanced with AI");
      }
    } catch (err: any) {
      toast.error(err.message || "AI enhancement failed");
    } finally {
      setEnhancing(false);
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedTicket || !session?.access_token) return;
    setSending(true);
    try {
      const res = await supabase.functions.invoke("send-support-reply", {
        body: {
          ticket_id: selectedTicket.id,
          message: replyText,
          close_ticket: closeOnReply,
        },
      });
      if (res.error) throw new Error(res.error.message);
      toast.success("Reply sent successfully");
      setReplyText("");
      setCloseOnReply(false);
      fetchMessages(selectedTicket.id);
      fetchTickets();
      setSelectedTicket(prev => prev ? {
        ...prev,
        status: closeOnReply ? 'closed' : 'in_progress',
        last_reply_at: new Date().toISOString(),
      } : null);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    const { error } = await supabase
      .from("help_support_tickets")
      .update({ status })
      .eq("id", ticketId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Ticket ${status}`);
    fetchTickets();
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, status } : null);
    }
  };

  const updateTicketPriority = async (ticketId: string, priority: string) => {
    const { error } = await supabase
      .from("help_support_tickets")
      .update({ priority })
      .eq("id", ticketId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Priority set to ${priority}`);
    fetchTickets();
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, priority } : null);
    }
  };

  const triggerPoll = async () => {
    setPolling(true);
    try {
      const res = await supabase.functions.invoke("poll-gmail");
      if (res.error) throw new Error(res.error.message);
      const data = res.data;
      toast.success(`Polled Gmail: ${data?.processed || 0} new emails processed`);
      fetchTickets();
    } catch (err: any) {
      toast.error(err.message || "Gmail poll failed");
    } finally {
      setPolling(false);
    }
  };

  const deleteTicket = async (ticketId: string) => {
    if (!confirm("Delete this ticket and all messages?")) return;
    const { error } = await supabase
      .from("help_support_tickets")
      .delete()
      .eq("id", ticketId);
    if (error) { toast.error(error.message); return; }
    toast.success("Ticket deleted");
    if (selectedTicket?.id === ticketId) {
      setViewMode("list");
      setSelectedTicket(null);
    }
    fetchTickets();
  };

  const filteredTickets = tickets.filter(t => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.subject.toLowerCase().includes(q) &&
          !t.email.toLowerCase().includes(q) &&
          !t.name.toLowerCase().includes(q)) return false;
    }
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    return true;
  });

  const statusCounts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    in_progress: tickets.filter(t => t.status === "in_progress").length,
    closed: tickets.filter(t => t.status === "closed").length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-amber-100 text-amber-800 border-amber-200";
      case "in_progress": return "bg-blue-100 text-blue-800 border-blue-200";
      case "closed": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 border-red-200";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200";
      case "normal": return "bg-gray-100 text-gray-600 border-gray-200";
      case "low": return "bg-slate-50 text-slate-500 border-slate-200";
      default: return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  const getSourceIcon = (source: string) => {
    return source === "email" ? <Mail size={12} /> : <MessageCircle size={12} />;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const renderMessageContent = (content: string) => {
    if (isHTML(content)) {
      return (
        <div
          className="text-sm text-[hsl(0,0%,30%)] leading-relaxed prose prose-sm max-w-none
            [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_img]:h-auto
            [&_table]:border-collapse [&_td]:p-1 [&_th]:p-1"
          dangerouslySetInnerHTML={{ __html: createSafeHTML(content) }}
        />
      );
    }
    return (
      <p className="text-sm text-[hsl(0,0%,30%)] whitespace-pre-wrap leading-relaxed">
        {content}
      </p>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-6 w-6 border-2 border-[hsl(0,0%,20%)] border-t-transparent rounded-full" />
      </div>
    );
  }

  // ─── DETAIL VIEW ───
  if (viewMode === "detail" && selectedTicket) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setViewMode("list"); setSelectedTicket(null); }}
              className="text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,15%)]"
            >
              <ArrowLeft size={16} className="mr-1" /> Back
            </Button>
            <div>
              <h2 className="font-display text-lg font-bold text-[hsl(0,0%,10%)]">
                #{selectedTicket.id.slice(0, 8).toUpperCase()}
              </h2>
              <p className="text-xs text-[hsl(0,0%,50%)]">{selectedTicket.subject}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedTicket.priority}
              onChange={e => updateTicketPriority(selectedTicket.id, e.target.value)}
              className="text-xs rounded-lg border border-[hsl(0,0%,88%)] bg-[hsl(0,0%,97%)] px-2 py-1.5"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <select
              value={selectedTicket.status}
              onChange={e => updateTicketStatus(selectedTicket.id, e.target.value)}
              className="text-xs rounded-lg border border-[hsl(0,0%,88%)] bg-[hsl(0,0%,97%)] px-2 py-1.5"
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="closed">Closed</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteTicket(selectedTicket.id)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* Ticket info card */}
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-[hsl(0,0%,50%)] text-xs block mb-1">From</span>
              <p className="font-medium text-[hsl(0,0%,15%)]">{selectedTicket.name}</p>
              <p className="text-xs text-[hsl(0,0%,50%)]">{selectedTicket.email}</p>
            </div>
            <div>
              <span className="text-[hsl(0,0%,50%)] text-xs block mb-1">Status</span>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${getStatusColor(selectedTicket.status)}`}>
                {selectedTicket.status === "open" ? <Inbox size={10} /> :
                 selectedTicket.status === "in_progress" ? <MailOpen size={10} /> : <Archive size={10} />}
                {selectedTicket.status.replace("_", " ")}
              </span>
            </div>
            <div>
              <span className="text-[hsl(0,0%,50%)] text-xs block mb-1">Source</span>
              <span className="inline-flex items-center gap-1 text-xs text-[hsl(0,0%,40%)]">
                {getSourceIcon(selectedTicket.source)} {selectedTicket.source}
              </span>
            </div>
            <div>
              <span className="text-[hsl(0,0%,50%)] text-xs block mb-1">Created</span>
              <p className="text-xs text-[hsl(0,0%,40%)]">
                {new Date(selectedTicket.created_at).toLocaleDateString()} {new Date(selectedTicket.created_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>

        {/* Messages thread */}
        <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[hsl(0,0%,92%)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[hsl(0,0%,15%)]">
              Conversation ({messages.length})
            </h3>
            <Button variant="ghost" size="sm" onClick={() => fetchMessages(selectedTicket.id)} className="text-xs text-[hsl(0,0%,50%)]">
              <RefreshCw size={12} className="mr-1" /> Refresh
            </Button>
          </div>

          <div className="divide-y divide-[hsl(0,0%,95%)]">
            {/* Original ticket message */}
            <div className="p-5 bg-[hsl(45,50%,97%)]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-amber-200 flex items-center justify-center">
                    <User size={12} className="text-amber-800" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-[hsl(0,0%,15%)]">{selectedTicket.name}</span>
                    <span className="text-xs text-[hsl(0,0%,50%)] ml-2">{selectedTicket.email}</span>
                  </div>
                </div>
                <span className="text-xs text-[hsl(0,0%,50%)]">{timeAgo(selectedTicket.created_at)}</span>
              </div>
              {renderMessageContent(selectedTicket.message)}
            </div>

            {/* Thread messages */}
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`p-5 ${
                  msg.sender_type === 'support' ? 'bg-blue-50/50' :
                  msg.sender_type === 'system' ? 'bg-[hsl(0,0%,98%)]' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      msg.sender_type === 'support' ? 'bg-blue-200' :
                      msg.sender_type === 'system' ? 'bg-gray-200' : 'bg-amber-200'
                    }`}>
                      {msg.sender_type === 'support' ? <Send size={12} className="text-blue-800" /> :
                       msg.sender_type === 'system' ? <AlertCircle size={12} className="text-gray-600" /> :
                       <User size={12} className="text-amber-800" />}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-[hsl(0,0%,15%)]">
                        {msg.sender_name || msg.sender_email || "Unknown"}
                      </span>
                      <Badge variant="outline" className="ml-2 text-[10px] py-0">
                        {msg.sender_type}
                      </Badge>
                    </div>
                  </div>
                  <span className="text-xs text-[hsl(0,0%,50%)]">{timeAgo(msg.created_at)}</span>
                </div>
                {renderMessageContent(msg.message)}
              </div>
            ))}

            {messages.length === 0 && (
              <div className="p-8 text-center text-sm text-[hsl(0,0%,50%)]">
                No additional messages yet
              </div>
            )}
          </div>
        </div>

        {/* Reply box */}
        {selectedTicket.status !== "closed" && (
          <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[hsl(0,0%,15%)]">Reply</h3>
              <Button
                onClick={enhanceReply}
                disabled={enhancing}
                variant="outline"
                size="sm"
                className="rounded-lg border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 gap-1.5"
              >
                {enhancing ? (
                  <><RefreshCw size={13} className="animate-spin" /> Enhancing...</>
                ) : (
                  <><Sparkles size={13} /> Fix with AI</>
                )}
              </Button>
            </div>
            <Textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Type your reply... (sent from support@fundingpulze.com)"
              className="min-h-[120px] bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg text-sm resize-y mb-3"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-[hsl(0,0%,50%)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={closeOnReply}
                  onChange={e => setCloseOnReply(e.target.checked)}
                  className="rounded"
                />
                Close ticket after sending
              </label>
              <Button
                onClick={sendReply}
                disabled={sending || !replyText.trim()}
                className="bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)] rounded-lg"
              >
                {sending ? (
                  <><RefreshCw size={14} className="mr-1 animate-spin" /> Sending...</>
                ) : (
                  <><Send size={14} className="mr-1" /> Send Reply</>
                )}
              </Button>
            </div>
          </div>
        )}

        {selectedTicket.status === "closed" && (
          <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5 text-center">
            <p className="text-sm text-[hsl(0,0%,50%)] mb-2">This ticket is closed.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateTicketStatus(selectedTicket.id, "open")}
              className="rounded-lg border-[hsl(0,0%,88%)]"
            >
              Reopen Ticket
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ─── LIST VIEW ───
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-[hsl(0,0%,10%)]">Support Tickets</h2>
          <p className="text-xs text-[hsl(0,0%,50%)]">Manage customer support from email & web</p>
        </div>
        <div className="flex items-center gap-2">
          {!notificationsEnabled && "Notification" in window && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => Notification.requestPermission().then(p => setNotificationsEnabled(p === "granted"))}
              className="rounded-lg text-xs"
            >
              <Volume2 size={14} className="mr-1" /> Enable Alerts
            </Button>
          )}
          <Button
            onClick={triggerPoll}
            disabled={polling}
            className="bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)] rounded-lg"
          >
            {polling ? (
              <><RefreshCw size={14} className="mr-2 animate-spin" /> Polling Gmail...</>
            ) : (
              <><Mail size={14} className="mr-2" /> Check Gmail</>
            )}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {(["all", "open", "in_progress", "closed"] as FilterStatus[]).map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`rounded-xl border p-4 text-left transition-all ${
              filterStatus === status
                ? 'bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] border-[hsl(0,0%,0%)]'
                : 'bg-[hsl(0,0%,100%)] text-[hsl(0,0%,30%)] border-[hsl(0,0%,90%)] hover:border-[hsl(0,0%,70%)]'
            }`}
          >
            <p className="text-2xl font-bold">{statusCounts[status]}</p>
            <p className="text-xs capitalize mt-1 opacity-70">{status.replace("_", " ")}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(0,0%,50%)]" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by subject, email, or name..."
          className="pl-10 bg-[hsl(0,0%,100%)] border-[hsl(0,0%,88%)] rounded-lg"
        />
      </div>

      {/* Ticket list */}
      <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[hsl(0,0%,97%)] text-[hsl(0,0%,45%)] text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-medium">Ticket</th>
              <th className="text-left px-5 py-3 font-medium">From</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Priority</th>
              <th className="text-left px-5 py-3 font-medium">Source</th>
              <th className="text-left px-5 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(0,0%,95%)]">
            {filteredTickets.map(ticket => (
              <tr
                key={ticket.id}
                onClick={() => openTicket(ticket)}
                className="hover:bg-[hsl(0,0%,98%)] cursor-pointer transition-colors"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[hsl(0,0%,50%)]">
                      #{ticket.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <p className="font-medium text-[hsl(0,0%,15%)] text-sm mt-0.5 line-clamp-1">
                    {ticket.subject}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <p className="text-[hsl(0,0%,30%)]">{ticket.name}</p>
                  <p className="text-xs text-[hsl(0,0%,50%)]">{ticket.email}</p>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${getStatusColor(ticket.status)}`}>
                    {ticket.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex text-xs px-2 py-1 rounded-full border ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-1 text-xs text-[hsl(0,0%,50%)]">
                    {getSourceIcon(ticket.source)} {ticket.source}
                  </span>
                </td>
                <td className="px-5 py-4 text-xs text-[hsl(0,0%,50%)] whitespace-nowrap">
                  {timeAgo(ticket.created_at)}
                </td>
              </tr>
            ))}
            {filteredTickets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-[hsl(0,0%,50%)]">
                  {searchQuery || filterStatus !== "all"
                    ? "No tickets match your filters"
                    : "No support tickets yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SupportTicketsCMS;
