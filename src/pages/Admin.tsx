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
  Users, Trophy, Link2, Shield, Plus, Pencil, Trash2,
  CheckCircle2, XCircle, DollarSign, Ticket, Home, LogOut,
} from "lucide-react";
import { toast } from "sonner";

type Tab = "users" | "challenges" | "referrals" | "coupons";

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

interface CouponForm {
  code: string;
  discount_type: string;
  discount_value: string;
  max_uses: string;
  is_active: boolean;
  expires_at: string;
}

const emptyCouponForm: CouponForm = {
  code: "",
  discount_type: "percentage",
  discount_value: "",
  max_uses: "",
  is_active: true,
  expires_at: "",
};

const Admin = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("users");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Challenge dialog
  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
  const [challengeForm, setChallengeForm] = useState<ChallengeForm>(emptyChallengeForm);
  const [saving, setSaving] = useState(false);

  // Coupon dialog
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [couponForm, setCouponForm] = useState<CouponForm>(emptyCouponForm);
  const [couponSaving, setCouponSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) { navigate("/auth"); return; }
      if (!isAdmin) { toast.error("Access denied. Admin only."); navigate("/"); return; }
      fetchAll();
    }
  }, [user, authLoading, isAdmin, adminLoading]);

  const fetchAll = async () => {
    const [p, c, r, cp] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("challenges").select("*").order("account_size", { ascending: true }),
      supabase.from("affiliate_referrals").select("*").order("created_at", { ascending: false }),
      supabase.from("coupons").select("*").order("created_at", { ascending: false }),
    ]);
    if (p.data) setProfiles(p.data);
    if (c.data) setChallenges(c.data);
    if (r.data) setReferrals(r.data);
    if (cp.data) setCoupons(cp.data);
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
    if (!confirm("Delete this challenge?")) return;
    const { error } = await supabase.from("challenges").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Challenge deleted.");
    fetchAll();
  };

  // ---- Coupon CRUD ----
  const openCreateCoupon = () => {
    setCouponForm(emptyCouponForm);
    setEditingCouponId(null);
    setCouponDialogOpen(true);
  };

  const openEditCoupon = (c: any) => {
    setCouponForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      max_uses: c.max_uses ? String(c.max_uses) : "",
      is_active: c.is_active,
      expires_at: c.expires_at ? c.expires_at.slice(0, 16) : "",
    });
    setEditingCouponId(c.id);
    setCouponDialogOpen(true);
  };

  const saveCoupon = async () => {
    setCouponSaving(true);
    const payload: any = {
      code: couponForm.code.toUpperCase().trim(),
      discount_type: couponForm.discount_type,
      discount_value: Number(couponForm.discount_value),
      max_uses: couponForm.max_uses ? Number(couponForm.max_uses) : null,
      is_active: couponForm.is_active,
      expires_at: couponForm.expires_at ? new Date(couponForm.expires_at).toISOString() : null,
    };

    if (editingCouponId) {
      const { error } = await supabase.from("coupons").update(payload).eq("id", editingCouponId);
      if (error) { toast.error(error.message); setCouponSaving(false); return; }
      toast.success("Coupon updated!");
    } else {
      const { error } = await supabase.from("coupons").insert(payload);
      if (error) { toast.error(error.message); setCouponSaving(false); return; }
      toast.success("Coupon created!");
    }
    setCouponDialogOpen(false);
    setCouponSaving(false);
    fetchAll();
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Coupon deleted.");
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

  const getProfileName = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    return p?.display_name || p?.email || userId.slice(0, 8) + "...";
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,0%)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[hsl(0,0%,50%)]">
          <Shield className="animate-pulse" size={24} />
          <p className="font-mono text-sm">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "users", label: "Users", icon: <Users size={18} />, count: profiles.length },
    { id: "challenges", label: "Challenges", icon: <Trophy size={18} />, count: challenges.length },
    { id: "referrals", label: "Referrals", icon: <Link2 size={18} />, count: referrals.length },
    { id: "coupons", label: "Coupons", icon: <Ticket size={18} />, count: coupons.length },
  ];

  return (
    <div className="min-h-screen bg-[hsl(0,0%,0%)] text-[hsl(0,0%,95%)] flex">
      {/* ===== Main Content (Center) ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 border-b border-[hsl(0,0%,12%)] flex items-center px-6 shrink-0">
          <h1 className="font-mono text-sm font-semibold tracking-wider uppercase text-[hsl(0,0%,70%)]">
            Admin Panel
          </h1>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-auto p-6">
          {/* ===== Users Tab ===== */}
          {tab === "users" && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-[hsl(0,0%,95%)]">Users</h2>
                <p className="text-sm text-[hsl(0,0%,45%)] mt-1">{profiles.length} registered users</p>
              </div>
              <div className="border border-[hsl(0,0%,12%)] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-[hsl(0,0%,40%)] border-b border-[hsl(0,0%,12%)]">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Referral Code</th>
                      <th className="px-4 py-3 font-medium">Invited By</th>
                      <th className="px-4 py-3 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((p) => (
                      <tr key={p.id} className="border-b border-[hsl(0,0%,8%)] last:border-0 hover:bg-[hsl(0,0%,5%)] transition-colors">
                        <td className="px-4 py-3 text-sm font-medium">{p.display_name || "—"}</td>
                        <td className="px-4 py-3 text-sm text-[hsl(0,0%,55%)]">{p.email || "—"}</td>
                        <td className="px-4 py-3">
                          <code className="text-xs bg-[hsl(0,0%,8%)] border border-[hsl(0,0%,15%)] px-2 py-0.5 rounded font-mono">{p.referral_code || "—"}</code>
                        </td>
                        <td className="px-4 py-3 text-sm text-[hsl(0,0%,55%)]">
                          {p.referred_by ? getProfileName(p.referred_by) : <span className="text-[hsl(0,0%,25%)]">Direct</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-[hsl(0,0%,45%)]">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {profiles.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-[hsl(0,0%,30%)]">No users yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== Challenges Tab ===== */}
          {tab === "challenges" && (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[hsl(0,0%,95%)]">Challenges</h2>
                  <p className="text-sm text-[hsl(0,0%,45%)] mt-1">{challenges.length} challenges</p>
                </div>
                <Button size="sm" onClick={openCreateChallenge} className="bg-[hsl(0,0%,100%)] text-[hsl(0,0%,0%)] hover:bg-[hsl(0,0%,90%)] rounded-md text-xs font-medium">
                  <Plus size={14} className="mr-1" /> New Challenge
                </Button>
              </div>
              <div className="border border-[hsl(0,0%,12%)] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-[hsl(0,0%,40%)] border-b border-[hsl(0,0%,12%)]">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Size</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Target</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {challenges.map((c) => (
                      <tr key={c.id} className="border-b border-[hsl(0,0%,8%)] last:border-0 hover:bg-[hsl(0,0%,5%)] transition-colors">
                        <td className="px-4 py-3 text-sm font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-sm">${c.account_size.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm">${c.price}</td>
                        <td className="px-4 py-3 text-sm text-[hsl(0,0%,55%)]">{c.profit_target}</td>
                        <td className="px-4 py-3 text-sm text-[hsl(0,0%,55%)]">{c.step_type}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            c.is_active
                              ? "bg-[hsl(0,0%,15%)] text-[hsl(0,0%,80%)]"
                              : "bg-[hsl(0,0%,8%)] text-[hsl(0,0%,35%)]"
                          }`}>
                            {c.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditChallenge(c)} className="p-1.5 rounded text-[hsl(0,0%,40%)] hover:text-[hsl(0,0%,90%)] hover:bg-[hsl(0,0%,10%)] transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => deleteChallenge(c.id)} className="p-1.5 rounded text-[hsl(0,0%,40%)] hover:text-[hsl(0,84%,60%)] hover:bg-[hsl(0,84%,60%,0.1)] transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {challenges.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-[hsl(0,0%,30%)]">No challenges yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== Referrals Tab ===== */}
          {tab === "referrals" && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-[hsl(0,0%,95%)]">Referrals</h2>
                <p className="text-sm text-[hsl(0,0%,45%)] mt-1">{referrals.length} referrals</p>
              </div>
              <div className="border border-[hsl(0,0%,12%)] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-[hsl(0,0%,40%)] border-b border-[hsl(0,0%,12%)]">
                      <th className="px-4 py-3 font-medium">Referrer</th>
                      <th className="px-4 py-3 font-medium">Referred</th>
                      <th className="px-4 py-3 font-medium">Commission</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((r) => (
                      <tr key={r.id} className="border-b border-[hsl(0,0%,8%)] last:border-0 hover:bg-[hsl(0,0%,5%)] transition-colors">
                        <td className="px-4 py-3 text-sm font-medium">{getProfileName(r.referrer_id)}</td>
                        <td className="px-4 py-3 text-sm">{getProfileName(r.referred_id)}</td>
                        <td className="px-4 py-3 text-sm">${(r.commission_amount || 0).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            r.commission_status === "paid" ? "bg-[hsl(0,0%,15%)] text-[hsl(0,0%,80%)]" :
                            r.commission_status === "approved" ? "bg-[hsl(0,0%,15%)] text-[hsl(0,0%,70%)]" :
                            r.commission_status === "rejected" ? "bg-[hsl(0,0%,8%)] text-[hsl(0,0%,35%)]" :
                            "bg-[hsl(0,0%,10%)] text-[hsl(0,0%,55%)]"
                          }`}>
                            {r.commission_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[hsl(0,0%,45%)]">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {r.commission_status === "pending" && (
                              <>
                                <button onClick={() => updateReferralStatus(r.id, "approved")} className="p-1.5 rounded text-[hsl(0,0%,40%)] hover:text-[hsl(0,0%,90%)] hover:bg-[hsl(0,0%,10%)] transition-colors" title="Approve">
                                  <CheckCircle2 size={15} />
                                </button>
                                <button onClick={() => updateReferralStatus(r.id, "rejected")} className="p-1.5 rounded text-[hsl(0,0%,40%)] hover:text-[hsl(0,84%,60%)] hover:bg-[hsl(0,84%,60%,0.1)] transition-colors" title="Reject">
                                  <XCircle size={15} />
                                </button>
                              </>
                            )}
                            {r.commission_status === "approved" && (
                              <button onClick={() => updateReferralStatus(r.id, "paid")} className="px-2.5 py-1 rounded text-xs font-medium bg-[hsl(0,0%,15%)] text-[hsl(0,0%,80%)] hover:bg-[hsl(0,0%,20%)] transition-colors">
                                Mark Paid
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {referrals.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-[hsl(0,0%,30%)]">No referrals yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== Coupons Tab ===== */}
          {tab === "coupons" && (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[hsl(0,0%,95%)]">Coupons</h2>
                  <p className="text-sm text-[hsl(0,0%,45%)] mt-1">{coupons.length} coupon codes</p>
                </div>
                <Button size="sm" onClick={openCreateCoupon} className="bg-[hsl(0,0%,100%)] text-[hsl(0,0%,0%)] hover:bg-[hsl(0,0%,90%)] rounded-md text-xs font-medium">
                  <Plus size={14} className="mr-1" /> New Coupon
                </Button>
              </div>
              <div className="border border-[hsl(0,0%,12%)] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-[hsl(0,0%,40%)] border-b border-[hsl(0,0%,12%)]">
                      <th className="px-4 py-3 font-medium">Code</th>
                      <th className="px-4 py-3 font-medium">Discount</th>
                      <th className="px-4 py-3 font-medium">Uses</th>
                      <th className="px-4 py-3 font-medium">Expires</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((c: any) => (
                      <tr key={c.id} className="border-b border-[hsl(0,0%,8%)] last:border-0 hover:bg-[hsl(0,0%,5%)] transition-colors">
                        <td className="px-4 py-3">
                          <code className="text-sm font-mono font-bold tracking-wider">{c.code}</code>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {c.discount_type === "percentage" ? `${c.discount_value}%` : `$${c.discount_value}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-[hsl(0,0%,55%)]">
                          {c.current_uses}{c.max_uses ? ` / ${c.max_uses}` : " / ∞"}
                        </td>
                        <td className="px-4 py-3 text-sm text-[hsl(0,0%,45%)]">
                          {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "Never"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            c.is_active
                              ? "bg-[hsl(0,0%,15%)] text-[hsl(0,0%,80%)]"
                              : "bg-[hsl(0,0%,8%)] text-[hsl(0,0%,35%)]"
                          }`}>
                            {c.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditCoupon(c)} className="p-1.5 rounded text-[hsl(0,0%,40%)] hover:text-[hsl(0,0%,90%)] hover:bg-[hsl(0,0%,10%)] transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => deleteCoupon(c.id)} className="p-1.5 rounded text-[hsl(0,0%,40%)] hover:text-[hsl(0,84%,60%)] hover:bg-[hsl(0,84%,60%,0.1)] transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {coupons.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-[hsl(0,0%,30%)]">No coupons yet. Create your first one.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== Right Sidebar ===== */}
      <div className="w-56 border-l border-[hsl(0,0%,12%)] flex flex-col shrink-0">
        <div className="h-14 border-b border-[hsl(0,0%,12%)] flex items-center justify-center">
          <Shield size={18} className="text-[hsl(0,0%,50%)]" />
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                tab === t.id
                  ? "bg-[hsl(0,0%,100%)] text-[hsl(0,0%,0%)] font-medium"
                  : "text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,80%)] hover:bg-[hsl(0,0%,8%)]"
              }`}
            >
              {t.icon}
              <span className="flex-1 text-left">{t.label}</span>
              <span className={`text-[10px] font-mono ${tab === t.id ? "text-[hsl(0,0%,40%)]" : "text-[hsl(0,0%,30%)]"}`}>
                {t.count}
              </span>
            </button>
          ))}
        </nav>

        <div className="border-t border-[hsl(0,0%,12%)] p-3 space-y-1">
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,80%)] hover:bg-[hsl(0,0%,8%)] transition-colors"
          >
            <Home size={18} />
            <span>Back to Site</span>
          </button>
          <button
            onClick={() => { signOut(); navigate("/"); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,80%)] hover:bg-[hsl(0,0%,8%)] transition-colors"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* ===== Challenge Dialog ===== */}
      <Dialog open={challengeDialogOpen} onOpenChange={setChallengeDialogOpen}>
        <DialogContent className="bg-[hsl(0,0%,5%)] border-[hsl(0,0%,15%)] text-[hsl(0,0%,95%)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {editingChallengeId ? "Edit Challenge" : "Create Challenge"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="col-span-2">
              <Label className="text-[hsl(0,0%,50%)] text-xs">Name</Label>
              <Input value={challengeForm.name} onChange={(e) => setChallengeForm({ ...challengeForm, name: e.target.value })} className="mt-1 bg-[hsl(0,0%,8%)] border-[hsl(0,0%,15%)] rounded-md text-[hsl(0,0%,90%)]" placeholder="e.g. $10K 1-Step" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,50%)] text-xs">Account Size ($)</Label>
              <Input type="number" value={challengeForm.account_size} onChange={(e) => setChallengeForm({ ...challengeForm, account_size: e.target.value })} className="mt-1 bg-[hsl(0,0%,8%)] border-[hsl(0,0%,15%)] rounded-md text-[hsl(0,0%,90%)]" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,50%)] text-xs">Price ($)</Label>
              <Input type="number" value={challengeForm.price} onChange={(e) => setChallengeForm({ ...challengeForm, price: e.target.value })} className="mt-1 bg-[hsl(0,0%,8%)] border-[hsl(0,0%,15%)] rounded-md text-[hsl(0,0%,90%)]" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,50%)] text-xs">Profit Target</Label>
              <Input value={challengeForm.profit_target} onChange={(e) => setChallengeForm({ ...challengeForm, profit_target: e.target.value })} className="mt-1 bg-[hsl(0,0%,8%)] border-[hsl(0,0%,15%)] rounded-md text-[hsl(0,0%,90%)]" placeholder="8%" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,50%)] text-xs">Daily Drawdown</Label>
              <Input value={challengeForm.daily_drawdown} onChange={(e) => setChallengeForm({ ...challengeForm, daily_drawdown: e.target.value })} className="mt-1 bg-[hsl(0,0%,8%)] border-[hsl(0,0%,15%)] rounded-md text-[hsl(0,0%,90%)]" placeholder="5%" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,50%)] text-xs">Max Drawdown</Label>
              <Input value={challengeForm.max_drawdown} onChange={(e) => setChallengeForm({ ...challengeForm, max_drawdown: e.target.value })} className="mt-1 bg-[hsl(0,0%,8%)] border-[hsl(0,0%,15%)] rounded-md text-[hsl(0,0%,90%)]" placeholder="10%" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,50%)] text-xs">Min Trading Days</Label>
              <Input value={challengeForm.min_trading_days} onChange={(e) => setChallengeForm({ ...challengeForm, min_trading_days: e.target.value })} className="mt-1 bg-[hsl(0,0%,8%)] border-[hsl(0,0%,15%)] rounded-md text-[hsl(0,0%,90%)]" placeholder="5" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,50%)] text-xs">Leverage</Label>
              <Input value={challengeForm.leverage} onChange={(e) => setChallengeForm({ ...challengeForm, leverage: e.target.value })} className="mt-1 bg-[hsl(0,0%,8%)] border-[hsl(0,0%,15%)] rounded-md text-[hsl(0,0%,90%)]" placeholder="1:100" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,50%)] text-xs">Step Type</Label>
              <select value={challengeForm.step_type} onChange={(e) => setChallengeForm({ ...challengeForm, step_type: e.target.value })} className="mt-1 w-full rounded-md bg-[hsl(0,0%,8%)] border border-[hsl(0,0%,15%)] px-3 py-2 text-sm text-[hsl(0,0%,90%)]">
                <option value="1-step">1-Step</option>
                <option value="2-step">2-Step</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={challengeForm.is_active} onChange={(e) => setChallengeForm({ ...challengeForm, is_active: e.target.checked })} className="rounded" />
                <span className="text-sm">Active</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-md border-[hsl(0,0%,15%)] text-[hsl(0,0%,60%)] hover:bg-[hsl(0,0%,10%)]" onClick={() => setChallengeDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-md bg-[hsl(0,0%,100%)] text-[hsl(0,0%,0%)] hover:bg-[hsl(0,0%,90%)]" onClick={saveChallenge} disabled={saving || !challengeForm.name || !challengeForm.account_size}>
              {saving ? "Saving..." : editingChallengeId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Coupon Dialog ===== */}
      <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
        <DialogContent className="bg-[hsl(0,0%,5%)] border-[hsl(0,0%,15%)] text-[hsl(0,0%,95%)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {editingCouponId ? "Edit Coupon" : "Create Coupon"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label className="text-[hsl(0,0%,50%)] text-xs">Coupon Code</Label>
              <Input value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })} className="mt-1 bg-[hsl(0,0%,8%)] border-[hsl(0,0%,15%)] rounded-md text-[hsl(0,0%,90%)] font-mono uppercase tracking-wider" placeholder="SAVE20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[hsl(0,0%,50%)] text-xs">Discount Type</Label>
                <select value={couponForm.discount_type} onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })} className="mt-1 w-full rounded-md bg-[hsl(0,0%,8%)] border border-[hsl(0,0%,15%)] px-3 py-2 text-sm text-[hsl(0,0%,90%)]">
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed ($)</option>
                </select>
              </div>
              <div>
                <Label className="text-[hsl(0,0%,50%)] text-xs">Discount Value</Label>
                <Input type="number" value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })} className="mt-1 bg-[hsl(0,0%,8%)] border-[hsl(0,0%,15%)] rounded-md text-[hsl(0,0%,90%)]" placeholder="20" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[hsl(0,0%,50%)] text-xs">Max Uses (empty = unlimited)</Label>
                <Input type="number" value={couponForm.max_uses} onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })} className="mt-1 bg-[hsl(0,0%,8%)] border-[hsl(0,0%,15%)] rounded-md text-[hsl(0,0%,90%)]" placeholder="100" />
              </div>
              <div>
                <Label className="text-[hsl(0,0%,50%)] text-xs">Expires At (optional)</Label>
                <Input type="datetime-local" value={couponForm.expires_at} onChange={(e) => setCouponForm({ ...couponForm, expires_at: e.target.value })} className="mt-1 bg-[hsl(0,0%,8%)] border-[hsl(0,0%,15%)] rounded-md text-[hsl(0,0%,90%)]" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" checked={couponForm.is_active} onChange={(e) => setCouponForm({ ...couponForm, is_active: e.target.checked })} className="rounded" />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-md border-[hsl(0,0%,15%)] text-[hsl(0,0%,60%)] hover:bg-[hsl(0,0%,10%)]" onClick={() => setCouponDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-md bg-[hsl(0,0%,100%)] text-[hsl(0,0%,0%)] hover:bg-[hsl(0,0%,90%)]" onClick={saveCoupon} disabled={couponSaving || !couponForm.code || !couponForm.discount_value}>
              {couponSaving ? "Saving..." : editingCouponId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
