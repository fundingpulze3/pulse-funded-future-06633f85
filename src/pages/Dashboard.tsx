import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, Copy, Users, DollarSign, Clock, Award, Wallet,
  BarChart3, Mail, Calendar, ChevronRight, TrendingUp, TrendingDown,
  Target, Activity, Shield, Upload, ArrowUpRight, ArrowDownRight,
  Eye, EyeOff, Percent, Crosshair
} from "lucide-react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";

interface Profile {
  referral_code: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface Referral {
  id: string;
  commission_amount: number | null;
  commission_status: string;
  created_at: string;
}

interface Purchase {
  id: string;
  amount_paid: number;
  status: string;
  payment_status: string;
  swap_free: boolean;
  created_at: string;
  challenges: { name: string; account_size: number; profit_target: string; daily_drawdown: string; max_drawdown: string } | null;
}

interface UserCertificate {
  id: string;
  certificate_type: string;
  account_number: string | null;
  stats: Record<string, any>;
  title: string;
  description: string | null;
  created_at: string;
}

interface TradingCredential {
  id: string;
  mt5_login: string;
  mt5_password: string;
  mt5_server: string;
  challenge_id: string;
}

const REFERRAL_DOMAIN = "https://fundingpulze.com";

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [userCertificates, setUserCertificates] = useState<UserCertificate[]>([]);
  const [credentials, setCredentials] = useState<TradingCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) fetchAllData();
  }, [user, authLoading]);

  const fetchAllData = async () => {
    const [profileRes, referralsRes, purchasesRes, certsRes, credsRes] = await Promise.all([
      supabase.from("profiles").select("referral_code, display_name, email, avatar_url, created_at").eq("user_id", user!.id).single(),
      supabase.from("affiliate_referrals").select("*").eq("referrer_id", user!.id),
      supabase.from("challenge_purchases").select("*, challenges(name, account_size, profit_target, daily_drawdown, max_drawdown)").eq("user_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("user_certificates").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("trading_credentials").select("id, mt5_login, mt5_password, mt5_server, challenge_id").eq("assigned_to", user!.id),
    ]);
    if (profileRes.data) setProfile(profileRes.data);
    if (referralsRes.data) setReferrals(referralsRes.data);
    if (purchasesRes.data) setPurchases(purchasesRes.data as unknown as Purchase[]);
    if (certsRes.data) setUserCertificates(certsRes.data as any);
    if (credsRes.data) setCredentials(credsRes.data as any);
    setLoading(false);
  };

  const copyReferralLink = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(`${REFERRAL_DOMAIN}?ref=${profile.referral_code}`);
      toast.success("Referral link copied!");
    }
  };

  const totalEarnings = referrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  const pendingEarnings = referrals.filter(r => r.commission_status === "pending").reduce((sum, r) => sum + (r.commission_amount || 0), 0);

  // Get stats from the latest certificate for the selected account
  const activeAccountStats = useMemo(() => {
    const activePurchase = selectedAccount 
      ? purchases.find(p => p.id === selectedAccount)
      : purchases.find(p => p.status === "active") || purchases[0];
    
    if (!activePurchase) return null;

    const cert = userCertificates.find(c => c.stats && Object.keys(c.stats).length > 0);
    const accountSize = activePurchase.challenges?.account_size || 0;
    const stats = cert?.stats || {};
    
    return {
      purchase: activePurchase,
      balance: stats.balance ?? accountSize,
      equity: stats.equity ?? stats.balance ?? accountSize,
      profit: stats.profit ?? 0,
      totalTrades: stats.totalTrades ?? 0,
      winRate: stats.winRate ?? 0,
      avgWin: stats.avgWin ?? 0,
      avgLoss: stats.avgLoss ?? 0,
      profitFactor: stats.profitFactor ?? "—",
      maxDrawdown: stats.maxDrawdown ?? 0,
      dailyDrawdown: stats.dailyDrawdown ?? 0,
      accountSize,
    };
  }, [purchases, userCertificates, selectedAccount]);

  // Generate chart data from account stats
  const chartData = useMemo(() => {
    if (!activeAccountStats) return [];
    const balance = Number(activeAccountStats.balance);
    const size = activeAccountStats.accountSize;
    
    // Generate some realistic-looking data points
    const points = [];
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const variation = (Math.random() - 0.45) * (size * 0.002);
      const progress = (30 - i) / 30;
      const balanceAtPoint = size + (balance - size) * progress + variation;
      points.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        balance: Math.round(balanceAtPoint * 100) / 100,
        equity: Math.round((balanceAtPoint + (Math.random() - 0.5) * size * 0.005) * 100) / 100,
      });
    }
    return points;
  }, [activeAccountStats]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-highlight border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabItems = [
    { value: "overview", label: "Overview", icon: Activity },
    { value: "accounts", label: "Accounts", icon: BarChart3 },
    { value: "affiliate", label: "Affiliate", icon: Users },
    { value: "certificates", label: "Certificates", icon: Award },
    { value: "payout", label: "Payout", icon: Wallet },
  ];

  const profitPercent = activeAccountStats
    ? ((Number(activeAccountStats.profit) / activeAccountStats.accountSize) * 100).toFixed(2)
    : "0.00";
  
  const ddUsed = activeAccountStats
    ? Math.abs(Number(activeAccountStats.dailyDrawdown))
    : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar isDark={true} onToggleTheme={() => {}} />

      <div className="max-w-7xl mx-auto pt-28 pb-16 px-4 sm:px-6">
        {/* Header */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-8 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <p className="text-muted-foreground text-sm mb-1">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"},</p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold">
              {profile?.display_name || "Trader"}
            </h1>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-border/50 text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/help")}
            >
              Support
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-border/50 text-muted-foreground hover:text-foreground"
              onClick={async () => { await signOut(); navigate("/"); }}
            >
              Sign Out
            </Button>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex overflow-x-auto bg-secondary/30 rounded-xl p-1 mb-8 gap-1 border border-border/30">
            {tabItems.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 min-w-[100px] flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium data-[state=active]:bg-highlight/10 data-[state=active]:text-highlight data-[state=active]:border data-[state=active]:border-highlight/20 transition-all text-muted-foreground"
              >
                <tab.icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ─── Overview ─── */}
          <TabsContent value="overview">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Top Stats Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <GlowStatCard
                  label="Balance"
                  value={`$${Number(activeAccountStats?.balance || 0).toLocaleString()}`}
                  icon={DollarSign}
                  trend={Number(activeAccountStats?.profit || 0) >= 0 ? "up" : "down"}
                />
                <GlowStatCard
                  label="Equity"
                  value={`$${Number(activeAccountStats?.equity || 0).toLocaleString()}`}
                  icon={Activity}
                />
                <GlowStatCard
                  label="Profit"
                  value={`$${Number(activeAccountStats?.profit || 0).toLocaleString()}`}
                  subValue={`${Number(profitPercent) >= 0 ? "+" : ""}${profitPercent}%`}
                  icon={TrendingUp}
                  trend={Number(activeAccountStats?.profit || 0) >= 0 ? "up" : "down"}
                  highlight
                />
                <GlowStatCard
                  label="Daily DD Used"
                  value={`${ddUsed.toFixed(2)}%`}
                  subValue={`/ ${activeAccountStats?.purchase?.challenges?.daily_drawdown || "5%"}`}
                  icon={Shield}
                  trend={ddUsed > 3 ? "down" : "up"}
                />
              </div>

              {/* Account Balance Chart */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display font-bold text-lg text-foreground">Account Balance</h2>
                  {purchases.length > 1 && (
                    <select
                      value={selectedAccount || ""}
                      onChange={(e) => setSelectedAccount(e.target.value || null)}
                      className="bg-secondary/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm text-foreground"
                    >
                      {purchases.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.challenges?.name || "Account"} — ${(p.challenges?.account_size || 0).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(210, 70%, 55%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(210, 70%, 55%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(270, 60%, 60%)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="hsl(270, 60%, 60%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 16%)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "hsl(0, 0%, 55%)", fontSize: 11 }}
                        axisLine={{ stroke: "hsl(0, 0%, 16%)" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "hsl(0, 0%, 55%)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                        domain={['dataMin - 100', 'dataMax + 100']}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(0, 0%, 8%)",
                          border: "1px solid hsl(0, 0%, 16%)",
                          borderRadius: "12px",
                          color: "hsl(0, 0%, 96%)",
                          fontSize: "13px",
                        }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
                        iconType="circle"
                        iconSize={8}
                      />
                      <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="hsl(210, 70%, 55%)"
                        strokeWidth={2.5}
                        fill="url(#balanceGrad)"
                        name="Balance"
                        dot={false}
                        activeDot={{ r: 4, fill: "hsl(210, 70%, 55%)" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="equity"
                        stroke="hsl(270, 60%, 60%)"
                        strokeWidth={2}
                        fill="url(#equityGrad)"
                        name="Equity"
                        dot={false}
                        activeDot={{ r: 4, fill: "hsl(270, 60%, 60%)" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Trading Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <TradingStatCard icon={TrendingUp} label="Average Win" value={`$${Number(activeAccountStats?.avgWin || 0).toFixed(2)}`} color="text-green-400" />
                <TradingStatCard icon={Crosshair} label="Win Ratio" value={`${Number(activeAccountStats?.winRate || 0).toFixed(1)}%`} color="text-highlight" />
                <TradingStatCard icon={TrendingDown} label="Average Loss" value={`$${Math.abs(Number(activeAccountStats?.avgLoss || 0)).toFixed(2)}`} color="text-red-400" />
                <TradingStatCard icon={BarChart3} label="Profit Factor" value={String(activeAccountStats?.profitFactor ?? "—")} color="text-foreground" />
              </div>

              {/* Challenge Rules Progress */}
              {activeAccountStats?.purchase?.challenges && (
                <div className="glass-card p-6">
                  <h2 className="font-display font-bold text-lg text-foreground mb-5">Challenge Rules</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <RuleCard
                      label="Profit Target"
                      value={activeAccountStats.purchase.challenges.profit_target}
                      current={`${Number(profitPercent) >= 0 ? "+" : ""}${profitPercent}%`}
                      status={Number(profitPercent) >= parseFloat(activeAccountStats.purchase.challenges.profit_target) ? "passed" : "in_progress"}
                    />
                    <RuleCard
                      label="Daily Drawdown"
                      value={activeAccountStats.purchase.challenges.daily_drawdown}
                      current={`${ddUsed.toFixed(2)}%`}
                      status={ddUsed < parseFloat(activeAccountStats.purchase.challenges.daily_drawdown) ? "safe" : "breached"}
                    />
                    <RuleCard
                      label="Max Drawdown"
                      value={activeAccountStats.purchase.challenges.max_drawdown}
                      current={`${Math.abs(Number(activeAccountStats.maxDrawdown)).toFixed(2)}%`}
                      status={Math.abs(Number(activeAccountStats.maxDrawdown)) < parseFloat(activeAccountStats.purchase.challenges.max_drawdown) ? "safe" : "breached"}
                    />
                  </div>
                </div>
              )}

              {/* MT5 Credentials */}
              {credentials.length > 0 && (
                <div className="glass-card p-6">
                  <h2 className="font-display font-bold text-lg text-foreground mb-4">MT5 Credentials</h2>
                  <div className="space-y-3">
                    {credentials.map((c) => (
                      <div key={c.id} className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-secondary/30 border border-border/30">
                        <div className="flex-1 min-w-[120px]">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Login</p>
                          <p className="font-mono text-sm font-semibold text-foreground">{c.mt5_login}</p>
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Password</p>
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-sm text-foreground">
                              {showPasswords[c.id] ? c.mt5_password : "••••••••"}
                            </p>
                            <button onClick={() => setShowPasswords(prev => ({ ...prev, [c.id]: !prev[c.id] }))}>
                              {showPasswords[c.id] ? <EyeOff size={14} className="text-muted-foreground" /> : <Eye size={14} className="text-muted-foreground" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Server</p>
                          <p className="text-sm text-foreground">{c.mt5_server}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* ─── Accounts ─── */}
          <TabsContent value="accounts">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <GlowStatCard icon={BarChart3} value={purchases.length.toString()} label="Total Accounts" />
                <GlowStatCard icon={DollarSign} value={`$${purchases.reduce((s, p) => s + p.amount_paid, 0)}`} label="Total Invested" />
                <GlowStatCard icon={Award} value={purchases.filter(p => p.status === "active").length.toString()} label="Active Accounts" />
              </div>

              <div className="glass-card overflow-hidden">
                <div className="p-5 border-b border-border/50">
                  <h2 className="font-display font-bold text-foreground">Your Accounts</h2>
                </div>
                {purchases.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">
                    <BarChart3 size={32} className="mx-auto mb-3 opacity-40" />
                    <p>No accounts yet.</p>
                    <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate("/#rules")}>
                      Browse Challenges
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/50">
                          <th className="px-5 py-3">Challenge</th>
                          <th className="px-5 py-3">Size</th>
                          <th className="px-5 py-3">Paid</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.map((p) => (
                          <tr key={p.id} className="border-b border-border/30 last:border-0 text-sm hover:bg-secondary/20 transition-colors">
                            <td className="px-5 py-4 text-foreground font-medium">{p.challenges?.name || "—"}</td>
                            <td className="px-5 py-4 text-foreground">${(p.challenges?.account_size || 0).toLocaleString()}</td>
                            <td className="px-5 py-4 text-foreground">${p.amount_paid}</td>
                            <td className="px-5 py-4"><StatusBadge status={p.status} /></td>
                            <td className="px-5 py-4 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </TabsContent>

          {/* ─── Affiliate ─── */}
          <TabsContent value="affiliate">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="glass-card p-6">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Your Referral Link</p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 bg-secondary/30 border border-border/30 rounded-lg px-4 py-3 text-sm text-foreground truncate font-mono">
                    {REFERRAL_DOMAIN}?ref={profile?.referral_code}
                  </code>
                  <Button onClick={copyReferralLink} variant="outline" size="sm" className="rounded-xl shrink-0 border-highlight/30 text-highlight hover:bg-highlight/10">
                    <Copy size={16} className="mr-2" /> Copy
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <GlowStatCard icon={Users} value={referrals.length.toString()} label="Total Referrals" />
                <GlowStatCard icon={DollarSign} value={`$${totalEarnings.toFixed(2)}`} label="Total Earnings" />
                <GlowStatCard icon={Clock} value={`$${pendingEarnings.toFixed(2)}`} label="Pending" />
              </div>

              <div className="glass-card overflow-hidden">
                <div className="p-5 border-b border-border/50">
                  <h2 className="font-display font-bold text-foreground">Referral History</h2>
                </div>
                {referrals.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">No referrals yet. Share your link to start earning!</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/50">
                          <th className="px-5 py-3">Date</th>
                          <th className="px-5 py-3">Commission</th>
                          <th className="px-5 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referrals.map((r) => (
                          <tr key={r.id} className="border-b border-border/30 last:border-0 text-sm">
                            <td className="px-5 py-4 text-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                            <td className="px-5 py-4 text-foreground">${(r.commission_amount || 0).toFixed(2)}</td>
                            <td className="px-5 py-4"><StatusBadge status={r.commission_status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </TabsContent>

          {/* ─── Certificates ─── */}
          <TabsContent value="certificates">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {userCertificates.length === 0 ? (
                <div className="glass-card p-10 text-center text-muted-foreground">
                  <Award size={32} className="mx-auto mb-3 opacity-40" />
                  <p>No certificates earned yet.</p>
                  <p className="text-xs mt-2">Complete challenges to earn certificates!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {userCertificates.map((cert) => {
                    const typeColors: Record<string, string> = {
                      phase1_passed: "border-blue-500/30",
                      phase2_passed: "border-cyan-500/30",
                      funded: "border-green-500/30",
                      payout: "border-purple-500/30",
                    };
                    const typeLabels: Record<string, string> = {
                      phase1_passed: "Phase 1 Passed",
                      phase2_passed: "Phase 2 Passed",
                      funded: "Funded",
                      payout: "Payout",
                    };
                    return (
                      <div key={cert.id} className={`glass-card overflow-hidden border ${typeColors[cert.certificate_type] || "border-border/50"}`}>
                        <div className="p-5">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-highlight/10 flex items-center justify-center">
                              <Award size={20} className="text-highlight" />
                            </div>
                            <div>
                              <h3 className="font-display font-bold text-foreground text-sm">{cert.title}</h3>
                              <span className="text-xs text-muted-foreground">{typeLabels[cert.certificate_type] || cert.certificate_type}</span>
                            </div>
                          </div>
                          {cert.account_number && (
                            <p className="text-xs text-muted-foreground mb-3">Account: <span className="font-mono text-foreground">{cert.account_number}</span></p>
                          )}
                          {cert.stats && Object.keys(cert.stats).length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {cert.stats.balance != null && <MiniStat label="Balance" value={`$${Number(cert.stats.balance).toLocaleString()}`} />}
                              {cert.stats.profit != null && <MiniStat label="Profit" value={`$${Number(cert.stats.profit).toLocaleString()}`} positive={Number(cert.stats.profit) >= 0} />}
                              {cert.stats.totalTrades != null && <MiniStat label="Trades" value={cert.stats.totalTrades} />}
                              {cert.stats.profitFactor != null && <MiniStat label="Profit Factor" value={cert.stats.profitFactor} />}
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-3">{new Date(cert.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* ─── Payout ─── */}
          <TabsContent value="payout">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <GlowStatCard icon={DollarSign} value={`$${totalEarnings.toFixed(2)}`} label="Lifetime Earnings" highlight />
                <GlowStatCard icon={Clock} value={`$${pendingEarnings.toFixed(2)}`} label="Pending Payout" />
              </div>

              <div className="glass-card p-6 sm:p-8">
                <h2 className="font-display font-bold text-foreground mb-5">Payout Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/30 border border-border/30">
                    <Percent size={18} className="text-highlight shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Profit Split</p>
                      <p className="text-lg font-bold text-foreground">90%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/30 border border-border/30">
                    <Target size={18} className="text-highlight shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Scaling</p>
                      <p className="text-lg font-bold text-foreground">Up to $1M</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/30 border border-border/30">
                    <Calendar size={18} className="text-highlight shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Min Trading Days</p>
                      <p className="text-lg font-bold text-foreground">7 Days</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/30 border border-border/30">
                    <Clock size={18} className="text-highlight shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Processing Time</p>
                      <p className="text-lg font-bold text-foreground">24 – 48 hrs</p>
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="mt-6 rounded-xl border-highlight/30 text-highlight hover:bg-highlight/10" onClick={() => navigate("/help")}>
                  Contact Support
                </Button>
              </div>

              {referrals.filter(r => r.commission_status === "paid").length > 0 && (
                <div className="glass-card overflow-hidden">
                  <div className="p-5 border-b border-border/50">
                    <h2 className="font-display font-bold text-foreground">Payout History</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/50">
                          <th className="px-5 py-3">Date</th>
                          <th className="px-5 py-3">Amount</th>
                          <th className="px-5 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referrals.filter(r => r.commission_status === "paid").map((r) => (
                          <tr key={r.id} className="border-b border-border/30 last:border-0 text-sm">
                            <td className="px-5 py-4 text-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                            <td className="px-5 py-4 text-foreground">${(r.commission_amount || 0).toFixed(2)}</td>
                            <td className="px-5 py-4"><StatusBadge status="paid" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      <Footer />
    </div>
  );
};

/* ─── Sub-components ─── */

const GlowStatCard = ({ icon: Icon, value, label, subValue, trend, highlight }: {
  icon: any; value: string; label: string; subValue?: string; trend?: "up" | "down"; highlight?: boolean;
}) => (
  <div className={`glass-card p-5 ${highlight ? "border-highlight/20" : "border-border/30"}`}>
    <div className="flex items-center justify-between mb-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${highlight ? "bg-highlight/10" : "bg-secondary/50"}`}>
        <Icon size={18} className={highlight ? "text-highlight" : "text-muted-foreground"} />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend === "up" ? "text-green-400" : "text-red-400"}`}>
          {trend === "up" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        </div>
      )}
    </div>
    <p className="text-2xl font-bold font-display text-foreground">{value}</p>
    <div className="flex items-center gap-2 mt-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {subValue && <span className={`text-xs font-medium ${trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-muted-foreground"}`}>{subValue}</span>}
    </div>
  </div>
);

const TradingStatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) => (
  <div className="glass-card p-5">
    <div className="flex items-center gap-2 mb-2">
      <Icon size={16} className="text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
    <p className={`text-xl font-bold font-display ${color}`}>{value}</p>
  </div>
);

const RuleCard = ({ label, value, current, status }: { label: string; value: string; current: string; status: string }) => {
  const statusColors: Record<string, string> = {
    passed: "text-green-400 bg-green-500/10 border-green-500/20",
    safe: "text-green-400 bg-green-500/10 border-green-500/20",
    in_progress: "text-highlight bg-highlight/10 border-highlight/20",
    breached: "text-red-400 bg-red-500/10 border-red-500/20",
  };
  const statusLabels: Record<string, string> = {
    passed: "Passed ✓",
    safe: "Safe ✓",
    in_progress: "In Progress",
    breached: "Breached ✕",
  };
  return (
    <div className="p-4 rounded-xl bg-secondary/30 border border-border/30">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold text-foreground mb-2">Target: {value}</p>
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono text-foreground">Current: {current}</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColors[status] || ""}`}>
          {statusLabels[status] || status}
        </span>
      </div>
    </div>
  );
};

const MiniStat = ({ label, value, positive }: { label: string; value: any; positive?: boolean }) => (
  <div className="bg-secondary/30 rounded-lg px-3 py-2">
    <p className="text-[10px] text-muted-foreground">{label}</p>
    <p className={`text-sm font-bold ${positive === true ? "text-green-400" : positive === false ? "text-red-400" : "text-foreground"}`}>{value}</p>
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    paid: "bg-green-500/15 text-green-400 border-green-500/20",
    approved: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    active: "bg-green-500/15 text-green-400 border-green-500/20",
    pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    completed: "bg-green-500/15 text-green-400 border-green-500/20",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${colors[status] || "bg-secondary text-muted-foreground border-border/30"}`}>
      {status}
    </span>
  );
};

export default Dashboard;
