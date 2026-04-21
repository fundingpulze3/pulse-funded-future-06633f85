import { useEffect, useState, useMemo } from "react";
import AnnouncementBar from "@/components/AnnouncementBar";
import fpLogoIcon from "@/assets/fp-logo-icon.png";
import rankStudentImg from "@/assets/rank-student.png";
import rankPractitionerImg from "@/assets/rank-practitioner.png";
import rankMasterImg from "@/assets/rank-master.png";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  User, Copy, Users, DollarSign, Clock, Award, Wallet,
  BarChart3, Calendar, TrendingUp, TrendingDown,
  Target, Activity, Shield, ArrowUpRight, ArrowDownRight,
  Eye, EyeOff, Percent, Zap, Key, LayoutDashboard, ChevronDown,
  LogOut, HelpCircle, Home, PieChart, Menu, X, Plus,
  Settings, CreditCard, Filter
} from "lucide-react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";
import TradingObjectives from "@/components/dashboard/TradingObjectives";
import TradingCalendar from "@/components/dashboard/TradingCalendar";
import SymbolsPieChart from "@/components/dashboard/SymbolsPieChart";

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
  challenge_id: string;
  amount_paid: number;
  status: string;
  payment_status: string;
  swap_free: boolean;
  created_at: string;
  challenges: { name: string; account_size: number; profit_target: string; daily_drawdown: string; max_drawdown: string; step_type: string } | null;
}

interface UserCertificate {
  id: string;
  certificate_type: string;
  account_number: string | null;
  stats: Record<string, any>;
  title: string;
  description: string | null;
  created_at: string;
  credential_id: string | null;
  purchase_id: string | null;
}

interface TradingCredential {
  id: string;
  mt5_login: string;
  mt5_password: string;
  mt5_server: string;
  challenge_id: string;
  purchase_id: string | null;
}

const REFERRAL_DOMAIN = "https://fundingpulze.com";

