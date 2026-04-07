import { useState, useEffect, useMemo } from "react";
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
  Mail, Eye, MousePointer, TrendingUp, Upload,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { toast } from "sonner";

const PIE_COLORS = ["hsl(142,70%,45%)", "hsl(200,70%,50%)", "hsl(45,90%,55%)", "hsl(0,70%,55%)", "hsl(270,60%,55%)", "hsl(30,80%,50%)"];

export default function EmailMarketing() {
  const [activeTab, setActiveTab] = useState("groups");
  const [groups, setGroups] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [g, co, ca, ev] = await Promise.all([
      supabase.from("email_groups").select("*").order("created_at", { ascending: false }),
      supabase.from("email_group_contacts").select("*").order("created_at", { ascending: false }),
      supabase.from("email_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("email_campaign_events").select("*").order("created_at", { ascending: false }),
    ]);
    if (g.data) setGroups(g.data);
    if (co.data) setContacts(co.data);
    if (ca.data) setCampaigns(ca.data);
    if (ev.data) setEvents(ev.data);
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

  const bulkAddContacts = async () => {
    if (!selectedGroupId || !bulkEmails.trim()) { toast.error("Enter emails"); return; }
    const emails = bulkEmails.split(/[\n,;]+/).map(e => e.trim().toLowerCase()).filter(e => e && e.includes("@"));
    if (emails.length === 0) { toast.error("No valid emails found"); return; }
    const rows = emails.map(email => ({ group_id: selectedGroupId, email, name: null }));
    const { error } = await supabase.from("email_group_contacts").upsert(rows, { onConflict: "group_id,email" });
    if (error) { toast.error(error.message); return; }
    toast.success(`${emails.length} contacts added`); setBulkDialog(false); setBulkEmails(""); fetchAll();
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
    setEditingCampaignId(null);
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
    return {
      sent,
      opened,
      clicked,
      openRate: sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0",
      clickRate: sent > 0 ? ((clicked / sent) * 100).toFixed(1) : "0",
    };
  }, [campaignEvents]);

  // Opens by hour (for "best time to send")
  const opensByHour = useMemo(() => {
    const hours: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hours[i] = 0;
    campaignEvents.filter(e => e.event_type === "open").forEach(e => {
      const h = new Date(e.created_at).getHours();
      hours[h]++;
    });
    return Object.entries(hours).map(([hour, count]) => ({
      hour: `${String(hour).padStart(2, "0")}:00`,
      opens: count,
    }));
  }, [campaignEvents]);

  const bestHour = useMemo(() => {
    const sorted = [...opensByHour].sort((a, b) => b.opens - a.opens);
    return sorted[0]?.opens > 0 ? sorted[0].hour : "N/A";
  }, [opensByHour]);

  // Opens over time
  const opensTimeline = useMemo(() => {
    const buckets: Record<string, { opens: number; clicks: number }> = {};
    campaignEvents.filter(e => e.event_type === "open" || e.event_type === "click").forEach(e => {
      const key = e.created_at?.slice(0, 10);
      if (!buckets[key]) buckets[key] = { opens: 0, clicks: 0 };
      if (e.event_type === "open") buckets[key].opens++;
      else buckets[key].clicks++;
    });
    return Object.entries(buckets).sort((a, b) => a[0].localeCompare(b[0])).map(([date, d]) => ({ date: date.slice(5), ...d }));
  }, [campaignEvents]);

  // Campaign performance pie
  const campaignPie = useMemo(() => {
    if (selectedCampaignId) return [];
    const campStats: Record<string, number> = {};
    events.filter(e => e.event_type === "open").forEach(e => {
      const camp = campaigns.find(c => c.id === e.campaign_id);
      const name = camp?.name || "Unknown";
      campStats[name] = (campStats[name] || 0) + 1;
    });
    return Object.entries(campStats).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  }, [events, campaigns, selectedCampaignId]);

  const getGroupName = (id: string) => groups.find(g => g.id === id)?.name || "Unknown";
  const getGroupContacts = (id: string) => contacts.filter(c => c.group_id === id);

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
              <div className="px-5 py-3 border-b border-[hsl(0,0%,93%)] flex items-center justify-between">
                <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">
                  Contacts in "{groups.find(g => g.id === selectedGroupId)?.name}"
                </h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setBulkDialog(true)} className="text-xs"><Upload size={12} className="mr-1" />Bulk Add</Button>
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
                                setEditingCampaignId(c.id); setCampaignDialog(true);
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

        {/* ===== ANALYTICS TAB ===== */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">Campaign Analytics</h2>
              <p className="text-xs text-[hsl(0,0%,50%)]">{selectedCampaignId ? campaigns.find(c => c.id === selectedCampaignId)?.name : "All campaigns"}</p>
            </div>
            <div className="flex gap-2">
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
          </div>

          {/* Stats Cards */}
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

          {/* AI Recommended Best Time */}
          <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={16} className="text-[hsl(0,0%,40%)]" />
              <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">AI Recommended Best Time to Send</h3>
              <span className="text-[9px] bg-[hsl(270,60%,93%)] text-[hsl(270,50%,35%)] px-2 py-0.5 rounded-full font-medium">AI</span>
            </div>
            <p className="text-2xl font-display font-bold text-[hsl(0,0%,5%)] mb-1">{bestHour}</p>
            <p className="text-[11px] text-[hsl(0,0%,50%)]">Based on open rate analysis across your campaigns. Contacts are most engaged at this hour.</p>
          </div>

          {/* Opens by Hour */}
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
            {/* Opens & Clicks over time */}
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
              ) : (
                <p className="text-xs text-[hsl(0,0%,55%)] text-center py-12">No engagement data yet</p>
              )}
            </div>

            {/* Campaign performance pie */}
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
              ) : (
                <p className="text-xs text-[hsl(0,0%,55%)] text-center py-12">{selectedCampaignId ? "Viewing single campaign" : "No data yet"}</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== GROUP DIALOG ===== */}
      <Dialog open={groupDialog} onOpenChange={setGroupDialog}>
        <DialogContent className="bg-[hsl(0,0%,100%)] border-[hsl(0,0%,90%)]">
          <DialogHeader><DialogTitle className="font-display">{editingGroupId ? "Edit Group" : "New Group"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Group Name</Label><Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Newsletter Subscribers" /></div>
            <div><Label className="text-xs">Description</Label><Input value={groupDesc} onChange={e => setGroupDesc(e.target.value)} placeholder="Optional description" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialog(false)} className="text-xs">Cancel</Button>
            <Button onClick={saveGroup} className="text-xs bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== CONTACT DIALOG ===== */}
      <Dialog open={contactDialog} onOpenChange={setContactDialog}>
        <DialogContent className="bg-[hsl(0,0%,100%)] border-[hsl(0,0%,90%)]">
          <DialogHeader><DialogTitle className="font-display">Add Contact</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Email</Label><Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="email@example.com" type="email" /></div>
            <div><Label className="text-xs">Name (optional)</Label><Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="John Doe" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactDialog(false)} className="text-xs">Cancel</Button>
            <Button onClick={addContact} className="text-xs bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== BULK ADD DIALOG ===== */}
      <Dialog open={bulkDialog} onOpenChange={setBulkDialog}>
        <DialogContent className="bg-[hsl(0,0%,100%)] border-[hsl(0,0%,90%)]">
          <DialogHeader><DialogTitle className="font-display">Bulk Add Contacts</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-[hsl(0,0%,50%)]">Paste emails separated by commas, semicolons, or new lines</p>
            <Textarea value={bulkEmails} onChange={e => setBulkEmails(e.target.value)} rows={8} placeholder="email1@example.com&#10;email2@example.com&#10;email3@example.com" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(false)} className="text-xs">Cancel</Button>
            <Button onClick={bulkAddContacts} className="text-xs bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]">Add All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== CAMPAIGN DIALOG ===== */}
      <Dialog open={campaignDialog} onOpenChange={v => { if (!v) closeCampaignDialog(); else setCampaignDialog(true); }}>
        <DialogContent className="bg-[hsl(0,0%,100%)] border-[hsl(0,0%,90%)] max-w-2xl">
          <DialogHeader><DialogTitle className="font-display">{editingCampaignId ? "Edit Campaign" : "New Campaign"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-auto pr-2">
            <div><Label className="text-xs">Campaign Name</Label><Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Welcome Series #1" /></div>
            <div><Label className="text-xs">Subject Line</Label><Input value={campaignSubject} onChange={e => setCampaignSubject(e.target.value)} placeholder="e.g. Welcome to Funding Pulze!" /></div>
            <div>
              <Label className="text-xs">Target Group</Label>
              <Select value={campaignGroupId} onValueChange={setCampaignGroupId}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Select group" /></SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name} ({getGroupContacts(g.id).length} contacts)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Schedule (optional)</Label>
              <Input type="datetime-local" value={campaignScheduleAt} onChange={e => setCampaignScheduleAt(e.target.value)} />
              <p className="text-[10px] text-[hsl(0,0%,55%)] mt-1">Leave empty to save as draft</p>
            </div>
            <div>
              <Label className="text-xs">Email HTML Content</Label>
              <Textarea value={campaignHtml} onChange={e => setCampaignHtml(e.target.value)} rows={12} placeholder="<h1>Hello!</h1><p>Your email content here...</p>" className="font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
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
