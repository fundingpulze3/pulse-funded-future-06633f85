import { useEffect, useState, useMemo } from "react";
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
  LayoutDashboard, ShoppingCart, TrendingUp, BarChart3, Globe,
} from "lucide-react";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Area, AreaChart,
} from "recharts";
import logo from "@/assets/logo.png";

type Tab = "dashboard" | "users" | "challenges" | "referrals" | "coupons" | "utm";

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
  const [tab, setTab] = useState<Tab>("dashboard");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [pageVisits, setPageVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
  const [challengeForm, setChallengeForm] = useState<ChallengeForm>(emptyChallengeForm);
  const [saving, setSaving] = useState(false);

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
    const [p, c, r, cp, pu, pv] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("challenges").select("*").order("account_size", { ascending: true }),
      supabase.from("affiliate_referrals").select("*").order("created_at", { ascending: false }),
      supabase.from("coupons").select("*").order("created_at", { ascending: false }),
      supabase.from("challenge_purchases").select("*").order("created_at", { ascending: false }),
      supabase.from("page_visits").select("*").order("created_at", { ascending: false }),
    ]);
    if (p.data) setProfiles(p.data);
    if (c.data) setChallenges(c.data);
    if (r.data) setReferrals(r.data);
    if (cp.data) setCoupons(cp.data);
    if (pu.data) setPurchases(pu.data);
    if (pv.data) setPageVisits(pv.data);
    setLoading(false);
  };

  // Dashboard stats
  const totalRevenue = useMemo(() => purchases.reduce((s, p) => s + (p.amount_paid || 0), 0), [purchases]);
  const totalOrders = purchases.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalPayouts = useMemo(() =>
    referrals.filter(r => r.commission_status === "paid").reduce((s, r) => s + (r.commission_amount || 0), 0),
    [referrals]
  );

  // Chart data - last 30 days
  const chartData = useMemo(() => {
    const days: Record<string, { revenue: number; payouts: number }> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(5, 10);
      days[key] = { revenue: 0, payouts: 0 };
    }
    purchases.forEach(p => {
      const key = p.created_at?.slice(5, 10);
      if (key && days[key]) days[key].revenue += p.amount_paid || 0;
    });
    referrals.filter(r => r.commission_status === "paid").forEach(r => {
      const key = r.created_at?.slice(5, 10);
      if (key && days[key]) days[key].payouts += r.commission_amount || 0;
    });
    return Object.entries(days).map(([date, vals]) => ({ date, ...vals }));
  }, [purchases, referrals]);

  // Recent sales
  const recentSales = useMemo(() => purchases.slice(0, 8), [purchases]);

  // UTM analytics
  const utmSourceStats = useMemo(() => {
    const sources: Record<string, { visits: number; signups: number }> = {};
    pageVisits.forEach((v) => {
      const src = v.utm_source || "(direct)";
      if (!sources[src]) sources[src] = { visits: 0, signups: 0 };
      sources[src].visits++;
    });
    profiles.forEach((p: any) => {
      const src = p.utm_source || "(direct)";
      if (!sources[src]) sources[src] = { visits: 0, signups: 0 };
      sources[src].signups++;
    });
    return Object.entries(sources)
      .map(([source, data]) => ({ source, ...data, conversionRate: data.visits > 0 ? ((data.signups / data.visits) * 100).toFixed(1) : "0" }))
      .sort((a, b) => b.visits - a.visits);
  }, [pageVisits, profiles]);

  const utmCampaignStats = useMemo(() => {
    const campaigns: Record<string, { visits: number; signups: number }> = {};
    pageVisits.filter(v => v.utm_campaign).forEach((v) => {
      const c = v.utm_campaign!;
      if (!campaigns[c]) campaigns[c] = { visits: 0, signups: 0 };
      campaigns[c].visits++;
    });
    profiles.filter((p: any) => p.utm_campaign).forEach((p: any) => {
      const c = p.utm_campaign;
      if (!campaigns[c]) campaigns[c] = { visits: 0, signups: 0 };
      campaigns[c].signups++;
    });
    return Object.entries(campaigns)
      .map(([campaign, data]) => ({ campaign, ...data, conversionRate: data.visits > 0 ? ((data.signups / data.visits) * 100).toFixed(1) : "0" }))
      .sort((a, b) => b.visits - a.visits);
  }, [pageVisits, profiles]);

  const utmMediumStats = useMemo(() => {
    const mediums: Record<string, { visits: number; signups: number }> = {};
    pageVisits.filter(v => v.utm_medium).forEach((v) => {
      const m = v.utm_medium!;
      if (!mediums[m]) mediums[m] = { visits: 0, signups: 0 };
      mediums[m].visits++;
    });
    profiles.filter((p: any) => p.utm_medium).forEach((p: any) => {
      const m = p.utm_medium;
      if (!mediums[m]) mediums[m] = { visits: 0, signups: 0 };
      mediums[m].signups++;
    });
    return Object.entries(mediums)
      .map(([medium, data]) => ({ medium, ...data, conversionRate: data.visits > 0 ? ((data.signups / data.visits) * 100).toFixed(1) : "0" }))
      .sort((a, b) => b.visits - a.visits);
  }, [pageVisits, profiles]);

  // ---- Challenge CRUD ----
  const openCreateChallenge = () => { setChallengeForm(emptyChallengeForm); setEditingChallengeId(null); setChallengeDialogOpen(true); };
  const openEditChallenge = (c: any) => {
    setChallengeForm({ name: c.name, account_size: String(c.account_size), price: String(c.price), profit_target: c.profit_target, daily_drawdown: c.daily_drawdown, max_drawdown: c.max_drawdown, min_trading_days: c.min_trading_days, leverage: c.leverage, step_type: c.step_type, is_active: c.is_active });
    setEditingChallengeId(c.id); setChallengeDialogOpen(true);
  };
  const saveChallenge = async () => {
    setSaving(true);
    const payload = { name: challengeForm.name, account_size: Number(challengeForm.account_size), price: Number(challengeForm.price), profit_target: challengeForm.profit_target, daily_drawdown: challengeForm.daily_drawdown, max_drawdown: challengeForm.max_drawdown, min_trading_days: challengeForm.min_trading_days, leverage: challengeForm.leverage, step_type: challengeForm.step_type, is_active: challengeForm.is_active };
    if (editingChallengeId) {
      const { error } = await supabase.from("challenges").update(payload).eq("id", editingChallengeId);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Challenge updated!");
    } else {
      const { error } = await supabase.from("challenges").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Challenge created!");
    }
    setChallengeDialogOpen(false); setSaving(false); fetchAll();
  };
  const deleteChallenge = async (id: string) => {
    if (!confirm("Delete this challenge?")) return;
    const { error } = await supabase.from("challenges").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Challenge deleted."); fetchAll();
  };

  // ---- Coupon CRUD ----
  const openCreateCoupon = () => { setCouponForm(emptyCouponForm); setEditingCouponId(null); setCouponDialogOpen(true); };
  const openEditCoupon = (c: any) => {
    setCouponForm({ code: c.code, discount_type: c.discount_type, discount_value: String(c.discount_value), max_uses: c.max_uses ? String(c.max_uses) : "", is_active: c.is_active, expires_at: c.expires_at ? c.expires_at.slice(0, 16) : "" });
    setEditingCouponId(c.id); setCouponDialogOpen(true);
  };
  const saveCoupon = async () => {
    setCouponSaving(true);
    const payload: any = { code: couponForm.code.toUpperCase().trim(), discount_type: couponForm.discount_type, discount_value: Number(couponForm.discount_value), max_uses: couponForm.max_uses ? Number(couponForm.max_uses) : null, is_active: couponForm.is_active, expires_at: couponForm.expires_at ? new Date(couponForm.expires_at).toISOString() : null };
    if (editingCouponId) {
      const { error } = await supabase.from("coupons").update(payload).eq("id", editingCouponId);
      if (error) { toast.error(error.message); setCouponSaving(false); return; }
      toast.success("Coupon updated!");
    } else {
      const { error } = await supabase.from("coupons").insert(payload);
      if (error) { toast.error(error.message); setCouponSaving(false); return; }
      toast.success("Coupon created!");
    }
    setCouponDialogOpen(false); setCouponSaving(false); fetchAll();
  };
  const deleteCoupon = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Coupon deleted."); fetchAll();
  };

  const updateReferralStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("affiliate_referrals").update({ commission_status: status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Commission ${status}!`); fetchAll();
  };

  const getProfileName = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    return p?.display_name || p?.email || userId.slice(0, 8) + "...";
  };

  const getChallengeNameById = (id: string) => {
    const c = challenges.find(ch => ch.id === id);
    return c?.name || "Unknown";
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

  // UTM analytics
  const utmSourceStats = useMemo(() => {
    const sources: Record<string, { visits: number; signups: number }> = {};
    pageVisits.forEach((v) => {
      const src = v.utm_source || "(direct)";
      if (!sources[src]) sources[src] = { visits: 0, signups: 0 };
      sources[src].visits++;
    });
    profiles.forEach((p: any) => {
      const src = p.utm_source || "(direct)";
      if (!sources[src]) sources[src] = { visits: 0, signups: 0 };
      sources[src].signups++;
    });
    return Object.entries(sources)
      .map(([source, data]) => ({ source, ...data, conversionRate: data.visits > 0 ? ((data.signups / data.visits) * 100).toFixed(1) : "0" }))
      .sort((a, b) => b.visits - a.visits);
  }, [pageVisits, profiles]);

  const utmCampaignStats = useMemo(() => {
    const campaigns: Record<string, { visits: number; signups: number }> = {};
    pageVisits.filter(v => v.utm_campaign).forEach((v) => {
      const c = v.utm_campaign!;
      if (!campaigns[c]) campaigns[c] = { visits: 0, signups: 0 };
      campaigns[c].visits++;
    });
    profiles.filter((p: any) => p.utm_campaign).forEach((p: any) => {
      const c = p.utm_campaign;
      if (!campaigns[c]) campaigns[c] = { visits: 0, signups: 0 };
      campaigns[c].signups++;
    });
    return Object.entries(campaigns)
      .map(([campaign, data]) => ({ campaign, ...data, conversionRate: data.visits > 0 ? ((data.signups / data.visits) * 100).toFixed(1) : "0" }))
      .sort((a, b) => b.visits - a.visits);
  }, [pageVisits, profiles]);

  const utmMediumStats = useMemo(() => {
    const mediums: Record<string, { visits: number; signups: number }> = {};
    pageVisits.filter(v => v.utm_medium).forEach((v) => {
      const m = v.utm_medium!;
      if (!mediums[m]) mediums[m] = { visits: 0, signups: 0 };
      mediums[m].visits++;
    });
    profiles.filter((p: any) => p.utm_medium).forEach((p: any) => {
      const m = p.utm_medium;
      if (!mediums[m]) mediums[m] = { visits: 0, signups: 0 };
      mediums[m].signups++;
    });
    return Object.entries(mediums)
      .map(([medium, data]) => ({ medium, ...data, conversionRate: data.visits > 0 ? ((data.signups / data.visits) * 100).toFixed(1) : "0" }))
      .sort((a, b) => b.visits - a.visits);
  }, [pageVisits, profiles]);

  const sidebarItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { id: "users", label: "Users", icon: <Users size={18} /> },
    { id: "challenges", label: "Challenges", icon: <Trophy size={18} /> },
    { id: "referrals", label: "Referrals", icon: <Link2 size={18} /> },
    { id: "coupons", label: "Coupons", icon: <Ticket size={18} /> },
    { id: "utm", label: "UTM Tracker", icon: <Globe size={18} /> },
  ];

  const statCards = [
    { label: "Total Revenue", value: `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: <DollarSign size={18} />, sub: `${purchases.filter(p => { const d = new Date(p.created_at); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length} this month` },
    { label: "Total Users", value: profiles.length.toLocaleString(), icon: <Users size={18} />, sub: `+${profiles.filter(p => { const d = new Date(p.created_at); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length} new` },
    { label: "Total Orders", value: totalOrders.toLocaleString(), icon: <ShoppingCart size={18} />, sub: `${purchases.filter(p => p.payment_status === "confirmed").length} confirmed` },
    { label: "Avg Order Value", value: `$${avgOrderValue.toFixed(0)}`, icon: <TrendingUp size={18} />, sub: "" },
    { label: "Total Payouts", value: `$${totalPayouts.toFixed(2)}`, icon: <BarChart3 size={18} />, sub: `${referrals.filter(r => r.commission_status === "pending").length} pending` },
  ];

  return (
    <div className="min-h-screen bg-[hsl(0,0%,100%)] text-[hsl(0,0%,10%)] flex">
      {/* ===== Left Sidebar ===== */}
      <div className="w-60 bg-[hsl(0,0%,98%)] border-r border-[hsl(0,0%,90%)] flex flex-col shrink-0">
        {/* Brand */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-[hsl(0,0%,90%)]">
          <img src={logo} alt="Funding Pulze" className="h-8 w-8 rounded-lg" />
          <div>
            <p className="font-display text-sm font-bold text-[hsl(0,0%,5%)] leading-tight">Funding Pulze</p>
            <p className="text-[10px] text-[hsl(0,0%,50%)]">Admin Panel</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                tab === item.id
                  ? "bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] shadow-sm"
                  : "text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,15%)] hover:bg-[hsl(0,0%,93%)]"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="border-t border-[hsl(0,0%,90%)] p-3 space-y-0.5">
          <button onClick={() => navigate("/")} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,15%)] hover:bg-[hsl(0,0%,93%)] transition-colors">
            <Home size={18} /><span>Back to Site</span>
          </button>
          <button onClick={() => { signOut(); navigate("/"); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,15%)] hover:bg-[hsl(0,0%,93%)] transition-colors">
            <LogOut size={18} /><span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* ===== Main Content ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-16 border-b border-[hsl(0,0%,90%)] flex items-center justify-between px-8 shrink-0 bg-[hsl(0,0%,100%)]">
          <div>
            <h1 className="font-display text-xl font-bold text-[hsl(0,0%,5%)] capitalize">{tab}</h1>
            <p className="text-xs text-[hsl(0,0%,50%)]">This Month</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[hsl(0,0%,0%)] flex items-center justify-center">
              <span className="text-[hsl(0,0%,100%)] text-xs font-bold">
                {user?.email?.charAt(0).toUpperCase() || "A"}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8 bg-[hsl(0,0%,96%)]">

          {/* ===== Dashboard Tab ===== */}
          {tab === "dashboard" && (
            <div className="space-y-6">
              {/* Stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {statCards.map((card) => (
                  <div key={card.label} className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-[hsl(0,0%,45%)] uppercase tracking-wide">{card.label}</span>
                      <span className="text-[hsl(0,0%,60%)]">{card.icon}</span>
                    </div>
                    <p className="text-2xl font-display font-bold text-[hsl(0,0%,5%)]">{card.value}</p>
                    {card.sub && <p className="text-[11px] text-[hsl(0,0%,50%)] mt-1">{card.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Revenue Chart */}
              <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-6">
                <div className="flex items-center gap-2 mb-6">
                  <BarChart3 size={18} className="text-[hsl(0,0%,40%)]" />
                  <h3 className="font-display font-semibold text-[hsl(0,0%,10%)]">Revenue vs Payouts</h3>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(0,0%,0%)" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="hsl(0,0%,0%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="payoutGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(0,0%,60%)" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="hsl(0,0%,60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,92%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(0,0%,50%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(0,0%,50%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <RechartsTooltip
                      contentStyle={{ background: "#000", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, ""]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(0,0%,0%)" strokeWidth={2} fill="url(#revenueGrad)" name="Revenue" dot={{ r: 3, fill: "#000" }} />
                    <Area type="monotone" dataKey="payouts" stroke="hsl(0,0%,60%)" strokeWidth={2} fill="url(#payoutGrad)" name="Payouts" dot={{ r: 3, fill: "hsl(0,0%,60%)" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Recent Sales */}
              <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-6">
                <div className="flex items-center gap-2 mb-5">
                  <ShoppingCart size={18} className="text-[hsl(0,0%,40%)]" />
                  <h3 className="font-display font-semibold text-[hsl(0,0%,10%)]">Recent Sales</h3>
                </div>
                <div className="space-y-0">
                  {recentSales.length === 0 && (
                    <p className="text-center text-sm text-[hsl(0,0%,50%)] py-8">No sales yet.</p>
                  )}
                  {recentSales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between py-3.5 border-b border-[hsl(0,0%,94%)] last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[hsl(0,0%,94%)] flex items-center justify-center">
                          <ShoppingCart size={14} className="text-[hsl(0,0%,50%)]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[hsl(0,0%,10%)]">{getProfileName(sale.user_id)}</p>
                          <p className="text-[11px] text-[hsl(0,0%,50%)]">{getChallengeNameById(sale.challenge_id)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[hsl(0,0%,5%)]">${sale.amount_paid}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            sale.payment_status === "confirmed"
                              ? "bg-[hsl(0,0%,92%)] text-[hsl(0,0%,30%)]"
                              : "bg-[hsl(0,0%,95%)] text-[hsl(0,0%,55%)]"
                          }`}>{sale.payment_status}</span>
                          <span className="text-[10px] text-[hsl(0,0%,55%)]">
                            {new Date(sale.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== Users Tab ===== */}
          {tab === "users" && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">Users</h2>
                <p className="text-xs text-[hsl(0,0%,50%)] mt-1">{profiles.length} registered users</p>
              </div>
              <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-[hsl(0,0%,45%)] border-b border-[hsl(0,0%,92%)]">
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Email</th>
                      <th className="px-5 py-3 font-medium">Referral Code</th>
                      <th className="px-5 py-3 font-medium">Invited By</th>
                      <th className="px-5 py-3 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((p) => (
                      <tr key={p.id} className="border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)] transition-colors">
                        <td className="px-5 py-3.5 text-sm font-medium text-[hsl(0,0%,10%)]">{p.display_name || "—"}</td>
                        <td className="px-5 py-3.5 text-sm text-[hsl(0,0%,45%)]">{p.email || "—"}</td>
                        <td className="px-5 py-3.5"><code className="text-xs bg-[hsl(0,0%,95%)] border border-[hsl(0,0%,88%)] px-2 py-0.5 rounded font-mono text-[hsl(0,0%,30%)]">{p.referral_code || "—"}</code></td>
                        <td className="px-5 py-3.5 text-sm text-[hsl(0,0%,45%)]">{p.referred_by ? getProfileName(p.referred_by) : <span className="text-[hsl(0,0%,75%)]">Direct</span>}</td>
                        <td className="px-5 py-3.5 text-sm text-[hsl(0,0%,50%)]">{new Date(p.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {profiles.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No users yet.</td></tr>}
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
                  <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">Challenges</h2>
                  <p className="text-xs text-[hsl(0,0%,50%)] mt-1">{challenges.length} challenges</p>
                </div>
                <Button size="sm" onClick={openCreateChallenge} className="bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)] rounded-lg text-xs font-medium">
                  <Plus size={14} className="mr-1" /> New Challenge
                </Button>
              </div>
              <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-[hsl(0,0%,45%)] border-b border-[hsl(0,0%,92%)]">
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Size</th>
                      <th className="px-5 py-3 font-medium">Price</th>
                      <th className="px-5 py-3 font-medium">Target</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {challenges.map((c) => (
                      <tr key={c.id} className="border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)] transition-colors">
                        <td className="px-5 py-3.5 text-sm font-medium text-[hsl(0,0%,10%)]">{c.name}</td>
                        <td className="px-5 py-3.5 text-sm">${c.account_size.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-sm">${c.price}</td>
                        <td className="px-5 py-3.5 text-sm text-[hsl(0,0%,45%)]">{c.profit_target}</td>
                        <td className="px-5 py-3.5 text-sm text-[hsl(0,0%,45%)]">{c.step_type}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${c.is_active ? "bg-[hsl(0,0%,92%)] text-[hsl(0,0%,25%)]" : "bg-[hsl(0,0%,96%)] text-[hsl(0,0%,60%)]"}`}>
                            {c.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditChallenge(c)} className="p-1.5 rounded-lg text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,10%)] hover:bg-[hsl(0,0%,93%)] transition-colors"><Pencil size={14} /></button>
                            <button onClick={() => deleteChallenge(c.id)} className="p-1.5 rounded-lg text-[hsl(0,0%,50%)] hover:text-[hsl(0,84%,50%)] hover:bg-[hsl(0,84%,95%)] transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {challenges.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No challenges yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== Referrals Tab ===== */}
          {tab === "referrals" && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">Referrals</h2>
                <p className="text-xs text-[hsl(0,0%,50%)] mt-1">{referrals.length} referrals</p>
              </div>
              <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-[hsl(0,0%,45%)] border-b border-[hsl(0,0%,92%)]">
                      <th className="px-5 py-3 font-medium">Referrer</th>
                      <th className="px-5 py-3 font-medium">Referred</th>
                      <th className="px-5 py-3 font-medium">Commission</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((r) => (
                      <tr key={r.id} className="border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)] transition-colors">
                        <td className="px-5 py-3.5 text-sm font-medium text-[hsl(0,0%,10%)]">{getProfileName(r.referrer_id)}</td>
                        <td className="px-5 py-3.5 text-sm">{getProfileName(r.referred_id)}</td>
                        <td className="px-5 py-3.5 text-sm font-semibold">${(r.commission_amount || 0).toFixed(2)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                            r.commission_status === "paid" ? "bg-[hsl(0,0%,90%)] text-[hsl(0,0%,20%)]" :
                            r.commission_status === "approved" ? "bg-[hsl(0,0%,92%)] text-[hsl(0,0%,30%)]" :
                            r.commission_status === "rejected" ? "bg-[hsl(0,0%,96%)] text-[hsl(0,0%,55%)]" :
                            "bg-[hsl(0,0%,94%)] text-[hsl(0,0%,40%)]"
                          }`}>{r.commission_status}</span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-[hsl(0,0%,50%)]">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {r.commission_status === "pending" && (
                              <>
                                <button onClick={() => updateReferralStatus(r.id, "approved")} className="p-1.5 rounded-lg text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,10%)] hover:bg-[hsl(0,0%,93%)] transition-colors" title="Approve"><CheckCircle2 size={15} /></button>
                                <button onClick={() => updateReferralStatus(r.id, "rejected")} className="p-1.5 rounded-lg text-[hsl(0,0%,50%)] hover:text-[hsl(0,84%,50%)] hover:bg-[hsl(0,84%,95%)] transition-colors" title="Reject"><XCircle size={15} /></button>
                              </>
                            )}
                            {r.commission_status === "approved" && (
                              <button onClick={() => updateReferralStatus(r.id, "paid")} className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)] transition-colors">Mark Paid</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {referrals.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No referrals yet.</td></tr>}
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
                  <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">Coupons</h2>
                  <p className="text-xs text-[hsl(0,0%,50%)] mt-1">{coupons.length} coupon codes</p>
                </div>
                <Button size="sm" onClick={openCreateCoupon} className="bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)] rounded-lg text-xs font-medium">
                  <Plus size={14} className="mr-1" /> New Coupon
                </Button>
              </div>
              <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-[hsl(0,0%,45%)] border-b border-[hsl(0,0%,92%)]">
                      <th className="px-5 py-3 font-medium">Code</th>
                      <th className="px-5 py-3 font-medium">Discount</th>
                      <th className="px-5 py-3 font-medium">Uses</th>
                      <th className="px-5 py-3 font-medium">Expires</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((c: any) => (
                      <tr key={c.id} className="border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)] transition-colors">
                        <td className="px-5 py-3.5"><code className="text-sm font-mono font-bold tracking-wider text-[hsl(0,0%,10%)]">{c.code}</code></td>
                        <td className="px-5 py-3.5 text-sm">{c.discount_type === "percentage" ? `${c.discount_value}%` : `$${c.discount_value}`}</td>
                        <td className="px-5 py-3.5 text-sm text-[hsl(0,0%,45%)]">{c.current_uses}{c.max_uses ? ` / ${c.max_uses}` : " / ∞"}</td>
                        <td className="px-5 py-3.5 text-sm text-[hsl(0,0%,50%)]">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "Never"}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${c.is_active ? "bg-[hsl(0,0%,92%)] text-[hsl(0,0%,25%)]" : "bg-[hsl(0,0%,96%)] text-[hsl(0,0%,60%)]"}`}>
                            {c.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditCoupon(c)} className="p-1.5 rounded-lg text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,10%)] hover:bg-[hsl(0,0%,93%)] transition-colors"><Pencil size={14} /></button>
                            <button onClick={() => deleteCoupon(c.id)} className="p-1.5 rounded-lg text-[hsl(0,0%,50%)] hover:text-[hsl(0,84%,50%)] hover:bg-[hsl(0,84%,95%)] transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {coupons.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No coupons yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== UTM Tracker Tab ===== */}
          {tab === "utm" && (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
                  <span className="text-xs font-medium text-[hsl(0,0%,45%)] uppercase tracking-wide">Total Page Visits</span>
                  <p className="text-2xl font-display font-bold text-[hsl(0,0%,5%)] mt-2">{pageVisits.length.toLocaleString()}</p>
                </div>
                <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
                  <span className="text-xs font-medium text-[hsl(0,0%,45%)] uppercase tracking-wide">UTM-Tagged Visits</span>
                  <p className="text-2xl font-display font-bold text-[hsl(0,0%,5%)] mt-2">{pageVisits.filter(v => v.utm_source).length.toLocaleString()}</p>
                </div>
                <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
                  <span className="text-xs font-medium text-[hsl(0,0%,45%)] uppercase tracking-wide">Unique Sources</span>
                  <p className="text-2xl font-display font-bold text-[hsl(0,0%,5%)] mt-2">{new Set(pageVisits.filter(v => v.utm_source).map(v => v.utm_source)).size}</p>
                </div>
              </div>

              {/* By Source */}
              <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[hsl(0,0%,92%)] flex items-center gap-2">
                  <Globe size={18} className="text-[hsl(0,0%,40%)]" />
                  <h3 className="font-display font-semibold text-[hsl(0,0%,10%)]">Performance by Source</h3>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="bg-[hsl(0,0%,97%)] text-[hsl(0,0%,45%)] text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Source</th>
                    <th className="text-left px-5 py-3 font-medium">Visits</th>
                    <th className="text-left px-5 py-3 font-medium">Signups</th>
                    <th className="text-left px-5 py-3 font-medium">Conv. Rate</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[hsl(0,0%,95%)]">
                    {utmSourceStats.map((row) => (
                      <tr key={row.source} className="hover:bg-[hsl(0,0%,98%)] transition-colors">
                        <td className="px-5 py-3 font-medium text-[hsl(0,0%,10%)]">{row.source}</td>
                        <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{row.visits}</td>
                        <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{row.signups}</td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 bg-[hsl(0,0%,95%)] rounded text-xs font-mono">{row.conversionRate}%</span>
                        </td>
                      </tr>
                    ))}
                    {utmSourceStats.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No visit data yet.</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* By Campaign */}
              <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[hsl(0,0%,92%)] flex items-center gap-2">
                  <TrendingUp size={18} className="text-[hsl(0,0%,40%)]" />
                  <h3 className="font-display font-semibold text-[hsl(0,0%,10%)]">Performance by Campaign</h3>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="bg-[hsl(0,0%,97%)] text-[hsl(0,0%,45%)] text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Campaign</th>
                    <th className="text-left px-5 py-3 font-medium">Visits</th>
                    <th className="text-left px-5 py-3 font-medium">Signups</th>
                    <th className="text-left px-5 py-3 font-medium">Conv. Rate</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[hsl(0,0%,95%)]">
                    {utmCampaignStats.map((row) => (
                      <tr key={row.campaign} className="hover:bg-[hsl(0,0%,98%)] transition-colors">
                        <td className="px-5 py-3 font-medium text-[hsl(0,0%,10%)]">{row.campaign}</td>
                        <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{row.visits}</td>
                        <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{row.signups}</td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 bg-[hsl(0,0%,95%)] rounded text-xs font-mono">{row.conversionRate}%</span>
                        </td>
                      </tr>
                    ))}
                    {utmCampaignStats.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No campaign data yet.</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* By Medium */}
              <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[hsl(0,0%,92%)] flex items-center gap-2">
                  <BarChart3 size={18} className="text-[hsl(0,0%,40%)]" />
                  <h3 className="font-display font-semibold text-[hsl(0,0%,10%)]">Performance by Medium</h3>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="bg-[hsl(0,0%,97%)] text-[hsl(0,0%,45%)] text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Medium</th>
                    <th className="text-left px-5 py-3 font-medium">Visits</th>
                    <th className="text-left px-5 py-3 font-medium">Signups</th>
                    <th className="text-left px-5 py-3 font-medium">Conv. Rate</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[hsl(0,0%,95%)]">
                    {utmMediumStats.map((row) => (
                      <tr key={row.medium} className="hover:bg-[hsl(0,0%,98%)] transition-colors">
                        <td className="px-5 py-3 font-medium text-[hsl(0,0%,10%)]">{row.medium}</td>
                        <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{row.visits}</td>
                        <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{row.signups}</td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 bg-[hsl(0,0%,95%)] rounded text-xs font-mono">{row.conversionRate}%</span>
                        </td>
                      </tr>
                    ))}
                    {utmMediumStats.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No medium data yet.</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[hsl(0,0%,92%)]">
                  <h3 className="font-display font-semibold text-[hsl(0,0%,10%)]">Recent Visits</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-[hsl(0,0%,97%)] text-[hsl(0,0%,45%)] text-xs uppercase tracking-wider">
                      <th className="text-left px-5 py-3 font-medium">Date</th>
                      <th className="text-left px-5 py-3 font-medium">Page</th>
                      <th className="text-left px-5 py-3 font-medium">Source</th>
                      <th className="text-left px-5 py-3 font-medium">Medium</th>
                      <th className="text-left px-5 py-3 font-medium">Campaign</th>
                      <th className="text-left px-5 py-3 font-medium">Referrer</th>
                    </tr></thead>
                    <tbody className="divide-y divide-[hsl(0,0%,95%)]">
                      {pageVisits.slice(0, 50).map((v: any) => (
                        <tr key={v.id} className="hover:bg-[hsl(0,0%,98%)] transition-colors">
                          <td className="px-5 py-3 text-[hsl(0,0%,40%)] whitespace-nowrap">{new Date(v.created_at).toLocaleString()}</td>
                          <td className="px-5 py-3 font-mono text-xs text-[hsl(0,0%,30%)]">{v.page_url}</td>
                          <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{v.utm_source || "—"}</td>
                          <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{v.utm_medium || "—"}</td>
                          <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{v.utm_campaign || "—"}</td>
                          <td className="px-5 py-3 text-[hsl(0,0%,40%)] text-xs max-w-[200px] truncate">{v.referrer || "—"}</td>
                        </tr>
                      ))}
                      {pageVisits.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No visits recorded yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== Challenge Dialog ===== */}
      <Dialog open={challengeDialogOpen} onOpenChange={setChallengeDialogOpen}>
        <DialogContent className="bg-[hsl(0,0%,100%)] border-[hsl(0,0%,90%)] text-[hsl(0,0%,10%)] max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-display font-semibold">{editingChallengeId ? "Edit Challenge" : "Create Challenge"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="col-span-2">
              <Label className="text-[hsl(0,0%,45%)] text-xs">Name</Label>
              <Input value={challengeForm.name} onChange={(e) => setChallengeForm({ ...challengeForm, name: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="e.g. $10K 1-Step" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Account Size ($)</Label>
              <Input type="number" value={challengeForm.account_size} onChange={(e) => setChallengeForm({ ...challengeForm, account_size: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Price ($)</Label>
              <Input type="number" value={challengeForm.price} onChange={(e) => setChallengeForm({ ...challengeForm, price: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Profit Target</Label>
              <Input value={challengeForm.profit_target} onChange={(e) => setChallengeForm({ ...challengeForm, profit_target: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="8%" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Daily Drawdown</Label>
              <Input value={challengeForm.daily_drawdown} onChange={(e) => setChallengeForm({ ...challengeForm, daily_drawdown: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="5%" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Max Drawdown</Label>
              <Input value={challengeForm.max_drawdown} onChange={(e) => setChallengeForm({ ...challengeForm, max_drawdown: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="10%" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Min Trading Days</Label>
              <Input value={challengeForm.min_trading_days} onChange={(e) => setChallengeForm({ ...challengeForm, min_trading_days: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="5" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Leverage</Label>
              <Input value={challengeForm.leverage} onChange={(e) => setChallengeForm({ ...challengeForm, leverage: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="1:100" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Step Type</Label>
              <select value={challengeForm.step_type} onChange={(e) => setChallengeForm({ ...challengeForm, step_type: e.target.value })} className="mt-1 w-full rounded-lg bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,88%)] px-3 py-2 text-sm">
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
            <Button variant="outline" className="rounded-lg border-[hsl(0,0%,88%)] text-[hsl(0,0%,45%)] hover:bg-[hsl(0,0%,96%)]" onClick={() => setChallengeDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-lg bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]" onClick={saveChallenge} disabled={saving || !challengeForm.name || !challengeForm.account_size}>
              {saving ? "Saving..." : editingChallengeId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Coupon Dialog ===== */}
      <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
        <DialogContent className="bg-[hsl(0,0%,100%)] border-[hsl(0,0%,90%)] text-[hsl(0,0%,10%)] max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-display font-semibold">{editingCouponId ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Coupon Code</Label>
              <Input value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg font-mono uppercase tracking-wider" placeholder="SAVE20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[hsl(0,0%,45%)] text-xs">Discount Type</Label>
                <select value={couponForm.discount_type} onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })} className="mt-1 w-full rounded-lg bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,88%)] px-3 py-2 text-sm">
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed ($)</option>
                </select>
              </div>
              <div>
                <Label className="text-[hsl(0,0%,45%)] text-xs">Discount Value</Label>
                <Input type="number" value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="20" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[hsl(0,0%,45%)] text-xs">Max Uses (empty = unlimited)</Label>
                <Input type="number" value={couponForm.max_uses} onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="100" />
              </div>
              <div>
                <Label className="text-[hsl(0,0%,45%)] text-xs">Expires At (optional)</Label>
                <Input type="datetime-local" value={couponForm.expires_at} onChange={(e) => setCouponForm({ ...couponForm, expires_at: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" checked={couponForm.is_active} onChange={(e) => setCouponForm({ ...couponForm, is_active: e.target.checked })} className="rounded" />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg border-[hsl(0,0%,88%)] text-[hsl(0,0%,45%)] hover:bg-[hsl(0,0%,96%)]" onClick={() => setCouponDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-lg bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]" onClick={saveCoupon} disabled={couponSaving || !couponForm.code || !couponForm.discount_value}>
              {couponSaving ? "Saving..." : editingCouponId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
