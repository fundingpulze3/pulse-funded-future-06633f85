import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateAndUploadCertificate } from "@/lib/generateCertificateImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertCircle, CheckCircle2, RefreshCw, Loader2, Search, X,
  TrendingUp, TrendingDown, Activity, DollarSign, BarChart3,
  ArrowLeft, User, CreditCard, Calendar, Target, Shield, Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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
  dailyDrawdownLimit: string;
  maxDrawdownLimit: string;
}

const PHASES = [
  { value: "pending", label: "Pending", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { value: "active", label: "Active (Phase 1)", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "phase1_passed", label: "Phase 1 Passed (Under Review)", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "phase2", label: "Phase 2", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { value: "phase2_passed", label: "Phase 2 Passed (Under Review)", color: "bg-amber-50 text-amber-700 border-amber-200" },
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
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  // Manual credential dialog (replaces pool auto-pick when pushing to next phase)
  const [pushDialog, setPushDialog] = useState<{ open: boolean; account: UserAccount | null; targetStatus: string }>({ open: false, account: null, targetStatus: "" });
  const [credForm, setCredForm] = useState({ mt5Login: "", mt5Password: "", mt5Server: "MEXAtlantic-Demo" });

  useEffect(() => { fetchAccounts(); }, []);

  // Paginated fetch to bypass Supabase 1k row limit
  const fetchAllRows = async (table: string, columns = "*", orderCol?: string) => {
    const rows: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      let q = supabase.from(table as any).select(columns).range(from, from + batchSize - 1);
      if (orderCol) q = q.order(orderCol, { ascending: false });
      const { data, error } = await q;
      if (error) { console.error(`fetchAllRows(${table}):`, error.message); break; }
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    return rows;
  };

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const [purchases, profiles, challenges, creds, certs] = await Promise.all([
        fetchAllRows("challenge_purchases", "*", "created_at"),
        fetchAllRows("profiles", "user_id, display_name, email"),
        fetchAllRows("challenges", "id, name, account_size, step_type, daily_drawdown, max_drawdown"),
        fetchAllRows("trading_credentials", "id, mt5_login, challenge_id, assigned_to, purchase_id, is_assigned"),
        fetchAllRows("user_certificates", "purchase_id, account_number, stats"),
      ]);

      const filteredPurchases = purchases.filter((p: any) => {
        const paymentStatus = String(p.payment_status || "").toLowerCase();
        const status = String(p.status || "").toLowerCase();
        return ["paid", "confirmed", "completed"].includes(paymentStatus) && status !== "pending";
      });

      const mapped: UserAccount[] = filteredPurchases.map(p => {
        const profile = profiles.find(pr => pr.user_id === p.user_id);
        const challenge = challenges.find(c => c.id === p.challenge_id);
        const cred = creds.find(c => c.purchase_id === p.id);
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
          dailyDrawdownLimit: challenge?.daily_drawdown || "5",
          maxDrawdownLimit: challenge?.max_drawdown || "10",
        };
      });

      setAccounts(mapped);
      if (selectedAccount) {
        const updated = mapped.find(a => a.purchaseId === selectedAccount.purchaseId);
        setSelectedAccount(updated || null);
      }
    } catch (err: any) {
      console.error("UserPhaseManager fetchAccounts error:", err);
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
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

    // First-time credential assignment only (e.g. status set to "active" before any MT5 was issued).
    // Phase advancement (active→phase2, phase2→funded) is handled by the dedicated "Push" button below.
    // CRITICAL: only pick credentials that have NEVER been assigned to anyone — never reuse an
    // mt5_login that was previously held by another trader (assigned_to / assigned_at must be null).
    const needsFirstCred = (newStatus === "active") && !account.mt5Login;
    if (needsFirstCred) {
      const { data: availableCred } = await supabase
        .from("trading_credentials")
        .select("*")
        .eq("is_assigned", false)
        .is("assigned_to", null)
        .is("assigned_at", null)
        .eq("challenge_id", account.challengeId)
        .limit(1)
        .maybeSingle();

      if (availableCred) {
        // Atomic claim: only succeed if still unclaimed (race-safe).
        const { data: claimed, error: claimErr } = await supabase
          .from("trading_credentials")
          .update({
            is_assigned: true,
            assigned_to: account.userId,
            purchase_id: account.purchaseId,
            assigned_at: new Date().toISOString(),
          })
          .eq("id", availableCred.id)
          .eq("is_assigned", false)
          .is("assigned_to", null)
          .select("id")
          .maybeSingle();

        if (claimErr || !claimed) {
          toast.error("Credential was just claimed by another assignment — try again.");
          setUpdating(null);
          return;
        }

        try {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              type: "credentials",
              recipientUserId: account.userId,
              data: {
                mt5Login: availableCred.mt5_login,
                mt5Password: availableCred.mt5_password,
                mt5Server: availableCred.mt5_server || "MEXAtlantic-Demo",
                challengeName: account.challengeName,
                accountSize: `$${Number(account.accountSize).toLocaleString()}`,
              },
            },
          });
        } catch (e) { console.error("credentials email failed", e); }

        toast.success(`Credentials issued: FP ${availableCred.mt5_login}`);
      } else {
        toast.warning("No fresh, never-used credentials available for this challenge!");
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

      // Carry forward the latest parsed MT5 stats so dashboard graphs/trades stay populated
      // after the admin manually pushes a phase. NEVER overwrite with empty {accountSize, userName}.
      let carriedStats: Record<string, any> = { accountSize: account.accountSize, userName: account.userName };
      try {
        const { data: existingCerts } = await supabase
          .from("user_certificates")
          .select("stats, certificate_type, created_at")
          .eq("user_id", account.userId)
          .eq("account_number", account.mt5Login)
          .order("created_at", { ascending: false });
        const richest = (existingCerts || []).find((c: any) => {
          const s = c.stats;
          return s && (typeof s.balance === "number" || typeof s.totalTrades === "number" || typeof s.equity === "number");
        });
        if (richest && richest.stats && typeof richest.stats === "object") {
          carriedStats = { ...(richest.stats as Record<string, any>), ...carriedStats };
        }
      } catch (e) { console.error("failed to carry forward stats", e); }

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
        stats: carriedStats,
      });
      toast.success(`Certificate "${certTitle}" issued`);
    }

    toast.success(`Status → ${newStatus}`);
    setUpdating(null);
    fetchAccounts();
  };

  // ── Open the manual-credential dialog when admin clicks "Push to next phase" ──
  // We NO LONGER auto-pull from the pool. Admin must enter the new MT5 login/password/server
  // for this trader, which guarantees credentials are never reused across users.
  const openPushDialog = (account: UserAccount) => {
    const targetStatus = account.status === "phase1_passed"
      ? (account.stepType?.toLowerCase().includes("one") ? "funded" : "phase2")
      : "funded";
    setCredForm({ mt5Login: "", mt5Password: "", mt5Server: "MEXAtlantic-Demo" });
    setPushDialog({ open: true, account, targetStatus });
  };

  // ── Submit the manual credentials → create row, assign, flip status, email trader ──
  const submitPushDialog = async () => {
    const { account, targetStatus } = pushDialog;
    if (!account) return;
    const mt5Login = credForm.mt5Login.trim();
    const mt5Password = credForm.mt5Password.trim();
    const mt5Server = credForm.mt5Server.trim() || "MEXAtlantic-Demo";
    if (!mt5Login || !mt5Password) {
      toast.error("MT5 login and password are required.");
      return;
    }

    setUpdating(account.purchaseId);
    try {
      // Guard: refuse if this MT5 login already exists in the credentials pool — never reuse.
      const { data: dup } = await supabase
        .from("trading_credentials")
        .select("id, assigned_to")
        .eq("mt5_login", mt5Login)
        .maybeSingle();
      if (dup) {
        toast.error(`MT5 login ${mt5Login} already exists in the credentials pool — never reuse logins. Use a fresh one.`);
        setUpdating(null);
        return;
      }

      // 1. Create the new credential row pre-assigned to this trader/purchase.
      const { data: created, error: insertErr } = await supabase
        .from("trading_credentials")
        .insert({
          challenge_id: account.challengeId,
          mt5_login: mt5Login,
          mt5_password: mt5Password,
          mt5_server: mt5Server,
          is_assigned: true,
          assigned_to: account.userId,
          assigned_at: new Date().toISOString(),
          purchase_id: account.purchaseId,
        })
        .select("id, mt5_login, mt5_password, mt5_server")
        .single();
      if (insertErr || !created) throw insertErr || new Error("Failed to create credential");

      // 2. Update purchase status.
      const oldStatus = account.status;
      const { error: updErr } = await supabase
        .from("challenge_purchases")
        .update({ status: targetStatus })
        .eq("id", account.purchaseId);
      if (updErr) throw updErr;

      // 3. Log status change.
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from("account_status_history").insert({
        purchase_id: account.purchaseId,
        user_id: account.userId,
        old_status: oldStatus,
        new_status: targetStatus,
        changed_by: session?.user?.id || null,
        note: `Admin pushed to ${targetStatus} with manually-entered credential FP ${created.mt5_login}.`,
      } as any);

      // 4. Email the trader the new credentials.
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            type: "credentials",
            recipientUserId: account.userId,
            data: {
              mt5Login: created.mt5_login,
              mt5Password: created.mt5_password,
              mt5Server: created.mt5_server || "MEXAtlantic-Demo",
              challengeName: account.challengeName,
              accountSize: `$${Number(account.accountSize).toLocaleString()}`,
            },
          },
        });
      } catch (e) { console.error("credentials email failed", e); }

      toast.success(`Pushed to ${targetStatus}. Credential FP ${created.mt5_login} assigned & emailed.`);
      setPushDialog({ open: false, account: null, targetStatus: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to push to next phase");
    } finally {
      setUpdating(null);
      fetchAccounts();
    }
  };

  // HTML Statement Upload Handler
  const handleStatementUpload = async (file: File) => {
    if (!selectedAccount?.mt5Login) {
      toast.error("No MT5 login assigned to this account");
      return;
    }
    setUploading(true);
    setUploadResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-mt5-statement`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      });
      const result = await res.json();
      setUploadResult(result);
      if (result.success) {
        toast.success(result.message || "Statement processed successfully");
        fetchAccounts();
      } else {
        toast.error(result.message || result.error || "Failed to process statement");
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
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

  // Shared push-credentials dialog — rendered in both detail and list views.
  const pushCredDialog = (
    <Dialog open={pushDialog.open} onOpenChange={(o) => !o && setPushDialog({ open: false, account: null, targetStatus: "" })}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {pushDialog.targetStatus === "phase2" ? "Push to Phase 2 — enter NEW credentials" :
             pushDialog.targetStatus === "funded" ? "Push to Funded — enter NEW credentials" :
             "Push to next phase"}
          </DialogTitle>
          <DialogDescription asChild>
            <div>
              {pushDialog.account && (
                <>Issuing a brand-new MT5 account to <b>{pushDialog.account.userName}</b> ({pushDialog.account.email}) for <b>{pushDialog.account.challengeName}</b>. These credentials will be saved to the credentials pool, locked to this trader, and emailed to them. Never reuse old logins.</>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="cred-login" className="text-xs">MT5 Login *</Label>
            <Input id="cred-login" value={credForm.mt5Login} onChange={e => setCredForm(f => ({ ...f, mt5Login: e.target.value }))} placeholder="e.g. 90460001" className="mt-1 h-9 text-sm" />
          </div>
          <div>
            <Label htmlFor="cred-pass" className="text-xs">MT5 Password *</Label>
            <Input id="cred-pass" value={credForm.mt5Password} onChange={e => setCredForm(f => ({ ...f, mt5Password: e.target.value }))} placeholder="MT5 investor / master password" className="mt-1 h-9 text-sm" />
          </div>
          <div>
            <Label htmlFor="cred-server" className="text-xs">MT5 Server</Label>
            <Input id="cred-server" value={credForm.mt5Server} onChange={e => setCredForm(f => ({ ...f, mt5Server: e.target.value }))} placeholder="MEXAtlantic-Demo" className="mt-1 h-9 text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setPushDialog({ open: false, account: null, targetStatus: "" })} disabled={updating === pushDialog.account?.purchaseId}>Cancel</Button>
          <Button size="sm" onClick={submitPushDialog} disabled={updating === pushDialog.account?.purchaseId} className="bg-amber-600 hover:bg-amber-700 text-white">
            {updating === pushDialog.account?.purchaseId ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <CheckCircle2 size={14} className="mr-1.5" />}
            Assign & email trader
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

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
    const dailyDD = s.dailyDrawdownPercent ?? s.maxDailyDrawdownPercent ?? 0;
    const gainPercent = s.gainPercent ?? (profit / selectedAccount.accountSize * 100);
    const profitFactor = s.profitFactor ?? 0;

    // Pull challenge limits from purchase row for context
    const challengeRow: any = (selectedAccount as any).challenges || (selectedAccount as any).challenge || null;
    const dailyDDLimit = parseFloat(String(challengeRow?.daily_drawdown ?? "5")) || 5;
    const maxDDLimit = parseFloat(String(challengeRow?.max_drawdown ?? "10")) || 10;

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

        {/* Manual Push Button — only when account is under review */}
        {(selectedAccount.status === "phase1_passed" || selectedAccount.status === "phase2_passed") && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-900 uppercase tracking-wider mb-1">⚠ Account Under Review</p>
            <p className="text-xs text-amber-800 mb-3">
              {selectedAccount.status === "phase1_passed"
                ? "Trader passed Phase 1. Enter the NEW MT5 credentials for the next phase — they will be assigned to this trader and emailed automatically. Never reuse old logins."
                : "Trader passed Phase 2. Enter the NEW funded MT5 credentials — they will be assigned to this trader and emailed automatically. Never reuse old logins."}
            </p>
            <Button
              size="sm"
              disabled={updating === selectedAccount.purchaseId}
              onClick={() => openPushDialog(selectedAccount)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
            >
              {updating === selectedAccount.purchaseId ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <CheckCircle2 size={14} className="mr-1.5" />}
              {selectedAccount.status === "phase1_passed" ? "Push to Phase 2 (enter credentials)" : "Push to Funded (enter credentials)"}
            </Button>
          </div>
        )}

        {/* Phase Selector */}
        <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] p-4">
          <p className="text-xs font-semibold text-[hsl(0,0%,40%)] uppercase tracking-wider mb-3">Change Status (manual override)</p>
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

        {/* HTML Statement Upload */}
        <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] p-4">
          <p className="text-xs font-semibold text-[hsl(0,0%,40%)] uppercase tracking-wider mb-3">Upload MT5 Statement</p>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(0,0%,0%)] text-white text-xs font-medium cursor-pointer hover:bg-[hsl(0,0%,15%)] transition-colors">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? "Processing..." : "Upload HTML Statement"}
              <input
                type="file"
                accept=".html,.htm"
                className="hidden"
                disabled={uploading || !selectedAccount.mt5Login}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleStatementUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
            {!selectedAccount.mt5Login && (
              <span className="text-xs text-red-500">No MT5 login assigned</span>
            )}
          </div>
          {uploadResult && (
            <div className={`mt-3 p-3 rounded-lg text-xs ${uploadResult.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              <p className="font-semibold">{uploadResult.success ? "✅ Success" : "❌ Failed"}</p>
              <p className="mt-1">{uploadResult.message || uploadResult.error}</p>
              {uploadResult.evaluation && (
                <div className="mt-2 space-y-1">
                  {uploadResult.evaluation.details && Object.entries(uploadResult.evaluation.details).map(([key, val]) => (
                    <p key={key}><span className="font-medium capitalize">{key.replace(/([A-Z])/g, " $1")}:</span> {String(val)}</p>
                  ))}
                </div>
              )}
            </div>
          )}
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
        {pushCredDialog}
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

      {/* Under Review banner — surfaces accounts awaiting manual push */}
      {((statusCounts.phase1_passed || 0) + (statusCounts.phase2_passed || 0)) > 0 && statusFilter === "all" && (
        <button
          onClick={() => setStatusFilter("phase1_passed")}
          className="w-full flex items-center justify-between bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl px-4 py-3 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">
              {(statusCounts.phase1_passed || 0) + (statusCounts.phase2_passed || 0)}
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">Accounts awaiting manual push</p>
              <p className="text-[11px] text-amber-700">
                Phase 1 passed: {statusCounts.phase1_passed || 0} · Phase 2 passed: {statusCounts.phase2_passed || 0} — click an account to push it forward.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-amber-700">Review →</span>
        </button>
      )}

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
        {PHASES.map(p => {
          const isUnderReview = p.value === "phase1_passed" || p.value === "phase2_passed";
          const count = statusCounts[p.value] || 0;
          return (
            <button
              key={p.value}
              onClick={() => setStatusFilter(p.value)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                statusFilter === p.value
                  ? "bg-[hsl(0,0%,8%)] text-white"
                  : isUnderReview && count > 0
                    ? "bg-amber-100 text-amber-800 hover:bg-amber-200 ring-1 ring-amber-300"
                    : "bg-[hsl(0,0%,95%)] text-[hsl(0,0%,45%)] hover:bg-[hsl(0,0%,90%)]"
              }`}
            >
              {p.label.split(" (")[0]} ({count})
            </button>
          );
        })}
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
      {pushCredDialog}
    </div>
  );
};

export default UserPhaseManager;
