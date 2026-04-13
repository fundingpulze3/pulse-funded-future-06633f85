import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Users, Plus, Trash2, Send, Calendar, BarChart3, Clock,
  Mail, Eye, MousePointer, TrendingUp, Upload, Code, FileText,
  Layout, UserPlus, FileUp, Palette,
} from "lucide-react";
import EmailTemplateBuilder from "@/components/admin/EmailTemplateBuilder";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { toast } from "sonner";

const PIE_COLORS = ["hsl(142,70%,45%)", "hsl(200,70%,50%)", "hsl(45,90%,55%)", "hsl(0,70%,55%)", "hsl(270,60%,55%)", "hsl(30,80%,50%)"];
const LIGHT_DIALOG_CLASS = "bg-[hsl(var(--popover))] border-[hsl(var(--border))] text-[hsl(var(--foreground))]";
const LIGHT_FIELD_CLASS = "bg-[hsl(var(--background))] border-[hsl(var(--input))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]";
const LIGHT_COLOR_SCHEME = { colorScheme: "light" as const };

// ---- Predefined Email Templates ----
const EMAIL_TEMPLATES: { name: string; description: string; html: string }[] = [
  {
    name: "Welcome Email",
    description: "Clean welcome email for new users",
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5}table{border-spacing:0}.wrapper{max-width:600px;margin:0 auto;background:#ffffff}.header{background:#000000;padding:30px 40px;text-align:center}.header h1{color:#ffffff;font-size:22px;margin:0;letter-spacing:1px}.body-content{padding:40px}.body-content h2{color:#111;font-size:20px;margin:0 0 15px}.body-content p{color:#555;font-size:15px;line-height:1.6;margin:0 0 20px}.cta-btn{display:inline-block;background:#000;color:#fff!important;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.5px}.footer{background:#fafafa;padding:25px 40px;text-align:center;border-top:1px solid #eee}.footer p{color:#999;font-size:12px;margin:0;line-height:1.6}</style></head><body><div class="wrapper"><div class="header"><h1>FUNDING PULZE</h1></div><div class="body-content"><h2>Welcome aboard! 🎉</h2><p>Thank you for joining Funding Pulze. We're excited to have you as part of our trading community.</p><p>Start your funded trading journey today and take advantage of our industry-leading challenge programs.</p><a href="https://fundingpulze.com" class="cta-btn">Get Started →</a></div><div class="footer"><p>© Funding Pulze. All rights reserved.<br/>You received this email because you're subscribed to our updates.</p></div></div></body></html>`,
  },
  {
    name: "Promotion / Discount",
    description: "Limited time offer with CTA button",
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5}.wrapper{max-width:600px;margin:0 auto;background:#ffffff}.hero{background:linear-gradient(135deg,#000 0%,#222 100%);padding:50px 40px;text-align:center}.hero h1{color:#fff;font-size:36px;margin:0 0 8px;font-weight:800}.hero p{color:#ccc;font-size:16px;margin:0}.badge{display:inline-block;background:#FFD700;color:#000;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:700;margin-top:15px}.body-content{padding:40px;text-align:center}.body-content p{color:#555;font-size:15px;line-height:1.6;margin:0 0 25px}.cta-btn{display:inline-block;background:#000;color:#fff!important;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:15px;font-weight:600}.footer{background:#fafafa;padding:25px 40px;text-align:center;border-top:1px solid #eee}.footer p{color:#999;font-size:12px;margin:0}</style></head><body><div class="wrapper"><div class="hero"><h1>20% OFF</h1><p>All Challenge Programs</p><span class="badge">LIMITED TIME</span></div><div class="body-content"><p>Don't miss this exclusive offer! Use code <strong>PULZE20</strong> at checkout to save 20% on any challenge program.</p><p>Offer expires in 48 hours. Act now!</p><a href="https://fundingpulze.com" class="cta-btn">Claim Your Discount →</a></div><div class="footer"><p>© Funding Pulze. All rights reserved.</p></div></div></body></html>`,
  },
  {
    name: "Newsletter Update",
    description: "Weekly/monthly newsletter format",
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5}.wrapper{max-width:600px;margin:0 auto;background:#ffffff}.header{background:#000;padding:20px 40px;display:flex;align-items:center;justify-content:space-between}.header h1{color:#fff;font-size:18px;margin:0}.header span{color:#888;font-size:12px}.section{padding:30px 40px;border-bottom:1px solid #f0f0f0}.section h3{color:#111;font-size:16px;margin:0 0 10px;display:flex;align-items:center;gap:8px}.section p{color:#555;font-size:14px;line-height:1.6;margin:0 0 12px}.read-more{color:#000;font-weight:600;text-decoration:none;font-size:13px}.stat-row{display:flex;gap:20px;margin:15px 0}.stat{text-align:center;flex:1;padding:15px;background:#f8f8f8;border-radius:8px}.stat .num{font-size:24px;font-weight:800;color:#000;display:block}.stat .label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px}.footer{padding:25px 40px;text-align:center}.footer p{color:#999;font-size:12px;margin:0}</style></head><body><div class="wrapper"><div class="header"><h1>📰 Funding Pulze Weekly</h1><span>This Week's Update</span></div><div class="section"><h3>📈 Market Highlights</h3><p>Gold surged past $2,400 this week amid geopolitical tensions. EUR/USD tested the 1.0850 resistance level with strong momentum.</p><a href="https://fundingpulze.com" class="read-more">Read full analysis →</a></div><div class="section"><h3>🏆 Community Stats</h3><div class="stat-row"><div class="stat"><span class="num">$4.3M+</span><span class="label">Total Payouts</span></div><div class="stat"><span class="num">12K+</span><span class="label">Active Traders</span></div><div class="stat"><span class="num">95%</span><span class="label">Pass Rate</span></div></div></div><div class="section"><h3>🎓 Tips & Education</h3><p>Master risk management with our new guide: "The 2% Rule Every Funded Trader Should Follow."</p><a href="https://fundingpulze.com/blog" class="read-more">Read on our blog →</a></div><div class="footer"><p>© Funding Pulze. You received this because you're subscribed.<br/>Unsubscribe if you no longer wish to receive these emails.</p></div></div></body></html>`,
  },
  {
    name: "Achievement / Milestone",
    description: "Celebrate user or platform milestones",
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5}.wrapper{max-width:600px;margin:0 auto;background:#ffffff}.hero{background:#000;padding:50px 40px;text-align:center}.hero .emoji{font-size:48px;display:block;margin-bottom:15px}.hero h1{color:#FFD700;font-size:28px;margin:0 0 8px;font-weight:800}.hero p{color:#aaa;font-size:14px;margin:0}.body-content{padding:40px;text-align:center}.body-content p{color:#555;font-size:15px;line-height:1.7;margin:0 0 25px}.cta-btn{display:inline-block;background:#000;color:#fff!important;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:14px;font-weight:600}.social{padding:20px 40px;text-align:center}.social a{display:inline-block;margin:0 8px;color:#888;text-decoration:none;font-size:13px}.footer{padding:20px 40px;text-align:center;border-top:1px solid #f0f0f0}.footer p{color:#999;font-size:11px;margin:0}</style></head><body><div class="wrapper"><div class="hero"><span class="emoji">🏆</span><h1>We Hit $4.3M in Payouts!</h1><p>And it's all thanks to traders like you.</p></div><div class="body-content"><p>Our community of funded traders has collectively earned over $4.3 million in payouts. This milestone proves that with discipline and the right platform, anyone can succeed.</p><p>Ready to join the winners?</p><a href="https://fundingpulze.com" class="cta-btn">Start Your Challenge →</a></div><div class="social"><a href="https://instagram.com">Instagram</a> · <a href="https://twitter.com">Twitter</a> · <a href="https://discord.com">Discord</a></div><div class="footer"><p>© Funding Pulze. All rights reserved.</p></div></div></body></html>`,
  },
  {
    name: "Plain Text Style",
    description: "Simple text-only email, personal feel",
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;font-family:Georgia,'Times New Roman',serif;background:#f5f5f5}.wrapper{max-width:580px;margin:20px auto;background:#fff;padding:45px 50px;border:1px solid #eee;border-radius:4px}.wrapper h2{font-size:20px;color:#111;margin:0 0 20px;font-weight:normal}.wrapper p{color:#333;font-size:15px;line-height:1.8;margin:0 0 18px}.signature{margin-top:30px;padding-top:20px;border-top:1px solid #eee}.signature p{color:#888;font-size:13px;margin:0 0 4px;line-height:1.5}.signature strong{color:#333}</style></head><body><div class="wrapper"><h2>Hey there,</h2><p>Just wanted to drop you a quick note about something exciting we've been working on at Funding Pulze.</p><p>We've just launched new challenge sizes and improved our profit split — now up to 90% in your favor. If you've been thinking about getting funded, now's the perfect time.</p><p>Feel free to reply to this email if you have any questions. We're here to help.</p><div class="signature"><p><strong>Chirag</strong></p><p>Founder, Funding Pulze</p><p>support@fundingpulze.com</p></div></div></body></html>`,
  },
];

