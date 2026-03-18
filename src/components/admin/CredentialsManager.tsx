import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Key, CheckCircle2, FolderOpen, ChevronDown, ChevronRight, Search, Settings, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Credential {
  id: string;
  challenge_id: string;
  mt5_login: string;
  mt5_password: string;
  mt5_server: string;
  is_assigned: boolean;
  assigned_to: string | null;
  purchase_id: string | null;
  created_at: string;
}

interface Challenge {
  id: string;
  name: string;
  account_size: number;
  step_type: string;
}

const CredentialsManager = () => {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkChallengeId, setBulkChallengeId] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [defaultServer, setDefaultServer] = useState(() => {
    return localStorage.getItem("fp_default_server") || "OctaFX-Demo";
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [pendingPurchases, setPendingPurchases] = useState<any[]>([]);
  const [assigning, setAssigning] = useState(false);

  const [form, setForm] = useState({
    challenge_id: "",
    mt5_login: "",
    mt5_password: "",
    mt5_server: "",
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [credRes, chalRes] = await Promise.all([
      supabase.from("trading_credentials").select("*").order("created_at", { ascending: false }),
      supabase.from("challenges").select("id, name, account_size, step_type").order("account_size"),
    ]);
    if (credRes.data) setCredentials(credRes.data as any);
    if (chalRes.data) {
      setChallenges(chalRes.data);
      if (chalRes.data[0]) {
        if (!form.challenge_id) setForm(f => ({ ...f, challenge_id: chalRes.data[0].id }));
        if (!bulkChallengeId) setBulkChallengeId(chalRes.data[0].id);
      }
    }
    setLoading(false);
  };

  const toggleFolder = (challengeId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(challengeId)) next.delete(challengeId);
      else next.add(challengeId);
      return next;
    });
  };

  const getChallengeLabel = (c: Challenge) => `$${c.account_size.toLocaleString()} - ${c.step_type === "1-step" ? "1 Step" : "2 Step"}`;

  const saveCredential = async () => {
    setSaving(true);
    const { error } = await supabase.from("trading_credentials").insert({
      challenge_id: form.challenge_id,
      mt5_login: form.mt5_login.trim(),
      mt5_password: form.mt5_password.trim(),
      mt5_server: (form.mt5_server.trim() || defaultServer),
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Credential added!");
    setDialogOpen(false);
    setSaving(false);
    setForm(f => ({ ...f, mt5_login: "", mt5_password: "", mt5_server: "" }));
    fetchData();
  };

  const bulkImport = async () => {
    if (!bulkChallengeId || !bulkText.trim()) return;
    setSaving(true);
    const lines = bulkText.trim().split("\n").filter(l => l.trim());
    const records = lines.map(line => {
      const parts = line.split(/[,\t]+/).map(s => s.trim());
      return {
        challenge_id: bulkChallengeId,
        mt5_login: parts[0] || "",
        mt5_password: parts[1] || "",
        mt5_server: parts[2] || defaultServer,
      };
    }).filter(r => r.mt5_login && r.mt5_password);

    if (records.length === 0) { toast.error("No valid credentials found"); setSaving(false); return; }

    const { error } = await supabase.from("trading_credentials").insert(records);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success(`${records.length} credentials imported!`);
    setBulkDialogOpen(false);
    setBulkText("");
    setSaving(false);
    fetchData();
  };

  const deleteCredential = async (id: string) => {
    if (!confirm("Delete this credential?")) return;
    const { error } = await supabase.from("trading_credentials").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    fetchData();
  };

  // Fetch purchases that are confirmed/completed but have no credentials assigned
  const fetchPending = async () => {
    // Get all confirmed/completed purchases
    const { data: purchases } = await supabase
      .from("challenge_purchases")
      .select("id, challenge_id, user_id, payment_status, created_at, challenges(name, account_size, step_type)")
      .in("payment_status", ["confirmed", "completed", "paid"])
      .order("created_at", { ascending: false });
    if (!purchases) return;
    // Get all assigned credential purchase_ids
    const { data: assignedCreds } = await supabase
      .from("trading_credentials")
      .select("purchase_id")
      .not("purchase_id", "is", null);
    const assignedPurchaseIds = new Set((assignedCreds || []).map(c => c.purchase_id));
    const pending = purchases.filter(p => !assignedPurchaseIds.has(p.id));
    setPendingPurchases(pending);
  };

  const openPendingDialog = async () => {
    await fetchPending();
    setPendingDialogOpen(true);
  };

  // Auto-assign credentials to all pending purchases
  const assignAllPending = async () => {
    setAssigning(true);
    let assigned = 0;
    let failed = 0;
    for (const p of pendingPurchases) {
      const { data: freeCred } = await supabase
        .from("trading_credentials")
        .select("id")
        .eq("challenge_id", p.challenge_id)
        .eq("is_assigned", false)
        .limit(1)
        .maybeSingle();
      if (freeCred) {
        const { error } = await supabase
          .from("trading_credentials")
          .update({
            is_assigned: true,
            assigned_to: p.user_id,
            assigned_at: new Date().toISOString(),
            purchase_id: p.id,
          })
          .eq("id", freeCred.id)
          .eq("is_assigned", false);
        if (!error) assigned++;
        else failed++;
      } else {
        failed++;
      }
    }
    toast.success(`${assigned} credentials assigned${failed > 0 ? `, ${failed} failed (no free creds)` : ""}`);
    setAssigning(false);
    fetchData();
    await fetchPending();
  };

  const grouped = (() => {
    const map = new Map<string, { challenge: Challenge; challengeIds: string[]; credentials: Credential[]; total: number; available: number; assigned: number }>();
    challenges.forEach(ch => {
      const label = getChallengeLabel(ch);
      const existing = map.get(label);
      const creds = credentials.filter(c => c.challenge_id === ch.id);
      const filtered = creds.filter(c => {
        if (search && !c.mt5_login.includes(search) && !c.mt5_server.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });
      if (existing) {
        existing.challengeIds.push(ch.id);
        existing.credentials.push(...filtered);
        existing.total += creds.length;
        existing.available += creds.filter(c => !c.is_assigned).length;
        existing.assigned += creds.filter(c => c.is_assigned).length;
      } else {
        map.set(label, { challenge: ch, challengeIds: [ch.id], credentials: filtered, total: creds.length, available: creds.filter(c => !c.is_assigned).length, assigned: creds.filter(c => c.is_assigned).length });
      }
    });
    return Array.from(map.values()).filter(g => g.total > 0 || !search);
  })();

  const totalAll = credentials.length;
  const availableAll = credentials.filter(c => !c.is_assigned).length;
  const assignedAll = credentials.filter(c => c.is_assigned).length;

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-5 h-5 border-2 border-[hsl(0,0%,30%)] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[hsl(0,0%,97%)] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[hsl(0,0%,5%)]">{totalAll}</p>
          <p className="text-xs text-[hsl(0,0%,50%)]">Total</p>
        </div>
        <div className="bg-[hsl(120,40%,96%)] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{availableAll}</p>
          <p className="text-xs text-[hsl(0,0%,50%)]">Available</p>
        </div>
        <div className="bg-[hsl(220,40%,96%)] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{assignedAll}</p>
          <p className="text-xs text-[hsl(0,0%,50%)]">Assigned</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(0,0%,50%)]" />
          <Input placeholder="Search login or server..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg text-sm" />
        </div>
        <Button size="sm" variant="outline" className="rounded-lg border-[hsl(0,0%,88%)]" onClick={() => setSettingsOpen(true)}>
          <Settings size={14} className="mr-1" /> Default Server
        </Button>
        <Button size="sm" className="rounded-lg bg-[hsl(0,0%,0%)] text-white hover:bg-[hsl(0,0%,15%)]" onClick={() => { setForm(f => ({ ...f, mt5_server: "" })); setDialogOpen(true); }}>
          <Plus size={14} className="mr-1" /> Add
        </Button>
        <Button size="sm" variant="outline" className="rounded-lg border-[hsl(0,0%,88%)]" onClick={() => setBulkDialogOpen(true)}>
          Bulk Import
        </Button>
        <Button size="sm" variant="outline" className="rounded-lg border-orange-300 text-orange-600 hover:bg-orange-50" onClick={openPendingDialog}>
          <AlertCircle size={14} className="mr-1" /> Pending
        </Button>
      </div>

      {/* Folder View */}
      <div className="space-y-2">
        {grouped.map(({ challenge, credentials: creds, total, available, assigned }) => {
          const isOpen = expandedFolders.has(challenge.id);
          return (
            <div key={challenge.id} className="bg-white rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
              {/* Folder Header */}
              <button
                onClick={() => toggleFolder(challenge.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[hsl(0,0%,98%)] transition-colors text-left"
              >
                {isOpen ? <ChevronDown size={16} className="text-[hsl(0,0%,40%)]" /> : <ChevronRight size={16} className="text-[hsl(0,0%,40%)]" />}
                <FolderOpen size={18} className="text-[hsl(40,80%,50%)]" />
                <span className="font-semibold text-sm text-[hsl(0,0%,10%)] flex-1">{getChallengeLabel(challenge)}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-[hsl(0,0%,50%)]">{total} total</span>
                  <span className="text-green-600">{available} free</span>
                  <span className="text-blue-600">{assigned} assigned</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setForm(f => ({ ...f, challenge_id: challenge.id, mt5_server: "" })); setDialogOpen(true); }}
                    className="ml-1 p-1 rounded-md hover:bg-[hsl(0,0%,92%)] text-[hsl(0,0%,40%)] hover:text-[hsl(0,0%,10%)] transition-colors"
                    title="Add credential to this folder"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </button>

              {/* Expanded Content */}
              {isOpen && (
                <div className="border-t border-[hsl(0,0%,92%)]">
                  {creds.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-[hsl(0,0%,50%)]">
                      No credentials in this folder.
                      <Button size="sm" variant="link" className="ml-2" onClick={() => { setForm(f => ({ ...f, challenge_id: challenge.id, mt5_server: "" })); setDialogOpen(true); }}>
                        Add one
                      </Button>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-[hsl(0,0%,50%)] border-b border-[hsl(0,0%,95%)]">
                          <th className="px-4 py-2">Login</th>
                          <th className="px-4 py-2">Password</th>
                          <th className="px-4 py-2">Server</th>
                          <th className="px-4 py-2">Status</th>
                          <th className="px-4 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {creds.map(c => (
                          <tr key={c.id} className="border-b border-[hsl(0,0%,97%)] last:border-0 text-sm hover:bg-[hsl(0,0%,99%)]">
                            <td className="px-4 py-2.5 font-mono text-[hsl(0,0%,20%)] font-medium">{c.mt5_login}</td>
                            <td className="px-4 py-2.5 font-mono text-[hsl(0,0%,35%)]">{c.mt5_password}</td>
                            <td className="px-4 py-2.5 text-[hsl(0,0%,45%)]">{c.mt5_server}</td>
                            <td className="px-4 py-2.5">
                              {c.is_assigned ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                                  <CheckCircle2 size={10} /> Assigned
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                                  <Key size={10} /> Free
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {!c.is_assigned && (
                                <button onClick={() => deleteCredential(c.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {grouped.length === 0 && (
          <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] p-10 text-center text-[hsl(0,0%,50%)] text-sm">
            No credentials yet. Add challenges first, then add credentials.
          </div>
        )}
      </div>

      {/* Add Single Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white border-[hsl(0,0%,90%)] rounded-2xl">
          <DialogHeader><DialogTitle className="text-[hsl(0,0%,5%)]">Add Credential</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">Challenge Folder</Label>
              <select value={form.challenge_id} onChange={e => setForm({ ...form, challenge_id: e.target.value })}
                className="mt-1 w-full rounded-lg bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,88%)] px-3 py-2 text-sm text-[hsl(0,0%,10%)]">
                {challenges.map(c => <option key={c.id} value={c.id} className="text-[hsl(0,0%,10%)]">{getChallengeLabel(c)}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">MT5 Login</Label>
              <Input value={form.mt5_login} onChange={e => setForm({ ...form, mt5_login: e.target.value })}
                className="mt-1 bg-white border-[hsl(0,0%,88%)] rounded-lg font-mono text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,60%)]" placeholder="12345678" />
            </div>
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">MT5 Password</Label>
              <Input value={form.mt5_password} onChange={e => setForm({ ...form, mt5_password: e.target.value })}
                className="mt-1 bg-white border-[hsl(0,0%,88%)] rounded-lg font-mono text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,60%)]" placeholder="password123" />
            </div>
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">Server <span className="text-[hsl(0,0%,70%)]">(leave blank for default: {defaultServer})</span></Label>
              <Input value={form.mt5_server} onChange={e => setForm({ ...form, mt5_server: e.target.value })}
                className="mt-1 bg-white border-[hsl(0,0%,88%)] rounded-lg text-[hsl(0,0%,10%)] placeholder:text-[hsl(0,0%,60%)]" placeholder={defaultServer} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg border-[hsl(0,0%,88%)]" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-lg bg-[hsl(0,0%,0%)] text-white hover:bg-[hsl(0,0%,15%)]" onClick={saveCredential}
              disabled={saving || !form.mt5_login || !form.mt5_password}>
              {saving ? "Saving..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="bg-white border-[hsl(0,0%,90%)] rounded-2xl">
          <DialogHeader><DialogTitle className="text-[hsl(0,0%,5%)]">Bulk Import Credentials</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">Challenge Folder</Label>
              <select value={bulkChallengeId} onChange={e => setBulkChallengeId(e.target.value)}
                className="mt-1 w-full rounded-lg bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,88%)] px-3 py-2 text-sm text-[hsl(0,0%,10%)]">
                {challenges.map(c => <option key={c.id} value={c.id} className="text-[hsl(0,0%,10%)]">{getChallengeLabel(c)}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">Credentials (one per line: login,password,server)</Label>
              <p className="text-[10px] text-[hsl(0,0%,60%)] mb-1">Server is optional — defaults to: {defaultServer}</p>
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
                className="w-full h-40 rounded-lg bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,88%)] px-3 py-2 text-sm font-mono resize-none"
                placeholder={"12345678,pass123\n12345679,pass456\n12345680,pass789,CustomServer"} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg border-[hsl(0,0%,88%)]" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-lg bg-[hsl(0,0%,0%)] text-white hover:bg-[hsl(0,0%,15%)]" onClick={bulkImport}
              disabled={saving || !bulkText.trim()}>
              {saving ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Default Server Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="bg-white border-[hsl(0,0%,90%)] rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle className="text-[hsl(0,0%,5%)]">Default Server</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs text-[hsl(0,0%,45%)]">Default MT5 Server for new credentials</Label>
            <Input value={defaultServer} onChange={e => setDefaultServer(e.target.value)}
              className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" />
            <p className="text-[10px] text-[hsl(0,0%,60%)] mt-2">This will be used when no server is specified during add or bulk import.</p>
          </div>
          <DialogFooter>
            <Button className="rounded-lg bg-[hsl(0,0%,0%)] text-white hover:bg-[hsl(0,0%,15%)]" onClick={() => { setSettingsOpen(false); toast.success("Default server updated"); }}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pending Credentials Dialog */}
      <Dialog open={pendingDialogOpen} onOpenChange={setPendingDialogOpen}>
        <DialogContent className="bg-white border-[hsl(0,0%,90%)] rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[hsl(0,0%,5%)]">
              Pending Credential Assignments ({pendingPurchases.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[350px] overflow-y-auto">
            {pendingPurchases.length === 0 ? (
              <div className="text-center py-8 text-[hsl(0,0%,50%)] text-sm">
                <CheckCircle2 size={28} className="mx-auto mb-2 text-green-500" />
                All purchases have credentials assigned!
              </div>
            ) : (
              <div className="space-y-2">
                {pendingPurchases.map(p => {
                  const ch = p.challenges as any;
                  const availForChallenge = credentials.filter(c => c.challenge_id === p.challenge_id && !c.is_assigned).length;
                  return (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,92%)]">
                      <div>
                        <p className="text-sm font-medium text-[hsl(0,0%,10%)]">
                          ${ch?.account_size?.toLocaleString()} - {ch?.step_type === "one_step" ? "1 Step" : "2 Step"}
                        </p>
                        <p className="text-[10px] text-[hsl(0,0%,50%)]">
                          Purchase: {new Date(p.created_at).toLocaleDateString()} • User: {p.user_id.slice(0, 8)}...
                        </p>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${availForChallenge > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                        {availForChallenge > 0 ? `${availForChallenge} free` : "No creds"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg border-[hsl(0,0%,88%)]" onClick={() => setPendingDialogOpen(false)}>Close</Button>
            {pendingPurchases.length > 0 && (
              <Button className="rounded-lg bg-[hsl(0,0%,0%)] text-white hover:bg-[hsl(0,0%,15%)]" onClick={assignAllPending} disabled={assigning}>
                <RefreshCw size={14} className={`mr-1 ${assigning ? "animate-spin" : ""}`} />
                {assigning ? "Assigning..." : `Assign All (${pendingPurchases.length})`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CredentialsManager;