type AccountFilter = "all" | "1-step" | "2-step" | "ongoing" | "breached" | "funded" | "completed";
type SidebarTab = "overview" | "affiliate";
type StepFilter = "all" | "1-step" | "2-step";
type StatusFilter = "all" | "ongoing" | "funded" | "breached" | "completed";

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.add("dark");
    // Add noindex meta tag
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex, nofollow";
    return () => { if (meta) meta.remove(); };
  }, []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [userCertificates, setUserCertificates] = useState<UserCertificate[]>([]);
  const [credentials, setCredentials] = useState<TradingCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [stepFilter, setStepFilter] = useState<StepFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const searchParams = new URLSearchParams(window.location.search);
  const activeView: SidebarTab = searchParams.get("view") === "affiliate" ? "affiliate" : "overview";
  const setActiveView = (v: SidebarTab) => {
    if (v === "affiliate") navigate("/dashboard?view=affiliate");
    else navigate("/dashboard");
  };
  const [certTemplates, setCertTemplates] = useState<Record<string, string>>({});
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [credDialogPurchaseId, setCredDialogPurchaseId] = useState<string | null>(null);
  const [stepDropdownOpen, setStepDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) fetchAllData();
  }, [user, authLoading]);

  // selectedAccount is a "view key": either `cred:<credentialId>` or `purchase:<purchaseId>`
  // (used for purchases that don't have any credential assigned yet).
  // We DON'T auto-select here yet — we wait until accountViews is built below.

  const withTimeout = <T,>(promise: Promise<T>, ms = 12000): Promise<T> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Dashboard request timeout")), ms);
      promise.then(v => { clearTimeout(timer); resolve(v); }).catch(e => { clearTimeout(timer); reject(e); });
    });

  const fetchAllData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setLoadError(null);
      const [profileRes, referralsRes, purchasesRes, certsRes, credsRes, templatesRes] = await withTimeout(
        Promise.all([
          supabase.from("profiles").select("referral_code, display_name, email, avatar_url, created_at").eq("user_id", user.id).maybeSingle(),
          supabase.from("affiliate_referrals").select("*").eq("referrer_id", user.id),
          supabase.from("challenge_purchases").select("*, challenges(name, account_size, profit_target, daily_drawdown, max_drawdown, step_type)").eq("user_id", user.id).in("payment_status", ["paid", "confirmed", "completed"]).order("created_at", { ascending: false }),
          supabase.from("user_certificates").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
          supabase.from("trading_credentials").select("id, mt5_login, mt5_password, mt5_server, challenge_id, purchase_id").eq("assigned_to", user.id),
          supabase.from("certificate_templates").select("certificate_type, background_image_url"),
        ])
      );
      const fatalError = purchasesRes.error;
      if (fatalError) throw fatalError;
      setProfile(profileRes.data ?? null);
      setReferrals(referralsRes.data ?? []);
      setPurchases((purchasesRes.data as unknown as Purchase[]) ?? []);
      setUserCertificates((certsRes.data as any) ?? []);
      setCredentials((credsRes.data as any) ?? []);
      const tMap: Record<string, string> = {};
      (templatesRes.data || []).forEach((t: any) => { tMap[t.certificate_type] = t.background_image_url; });
      setCertTemplates(tMap);
    } catch (error) {
      console.error("Dashboard load failed:", error);
      setLoadError("Could not load dashboard data. Please retry.");
      toast.error("Dashboard failed to load");
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(`${REFERRAL_DOMAIN}?ref=${profile.referral_code}`);
      toast.success("Referral link copied!");
    }
  };

  const totalEarnings = referrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  const pendingEarnings = referrals.filter(r => r.commission_status === "pending").reduce((sum, r) => sum + (r.commission_amount || 0), 0);

  const getAccountStatus = (purchase: Purchase): string => {
    const status = purchase.status.toLowerCase();
    if (status === "breached" || status === "failed") return "breached";
    if (status === "funded") return "funded";
    if (status === "completed" || status === "passed") return "completed";
    return "ongoing";
  };

  const getStepType = (purchase: Purchase): string => purchase.challenges?.step_type?.toLowerCase() || "";

  const getRank = (purchase: Purchase): { label: string; img: string; color: string } => {
    const status = purchase.status.toLowerCase();
    const stepType = (purchase.challenges?.step_type || "").toLowerCase();
    if (status === "funded") return { label: "Master", img: rankMasterImg, color: "text-[hsl(45,90%,55%)]" };
    if (stepType.includes("one") || stepType.includes("1")) {
      return { label: "Practitioner", img: rankPractitionerImg, color: "text-[hsl(270,70%,65%)]" };
    }
    if (status === "phase2") return { label: "Practitioner", img: rankPractitionerImg, color: "text-[hsl(270,70%,65%)]" };
    return { label: "Student", img: rankStudentImg, color: "text-[hsl(207,80%,65%)]" };
  };

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      // Step filter
      if (stepFilter === "1-step" && !getStepType(p).includes("1")) return false;
      if (stepFilter === "2-step" && !getStepType(p).includes("2")) return false;
      // Status filter
      if (statusFilter !== "all" && getAccountStatus(p) !== statusFilter) return false;
      return true;
    });
  }, [purchases, stepFilter, statusFilter]);

  // A "rich" stat blob has actual MT5 fields like balance/totalTrades, not just {userName, accountSize}
  const isRichStats = (stats: Record<string, any> | null | undefined): boolean => {
    if (!stats || typeof stats !== "object") return false;
    return (
      typeof stats.balance === "number" ||
      typeof stats.totalTrades === "number" ||
      typeof stats.equity === "number" ||
      typeof stats.profit === "number"
    );
  };

  // Pick the freshest cert that actually contains parsed MT5 stats for this account
  const pickRichestCert = (matcher: (c: UserCertificate) => boolean): UserCertificate | null => {
    const candidates = userCertificates.filter(c => matcher(c) && isRichStats(c.stats));
    if (candidates.length === 0) return null;
    // Prefer latest_stats type, otherwise the most recently created
    const latest = candidates.find(c => c.certificate_type === "latest_stats");
    if (latest) return latest;
    return [...candidates].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  };

  // ── Build "Account Views" ──────────────────────────────────────────────
  // We render ONE card per CREDENTIAL (so phase 1 cred stays visible even after
  // the trader gets a phase 2 cred under the same purchase). A purchase that
  // has zero credentials still gets a single placeholder view.
  type AccountView = {
    key: string;                         // unique key for selection (`cred:<id>` or `purchase:<id>`)
    purchase: Purchase;
    credential: TradingCredential | null;
    accountNumber: string;               // mt5_login if available, else fallback
    phaseLabel: "Phase 1" | "Phase 2" | "Funded" | null;
    derivedStatus: "ongoing" | "funded" | "breached" | "completed";
  };

  // Decide phase label for a credential view by looking at its richest cert
  const phaseFromCert = (cert: UserCertificate | null): AccountView["phaseLabel"] => {
    const t = cert?.certificate_type || "";
    if (t.includes("phase1")) return "Phase 1";
    if (t.includes("phase2")) return "Phase 2";
    if (t.includes("funded")) return "Funded";
    return null;
  };

  // Per-credential status: passed if cert is phase1/phase2_passed,
  // breached if cert is breached, otherwise inherit purchase status.
  const statusFromCert = (cert: UserCertificate | null, fallback: AccountView["derivedStatus"]): AccountView["derivedStatus"] => {
    const t = (cert?.certificate_type || "").toLowerCase();
    if (t.includes("breached") || t.includes("failed")) return "breached";
    if (t.includes("passed") || t.includes("phase1_passed") || t.includes("phase2_passed")) return "completed";
    if (t.includes("funded")) return "funded";
    return fallback;
  };

  const accountViews = useMemo<AccountView[]>(() => {
    const views: AccountView[] = [];
    for (const p of purchases) {
      const purchaseCreds = credentials
        .filter(c => c.purchase_id === p.id)
        // oldest first → phase 1 card sits above phase 2 card
        .sort((a, b) => a.mt5_login.localeCompare(b.mt5_login));
      const purchaseStatus = getAccountStatus(p) as AccountView["derivedStatus"];
      if (purchaseCreds.length === 0) {
        views.push({
          key: `purchase:${p.id}`,
          purchase: p,
          credential: null,
          accountNumber: p.id.slice(0, 8),
          phaseLabel: null,
          derivedStatus: purchaseStatus,
        });
        continue;
      }
      for (const cred of purchaseCreds) {
        const cert = pickRichestCert(c => c.account_number === cred.mt5_login)
          || pickRichestCert(c => c.credential_id === cred.id);
        // For older creds whose phase is over, the latest_stats may be empty —
        // fall back to type-based phase detection from any cert tied to this credential.
        const anyCertForCred = userCertificates.find(c => c.account_number === cred.mt5_login || c.credential_id === cred.id) || null;
        const phaseLabel = phaseFromCert(cert) || phaseFromCert(anyCertForCred);
        views.push({
          key: `cred:${cred.id}`,
          purchase: p,
          credential: cred,
          accountNumber: cred.mt5_login,
          phaseLabel,
          derivedStatus: statusFromCert(cert || anyCertForCred, purchaseStatus),
        });
      }
    }
    return views;
  }, [purchases, credentials, userCertificates]);

  const filteredViews = useMemo(() => {
    return accountViews.filter(v => {
      if (stepFilter === "1-step" && !getStepType(v.purchase).includes("1")) return false;
      if (stepFilter === "2-step" && !getStepType(v.purchase).includes("2")) return false;
      if (statusFilter !== "all" && v.derivedStatus !== statusFilter) return false;
      return true;
    });
  }, [accountViews, stepFilter, statusFilter]);

  // Auto-select first view once data loads / when current selection becomes stale
  useEffect(() => {
    if (accountViews.length === 0) {
      if (selectedAccount !== null) setSelectedAccount(null);
      return;
    }
    if (!selectedAccount || !accountViews.some(v => v.key === selectedAccount)) {
      setSelectedAccount(accountViews[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountViews]);

  const activeAccountStats = useMemo(() => {
    const activeView = (selectedAccount && accountViews.find(v => v.key === selectedAccount)) || accountViews[0];
    if (!activeView) return null;
    const activePurchase = activeView.purchase;
    const cred = activeView.credential;
    const accountLogin = cred?.mt5_login || null;
    // Stats are matched STRICTLY by this credential's mt5 login when we have one,
    // so phase 1 keeps showing phase 1 stats/graphs even after phase 2 starts.
    const matchedCert = accountLogin
      ? (pickRichestCert(c => c.account_number === accountLogin)
          || pickRichestCert(c => c.credential_id === cred!.id))
      : pickRichestCert(c => c.purchase_id === activePurchase.id);
    const accountSize = activePurchase.challenges?.account_size || 0;
    const stats = matchedCert?.stats || {};
    return {
      view: activeView,
      purchase: activePurchase,
      stats, balance: stats.balance ?? accountSize, equity: stats.equity ?? stats.balance ?? accountSize,
      profit: stats.profit ?? 0, deposit: stats.deposit ?? accountSize, totalTrades: stats.totalTrades ?? 0,
      winRate: stats.winRate ?? 0, profitFactor: stats.profitFactor ?? 0, sharpeRatio: stats.sharpeRatio ?? 0,
      recoveryFactor: stats.recoveryFactor ?? 0, maxDrawdownPercent: stats.maxDrawdownPercent ?? stats.drawdownPercent ?? 0,
      gainPercent: stats.gainPercent ?? 0, grossProfit: stats.grossProfit ?? 0, grossLoss: stats.grossLoss ?? 0,
      bestTrade: stats.bestTrade ?? 0, worstTrade: stats.worstTrade ?? 0,
      longTrades: stats.longTrades ?? 0, shortTrades: stats.shortTrades ?? 0,
      avgHoldTimeMinutes: stats.avgHoldTimeMinutes ?? 0, tradesPerWeek: stats.tradesPerWeek ?? 0,
      depositLoad: stats.depositLoad ?? 0, maxConsecutiveWins: stats.maxConsecutiveWins ?? 0,
      maxConsecutiveLosses: stats.maxConsecutiveLosses ?? 0, manualTrades: stats.manualTrades ?? 0,
      robotTrades: stats.robotTrades ?? 0, swapTotal: stats.swapTotal ?? 0, commissionTotal: stats.commissionTotal ?? 0,
      balanceChart: stats.balanceChart, growthChart: stats.growthChart, drawdownChart: stats.drawdownChart,
      profitByDay: stats.profitByDay, symbols: stats.symbols, monthlyPL: stats.monthlyPL, accountSize,
      broker: stats.broker ?? "", currency: stats.currency ?? "USD", accountType: stats.accountType ?? "",
      accountNumber: accountLogin || stats.accountNumber || "", name: stats.name ?? "", withdrawal: stats.withdrawal ?? 0,
      withdrawalCount: stats.withdrawalCount ?? 0, depositCount: stats.depositCount ?? 0,
      growthPercent: stats.growthPercent ?? 0, longNetPL: stats.longNetPL ?? 0, shortNetPL: stats.shortNetPL ?? 0,
      avgPLLong: stats.avgPLLong ?? 0, avgPLShort: stats.avgPLShort ?? 0,
      winTradesLong: stats.winTradesLong ?? 0, winTradesShort: stats.winTradesShort ?? 0,
      tradesLong: stats.tradesLong ?? 0, tradesShort: stats.tradesShort ?? 0,
      signalTrades: stats.signalTrades ?? 0, maxConsecutiveProfit: stats.maxConsecutiveProfit ?? 0,
      maxConsecutiveLoss: stats.maxConsecutiveLoss ?? 0, drawdownDetailChart: stats.drawdownDetailChart,
      dailyDDPercent: stats.dailyDrawdownPercent ?? stats.maxDailyDrawdownPercent ?? 0,
    };
  }, [accountViews, selectedAccount, userCertificates]);

  const chartData = useMemo(() => {
    if (!activeAccountStats?.balanceChart || !Array.isArray(activeAccountStats.balanceChart)) {
      if (!activeAccountStats) return [];
      return [
        { date: "Start", balance: activeAccountStats.accountSize, equity: activeAccountStats.accountSize },
        { date: "Now", balance: Number(activeAccountStats.balance), equity: Number(activeAccountStats.equity) },
      ];
    }
    return activeAccountStats.balanceChart.map((p: any) => ({
      date: new Date(p.timestamp * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      balance: Math.round(p.balance * 100) / 100,
      equity: Math.round(p.equity * 100) / 100,
    }));
  }, [activeAccountStats]);

  const growthData = useMemo(() => {
    if (!activeAccountStats?.growthChart || !Array.isArray(activeAccountStats.growthChart)) return [];
    return activeAccountStats.growthChart.map((p: any) => ({
      date: new Date(p.timestamp * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      growth: Math.round(p.growth * 1000) / 1000,
    }));
  }, [activeAccountStats]);

  const drawdownData = useMemo(() => {
    if (!activeAccountStats?.drawdownChart || !Array.isArray(activeAccountStats.drawdownChart)) return [];
    return activeAccountStats.drawdownChart.map((p: any) => ({
      date: new Date(p.timestamp * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      drawdown: Math.round(p.drawdown * 1000) / 1000,
    }));
  }, [activeAccountStats]);

  const dailyProfitData = useMemo(() => {
    if (!activeAccountStats?.profitByDay || !Array.isArray(activeAccountStats.profitByDay)) return [];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return activeAccountStats.profitByDay.map((val: any, i: number) => ({
      day: days[i] || `Day ${i}`,
      profit: typeof val === "number" ? val : (val?.y?.[0] ?? 0),
    }));
  }, [activeAccountStats]);

  const monthlyPLRows = useMemo(() => {
    const monthlyPL = activeAccountStats?.monthlyPL;
    if (!monthlyPL || typeof monthlyPL !== "object") return [] as Array<{ year: string; months: number[]; total: number }>;
    const normalizeMonths = (value: unknown): number[] => {
      if (Array.isArray(value)) return Array.from({ length: 12 }, (_, i) => Number(value[i] ?? 0) || 0);
      if (value && typeof value === "object") {
        const monthsObj = value as Record<string, unknown>;
        return Array.from({ length: 12 }, (_, i) => Number(monthsObj[String(i + 1)] ?? monthsObj[String(i)] ?? 0) || 0);
      }
      return Array(12).fill(0);
    };
    const rows: Array<{ year: string; months: number[]; total: number }> = [];
    const typedMonthly = monthlyPL as Record<string, any>;
    if (Array.isArray(typedMonthly.years)) {
      typedMonthly.years.forEach((entry: any) => {
        if (!entry || typeof entry !== "object") return;
        const year = entry.year != null ? String(entry.year) : "Unknown";
        const months = normalizeMonths(entry.months);
        const total = Number(entry.yearly ?? months.reduce((sum: number, m: number) => sum + m, 0)) || 0;
        rows.push({ year, months, total });
      });
    } else {
      Object.entries(typedMonthly).forEach(([year, value]) => {
        if (!/^\d{4}$/.test(year)) return;
        const months = normalizeMonths((value as any)?.months ?? value);
        const total = Number((value as any)?.total ?? (value as any)?.yearly ?? months.reduce((sum: number, m: number) => sum + m, 0)) || 0;
        rows.push({ year, months, total });
      });
    }
    return rows.sort((a, b) => Number(a.year) - Number(b.year));
  }, [activeAccountStats]);

  const profitPercent = activeAccountStats
    ? Number(activeAccountStats.gainPercent || ((Number(activeAccountStats.profit) / activeAccountStats.accountSize) * 100))
    : 0;
  const ddUsed = Number(activeAccountStats?.maxDrawdownPercent || 0);

  const openCredentialsPopup = (purchaseId: string) => {
    setCredDialogPurchaseId(purchaseId);
    setCredentialsDialogOpen(true);
  };

  // Loading
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,4%)] flex items-center justify-center">
        <motion.div className="flex flex-col items-center gap-4" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="w-10 h-10 border-2 border-[hsl(207,90%,77%)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[hsl(210,20%,70%)] font-medium">Loading dashboard...</p>
        </motion.div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,4%)] text-white flex items-center justify-center">
        <div className="text-center p-8">
          <p className="text-lg font-bold mb-2">Dashboard unavailable</p>
          <p className="text-[hsl(210,20%,60%)] mb-5">{loadError}</p>
          <Button className="rounded-xl bg-[hsl(207,90%,77%)] hover:bg-[hsl(207,90%,72%)]" onClick={fetchAllData}>Retry</Button>
        </div>
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    ongoing: { label: "Active", color: "text-[hsl(207,90%,77%)]", bg: "bg-[hsl(207,90%,77%)]/15" },
    funded: { label: "Funded", color: "text-[hsl(142,60%,50%)]", bg: "bg-[hsl(142,60%,50%)]/15" },
    breached: { label: "Not Passed", color: "text-[hsl(0,70%,55%)]", bg: "bg-[hsl(0,70%,55%)]/15" },
    completed: { label: "Passed", color: "text-[hsl(142,60%,50%)]", bg: "bg-[hsl(142,60%,50%)]/15" },
  };

  const stepOptions: { key: StepFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "1-step", label: "1-Step" },
    { key: "2-step", label: "2-Step" },
  ];

  const statusOptions: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "ongoing", label: "Active" },
    { key: "funded", label: "Funded" },
    { key: "breached", label: "Not Passed" },
    { key: "completed", label: "Passed" },
  ];

  // navItems moved to DashboardSidebar

  const popupCredentials = credDialogPurchaseId
    ? credentials.filter(c => c.purchase_id === credDialogPurchaseId)
    : [];

  return (
    <div className="h-screen bg-[hsl(220,20%,4%)] text-[hsl(0,0%,92%)] flex flex-col overflow-hidden">
      <AnnouncementBar />
      <DashboardSidebar profile={profile} />

      <div className="flex flex-1 min-h-0">
        {/* Left Panel - Account List */}
        {/* Spacer for desktop sidebar */}
        <div className="hidden lg:block w-16 shrink-0" />

        <aside className={`
          hidden lg:flex w-[320px] bg-[hsl(220,20%,5%)] border-r border-[hsl(220,15%,12%)]
          flex-col shrink-0 h-full overflow-hidden
        `}>

          {/* User info */}
          <div className="p-4 border-b border-[hsl(220,15%,12%)]">
            <div className="flex items-center gap-3">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.display_name || "Trader"} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(207,90%,77%)] to-[hsl(207,85%,65%)] flex items-center justify-center text-white font-bold text-sm">
                  {(profile?.display_name || "T")[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{profile?.display_name || "Trader"}</p>
                <p className="text-[11px] text-[hsl(220,15%,45%)] truncate">{profile?.email || ""}</p>
              </div>
            </div>
          </div>

          {/* Dropdown Filters */}
          <div className="px-3 py-3 border-b border-[hsl(220,15%,12%)] space-y-2">
            {/* All Accounts label */}
            <div className="flex items-center gap-2 text-[11px] text-[hsl(220,15%,45%)] font-medium uppercase tracking-wider px-1">
              <Home size={12} /> Home
            </div>

            {/* Step Type Dropdown */}
            <div className="relative">
              <button
                onClick={() => { setStepDropdownOpen(!stepDropdownOpen); setStatusDropdownOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,15%)] hover:border-[hsl(220,15%,20%)] transition-colors text-sm"
              >
                <div className="flex items-center gap-2">
                  <Filter size={13} className="text-[hsl(220,15%,40%)]" />
                  <span>{stepOptions.find(o => o.key === stepFilter)?.label || "All"}</span>
                </div>
                <ChevronDown size={14} className={`text-[hsl(220,15%,40%)] transition-transform ${stepDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {stepDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[hsl(220,20%,8%)] border border-[hsl(220,15%,15%)] rounded-xl overflow-hidden z-10 shadow-xl">
                  {stepOptions.map(o => (
                    <button
                      key={o.key}
                      onClick={() => { setStepFilter(o.key); setStepDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-[hsl(220,15%,12%)] transition-colors ${
                        stepFilter === o.key ? "text-[hsl(207,90%,77%)] bg-[hsl(207,90%,77%)]/5" : "text-[hsl(0,0%,80%)]"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status Dropdown */}
            <div className="relative">
              <button
                onClick={() => { setStatusDropdownOpen(!statusDropdownOpen); setStepDropdownOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,15%)] hover:border-[hsl(220,15%,20%)] transition-colors text-sm"
              >
                <div className="flex items-center gap-2">
                  <Filter size={13} className="text-[hsl(220,15%,40%)]" />
                  <span>{statusOptions.find(o => o.key === statusFilter)?.label || "All"}</span>
                </div>
                <ChevronDown size={14} className={`text-[hsl(220,15%,40%)] transition-transform ${statusDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {statusDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[hsl(220,20%,8%)] border border-[hsl(220,15%,15%)] rounded-xl overflow-hidden z-10 shadow-xl">
                  {statusOptions.map(o => (
                    <button
                      key={o.key}
                      onClick={() => { setStatusFilter(o.key); setStatusDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-[hsl(220,15%,12%)] transition-colors ${
                        statusFilter === o.key ? "text-[hsl(207,90%,77%)] bg-[hsl(207,90%,77%)]/5" : "text-[hsl(0,0%,80%)]"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Account Cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-[hsl(220,15%,15%)] scrollbar-track-transparent">
            <AnimatePresence>
              {filteredPurchases.slice(0, 10).map((p, i) => {
                const isActive = selectedAccount === p.id;
                const status = getAccountStatus(p);
                const sc = statusConfig[status] || statusConfig.ongoing;
                const cred = credentials.find(c => c.purchase_id === p.id);
                const challengeName = p.challenges?.name || "Account";
                const stepType = p.challenges?.step_type || "—";
                const accountNumber = cred?.mt5_login || p.id.slice(0, 8);
                const rank = getRank(p);
                const purchaseCert = pickRichestCert(c => c.purchase_id === p.id)
                  || (cred ? pickRichestCert(c => c.account_number === cred.mt5_login) : null);
                const trades = purchaseCert?.stats?.totalTrades ?? 0;

                // Subtle accent hue per card based on status
                const accentMap: Record<string, string> = {
                  ongoing: "207,90%,77%",
                  funded: "142,60%,50%",
                  breached: "0,70%,55%",
                  completed: "160,55%,50%",
                };
                const accent = accentMap[status] || accentMap.ongoing;

                return (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    onClick={() => { setSelectedAccount(p.id); setActiveView("overview"); }}
                    className={`group cursor-pointer rounded-xl transition-all duration-200 overflow-hidden ${
                      isActive
                        ? `bg-[hsl(220,20%,8%)] ring-1 ring-[hsl(${accent})]/25 shadow-[0_0_24px_-6px_hsl(${accent},0.15)]`
                        : "bg-[hsl(220,20%,7%)] hover:bg-[hsl(220,20%,8%)] ring-1 ring-[hsl(220,15%,12%)] hover:ring-[hsl(220,15%,18%)]"
                    }`}
                  >
                    {/* Accent top line */}
                    <div className={`h-[2px] w-full transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`} style={{ background: `linear-gradient(90deg, hsl(${accent}), hsl(${accent}, 0.3))` }} />

                    <div className="px-3.5 py-3">
                      {/* Header row */}
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors overflow-hidden ${
                          isActive ? `bg-[hsl(${accent})]/12` : "bg-[hsl(220,15%,11%)] group-hover:bg-[hsl(220,15%,13%)]"
                        }`}>
                          <img src={rank.img} alt={rank.label} className={`w-8 h-8 object-cover transition-opacity ${isActive ? "opacity-100" : "opacity-70 group-hover:opacity-90"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-bold leading-tight truncate">FP {accountNumber}</p>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${sc.bg} ${sc.color}`}>
                              {sc.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-[hsl(220,15%,45%)] truncate">{challengeName}</span>
                            <span className="text-[9px] px-1 py-px rounded bg-[hsl(220,15%,12%)] text-[hsl(220,15%,55%)] font-medium">{stepType}</span>
                            <span className={`flex items-center gap-0.5 ml-auto shrink-0`}>
                              <img src={fpLogoIcon} alt="FP" className="w-3.5 h-3.5 object-contain opacity-40" />
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-3 mt-2.5 pl-12">
                        <div className="flex items-center gap-1">
                          <Activity size={10} className="text-[hsl(220,15%,30%)]" />
                          <span className="text-[10px] text-[hsl(220,15%,40%)]">Trades</span>
                          <span className="text-[11px] font-bold ml-0.5">{trades}</span>
                        </div>
                        <div className="w-px h-3 bg-[hsl(220,15%,15%)]" />
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[hsl(220,15%,40%)]">#</span>
                          <span className="text-[11px] font-bold font-mono">{accountNumber}</span>
                        </div>
                      </div>

                      {/* Action buttons (active only) */}
                      {isActive && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="flex gap-2 mt-3 pt-2.5 border-t border-[hsl(220,15%,11%)]"
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); openCredentialsPopup(p.id); }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-[7px] rounded-lg bg-[hsl(220,15%,11%)] hover:bg-[hsl(220,15%,14%)] text-[11px] font-medium text-[hsl(220,15%,55%)] hover:text-white transition-colors"
                          >
                            <Key size={11} /> Credentials
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setActiveView("overview"); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-[7px] rounded-lg text-[11px] font-bold text-white transition-colors`}
                            style={{ background: `hsl(${accent})` }}
                          >
                            <LayoutDashboard size={11} /> Dashboard
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredPurchases.length === 0 && (
              <div className="text-center py-12 text-[hsl(220,15%,40%)]">
                <BarChart3 size={28} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No accounts match this filter.</p>
              </div>
            )}

            {filteredPurchases.length > 10 && (
              <p className="text-center text-[10px] text-[hsl(220,15%,35%)] pt-2">
                Showing 10 of {filteredPurchases.length} accounts
              </p>
            )}
          </div>

          {/* Buy challenge CTA */}
          <div className="p-3 border-t border-[hsl(220,15%,12%)]">
            <button
              onClick={() => navigate("/#challenges")}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[hsl(207,90%,77%)] to-[hsl(207,90%,72%)] text-white text-xs font-bold hover:opacity-90 transition-opacity"
            >
              + New Challenge
            </button>
          </div>
        </aside>

        {/* Right Panel - Content */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          {/* Mobile Account Selector */}
          <div className="lg:hidden p-3 border-b border-[hsl(220,15%,12%)] bg-[hsl(220,20%,5%)]">
            {filteredPurchases.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-[hsl(220,15%,40%)] font-semibold">Your Accounts</p>
                  <span className="text-[10px] text-[hsl(220,15%,35%)]">{filteredPurchases.length} account{filteredPurchases.length > 1 ? "s" : ""}</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                  {filteredPurchases.slice(0, 10).map(p => {
                    const isActive = selectedAccount === p.id;
                    const status = getAccountStatus(p);
                    const sc = statusConfig[status] || statusConfig.ongoing;
                    const cred = credentials.find(c => c.purchase_id === p.id);
                    const accountNumber = cred?.mt5_login || p.id.slice(0, 8);
                    return (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedAccount(p.id); setActiveView("overview"); }}
                        className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-left ${
                          isActive
                            ? "bg-[hsl(220,20%,9%)] border-[hsl(207,90%,77%)]/30"
                            : "bg-[hsl(220,20%,7%)] border-[hsl(220,15%,12%)] hover:border-[hsl(220,15%,18%)]"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold whitespace-nowrap">FP {accountNumber}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[9px] font-bold ${sc.color}`}>{sc.label}</span>
                            <span className="text-[9px] text-[hsl(220,15%,40%)]">${(p.challenges?.account_size || 0).toLocaleString()}</span>
                            {(() => { const r = getRank(p); return <img src={r.img} alt={r.label} className="w-4 h-4 rounded-full object-cover" />; })()}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-[hsl(220,15%,40%)]">No accounts yet</p>
                <button onClick={() => navigate("/#challenges")} className="mt-2 text-xs font-bold text-[hsl(207,90%,77%)]">Get a Challenge →</button>
              </div>
            )}
          </div>

          <AnimatePresence>
            <motion.div
              key={activeView + (selectedAccount || "")}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="p-3 sm:p-4 lg:p-5 space-y-3 max-w-[1200px]"
            >

              {/* ═══ OVERVIEW ═══ */}
              {activeView === "overview" && activeAccountStats && (
                <>
                  {/* Account Overview Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="font-display text-lg font-bold">Account Overview</h1>
                        {(() => {
                          const rank = getRank(activeAccountStats.purchase);
                          return (
                            <span className={`flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,15%)] ${rank.color}`}>
                              <img src={rank.img} alt={rank.label} className="w-5 h-5 rounded-full object-cover" />
                              {rank.label}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-[11px] text-[hsl(220,15%,45%)]">
                        {activeAccountStats.accountNumber || activeAccountStats.purchase.id.slice(0, 8)} · {new Date(activeAccountStats.purchase.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>

                  {/* Balance Chart */}
                  <div className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-3 sm:p-4">
                    <div className="h-[160px] sm:h-[200px] lg:h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(207,90%,77%)" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="hsl(207,90%,77%)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,12%)" />
                          <XAxis dataKey="date" tick={{ fill: "hsl(220,15%,40%)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                          <YAxis tick={{ fill: "hsl(220,15%,40%)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toLocaleString()}`} domain={["dataMin - 20", "dataMax + 20"]} />
                          <Tooltip contentStyle={{ background: "hsl(220,20%,8%)", border: "1px solid hsl(220,15%,15%)", borderRadius: "8px", color: "white", fontSize: "12px" }} formatter={(value: number) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, undefined]} />
                          <Area type="monotone" dataKey="balance" stroke="hsl(207,90%,77%)" strokeWidth={2} fill="url(#balGrad)" dot={false} activeDot={{ r: 4, fill: "hsl(207,90%,77%)" }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Key Stats Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {[
                      { label: "Account balance", value: `$${Number(activeAccountStats.balance).toLocaleString(undefined, { minimumFractionDigits: 1 })}`, color: "" },
                      { label: "Average win", value: `$${Number(activeAccountStats.bestTrade || 0).toFixed(2)}`, color: "text-[hsl(142,60%,50%)]" },
                      { label: "Average loss", value: `$${Math.abs(Number(activeAccountStats.worstTrade || 0)).toFixed(2)}`, color: "text-[hsl(0,70%,55%)]" },
                      { label: "Win ratio", value: `${Number(activeAccountStats.winRate || 0).toFixed(1)}%`, color: "" },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-3 text-center">
                        <p className="text-[10px] sm:text-[11px] text-[hsl(220,15%,45%)] mb-1">{s.label}</p>
                        <p className={`text-base sm:text-lg font-bold font-display ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Top Stats Row */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                    {[
                      { label: "Balance", value: `$${Number(activeAccountStats.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: DollarSign, trend: Number(activeAccountStats.profit) >= 0 ? "up" as const : "down" as const },
                      { label: "Equity", value: `$${Number(activeAccountStats.equity).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: Activity },
                      { label: "Profit", value: `$${Number(activeAccountStats.profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, subValue: `${profitPercent >= 0 ? "+" : ""}${profitPercent.toFixed(2)}%`, icon: TrendingUp, trend: Number(activeAccountStats.profit) >= 0 ? "up" as const : "down" as const, highlight: true },
                      { label: "Max Drawdown", value: `${ddUsed.toFixed(2)}%`, subValue: `/ ${activeAccountStats.purchase.challenges?.max_drawdown || "10%"}`, icon: Shield, trend: ddUsed > 5 ? "down" as const : "up" as const },
                    ].map((stat) => (
                      <DashStatCard key={stat.label} {...stat} />
                    ))}
                  </div>

                  {/* Growth & Drawdown */}
                  {(growthData.length > 0 || drawdownData.length > 0) && (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {growthData.length > 0 && (
                        <div className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-3 sm:p-5">
                          <h3 className="font-display font-bold text-sm mb-3 sm:mb-4 flex items-center gap-2">
                            <TrendingUp size={14} className="text-[hsl(142,60%,50%)]" /> Growth %
                          </h3>
                          <div className="h-[160px] sm:h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={growthData}>
                                <defs>
                                  <linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(142,60%,50%)" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="hsl(142,60%,50%)" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,12%)" />
                                <XAxis dataKey="date" tick={{ fill: "hsl(220,15%,40%)", fontSize: 9 }} tickLine={false} interval="preserveStartEnd" />
                                <YAxis tick={{ fill: "hsl(220,15%,40%)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                                <Tooltip contentStyle={{ background: "hsl(220,20%,8%)", border: "1px solid hsl(220,15%,15%)", borderRadius: "8px", color: "white", fontSize: "12px" }} formatter={(v: number) => [`${v.toFixed(3)}%`]} />
                                <Area type="monotone" dataKey="growth" stroke="hsl(142,60%,50%)" strokeWidth={2} fill="url(#gGrad)" dot={false} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                      {drawdownData.length > 0 && (
                        <div className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-3 sm:p-5">
                          <h3 className="font-display font-bold text-sm mb-3 sm:mb-4 flex items-center gap-2">
                            <TrendingDown size={14} className="text-[hsl(0,70%,55%)]" /> Drawdown %
                          </h3>
                          <div className="h-[160px] sm:h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={drawdownData}>
                                <defs>
                                  <linearGradient id="dGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(0,70%,55%)" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="hsl(0,70%,55%)" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,12%)" />
                                <XAxis dataKey="date" tick={{ fill: "hsl(220,15%,40%)", fontSize: 9 }} tickLine={false} interval="preserveStartEnd" />
                                <YAxis tick={{ fill: "hsl(220,15%,40%)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                                <Tooltip contentStyle={{ background: "hsl(220,20%,8%)", border: "1px solid hsl(220,15%,15%)", borderRadius: "8px", color: "white", fontSize: "12px" }} formatter={(v: number) => [`${v.toFixed(3)}%`]} />
                                <Area type="monotone" dataKey="drawdown" stroke="hsl(0,70%,55%)" strokeWidth={2} fill="url(#dGrad)" dot={false} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Trading Objectives — compact row */}
                  <TradingObjectives
                    profitTarget={activeAccountStats.purchase.challenges?.profit_target || "8"}
                    dailyDrawdown={activeAccountStats.purchase.challenges?.daily_drawdown || "5"}
                    maxDrawdown={activeAccountStats.purchase.challenges?.max_drawdown || "10"}
                    currentProfit={Number(activeAccountStats.profit)}
                    currentDailyDD={Number(activeAccountStats.dailyDDPercent)}
                    currentMaxDD={ddUsed}
                    accountSize={activeAccountStats.accountSize}
                    status={activeAccountStats.purchase.status}
                  />

                  <TradingCalendar
                    balanceChart={activeAccountStats.balanceChart}
                    profitByDay={activeAccountStats.profitByDay}
                    symbols={activeAccountStats.symbols}
                    totalTrades={activeAccountStats.totalTrades}
                    profit={Number(activeAccountStats.profit)}
                    accountSize={activeAccountStats.accountSize}
                  />

                  {/* Trading Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {[
                      { label: "Win Rate", value: `${Number(activeAccountStats.winRate).toFixed(1)}%`, color: "text-[hsl(207,90%,77%)]" },
                      { label: "Profit Factor", value: Number(activeAccountStats.profitFactor) === -1 ? "∞" : String(activeAccountStats.profitFactor ?? "—"), color: "" },
                      { label: "Sharpe Ratio", value: Number(activeAccountStats.sharpeRatio).toFixed(2), color: "" },
                      { label: "Best Trade", value: `$${Number(activeAccountStats.bestTrade).toFixed(2)}`, color: "text-[hsl(142,60%,50%)]" },
                      { label: "Worst Trade", value: `$${Number(activeAccountStats.worstTrade).toFixed(2)}`, color: "text-[hsl(0,70%,55%)]" },
                      { label: "Total Trades", value: String(activeAccountStats.totalTrades), color: "" },
                    ].map(stat => (
                      <div key={stat.label} className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-2.5 sm:p-3">
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[hsl(220,15%,40%)] mb-1">{stat.label}</p>
                        <p className={`text-sm sm:text-base font-bold font-display ${stat.color}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* P&L + Direction + Activity + Streaks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                    <InfoCard title="P&L Breakdown">
                      {[
                        { label: "Gross Profit", value: `$${Number(activeAccountStats.grossProfit).toFixed(2)}`, cls: "text-[hsl(142,60%,50%)]" },
                        { label: "Gross Loss", value: `$${Number(activeAccountStats.grossLoss).toFixed(2)}`, cls: "text-[hsl(0,70%,55%)]" },
                        { label: "Swap", value: `$${Number(activeAccountStats.swapTotal).toFixed(2)}`, cls: "" },
                        { label: "Commission", value: `$${Number(activeAccountStats.commissionTotal).toFixed(2)}`, cls: "" },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between items-center">
                          <span className="text-xs text-[hsl(220,15%,45%)]">{r.label}</span>
                          <span className={`text-sm font-bold ${r.cls}`}>{r.value}</span>
                        </div>
                      ))}
                      <div className="h-px bg-[hsl(220,15%,12%)]" />
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold">Net Profit</span>
                        <span className={`text-sm font-bold ${Number(activeAccountStats.profit) >= 0 ? "text-[hsl(142,60%,50%)]" : "text-[hsl(0,70%,55%)]"}`}>${Number(activeAccountStats.profit).toFixed(2)}</span>
                      </div>
                    </InfoCard>

                    <InfoCard title="Direction">
                      {[
                        { label: "Long", count: activeAccountStats.longTrades, color: "bg-[hsl(207,90%,77%)]" },
                        { label: "Short", count: activeAccountStats.shortTrades, color: "bg-purple-500" },
                      ].map(d => (
                        <div key={d.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[hsl(220,15%,45%)]">{d.label}</span>
                            <span className="font-medium">{d.count}</span>
                          </div>
                          <div className="h-1.5 bg-[hsl(220,15%,12%)] rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full ${d.color} rounded-full`}
                              initial={{ width: 0 }}
                              animate={{ width: `${activeAccountStats.totalTrades ? (d.count / activeAccountStats.totalTrades) * 100 : 0}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      ))}
                    </InfoCard>

                    <InfoCard title="Activity">
                      {[
                        { label: "Trades/Week", value: activeAccountStats.tradesPerWeek },
                        { label: "Avg Hold", value: `${activeAccountStats.avgHoldTimeMinutes}m` },
                        { label: "Manual", value: activeAccountStats.manualTrades },
                        { label: "Robot/EA", value: activeAccountStats.robotTrades },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between items-center">
                          <span className="text-xs text-[hsl(220,15%,45%)]">{r.label}</span>
                          <span className="text-sm font-bold">{r.value}</span>
                        </div>
                      ))}
                    </InfoCard>

                    <InfoCard title="Streaks & Risk">
                      {[
                        { label: "Consec. Wins", value: activeAccountStats.maxConsecutiveWins, cls: "text-[hsl(142,60%,50%)]" },
                        { label: "Consec. Losses", value: activeAccountStats.maxConsecutiveLosses, cls: "text-[hsl(0,70%,55%)]" },
                        { label: "Recovery Factor", value: Number(activeAccountStats.recoveryFactor).toFixed(2), cls: "" },
                        { label: "Deposit Load", value: `${Number(activeAccountStats.depositLoad).toFixed(1)}%`, cls: "" },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between items-center">
                          <span className="text-xs text-[hsl(220,15%,45%)]">{r.label}</span>
                          <span className={`text-sm font-bold ${r.cls}`}>{r.value}</span>
                        </div>
                      ))}
                    </InfoCard>
                  </div>

                  {/* Symbols Pie Chart */}
                  <SymbolsPieChart symbols={activeAccountStats.symbols} />

                  {/* Daily Profit by Day of Week */}
                  {dailyProfitData.length > 0 && (
                    <div className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-3 sm:p-5">
                      <h3 className="font-display font-bold text-sm mb-3 sm:mb-4">Profit by Day of Week</h3>
                      <div className="h-[150px] sm:h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dailyProfitData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,12%)" />
                            <XAxis dataKey="day" tick={{ fill: "hsl(220,15%,45%)", fontSize: 11 }} tickLine={false} />
                            <YAxis tick={{ fill: "hsl(220,15%,45%)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                            <Tooltip contentStyle={{ background: "hsl(220,20%,8%)", border: "1px solid hsl(220,15%,15%)", borderRadius: "8px", color: "white", fontSize: "12px" }} labelStyle={{ color: "hsl(220,15%,70%)" }} itemStyle={{ color: "white" }} />
                            <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                              {dailyProfitData.map((entry, index) => (
                                <Cell key={index} fill={entry.profit >= 0 ? "hsl(142,60%,50%)" : "hsl(0,70%,55%)"} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Symbols Table */}
                  {activeAccountStats.symbols && activeAccountStats.symbols.length > 0 && (
                    <div className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-5">
                      <h3 className="font-display font-bold text-sm mb-4">Symbols Traded</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-[10px] uppercase tracking-widest text-[hsl(220,15%,40%)] border-b border-[hsl(220,15%,12%)]">
                              <th className="px-4 py-2">Symbol</th>
                              <th className="px-4 py-2">Trades</th>
                              <th className="px-4 py-2">Profit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeAccountStats.symbols.map((s: any, i: number) => (
                              <tr key={i} className="border-b border-[hsl(220,15%,8%)] text-sm hover:bg-[hsl(220,15%,9%)] transition-colors">
                                <td className="px-4 py-3 font-mono font-medium">{s.name}</td>
                                <td className="px-4 py-3">{s.trades}</td>
                                <td className={`px-4 py-3 font-bold ${s.profit >= 0 ? "text-[hsl(142,60%,50%)]" : "text-[hsl(0,70%,55%)]"}`}>${Number(s.profit).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Monthly P&L */}
                  {monthlyPLRows.length > 0 && (
                    <div className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-5">
                      <h3 className="font-display font-bold text-sm mb-4">Monthly P&L</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-[10px] uppercase tracking-widest text-[hsl(220,15%,40%)] border-b border-[hsl(220,15%,12%)]">
                              <th className="px-4 py-2">Year</th>
                              {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map(m => (
                                <th key={m} className="px-2 py-2 text-center">{m}</th>
                              ))}
                              <th className="px-4 py-2 text-center">Total</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm">
                            {monthlyPLRows.map(({ year, months, total }) => (
                              <tr key={year} className="border-b border-[hsl(220,15%,8%)]">
                                <td className="px-4 py-3 font-bold">{year}</td>
                                {months.map((val: number, i: number) => (
                                  <td key={`${year}-${i}`} className={`px-2 py-3 text-center text-xs font-mono font-bold ${val > 0 ? "text-[hsl(142,60%,50%)]" : val < 0 ? "text-[hsl(0,70%,55%)]" : "text-[hsl(220,15%,30%)]"}`}>
                                    {val !== 0 ? `$${val.toFixed(0)}` : "—"}
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-center font-bold">
                                  {total !== 0 ? `$${total.toFixed(0)}` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeView === "overview" && !activeAccountStats && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <BarChart3 size={40} className="mx-auto mb-4 text-[hsl(220,15%,25%)]" />
                    <p className="text-lg font-bold mb-2">No account selected</p>
                    <p className="text-sm text-[hsl(220,15%,40%)] mb-4">Select an account from the left panel or purchase a challenge.</p>
                    <Button onClick={() => navigate("/#challenges")} className="rounded-xl bg-[hsl(207,90%,77%)] hover:bg-[hsl(207,90%,72%)]">
                      Browse Challenges
                    </Button>
                  </div>
                </div>
              )}

              {/* ═══ AFFILIATE ═══ */}
              {activeView === "affiliate" && (
                <div className="space-y-5">
                  <h1 className="font-display text-xl font-bold">Affiliate Program</h1>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <DashStatCard icon={Users} value={String(referrals.length)} label="Total Referrals" />
                    <DashStatCard icon={DollarSign} value={`$${totalEarnings.toFixed(2)}`} label="Total Earned" highlight />
                    <DashStatCard icon={Clock} value={`$${pendingEarnings.toFixed(2)}`} label="Pending" />
                  </div>

                  {/* Referral Link */}
                  <div className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-5">
                    <h2 className="font-display font-bold text-sm mb-4">Your Referral Link</h2>
                    {profile?.referral_code ? (
                      <div className="flex items-center gap-3">
                        <code className="flex-1 bg-[hsl(220,15%,10%)] px-4 py-2.5 rounded-lg text-xs text-[hsl(207,90%,77%)] font-mono truncate">
                          {REFERRAL_DOMAIN}?ref={profile.referral_code}
                        </code>
                        <Button size="sm" onClick={copyReferralLink} className="rounded-lg bg-[hsl(207,90%,77%)] hover:bg-[hsl(207,90%,72%)] text-white shrink-0">
                          <Copy size={14} className="mr-1" /> Copy
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-[hsl(220,15%,45%)]">No referral code assigned yet.</p>
                    )}
                  </div>

                  {/* Referral History */}
                  <div className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-5">
                    <h2 className="font-display font-bold text-sm mb-4">Commission History</h2>
                    {referrals.length === 0 ? (
                      <p className="text-sm text-[hsl(220,15%,45%)]">No referrals yet. Share your link to start earning!</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-[10px] uppercase tracking-widest text-[hsl(220,15%,40%)] border-b border-[hsl(220,15%,12%)]">
                              <th className="px-5 py-3">Date</th>
                              <th className="px-5 py-3">Commission</th>
                              <th className="px-5 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {referrals.map((r) => (
                              <tr key={r.id} className="border-b border-[hsl(220,15%,8%)] text-sm">
                                <td className="px-5 py-4">{new Date(r.created_at).toLocaleDateString()}</td>
                                <td className="px-5 py-4">${(r.commission_amount || 0).toFixed(2)}</td>
                                <td className="px-5 py-4"><StatusBadge status={r.commission_status} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ═══ CREDENTIALS POPUP ═══ */}
      <Dialog open={credentialsDialogOpen} onOpenChange={setCredentialsDialogOpen}>
        <DialogContent className="bg-[hsl(220,20%,7%)] border-[hsl(220,15%,15%)] text-[hsl(0,0%,92%)] rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">FP Credentials</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {popupCredentials.length === 0 ? (
              <div className="text-center py-6">
                <Key size={28} className="mx-auto mb-2 text-[hsl(220,15%,30%)]" />
                <p className="text-sm text-[hsl(220,15%,45%)]">No credentials assigned yet.</p>
              </div>
            ) : (
              popupCredentials.map(c => (
                <div key={c.id} className="rounded-xl bg-[hsl(220,20%,10%)] border border-[hsl(220,15%,15%)] p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-[hsl(220,15%,40%)] mb-1">Login</p>
                      <p className="font-mono text-sm font-bold">{c.mt5_login}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-[hsl(220,15%,40%)] mb-1">Server</p>
                      <p className="text-sm text-[hsl(220,15%,60%)]">{c.mt5_server}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[hsl(220,15%,40%)] mb-1">Password</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm flex-1">{showPasswords[c.id] ? c.mt5_password : "••••••••"}</p>
                      <button onClick={() => setShowPasswords(prev => ({ ...prev, [c.id]: !prev[c.id] }))} className="p-1.5 rounded-lg hover:bg-[hsl(220,15%,15%)] transition-colors">
                        {showPasswords[c.id] ? <EyeOff size={14} className="text-[hsl(220,15%,45%)]" /> : <Eye size={14} className="text-[hsl(220,15%,45%)]" />}
                      </button>
                      <button onClick={() => { navigator.clipboard.writeText(c.mt5_password); toast.success("Password copied"); }} className="p-1.5 rounded-lg hover:bg-[hsl(220,15%,15%)] transition-colors">
                        <Copy size={14} className="text-[hsl(220,15%,45%)]" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ─── Sub-components ─── */

const DashStatCard = ({ icon: Icon, value, label, subValue, trend, highlight }: {
  icon: any; value: string; label: string; subValue?: string; trend?: "up" | "down"; highlight?: boolean;
}) => (
  <div className={`rounded-xl bg-[hsl(220,20%,7%)] border p-3 sm:p-4 transition-all ${
    highlight ? "border-[hsl(207,90%,77%)]/20" : "border-[hsl(220,15%,12%)]"
  }`}>
    <div className="flex items-center justify-between mb-1.5 sm:mb-2">
      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center ${highlight ? "bg-[hsl(207,90%,77%)]/10" : "bg-[hsl(220,15%,12%)]"}`}>
        <Icon size={14} className={`sm:w-4 sm:h-4 ${highlight ? "text-[hsl(207,90%,77%)]" : "text-[hsl(220,15%,40%)]"}`} />
      </div>
      {trend && (
        <div className={`flex items-center gap-0.5 text-xs font-medium ${trend === "up" ? "text-[hsl(142,60%,50%)]" : "text-[hsl(0,70%,55%)]"}`}>
          {trend === "up" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        </div>
      )}
    </div>
    <p className="text-base sm:text-xl font-bold font-display truncate">{value}</p>
    <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
      <p className="text-[10px] sm:text-[11px] text-[hsl(220,15%,45%)]">{label}</p>
      {subValue && <span className={`text-[10px] sm:text-xs font-medium ${trend === "up" ? "text-[hsl(142,60%,50%)]" : trend === "down" ? "text-[hsl(0,70%,55%)]" : "text-[hsl(220,15%,45%)]"}`}>{subValue}</span>}
    </div>
  </div>
);

const InfoCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-4">
    <p className="text-[10px] uppercase tracking-widest text-[hsl(220,15%,40%)] mb-3 font-semibold">{title}</p>
    <div className="space-y-2.5">{children}</div>
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    paid: "bg-[hsl(142,60%,50%)]/15 text-[hsl(142,60%,50%)] border-[hsl(142,60%,50%)]/20",
    approved: "bg-[hsl(207,90%,77%)]/15 text-[hsl(207,90%,77%)] border-[hsl(207,90%,77%)]/20",
    active: "bg-[hsl(142,60%,50%)]/15 text-[hsl(142,60%,50%)] border-[hsl(142,60%,50%)]/20",
    pending: "bg-[hsl(45,80%,55%)]/15 text-[hsl(45,80%,55%)] border-[hsl(45,80%,55%)]/20",
    completed: "bg-[hsl(142,60%,50%)]/15 text-[hsl(142,60%,50%)] border-[hsl(142,60%,50%)]/20",
    breached: "bg-[hsl(0,70%,55%)]/15 text-[hsl(0,70%,55%)] border-[hsl(0,70%,55%)]/20",
    funded: "bg-[hsl(180,60%,50%)]/15 text-[hsl(180,60%,50%)] border-[hsl(180,60%,50%)]/20",
    failed: "bg-[hsl(0,70%,55%)]/15 text-[hsl(0,70%,55%)] border-[hsl(0,70%,55%)]/20",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${colors[status] || "bg-[hsl(220,15%,12%)] text-[hsl(220,15%,45%)] border-[hsl(220,15%,15%)]"}`}>
      {status}
    </span>
  );
};

export default Dashboard;
