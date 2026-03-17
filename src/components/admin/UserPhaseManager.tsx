import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateAndUploadCertificate } from "@/lib/generateCertificateImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertCircle, CheckCircle2, RefreshCw, Loader2, Search, X,
  TrendingUp, TrendingDown, Activity, DollarSign, BarChart3,
  ArrowLeft, User, CreditCard, Calendar, Target, Shield,
} from "lucide-react";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

interface UserAccount {
  purchaseId: string;
  userId: string;
  userName: string;
  email: string;
  challengeName: string;
  challengeId: string;
  accountSize: number;
  stepType: string;
  status: string;
  mt5Login: string | null;
  credentialId: string | null;
  createdAt: string;
  stats: Record<string, any> | null;
}

const PHASES = [
  { value: "pending", label: "Pending", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { value: "active", label: "Active (Phase 1)", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "phase2", label: "Phase 2", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { value: "funded", label: "Funded", color: "bg-green-50 text-green-700 border-green-200" },
  { value: "breached", label: "Breached", color: "bg-red-50 text-red-700 border-red-200" },
  { value: "completed", label: "Completed", color: "bg-purple-50 text-purple-700 border-purple-200" },
];

const UserPhaseManager = () => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAccount, setSelectedAccount] = useState<UserAccount | null>(null);

  useEffect(() => { fetchAccounts(); }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    const [purchasesRes, profilesRes, challengesRes, credsRes, certsRes] = await Promise.all([
      supabase.from("challenge_purchases").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, display_name, email"),
      supabase.from("challenges").select("id, name, account_size, step_type"),
      supabase.from("trading_credentials").select("id, mt5_login, challenge_id, assigned_to, purchase_id, is_assigned"),
      supabase.from("user_certificates").select("purchase_id, account_number, stats"),
    ]);

    const profiles = profilesRes.data || [];
    const challenges = challengesRes.data || [];
    const creds = credsRes.data || [];
    const certs = certsRes.data || [];
    const purchases = (purchasesRes.data || []).filter((p: any) => {
      const paymentStatus = String(p.payment_status || "").toLowerCase();
      const status = String(p.status || "").toLowerCase();
      return ["paid", "confirmed", "completed"].includes(paymentStatus) && status !== "pending";
    });

    const mapped: UserAccount[] = purchases.map(p => {
      const profile = profiles.find(pr => pr.user_id === p.user_id);
      const challenge = challenges.find(c => c.id === p.challenge_id);
      const cred = creds.find(c => c.purchase_id === p.id);
      // Find stats for this purchase
      const cert = certs.find(c => c.purchase_id === p.id && c.stats && Object.keys(c.stats as any).length > 0)
        || (cred ? certs.find(c => c.account_number === cred.mt5_login && c.stats && Object.keys(c.stats as any).length > 0) : null);
      return {
        purchaseId: p.id,
        userId: p.user_id,
        userName: profile?.display_name || profile?.email?.split("@")[0] || "Unknown",
        email: profile?.email || "",
        challengeName: challenge?.name || "Unknown",
        challengeId: p.challenge_id,
        accountSize: challenge?.account_size || 0,
        stepType: challenge?.step_type || "",
        status: p.status,
        mt5Login: cred?.mt5_login || null,
        credentialId: cred?.id || null,
        createdAt: p.created_at,
        stats: (cert?.stats as Record<string, any>) || null,
      };
    });

    setAccounts(mapped);
    // Update selected account if it exists
    if (selectedAccount) {
      const updated = mapped.find(a => a.purchaseId === selectedAccount.purchaseId);
      setSelectedAccount(updated || null);
    }
    setLoading(false);
  };

  const changePhase = async (account: UserAccount, newStatus: string) => {
    setUpdating(account.purchaseId);
    const oldStatus = account.status;

    const { error } = await supabase
      .from("challenge_purchases")
      .update({ status: newStatus })
      .eq("id", account.purchaseId);

    if (error) {
      toast.error(error.message);
      setUpdating(null);
      return;
    }

    // Log status change
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("account_status_history").insert({
      purchase_id: account.purchaseId,
      user_id: account.userId,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: session?.user?.id || null,
    } as any);

    // Auto-assign credentials if moving to active phase and no creds assigned
    if ((newStatus === "active" || newStatus === "phase2" || newStatus === "funded") && !account.mt5Login) {
      const { data: availableCred } = await supabase
        .from("trading_credentials")
        .select("*")
        .eq("is_assigned", false)
        .eq("challenge_id", account.challengeId)
        .limit(1)
        .single();

      if (availableCred) {
        await supabase
          .from("trading_credentials")
          .update({
            is_assigned: true,
            assigned_to: account.userId,
            purchase_id: account.purchaseId,
            assigned_at: new Date().toISOString(),
          })
          .eq("id", availableCred.id);
        toast.success(`Credentials auto-assigned: FP ${availableCred.mt5_login}`);
      } else {
        toast.warning("No available credentials in pool!");
      }
    }

    // Auto-generate certificate for passed phases
    if (newStatus === "completed" || newStatus === "phase2" || newStatus === "funded") {
      const certType = newStatus === "phase2" ? "phase1_passed" : newStatus === "funded" ? "phase2_passed" : "funded";
      const certTitle = newStatus === "phase2" ? "Phase 1 Passed" : newStatus === "funded" ? "Phase 2 Passed" : "Funded Account";

      // Get template background
      const { data: template } = await supabase
        .from("certificate_templates")
        .select("background_image_url")
        .eq("certificate_type", certType)
        .maybeSingle();

      const certId = crypto.randomUUID();
      let certificateImageUrl: string | null = null;

      if (template?.background_image_url) {
        const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        certificateImageUrl = await generateAndUploadCertificate(supabase, {
          certId,
          backgroundUrl: template.background_image_url,
          userName: account.userName,
          date: dateStr,
          certificateType: certType,
        });
      }

      await supabase.from("user_certificates").insert({
        id: certId,
        user_id: account.userId,
        certificate_type: certType,
        account_number: account.mt5Login,
        title: certTitle,
        description: `${account.userName} - ${account.challengeName}`,
        credential_id: account.credentialId,
        purchase_id: account.purchaseId,
        certificate_image_url: certificateImageUrl,
        stats: { accountSize: account.accountSize, userName: account.userName },
      });
      toast.success(`Certificate "${certTitle}" issued`);
    }

    toast.success(`Status → ${newStatus}`);
    setUpdating(null);
    fetchAccounts();
  };

  const filtered = useMemo(() => {
    return accounts.filter(a => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        a.userName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.mt5Login && a.mt5Login.includes(q)) ||
        a.challengeName.toLowerCase().includes(q) ||
        a.purchaseId.toLowerCase().includes(q)
      );
    });
  }, [accounts, searchQuery, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: accounts.length };
    PHASES.forEach(p => { counts[p.value] = accounts.filter(a => a.status === p.value).length; });
    return counts;
  }, [accounts]);

  // Build chart data for selected account
  const chartData = useMemo(() => {
    if (!selectedAccount?.stats?.balanceChart || !Array.isArray(selectedAccount.stats.balanceChart)) {
      if (!selectedAccount) return [];
      return [
        { date: "Start", balance: selectedAccount.accountSize },
        { date: "Now", balance: selectedAccount.stats?.balance ?? selectedAccount.accountSize },
      ];
    }
    return selectedAccount.stats.balanceChart.map((p: any) => ({
      date: new Date(p.timestamp * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      balance: Math.round(p.balance * 100) / 100,
    }));
  }, [selectedAccount]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-[hsl(0,0%,30%)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Account Detail View ──
  if (selectedAccount) {
    const s = selectedAccount.stats || {};
    const phase = PHASES.find(p => p.value === selectedAccount.status) || PHASES[0];
    const balance = s.balance ?? selectedAccount.accountSize;
    const profit = s.profit ?? 0;
    const equity = s.equity ?? balance;
    const totalTrades = s.totalTrades ?? 0;
    const winRate = s.winRate ?? 0;
    const maxDD = s.maxDrawdownPercent ?? 0;
    const gainPercent = s.gainPercent ?? (profit / selectedAccount.accountSize * 100);
    const profitFactor = s.profitFactor ?? 0;

    return (
      <div className="space-y-5">
        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedAccount(null)}
            className="p-2 rounded-lg hover:bg-[hsl(0,0%,93%)] transition-colors"
          >
            <ArrowLeft size={18} className="text-[hsl(0,0%,30%)]" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-[hsl(0,0%,8%)]">
                FP {selectedAccount.mt5Login || "—"}
              </h2>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border ${phase.color}`}>
                {phase.label}
              </span>
            </div>
            <p className="text-xs text-[hsl(0,0%,50%)] mt-0.5">
              {selectedAccount.userName} · {selectedAccount.email} · {selectedAccount.challengeName} · Created {new Date(selectedAccount.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Phase Selector */}
        <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] p-4">
          <p className="text-xs font-semibold text-[hsl(0,0%,40%)] uppercase tracking-wider mb-3">Change Status</p>
          <div className="flex flex-wrap gap-2">
            {PHASES.map(p => (
              <button
                key={p.value}
                disabled={updating === selectedAccount.purchaseId || selectedAccount.status === p.value}
                onClick={() => changePhase(selectedAccount, p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  selectedAccount.status === p.value
                    ? p.color + " ring-2 ring-offset-1 ring-current"
                    : "bg-[hsl(0,0%,96%)] text-[hsl(0,0%,40%)] border-[hsl(0,0%,90%)] hover:bg-[hsl(0,0%,92%)]"
                }`}
              >
                {p.label}
              </button>
            ))}
            {updating === selectedAccount.purchaseId && <Loader2 size={14} className="animate-spin text-[hsl(0,0%,50%)] self-center" />}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Balance", value: `$${Number(balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-[hsl(207,80%,50%)]" },
            { label: "Equity", value: `$${Number(equity).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-[hsl(142,60%,40%)]" },
            { label: "Profit", value: `$${Number(profit).toFixed(2)}`, icon: profit >= 0 ? TrendingUp : TrendingDown, color: profit >= 0 ? "text-[hsl(142,60%,40%)]" : "text-[hsl(0,70%,50%)]" },
            { label: "Trades", value: String(totalTrades), icon: Activity, color: "text-[hsl(270,60%,55%)]" },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-[hsl(0,0%,90%)] p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[hsl(0,0%,50%)] font-medium">{card.label}</span>
                <card.icon size={14} className={card.color} />
              </div>
              <p className="text-lg font-bold text-[hsl(0,0%,8%)]">{card.value}</p>
            </div>
          ))}
        </div>

        {/* More stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Win Rate", value: `${Number(winRate).toFixed(1)}%` },
            { label: "Gain", value: `${Number(gainPercent).toFixed(2)}%` },
            { label: "Max Drawdown", value: `${Number(maxDD).toFixed(2)}%` },
            { label: "Profit Factor", value: Number(profitFactor).toFixed(2) },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-[hsl(0,0%,90%)] p-3.5">
              <span className="text-[10px] text-[hsl(0,0%,50%)] font-medium">{card.label}</span>
              <p className="text-base font-bold text-[hsl(0,0%,8%)] mt-0.5">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Balance Chart */}
        {chartData.length > 1 && (
          <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] p-4">
            <p className="text-xs font-semibold text-[hsl(0,0%,40%)] uppercase tracking-wider mb-3">Balance Chart</p>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="adminBalanceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(207,80%,55%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(207,80%,55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,92%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(0,0%,50%)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(0,0%,50%)" }} domain={["dataMin - 10", "dataMax + 10"]} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(0,0%,90%)" }} />
                  <Area type="monotone" dataKey="balance" stroke="hsl(207,80%,55%)" fill="url(#adminBalanceGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Account Info */}
        <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] p-4">
          <p className="text-xs font-semibold text-[hsl(0,0%,40%)] uppercase tracking-wider mb-3">Account Details</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6 text-sm">
            {[
              ["User", selectedAccount.userName],
              ["Email", selectedAccount.email],
              ["Challenge", selectedAccount.challengeName],
              ["Step Type", selectedAccount.stepType],
              ["Account Size", `$${selectedAccount.accountSize.toLocaleString()}`],
              ["FP Login", selectedAccount.mt5Login || "Not assigned"],
              ["Purchase ID", selectedAccount.purchaseId.slice(0, 12) + "…"],
              ["Created", new Date(selectedAccount.createdAt).toLocaleString()],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-[10px] text-[hsl(0,0%,50%)] font-medium">{label}</p>
                <p className="text-[hsl(0,0%,15%)] font-medium truncate">{val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(0,0%,50%)]" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, account number, challenge..."
            className="pl-9 h-9 text-sm rounded-lg border-[hsl(0,0%,88%)] bg-white"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(0,0%,60%)] hover:text-[hsl(0,0%,30%)]">
              <X size={14} />
            </button>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={fetchAccounts} className="text-xs rounded-lg border-[hsl(0,0%,88%)] h-9">
          <RefreshCw size={12} className="mr-1" /> Refresh
        </Button>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
            statusFilter === "all" ? "bg-[hsl(0,0%,8%)] text-white" : "bg-[hsl(0,0%,95%)] text-[hsl(0,0%,45%)] hover:bg-[hsl(0,0%,90%)]"
          }`}
        >
          All ({statusCounts.all})
        </button>
        {PHASES.map(p => (
          <button
            key={p.value}
            onClick={() => setStatusFilter(p.value)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              statusFilter === p.value ? "bg-[hsl(0,0%,8%)] text-white" : "bg-[hsl(0,0%,95%)] text-[hsl(0,0%,45%)] hover:bg-[hsl(0,0%,90%)]"
            }`}
          >
            {p.label.split(" (")[0]} ({statusCounts[p.value] || 0})
          </button>
        ))}
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[hsl(0,0%,92%)]">
          <h3 className="font-semibold text-sm text-[hsl(0,0%,10%)]">
            {searchQuery ? `Results (${filtered.length})` : `User Accounts (${filtered.length})`}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[hsl(0,0%,45%)] border-b border-[hsl(0,0%,92%)]">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Challenge</th>
                <th className="px-4 py-3 font-medium">FP Login</th>
                <th className="px-4 py-3 font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">Phase / Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(account => {
                const phase = PHASES.find(p => p.value === account.status) || PHASES[0];
                const balance = account.stats?.balance ?? account.accountSize;
                const profit = account.stats?.profit ?? 0;
                return (
                  <tr
                    key={account.purchaseId}
                    onClick={() => setSelectedAccount(account)}
                    className="border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(207,50%,97%)] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[hsl(0,0%,10%)]">{account.userName}</p>
                      <p className="text-[10px] text-[hsl(0,0%,50%)]">{account.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[hsl(0,0%,20%)]">{account.challengeName}</p>
                      <p className="text-[10px] text-[hsl(0,0%,50%)]">{account.stepType}</p>
                    </td>
                    <td className="px-4 py-3">
                      {account.mt5Login ? (
                        <code className="text-xs bg-[hsl(0,0%,95%)] px-2 py-0.5 rounded font-mono">{account.mt5Login}</code>
                      ) : (
                        <span className="text-xs text-[hsl(0,0%,60%)]">Not assigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[hsl(0,0%,10%)]">${Number(balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                      {profit !== 0 && (
                        <p className={`text-[10px] font-medium ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {profit >= 0 ? "+" : ""}{Number(profit).toFixed(2)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border ${phase.color}`}>
                        {phase.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">
                  {searchQuery ? "No accounts match your search." : "No user accounts yet."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserPhaseManager;
