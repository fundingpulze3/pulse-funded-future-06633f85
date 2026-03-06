import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Users, Trophy, Link2, Shield, Plus, Pencil, Trash2,
  CheckCircle2, XCircle, DollarSign,
} from "lucide-react";
import { toast } from "sonner";

type Tab = "users" | "challenges" | "referrals";

interface ChallengeForm {
  name: string;
  account_size: string;
  price: string;
  profit_target: string;
  daily_drawdown: string;
  max_drawdown: string;
  min_trading_days: string;
  leverage: string;
  step_type: string;
  is_active: boolean;
}

const emptyChallengeForm: ChallengeForm = {
  name: "",
  account_size: "",
  price: "",
  profit_target: "",
  daily_drawdown: "",
  max_drawdown: "",
  min_trading_days: "",
  leverage: "1:100",
  step_type: "1-step",
  is_active: true,
};

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("users");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Challenge dialog
  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
  const [challengeForm, setChallengeForm] = useState<ChallengeForm>(emptyChallengeForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) { navigate("/auth"); return; }
      if (!isAdmin) { toast.error("Access denied. Admin only."); navigate("/"); return; }
      fetchAll();
    }
  }, [user, authLoading, isAdmin, adminLoading]);

  const fetchAll = async () => {
    const [p, c, r] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("challenges").select("*").order("account_size", { ascending: true }),
      supabase.from("affiliate_referrals").select("*").order("created_at", { ascending: false }),
    ]);
    if (p.data) setProfiles(p.data);
    if (c.data) setChallenges(c.data);
    if (r.data) setReferrals(r.data);
    setLoading(false);
  };

  // ---- Challenge CRUD ----
  const openCreateChallenge = () => {
    setChallengeForm(emptyChallengeForm);
    setEditingChallengeId(null);
    setChallengeDialogOpen(true);
  };

  const openEditChallenge = (c: any) => {
    setChallengeForm({
      name: c.name,
      account_size: String(c.account_size),
      price: String(c.price),
      profit_target: c.profit_target,
      daily_drawdown: c.daily_drawdown,
      max_drawdown: c.max_drawdown,
      min_trading_days: c.min_trading_days,
      leverage: c.leverage,
      step_type: c.step_type,
      is_active: c.is_active,
    });
    setEditingChallengeId(c.id);
    setChallengeDialogOpen(true);
  };

  const saveChallenge = async () => {
    setSaving(true);
    const payload = {
      name: challengeForm.name,
      account_size: Number(challengeForm.account_size),
      price: Number(challengeForm.price),
      profit_target: challengeForm.profit_target,
      daily_drawdown: challengeForm.daily_drawdown,
      max_drawdown: challengeForm.max_drawdown,
      min_trading_days: challengeForm.min_trading_days,
      leverage: challengeForm.leverage,
      step_type: challengeForm.step_type,
      is_active: challengeForm.is_active,
    };

    if (editingChallengeId) {
      const { error } = await supabase.from("challenges").update(payload).eq("id", editingChallengeId);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Challenge updated!");
    } else {
      const { error } = await supabase.from("challenges").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Challenge created!");
    }
    setChallengeDialogOpen(false);
    setSaving(false);
    fetchAll();
  };

  const deleteChallenge = async (id: string) => {
    if (!confirm("Delete this challenge? This cannot be undone.")) return;
    const { error } = await supabase.from("challenges").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Challenge deleted.");
    fetchAll();
  };

  // ---- Referral actions ----
  const updateReferralStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("affiliate_referrals")
      .update({ commission_status: status })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Commission ${status}!`);
    fetchAll();
  };

  // Helper to resolve user_id to display name
  const getProfileName = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    return p?.display_name || p?.email || userId.slice(0, 8) + "...";
  };

  const getReferrerName = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    if (!p) return "—";
    const referrer = profiles.find((pr) => pr.user_id === p.referred_by);
    return referrer ? (referrer.display_name || referrer.email || "Unknown") : "Direct";
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Shield className="animate-pulse" size={24} />
          <p>Verifying admin access...</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "users", label: "Users", icon: <Users size={18} />, count: profiles.length },
    { id: "challenges", label: "Challenges", icon: <Trophy size={18} />, count: challenges.length },
    { id: "referrals", label: "Referrals", icon: <Link2 size={18} />, count: referrals.length },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
                <Shield size={22} className="text-primary" /> Admin Panel
              </h1>
              <p className="text-sm text-muted-foreground">Manage your platform</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {t.icon}
              {t.label}
              <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                tab === t.id ? "bg-primary-foreground/20" : "bg-border"
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* ===== Users Tab ===== */}
        {tab === "users" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-display font-bold text-lg text-foreground">All Users</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b border-border bg-secondary/50">
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Referral Code</th>
                    <th className="px-5 py-3">Invited By</th>
                    <th className="px-5 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-4 text-sm text-foreground font-medium">{p.display_name || "—"}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{p.email || "—"}</td>
                      <td className="px-5 py-4">
                        <code className="text-xs bg-secondary px-2 py-1 rounded-md text-accent">{p.referral_code || "—"}</code>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {p.referred_by ? getProfileName(p.referred_by) : <span className="text-muted-foreground/50">Direct</span>}
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {profiles.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No users yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== Challenges Tab ===== */}
        {tab === "challenges" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-foreground">Challenges</h2>
              <Button size="sm" className="rounded-xl" onClick={openCreateChallenge}>
                <Plus size={16} className="mr-1" /> New Challenge
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b border-border bg-secondary/50">
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Size</th>
                    <th className="px-5 py-3">Price</th>
                    <th className="px-5 py-3">Target</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {challenges.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-4 text-sm text-foreground font-medium">{c.name}</td>
                      <td className="px-5 py-4 text-sm text-foreground">${c.account_size.toLocaleString()}</td>
                      <td className="px-5 py-4 text-sm text-foreground">${c.price}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{c.profit_target}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{c.step_type}</td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          c.is_active ? "bg-green-500/20 text-green-400" : "bg-destructive/20 text-destructive"
                        }`}>
                          {c.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEditChallenge(c)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => deleteChallenge(c.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {challenges.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">No challenges yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== Referrals Tab ===== */}
        {tab === "referrals" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-display font-bold text-lg text-foreground">All Referrals</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b border-border bg-secondary/50">
                    <th className="px-5 py-3">Referrer</th>
                    <th className="px-5 py-3">Referred</th>
                    <th className="px-5 py-3">Commission</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-4 text-sm text-foreground font-medium">{getProfileName(r.referrer_id)}</td>
                      <td className="px-5 py-4 text-sm text-foreground">{getProfileName(r.referred_id)}</td>
                      <td className="px-5 py-4 text-sm text-foreground flex items-center gap-1">
                        <DollarSign size={14} className="text-primary" />
                        {(r.commission_amount || 0).toFixed(2)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          r.commission_status === "paid" ? "bg-green-500/20 text-green-400" :
                          r.commission_status === "approved" ? "bg-blue-500/20 text-blue-400" :
                          r.commission_status === "rejected" ? "bg-destructive/20 text-destructive" :
                          "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {r.commission_status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.commission_status === "pending" && (
                            <>
                              <button
                                onClick={() => updateReferralStatus(r.id, "approved")}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                title="Approve"
                              >
                                <CheckCircle2 size={16} />
                              </button>
                              <button
                                onClick={() => updateReferralStatus(r.id, "rejected")}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Reject"
                              >
                                <XCircle size={16} />
                              </button>
                            </>
                          )}
                          {r.commission_status === "approved" && (
                            <button
                              onClick={() => updateReferralStatus(r.id, "paid")}
                              className="px-3 py-1 rounded-lg text-xs font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                            >
                              Mark Paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {referrals.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No referrals yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ===== Challenge Create/Edit Dialog ===== */}
      <Dialog open={challengeDialogOpen} onOpenChange={setChallengeDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingChallengeId ? "Edit Challenge" : "Create Challenge"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label className="text-muted-foreground text-xs">Name</Label>
              <Input value={challengeForm.name} onChange={(e) => setChallengeForm({ ...challengeForm, name: e.target.value })} className="mt-1 bg-secondary border-border rounded-xl" placeholder="e.g. $10K 1-Step" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Account Size ($)</Label>
              <Input type="number" value={challengeForm.account_size} onChange={(e) => setChallengeForm({ ...challengeForm, account_size: e.target.value })} className="mt-1 bg-secondary border-border rounded-xl" placeholder="10000" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Price ($)</Label>
              <Input type="number" value={challengeForm.price} onChange={(e) => setChallengeForm({ ...challengeForm, price: e.target.value })} className="mt-1 bg-secondary border-border rounded-xl" placeholder="99" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Profit Target</Label>
              <Input value={challengeForm.profit_target} onChange={(e) => setChallengeForm({ ...challengeForm, profit_target: e.target.value })} className="mt-1 bg-secondary border-border rounded-xl" placeholder="8%" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Daily Drawdown</Label>
              <Input value={challengeForm.daily_drawdown} onChange={(e) => setChallengeForm({ ...challengeForm, daily_drawdown: e.target.value })} className="mt-1 bg-secondary border-border rounded-xl" placeholder="5%" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Max Drawdown</Label>
              <Input value={challengeForm.max_drawdown} onChange={(e) => setChallengeForm({ ...challengeForm, max_drawdown: e.target.value })} className="mt-1 bg-secondary border-border rounded-xl" placeholder="10%" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Min Trading Days</Label>
              <Input value={challengeForm.min_trading_days} onChange={(e) => setChallengeForm({ ...challengeForm, min_trading_days: e.target.value })} className="mt-1 bg-secondary border-border rounded-xl" placeholder="5" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Leverage</Label>
              <Input value={challengeForm.leverage} onChange={(e) => setChallengeForm({ ...challengeForm, leverage: e.target.value })} className="mt-1 bg-secondary border-border rounded-xl" placeholder="1:100" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Step Type</Label>
              <select
                value={challengeForm.step_type}
                onChange={(e) => setChallengeForm({ ...challengeForm, step_type: e.target.value })}
                className="mt-1 w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground"
              >
                <option value="1-step">1-Step</option>
                <option value="2-step">2-Step</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={challengeForm.is_active}
                  onChange={(e) => setChallengeForm({ ...challengeForm, is_active: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-foreground">Active</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setChallengeDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={saveChallenge} disabled={saving || !challengeForm.name || !challengeForm.account_size}>
              {saving ? "Saving..." : editingChallengeId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