export default function EmailMarketing() {
  const [activeTab, setActiveTab] = useState("groups");
  const [groups, setGroups] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);

  // Group state
  const [groupDialog, setGroupDialog] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Contact state
  const [contactDialog, setContactDialog] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [bulkDialog, setBulkDialog] = useState(false);
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkMode, setBulkMode] = useState<"paste" | "csv">("paste");
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [addUsersDialog, setAddUsersDialog] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // Campaign state
  const [campaignDialog, setCampaignDialog] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignHtml, setCampaignHtml] = useState("");
  const [campaignGroupId, setCampaignGroupId] = useState("");
  const [campaignScheduleAt, setCampaignScheduleAt] = useState("");
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [detailCampaignId, setDetailCampaignId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"templates" | "code">("templates");
  const [showPreview, setShowPreview] = useState(false);
  const [templateDialog, setTemplateDialog] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAllRows = async (table: string, columns = "*", orderCol = "created_at") => {
    const rows: any[] = [];
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await (supabase.from(table as any) as any).select(columns).order(orderCol, { ascending: false }).range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      rows.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return rows;
  };

  const fetchAll = async () => {
    setLoading(true);
    const [g, co, ca, ev, pr] = await Promise.all([
      fetchAllRows("email_groups"),
      fetchAllRows("email_group_contacts"),
      fetchAllRows("email_campaigns"),
      fetchAllRows("email_campaign_events"),
      fetchAllRows("profiles", "user_id, email, display_name"),
    ]);
    setGroups(g);
    setContacts(co);
    setCampaigns(ca);
    setEvents(ev);
    setAllProfiles(pr);
    setLoading(false);
  };

  // ---- Groups ----
  const saveGroup = async () => {
    if (!groupName.trim()) { toast.error("Group name required"); return; }
    if (editingGroupId) {
      const { error } = await supabase.from("email_groups").update({ name: groupName, description: groupDesc }).eq("id", editingGroupId);
      if (error) { toast.error(error.message); return; }
      toast.success("Group updated");
    } else {
      const { error } = await supabase.from("email_groups").insert({ name: groupName, description: groupDesc });
      if (error) { toast.error(error.message); return; }
      toast.success("Group created");
    }
    setGroupDialog(false); setGroupName(""); setGroupDesc(""); setEditingGroupId(null); fetchAll();
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Delete this group and all its contacts?")) return;
    await supabase.from("email_groups").delete().eq("id", id);
    toast.success("Group deleted"); fetchAll();
  };

  // ---- Contacts ----
  const addContact = async () => {
    if (!selectedGroupId || !contactEmail.trim()) { toast.error("Email required"); return; }
    const { error } = await supabase.from("email_group_contacts").insert({ group_id: selectedGroupId, email: contactEmail.trim().toLowerCase(), name: contactName.trim() || null });
    if (error) { toast.error(error.message.includes("duplicate") ? "Email already in group" : error.message); return; }
    toast.success("Contact added"); setContactDialog(false); setContactEmail(""); setContactName(""); fetchAll();
  };

  const parseEmailsFromText = (text: string): { email: string; name: string | null }[] => {
    const lines = text.split(/[\n\r]+/).filter(l => l.trim());
    const results: { email: string; name: string | null }[] = [];
    for (const line of lines) {
      // Support: "name,email" or "email,name" or just "email"
      const parts = line.split(/[,;\t]+/).map(p => p.trim().replace(/^["']|["']$/g, ""));
      if (parts.length >= 2) {
        const emailPart = parts.find(p => p.includes("@"));
        const namePart = parts.find(p => !p.includes("@") && p.length > 0);
        if (emailPart) results.push({ email: emailPart.toLowerCase(), name: namePart || null });
      } else if (parts[0]?.includes("@")) {
        results.push({ email: parts[0].toLowerCase(), name: null });
      }
    }
    return results;
  };

  const upsertInBatches = async (rows: any[]) => {
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase.from("email_group_contacts").upsert(batch, { onConflict: "group_id,email" });
      if (error) throw error;
    }
  };

  const bulkAddContacts = async () => {
    if (!selectedGroupId || !bulkEmails.trim()) { toast.error("Enter emails"); return; }
    const parsed = parseEmailsFromText(bulkEmails);
    if (parsed.length === 0) { toast.error("No valid emails found"); return; }
    const rows = parsed.map(p => ({ group_id: selectedGroupId, email: p.email, name: p.name }));
    try {
      await upsertInBatches(rows);
      toast.success(`${parsed.length} contacts added`); setBulkDialog(false); setBulkEmails(""); fetchAll();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) setBulkEmails(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  const addRegisteredUsers = async (userIds: string[], closeAfter = true) => {
    if (!selectedGroupId || userIds.length === 0) return;
    if (userIds.length === 1) setAddingUserId(userIds[0]);
    const selectedUsers = allProfiles.filter(p => userIds.includes(p.user_id) && p.email);
    const rows = selectedUsers.map(u => ({ group_id: selectedGroupId, email: u.email.toLowerCase(), name: u.display_name || null }));
    if (rows.length === 0) { toast.error("No valid emails"); setAddingUserId(null); return; }
    try {
      await upsertInBatches(rows);
      toast.success(`${rows.length} user${rows.length > 1 ? 's' : ''} added to group`);
      if (closeAfter && userIds.length > 5) { setAddUsersDialog(false); setUserSearchQuery(""); }
      fetchAll();
    } catch (err: any) { toast.error(err.message || "Failed to add user"); }
    setAddingUserId(null);
  };

  const addAllRegisteredUsers = async () => {
    if (!selectedGroupId) return;
    const validUsers = allProfiles.filter(p => p.email);
    if (validUsers.length === 0) { toast.error("No users with email found"); return; }
    if (!confirm(`Add all ${validUsers.length} registered users to this group?`)) return;
    const rows = validUsers.map(u => ({ group_id: selectedGroupId, email: u.email.toLowerCase(), name: u.display_name || null }));
    try {
      await upsertInBatches(rows);
      toast.success(`${rows.length} users added to group`); setAddUsersDialog(false); fetchAll();
    } catch (err: any) { toast.error(err.message); }
  };

  const deleteContact = async (id: string) => {
    await supabase.from("email_group_contacts").delete().eq("id", id);
    toast.success("Contact removed"); fetchAll();
  };

  // ---- Campaigns ----
  const saveCampaign = async () => {
    if (!campaignName.trim() || !campaignSubject.trim() || !campaignGroupId) { toast.error("Fill all fields"); return; }
    const payload: any = {
      name: campaignName, subject: campaignSubject, html_content: campaignHtml,
      group_id: campaignGroupId, status: campaignScheduleAt ? "scheduled" : "draft",
      scheduled_at: campaignScheduleAt ? new Date(campaignScheduleAt).toISOString() : null,
    };
    if (editingCampaignId) {
      const { error } = await supabase.from("email_campaigns").update(payload).eq("id", editingCampaignId);
      if (error) { toast.error(error.message); return; }
      toast.success("Campaign updated");
    } else {
      const { error } = await supabase.from("email_campaigns").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Campaign created");
    }
    closeCampaignDialog(); fetchAll();
  };

  const closeCampaignDialog = () => {
    setCampaignDialog(false); setCampaignName(""); setCampaignSubject("");
    setCampaignHtml(""); setCampaignGroupId(""); setCampaignScheduleAt("");
    setEditingCampaignId(null); setEditorMode("templates"); setShowPreview(false);
  };

  const sendCampaign = async (id: string) => {
    if (!confirm("Send this campaign now?")) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-campaign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ campaign_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Campaign sent! ${data.sent} delivered, ${data.failed} failed`);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    }
    setSending(false);
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Delete this campaign?")) return;
    await supabase.from("email_campaigns").delete().eq("id", id);
    toast.success("Campaign deleted"); fetchAll();
  };

  // ---- Analytics ----
  const campaignEvents = useMemo(() => selectedCampaignId ? events.filter(e => e.campaign_id === selectedCampaignId) : events, [events, selectedCampaignId]);

  const stats = useMemo(() => {
    const sent = campaignEvents.filter(e => e.event_type === "sent").length;
    const opened = new Set(campaignEvents.filter(e => e.event_type === "open").map(e => e.contact_email)).size;
    const clicked = new Set(campaignEvents.filter(e => e.event_type === "click").map(e => e.contact_email)).size;
    return { sent, opened, clicked, openRate: sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0", clickRate: sent > 0 ? ((clicked / sent) * 100).toFixed(1) : "0" };
  }, [campaignEvents]);

  const opensByHour = useMemo(() => {
    const hours: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hours[i] = 0;
    campaignEvents.filter(e => e.event_type === "open").forEach(e => { hours[new Date(e.created_at).getHours()]++; });
    return Object.entries(hours).map(([hour, count]) => ({ hour: `${String(hour).padStart(2, "0")}:00`, opens: count }));
  }, [campaignEvents]);

  const bestHour = useMemo(() => {
    const sorted = [...opensByHour].sort((a, b) => b.opens - a.opens);
    return sorted[0]?.opens > 0 ? sorted[0].hour : "N/A";
  }, [opensByHour]);

  const opensTimeline = useMemo(() => {
    const buckets: Record<string, { opens: number; clicks: number }> = {};
    campaignEvents.filter(e => e.event_type === "open" || e.event_type === "click").forEach(e => {
      const key = e.created_at?.slice(0, 10);
      if (!buckets[key]) buckets[key] = { opens: 0, clicks: 0 };
      if (e.event_type === "open") buckets[key].opens++; else buckets[key].clicks++;
    });
    return Object.entries(buckets).sort((a, b) => a[0].localeCompare(b[0])).map(([date, d]) => ({ date: date.slice(5), ...d }));
  }, [campaignEvents]);

  const campaignPie = useMemo(() => {
    if (selectedCampaignId) return [];
    const campStats: Record<string, number> = {};
    events.filter(e => e.event_type === "open").forEach(e => {
      const camp = campaigns.find(c => c.id === e.campaign_id);
      campStats[camp?.name || "Unknown"] = (campStats[camp?.name || "Unknown"] || 0) + 1;
    });
    return Object.entries(campStats).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  }, [events, campaigns, selectedCampaignId]);

  const getGroupName = (id: string) => groups.find(g => g.id === id)?.name || "Unknown";
  const getGroupContacts = (id: string) => contacts.filter(c => c.group_id === id);

  const filteredUsers = useMemo(() => {
    const existingEmails = new Set(selectedGroupId ? getGroupContacts(selectedGroupId).map(c => c.email?.toLowerCase()) : []);
    return allProfiles.filter(p => {
      if (!p.email) return false;
      if (existingEmails.has(p.email.toLowerCase())) return false;
      if (!userSearchQuery) return true;
      const q = userSearchQuery.toLowerCase();
      return p.email.toLowerCase().includes(q) || p.display_name?.toLowerCase().includes(q);
    });
  }, [allProfiles, selectedGroupId, contacts, userSearchQuery]);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-[hsl(0,0%,92%)] text-[hsl(0,0%,35%)]",
      scheduled: "bg-[hsl(45,90%,90%)] text-[hsl(45,80%,30%)]",
      sending: "bg-[hsl(200,80%,90%)] text-[hsl(200,70%,30%)]",
      sent: "bg-[hsl(142,60%,90%)] text-[hsl(142,50%,25%)]",
    };
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors[status] || colors.draft}`}>{status}</span>;
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-[hsl(0,0%,50%)]"><Mail className="animate-pulse mr-2" size={20} />Loading...</div>;

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-lg p-1">
          <TabsTrigger value="groups" className="text-xs data-[state=active]:bg-[hsl(0,0%,0%)] data-[state=active]:text-[hsl(0,0%,100%)]"><Users size={14} className="mr-1.5" />Groups</TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs data-[state=active]:bg-[hsl(0,0%,0%)] data-[state=active]:text-[hsl(0,0%,100%)]"><Mail size={14} className="mr-1.5" />Campaigns</TabsTrigger>
          <TabsTrigger value="templates" className="text-xs data-[state=active]:bg-[hsl(0,0%,0%)] data-[state=active]:text-[hsl(0,0%,100%)]"><Palette size={14} className="mr-1.5" />Templates</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs data-[state=active]:bg-[hsl(0,0%,0%)] data-[state=active]:text-[hsl(0,0%,100%)]"><BarChart3 size={14} className="mr-1.5" />Analytics</TabsTrigger>
        </TabsList>

        {/* ===== GROUPS TAB ===== */}
        <TabsContent value="groups" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">Contact Groups</h2>
              <p className="text-xs text-[hsl(0,0%,50%)]">{groups.length} groups, {contacts.length} total contacts</p>
            </div>
            <Button size="sm" onClick={() => { setGroupName(""); setGroupDesc(""); setEditingGroupId(null); setGroupDialog(true); }} className="text-xs bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]">
              <Plus size={14} className="mr-1" /> New Group
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups.map(g => {
              const gc = getGroupContacts(g.id);
              return (
                <div key={g.id} className={`bg-[hsl(0,0%,100%)] border rounded-xl p-4 cursor-pointer transition-all ${selectedGroupId === g.id ? "border-[hsl(0,0%,0%)] shadow-md" : "border-[hsl(0,0%,90%)] hover:border-[hsl(0,0%,70%)]"}`} onClick={() => setSelectedGroupId(selectedGroupId === g.id ? null : g.id)}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-display font-semibold text-sm text-[hsl(0,0%,5%)]">{g.name}</h3>
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setGroupName(g.name); setGroupDesc(g.description || ""); setEditingGroupId(g.id); setGroupDialog(true); }} className="p-1 rounded hover:bg-[hsl(0,0%,93%)]"><Mail size={12} className="text-[hsl(0,0%,50%)]" /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }} className="p-1 rounded hover:bg-red-50"><Trash2 size={12} className="text-red-400" /></button>
                    </div>
                  </div>
                  {g.description && <p className="text-[11px] text-[hsl(0,0%,50%)] mb-2">{g.description}</p>}
                  <div className="flex items-center gap-1 text-[hsl(0,0%,40%)]">
                    <Users size={12} />
                    <span className="text-xs font-mono">{gc.length} contacts</span>
                  </div>
                </div>
              );
            })}
            {groups.length === 0 && <div className="col-span-3 text-center py-12 text-[hsl(0,0%,55%)] text-sm">No groups yet. Create one to start.</div>}
          </div>

          {/* Contacts for selected group */}
          {selectedGroupId && (
            <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[hsl(0,0%,93%)] flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">
                  Contacts in "{groups.find(g => g.id === selectedGroupId)?.name}"
                </h3>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setAddUsersDialog(true)} className="text-xs">
                    <UserPlus size={12} className="mr-1" />Add Users
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setBulkMode("paste"); setBulkEmails(""); setBulkDialog(true); }} className="text-xs">
                    <Upload size={12} className="mr-1" />Bulk Add
                  </Button>
                  <Button size="sm" onClick={() => { setContactEmail(""); setContactName(""); setContactDialog(true); }} className="text-xs bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]">
                    <Plus size={12} className="mr-1" /> Add Contact
                  </Button>
                </div>
              </div>
              <div className="max-h-[400px] overflow-auto">
                {getGroupContacts(selectedGroupId).map(c => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-2.5 border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)]">
                    <div>
                      <p className="text-xs font-medium text-[hsl(0,0%,15%)]">{c.email}</p>
                      {c.name && <p className="text-[10px] text-[hsl(0,0%,50%)]">{c.name}</p>}
                    </div>
                    <button onClick={() => deleteContact(c.id)} className="p-1 rounded hover:bg-red-50"><Trash2 size={12} className="text-red-400" /></button>
                  </div>
                ))}
                {getGroupContacts(selectedGroupId).length === 0 && <p className="text-xs text-[hsl(0,0%,55%)] text-center py-8">No contacts in this group</p>}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== CAMPAIGNS TAB ===== */}
        <TabsContent value="campaigns" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">Campaigns</h2>
              <p className="text-xs text-[hsl(0,0%,50%)]">{campaigns.length} total campaigns</p>
            </div>
            <Button size="sm" onClick={() => { closeCampaignDialog(); setCampaignDialog(true); }} className="text-xs bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]">
              <Plus size={14} className="mr-1" /> New Campaign
            </Button>
          </div>

          <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[hsl(0,0%,45%)] border-b border-[hsl(0,0%,92%)]">
                  <th className="px-5 py-3 font-medium">Campaign</th>
                  <th className="px-5 py-3 font-medium">Group</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Recipients</th>
                  <th className="px-5 py-3 font-medium">Sent At</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => {
                  const campEvents = events.filter(e => e.campaign_id === c.id);
                  const opens = new Set(campEvents.filter(e => e.event_type === "open").map(e => e.contact_email)).size;
                  const sentCount = campEvents.filter(e => e.event_type === "sent").length;
                  const openRate = sentCount > 0 ? ((opens / sentCount) * 100).toFixed(1) : "0";
                  return (
                    <tr key={c.id} className="border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)]">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-[hsl(0,0%,10%)]">{c.name}</p>
                        <p className="text-[10px] text-[hsl(0,0%,50%)]">{c.subject}</p>
                      </td>
                      <td className="px-5 py-3 text-xs text-[hsl(0,0%,40%)]">{c.group_id ? getGroupName(c.group_id) : "—"}</td>
                      <td className="px-5 py-3">{statusBadge(c.status)}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-mono text-[hsl(0,0%,30%)]">{c.total_recipients}</span>
                        {sentCount > 0 && <span className="text-[10px] text-[hsl(142,50%,40%)] ml-1.5">{openRate}% opened</span>}
                      </td>
                      <td className="px-5 py-3 text-xs text-[hsl(0,0%,50%)]">{c.sent_at ? new Date(c.sent_at).toLocaleString() : c.scheduled_at ? `Scheduled: ${new Date(c.scheduled_at).toLocaleString()}` : "—"}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          {(c.status === "draft" || c.status === "scheduled") && (
                            <>
                              <button onClick={() => {
                                setCampaignName(c.name); setCampaignSubject(c.subject); setCampaignHtml(c.html_content);
                                setCampaignGroupId(c.group_id || ""); setCampaignScheduleAt(c.scheduled_at ? c.scheduled_at.slice(0, 16) : "");
                                setEditingCampaignId(c.id); setEditorMode("code"); setCampaignDialog(true);
                              }} className="px-2 py-1 rounded text-[10px] bg-[hsl(0,0%,93%)] hover:bg-[hsl(0,0%,88%)]">Edit</button>
                              <button disabled={sending} onClick={() => sendCampaign(c.id)} className="px-2 py-1 rounded text-[10px] bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)] flex items-center gap-1">
                                <Send size={10} /> Send Now
                              </button>
                            </>
                          )}
                          {c.status === "sent" && (
                            <button onClick={() => { setSelectedCampaignId(c.id); setActiveTab("analytics"); }} className="px-2 py-1 rounded text-[10px] bg-[hsl(200,70%,93%)] text-[hsl(200,70%,30%)] hover:bg-[hsl(200,70%,88%)]">
                              <BarChart3 size={10} className="inline mr-1" />Stats
                            </button>
                          )}
                          <button onClick={() => deleteCampaign(c.id)} className="px-2 py-1 rounded text-[10px] text-red-500 hover:bg-red-50"><Trash2 size={10} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {campaigns.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-[hsl(0,0%,55%)] text-sm">No campaigns yet</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ===== TEMPLATES TAB ===== */}
        <TabsContent value="templates" className="space-y-4 mt-4">
          <div>
            <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">Email Template Builder</h2>
            <p className="text-xs text-[hsl(0,0%,50%)]">Build, save, and reuse email templates with the visual builder or HTML editor</p>
          </div>
          <EmailTemplateBuilder onUseTemplate={(html) => {
            setCampaignHtml(html);
            setEditorMode("code");
            setActiveTab("campaigns");
            setCampaignDialog(true);
            toast.success("Template loaded into campaign composer");
          }} />
        </TabsContent>

        {/* ===== ANALYTICS TAB ===== */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">Campaign Analytics</h2>
              <p className="text-xs text-[hsl(0,0%,50%)]">{selectedCampaignId ? campaigns.find(c => c.id === selectedCampaignId)?.name : "All campaigns"}</p>
            </div>
            <Select value={selectedCampaignId || "all"} onValueChange={v => setSelectedCampaignId(v === "all" ? null : v)}>
              <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="All Campaigns" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                {campaigns.filter(c => c.status === "sent").map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Emails Sent", value: stats.sent.toLocaleString(), icon: <Send size={16} /> },
              { label: "Unique Opens", value: stats.opened.toLocaleString(), icon: <Eye size={16} /> },
              { label: "Open Rate", value: `${stats.openRate}%`, icon: <TrendingUp size={16} /> },
              { label: "Unique Clicks", value: stats.clicked.toLocaleString(), icon: <MousePointer size={16} /> },
              { label: "Click Rate", value: `${stats.clickRate}%`, icon: <MousePointer size={16} /> },
            ].map(c => (
              <div key={c.label} className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-[hsl(0,0%,45%)] uppercase tracking-wider">{c.label}</span>
                  <span className="text-[hsl(0,0%,60%)]">{c.icon}</span>
                </div>
                <p className="text-xl font-display font-bold text-[hsl(0,0%,5%)]">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={16} className="text-[hsl(0,0%,40%)]" />
              <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">AI Recommended Best Time to Send</h3>
              <span className="text-[9px] bg-[hsl(270,60%,93%)] text-[hsl(270,50%,35%)] px-2 py-0.5 rounded-full font-medium">AI</span>
            </div>
            <p className="text-2xl font-display font-bold text-[hsl(0,0%,5%)] mb-1">{bestHour}</p>
            <p className="text-[11px] text-[hsl(0,0%,50%)]">Based on open rate analysis across your campaigns. Contacts are most engaged at this hour.</p>
          </div>

          <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-[hsl(0,0%,40%)]" />
              <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">Opens by Hour of Day</h3>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={opensByHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,93%)" />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "hsl(0,0%,55%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(0,0%,55%)" }} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{ background: "#000", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }} />
                <Bar dataKey="opens" fill="hsl(0,0%,15%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Eye size={16} className="text-[hsl(0,0%,40%)]" />
                <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">Engagement Over Time</h3>
              </div>
              {opensTimeline.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={opensTimeline}>
                    <defs>
                      <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142,70%,45%)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(142,70%,45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,93%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(0,0%,55%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(0,0%,55%)" }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{ background: "#000", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }} />
                    <Area type="monotone" dataKey="opens" stroke="hsl(142,70%,45%)" strokeWidth={2} fill="url(#openGrad)" name="Opens" />
                    <Area type="monotone" dataKey="clicks" stroke="hsl(200,70%,50%)" strokeWidth={2} fill="transparent" name="Clicks" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-[hsl(0,0%,55%)] text-center py-12">No engagement data yet</p>}
            </div>

            <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={16} className="text-[hsl(0,0%,40%)]" />
                <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">Opens by Campaign</h3>
              </div>
              {campaignPie.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={campaignPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35} strokeWidth={0}>
                        {campaignPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip contentStyle={{ background: "#000", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {campaignPie.map((s, i) => (
                      <div key={s.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-[hsl(0,0%,30%)] truncate max-w-[150px]">{s.name}</span>
                        </div>
                        <span className="font-mono text-[hsl(0,0%,50%)]">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-xs text-[hsl(0,0%,55%)] text-center py-12">{selectedCampaignId ? "Viewing single campaign" : "No data yet"}</p>}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== GROUP DIALOG ===== */}
      <Dialog open={groupDialog} onOpenChange={setGroupDialog}>
         <DialogContent className={LIGHT_DIALOG_CLASS} style={LIGHT_COLOR_SCHEME}>
          <DialogHeader><DialogTitle className="font-display text-black">{editingGroupId ? "Edit Group" : "New Group"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs text-[hsl(var(--muted-foreground))]">Group Name</Label><Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Newsletter Subscribers" className={LIGHT_FIELD_CLASS} style={LIGHT_COLOR_SCHEME} /></div>
            <div><Label className="text-xs text-[hsl(var(--muted-foreground))]">Description</Label><Input value={groupDesc} onChange={e => setGroupDesc(e.target.value)} placeholder="Optional description" className={LIGHT_FIELD_CLASS} style={LIGHT_COLOR_SCHEME} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialog(false)} className="text-xs border-gray-300 text-black hover:bg-gray-100">Cancel</Button>
            <Button onClick={saveGroup} className="text-xs bg-black text-white hover:bg-gray-800">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== CONTACT DIALOG ===== */}
      <Dialog open={contactDialog} onOpenChange={setContactDialog}>
         <DialogContent className={LIGHT_DIALOG_CLASS} style={LIGHT_COLOR_SCHEME}>
          <DialogHeader><DialogTitle className="font-display text-black">Add Contact</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs text-[hsl(var(--muted-foreground))]">Email</Label><Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="email@example.com" type="email" className={LIGHT_FIELD_CLASS} style={LIGHT_COLOR_SCHEME} /></div>
            <div><Label className="text-xs text-[hsl(var(--muted-foreground))]">Name (optional)</Label><Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="John Doe" className={LIGHT_FIELD_CLASS} style={LIGHT_COLOR_SCHEME} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactDialog(false)} className="text-xs border-gray-300 text-black hover:bg-gray-100">Cancel</Button>
            <Button onClick={addContact} className="text-xs bg-black text-white hover:bg-gray-800">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== BULK ADD DIALOG (CSV + Paste) ===== */}
      <Dialog open={bulkDialog} onOpenChange={setBulkDialog}>
         <DialogContent className={`${LIGHT_DIALOG_CLASS} max-w-lg`} style={LIGHT_COLOR_SCHEME}>
          <DialogHeader><DialogTitle className="font-display text-black">Bulk Add Contacts</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <button onClick={() => setBulkMode("paste")} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${bulkMode === "paste" ? "bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]" : "bg-[hsl(0,0%,95%)] text-[hsl(0,0%,45%)]"}`}>
                <FileText size={12} className="inline mr-1" />Copy & Paste
              </button>
              <button onClick={() => setBulkMode("csv")} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${bulkMode === "csv" ? "bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]" : "bg-[hsl(0,0%,95%)] text-[hsl(0,0%,45%)]"}`}>
                <FileUp size={12} className="inline mr-1" />Upload CSV
              </button>
            </div>

            {bulkMode === "csv" && (
              <div className="border-2 border-dashed border-[hsl(0,0%,85%)] rounded-lg p-6 text-center">
                <FileUp size={24} className="mx-auto mb-2 text-[hsl(0,0%,55%)]" />
                <p className="text-xs text-[hsl(0,0%,50%)] mb-2">Upload a CSV file with emails (one per line or comma-separated)</p>
                <p className="text-[10px] text-[hsl(0,0%,65%)] mb-3">Supports: name,email or email,name or just email per row</p>
                <input ref={csvInputRef} type="file" accept=".csv,.txt" onChange={handleCsvUpload} className="hidden" />
                <Button size="sm" variant="outline" onClick={() => csvInputRef.current?.click()} className="text-xs">
                  <Upload size={12} className="mr-1" />Choose File
                </Button>
              </div>
            )}

            {(bulkMode === "paste" || bulkEmails) && (
              <div>
                <p className="text-xs text-[hsl(0,0%,50%)] mb-1">
                  {bulkMode === "csv" ? "CSV content loaded — review and add:" : "Paste emails below (comma, semicolon, tab, or newline separated):"}
                </p>
                <Textarea value={bulkEmails} onChange={e => setBulkEmails(e.target.value)} rows={8} placeholder={"John Doe, john@example.com\njane@example.com\nBob, bob@company.com"} className={`font-mono text-xs ${LIGHT_FIELD_CLASS}`} style={LIGHT_COLOR_SCHEME} />
                {bulkEmails && (
                  <p className="text-[10px] text-[hsl(0,0%,55%)] mt-1">
                    {parseEmailsFromText(bulkEmails).length} valid emails detected
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(false)} className="text-xs">Cancel</Button>
            <Button onClick={bulkAddContacts} className="text-xs bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]">
              Add {bulkEmails ? parseEmailsFromText(bulkEmails).length : 0} Contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ADD REGISTERED USERS DIALOG ===== */}
      <Dialog open={addUsersDialog} onOpenChange={setAddUsersDialog}>
         <DialogContent className={`${LIGHT_DIALOG_CLASS} max-w-lg`} style={LIGHT_COLOR_SCHEME}>
          <DialogHeader><DialogTitle className="font-display text-black">Add Registered Users</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={userSearchQuery} onChange={e => setUserSearchQuery(e.target.value)} placeholder="Search by name or email..." className={`text-xs ${LIGHT_FIELD_CLASS}`} style={LIGHT_COLOR_SCHEME} />
              <Button size="sm" onClick={addAllRegisteredUsers} className="text-xs bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] whitespace-nowrap">
                Add All ({allProfiles.filter(p => p.email).length})
              </Button>
            </div>
            <div className="max-h-[350px] overflow-auto border border-[hsl(0,0%,90%)] rounded-lg">
              {filteredUsers.slice(0, 100).map(u => (
                <div key={u.user_id} className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)]">
                  <div>
                    <p className="text-xs font-medium text-[hsl(0,0%,15%)]">{u.display_name || "—"}</p>
                    <p className="text-[10px] text-[hsl(0,0%,50%)]">{u.email}</p>
                  </div>
                  <Button size="sm" variant="outline" disabled={addingUserId === u.user_id} onClick={() => addRegisteredUsers([u.user_id], false)} className="text-[10px] h-7 px-2">
                    {addingUserId === u.user_id ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <><Plus size={10} className="mr-1" />Add</>}
                  </Button>
                </div>
              ))}
              {filteredUsers.length === 0 && <p className="text-xs text-[hsl(0,0%,55%)] text-center py-8">No more users to add</p>}
              {filteredUsers.length > 100 && <p className="text-[10px] text-[hsl(0,0%,55%)] text-center py-2">Showing first 100 of {filteredUsers.length}</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== CAMPAIGN DIALOG (with templates + code editor) ===== */}
      <Dialog open={campaignDialog} onOpenChange={v => { if (!v) closeCampaignDialog(); else setCampaignDialog(true); }}>
         <DialogContent className={`${LIGHT_DIALOG_CLASS} max-w-4xl max-h-[90vh] overflow-hidden flex flex-col`} style={LIGHT_COLOR_SCHEME}>
          <DialogHeader><DialogTitle className="font-display text-black">{editingCampaignId ? "Edit Campaign" : "New Campaign"}</DialogTitle></DialogHeader>
          <div className="space-y-3 flex-1 overflow-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-xs text-[hsl(var(--muted-foreground))]">Campaign Name</Label><Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Welcome Series #1" className={LIGHT_FIELD_CLASS} style={LIGHT_COLOR_SCHEME} /></div>
              <div><Label className="text-xs text-[hsl(var(--muted-foreground))]">Subject Line</Label><Input value={campaignSubject} onChange={e => setCampaignSubject(e.target.value)} placeholder="e.g. Welcome to Funding Pulze!" className={LIGHT_FIELD_CLASS} style={LIGHT_COLOR_SCHEME} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Target Group</Label>
                <Select value={campaignGroupId} onValueChange={setCampaignGroupId}>
                  <SelectTrigger className={`text-xs ${LIGHT_FIELD_CLASS}`} style={LIGHT_COLOR_SCHEME}><SelectValue placeholder="Select group" /></SelectTrigger>
                  <SelectContent className={LIGHT_DIALOG_CLASS}>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name} ({getGroupContacts(g.id).length} contacts)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Schedule (optional)</Label>
                <Input type="datetime-local" value={campaignScheduleAt} onChange={e => setCampaignScheduleAt(e.target.value)} className={LIGHT_FIELD_CLASS} style={LIGHT_COLOR_SCHEME} />
              </div>
            </div>

            {/* Editor Mode Toggle */}
            <div className="flex items-center gap-2 pt-2">
              <Label className="text-xs font-semibold">Email Content</Label>
              <div className="flex gap-1 bg-[hsl(0,0%,95%)] rounded-lg p-0.5">
                <button onClick={() => setEditorMode("templates")} className={`px-3 py-1 rounded-md text-[10px] font-medium transition-all ${editorMode === "templates" ? "bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]" : "text-[hsl(0,0%,50%)]"}`}>
                  <Layout size={10} className="inline mr-1" />Templates
                </button>
                <button onClick={() => setEditorMode("code")} className={`px-3 py-1 rounded-md text-[10px] font-medium transition-all ${editorMode === "code" ? "bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]" : "text-[hsl(0,0%,50%)]"}`}>
                  <Code size={10} className="inline mr-1" />HTML Code
                </button>
              </div>
              {campaignHtml && (
                <button onClick={() => setShowPreview(!showPreview)} className="ml-auto text-[10px] px-3 py-1 rounded-md bg-[hsl(200,70%,93%)] text-[hsl(200,70%,30%)] hover:bg-[hsl(200,70%,88%)] flex items-center gap-1">
                  <Eye size={10} />{showPreview ? "Hide Preview" : "Preview"}
                </button>
              )}
            </div>

            {/* Templates Grid */}
            {editorMode === "templates" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {EMAIL_TEMPLATES.map((t, i) => (
                  <div key={i} onClick={() => { setCampaignHtml(t.html); setEditorMode("code"); toast.success(`"${t.name}" template loaded`); }}
                    className="bg-[hsl(0,0%,98%)] border border-[hsl(0,0%,90%)] rounded-lg p-4 cursor-pointer hover:border-[hsl(0,0%,60%)] hover:shadow-sm transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <Layout size={14} className="text-[hsl(0,0%,40%)]" />
                      <h4 className="text-xs font-semibold text-[hsl(0,0%,10%)]">{t.name}</h4>
                    </div>
                    <p className="text-[10px] text-[hsl(0,0%,50%)] leading-relaxed">{t.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Code Editor */}
            {editorMode === "code" && (
              <div className={`grid ${showPreview ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"} gap-3`}>
                <div>
                  <Textarea value={campaignHtml} onChange={e => setCampaignHtml(e.target.value)} rows={16} placeholder={"<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    /* Your CSS here */\n  </style>\n</head>\n<body>\n  <h1>Hello!</h1>\n  <p>Your email content here...</p>\n</body>\n</html>"} className={`font-mono text-xs leading-relaxed ${LIGHT_FIELD_CLASS}`} style={LIGHT_COLOR_SCHEME} />
                  <p className="text-[10px] text-[hsl(0,0%,55%)] mt-1">Full HTML + CSS supported. Links will be auto-tracked for click analytics.</p>
                </div>
                {showPreview && (
                  <div className="border border-[hsl(0,0%,90%)] rounded-lg overflow-hidden bg-[hsl(0,0%,98%)]">
                    <div className="px-3 py-1.5 bg-[hsl(0,0%,95%)] border-b border-[hsl(0,0%,90%)] flex items-center gap-1.5">
                      <Eye size={10} className="text-[hsl(0,0%,50%)]" />
                      <span className="text-[10px] font-medium text-[hsl(0,0%,45%)]">Live Preview</span>
                    </div>
                    <iframe srcDoc={campaignHtml} className="w-full h-[380px] border-0" sandbox="allow-same-origin" title="Email Preview" />
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 pt-3 border-t border-[hsl(0,0%,93%)]">
            <Button variant="outline" onClick={closeCampaignDialog} className="text-xs">Cancel</Button>
            <Button onClick={saveCampaign} className="text-xs bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]">
              {campaignScheduleAt ? <><Calendar size={12} className="mr-1" />Schedule</> : "Save Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
