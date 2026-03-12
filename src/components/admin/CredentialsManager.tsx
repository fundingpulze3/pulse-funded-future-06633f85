import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Key, CheckCircle2, XCircle, Search } from "lucide-react";
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
  const [filterChallenge, setFilterChallenge] = useState("all");
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkChallengeId, setBulkChallengeId] = useState("");

  const [form, setForm] = useState({
    challenge_id: "",
    mt5_login: "",
    mt5_password: "",
    mt5_server: "MetaQuotes-Demo",
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [credRes, chalRes] = await Promise.all([
      supabase.from("trading_credentials").select("*").order("created_at", { ascending: false }),
      supabase.from("challenges").select("id, name, account_size, step_type").order("account_size"),
    ]);
    if (credRes.data) setCredentials(credRes.data as any);
    if (chalRes.data) setChallenges(chalRes.data);
    if (chalRes.data?.[0] && !form.challenge_id) {
      setForm(f => ({ ...f, challenge_id: chalRes.data[0].id }));
      setBulkChallengeId(chalRes.data[0]?.id || "");
    }
    setLoading(false);
  };

  const saveCredential = async () => {
    setSaving(true);
    const { error } = await supabase.from("trading_credentials").insert({
      challenge_id: form.challenge_id,
      mt5_login: form.mt5_login.trim(),
      mt5_password: form.mt5_password.trim(),
      mt5_server: form.mt5_server.trim(),
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Credential added!");
    setDialogOpen(false);
    setSaving(false);
    setForm({ ...form, mt5_login: "", mt5_password: "" });
    fetchData();
  };

  const bulkImport = async () => {
    if (!bulkChallengeId || !bulkText.trim()) return;
    setSaving(true);
    // Format: one per line: login,password,server (server optional)
    const lines = bulkText.trim().split("\n").filter(l => l.trim());
    const records = lines.map(line => {
      const parts = line.split(/[,\t]+/).map(s => s.trim());
      return {
        challenge_id: bulkChallengeId,
        mt5_login: parts[0] || "",
        mt5_password: parts[1] || "",
        mt5_server: parts[2] || "MetaQuotes-Demo",
      };
    }).filter(r => r.mt5_login && r.mt5_password);

    if (records.length === 0) {
      toast.error("No valid credentials found");
      setSaving(false);
      return;
    }

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

  const getChallengeLabel = (id: string) => {
    const c = challenges.find(ch => ch.id === id);
    return c ? `$${c.account_size.toLocaleString()} ${c.name}` : "—";
  };

  const filtered = credentials.filter(c => {
    if (filterChallenge !== "all" && c.challenge_id !== filterChallenge) return false;
    if (search && !c.mt5_login.includes(search) && !c.mt5_server.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const available = filtered.filter(c => !c.is_assigned).length;
  const assigned = filtered.filter(c => c.is_assigned).length;

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-5 h-5 border-2 border-[hsl(0,0%,30%)] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[hsl(0,0%,97%)] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[hsl(0,0%,5%)]">{credentials.length}</p>
          <p className="text-xs text-[hsl(0,0%,50%)]">Total</p>
        </div>
        <div className="bg-[hsl(120,40%,96%)] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{available}</p>
          <p className="text-xs text-[hsl(0,0%,50%)]">Available</p>
        </div>
        <div className="bg-[hsl(220,40%,96%)] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{assigned}</p>
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
        <select value={filterChallenge} onChange={e => setFilterChallenge(e.target.value)}
          className="rounded-lg bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,88%)] px-3 py-2 text-sm">
          <option value="all">All Challenges</option>
          {challenges.map(c => <option key={c.id} value={c.id}>${c.account_size.toLocaleString()} {c.name}</option>)}
        </select>
        <Button size="sm" className="rounded-lg bg-[hsl(0,0%,0%)] text-white hover:bg-[hsl(0,0%,15%)]" onClick={() => setDialogOpen(true)}>
          <Plus size={14} className="mr-1" /> Add
        </Button>
        <Button size="sm" variant="outline" className="rounded-lg border-[hsl(0,0%,88%)]" onClick={() => setBulkDialogOpen(true)}>
          Bulk Import
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-[hsl(0,0%,50%)] border-b border-[hsl(0,0%,92%)]">
              <th className="px-4 py-3">Challenge</th>
              <th className="px-4 py-3">MT5 Login</th>
              <th className="px-4 py-3">Password</th>
              <th className="px-4 py-3">Server</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-[hsl(0,0%,50%)] text-sm">No credentials found</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-b border-[hsl(0,0%,95%)] last:border-0 text-sm">
                <td className="px-4 py-3 text-[hsl(0,0%,10%)] font-medium">{getChallengeLabel(c.challenge_id)}</td>
                <td className="px-4 py-3 font-mono text-[hsl(0,0%,30%)]">{c.mt5_login}</td>
                <td className="px-4 py-3 font-mono text-[hsl(0,0%,30%)]">{c.mt5_password}</td>
                <td className="px-4 py-3 text-[hsl(0,0%,40%)]">{c.mt5_server}</td>
                <td className="px-4 py-3">
                  {c.is_assigned ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-600">
                      <CheckCircle2 size={12} /> Assigned
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-600">
                      <Key size={12} /> Available
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!c.is_assigned && (
                    <button onClick={() => deleteCredential(c.id)} className="text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Single Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white border-[hsl(0,0%,90%)] rounded-2xl">
          <DialogHeader><DialogTitle className="text-[hsl(0,0%,5%)]">Add Credential</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">Challenge</Label>
              <select value={form.challenge_id} onChange={e => setForm({ ...form, challenge_id: e.target.value })}
                className="mt-1 w-full rounded-lg bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,88%)] px-3 py-2 text-sm">
                {challenges.map(c => <option key={c.id} value={c.id}>${c.account_size.toLocaleString()} {c.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">MT5 Login</Label>
              <Input value={form.mt5_login} onChange={e => setForm({ ...form, mt5_login: e.target.value })}
                className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg font-mono" placeholder="12345678" />
            </div>
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">MT5 Password</Label>
              <Input value={form.mt5_password} onChange={e => setForm({ ...form, mt5_password: e.target.value })}
                className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg font-mono" placeholder="password123" />
            </div>
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">MT5 Server</Label>
              <Input value={form.mt5_server} onChange={e => setForm({ ...form, mt5_server: e.target.value })}
                className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="MetaQuotes-Demo" />
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
              <Label className="text-xs text-[hsl(0,0%,45%)]">Challenge</Label>
              <select value={bulkChallengeId} onChange={e => setBulkChallengeId(e.target.value)}
                className="mt-1 w-full rounded-lg bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,88%)] px-3 py-2 text-sm">
                {challenges.map(c => <option key={c.id} value={c.id}>${c.account_size.toLocaleString()} {c.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-[hsl(0,0%,45%)]">Credentials (one per line: login,password,server)</Label>
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
                className="mt-1 w-full h-40 rounded-lg bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,88%)] px-3 py-2 text-sm font-mono resize-none"
                placeholder={"12345678,pass123,MetaQuotes-Demo\n12345679,pass456\n12345680,pass789"} />
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
    </div>
  );
};

export default CredentialsManager;
