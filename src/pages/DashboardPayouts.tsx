import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Wallet, Trophy, ArrowUpRight, Clock, CheckCircle2, XCircle,
  Loader2, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

const BLUE = "207,90%,77%";
const GREEN = "142,60%,50%";

const REWARD_CYCLES = [
  { key: "weekly", label: "Weekly", split: 60, days: 7 },
  { key: "biweekly", label: "Bi-weekly", split: 80, days: 14 },
  { key: "ondemand", label: "On Demand", split: 90, days: 7 },
  { key: "monthly", label: "Monthly", split: 100, days: 30 },
];

const WHITELIST_EMAILS = ["notchiragc@gmail.com"];

type PayoutRequest = {
  id: string;
  payout_number: string;
  amount: number;
  profit_split_percentage: number;
  reward_cycle: string;
  status: string;
  payment_method: string;
  payment_details: Record<string, string>;
  review_note: string | null;
  created_at: string;
};

type FundedAccount = {
  id: string;
  challenge_id: string;
  status: string;
  reward_cycle: string | null;
  total_profit: number | null;
  last_payout_at: string | null;
  challenges: { name: string; account_size: number } | null;
};

const DashboardPayouts = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string | null } | null>(null);
  const [fundedAccounts, setFundedAccounts] = useState<FundedAccount[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [certificates, setCertificates] = useState<{ title: string; certificate_image_url: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  // Request form state
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [requestAmount, setRequestAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"crypto" | "bank">("crypto");
  const [walletAddress, setWalletAddress] = useState("");
  const [bankDetails, setBankDetails] = useState({ bank_name: "", account_number: "", ifsc: "", account_holder: "" });
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth"); return; }
    if (user) loadData();
  }, [user, authLoading]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const [profileRes, purchasesRes, payoutsRes, certsRes] = await Promise.all([
      supabase.from("profiles").select("display_name, email").eq("user_id", user.id).maybeSingle(),
      supabase.from("challenge_purchases").select("id, challenge_id, status, reward_cycle, total_profit, last_payout_at, challenges(name, account_size)").eq("user_id", user.id).eq("status", "funded"),
      supabase.from("payout_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("user_certificates").select("title, certificate_image_url").eq("user_id", user.id),
    ]);

    setProfile(profileRes.data as any);
    const whitelisted = WHITELIST_EMAILS.includes(profileRes.data?.email || user.email || "");
    setHasAccess(whitelisted || (purchasesRes.data?.length || 0) > 0);

    const accounts = (purchasesRes.data || []).map((p: any) => ({
      ...p,
      challenges: p.challenges ? (Array.isArray(p.challenges) ? p.challenges[0] : p.challenges) : null,
    }));
    setFundedAccounts(accounts);
    if (accounts.length > 0 && !selectedAccount) setSelectedAccount(accounts[0].id);
    setPayouts((payoutsRes.data || []) as PayoutRequest[]);
    setCertificates(certsRes.data || []);
    setLoading(false);
  };

  const lifetimeEarnings = payouts
    .filter((p) => p.status === "approved" || p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  const selectedFunded = fundedAccounts.find((a) => a.id === selectedAccount);
  const currentCycle = REWARD_CYCLES.find((c) => c.key === (selectedFunded?.reward_cycle || "weekly"));
  const eligibleAmount = (selectedFunded?.total_profit || 0) * ((currentCycle?.split || 60) / 100);

  const updateRewardCycle = async (cycle: string) => {
    if (!selectedAccount) return;
    await supabase.from("challenge_purchases").update({ reward_cycle: cycle } as any).eq("id", selectedAccount);
    setFundedAccounts((prev) =>
      prev.map((a) => (a.id === selectedAccount ? { ...a, reward_cycle: cycle } : a))
    );
    toast.success("Reward cycle updated!");
  };

  const submitPayout = async () => {
    if (!user || !selectedAccount || !requestAmount) return;
    const amount = parseFloat(requestAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (amount > eligibleAmount) { toast.error(`Maximum eligible: $${eligibleAmount.toFixed(2)}`); return; }

    const paymentDetails =
      paymentMethod === "crypto"
        ? { wallet_address: walletAddress, network: "USDT TRC20" }
        : bankDetails;

    if (paymentMethod === "crypto" && !walletAddress) { toast.error("Enter wallet address"); return; }
    if (paymentMethod === "bank" && (!bankDetails.bank_name || !bankDetails.account_number)) {
      toast.error("Fill in bank details");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("payout_requests").insert({
      user_id: user.id,
      purchase_id: selectedAccount,
      amount,
      profit_split_percentage: currentCycle?.split || 60,
      reward_cycle: currentCycle?.key || "weekly",
      payment_method: paymentMethod,
      payment_details: paymentDetails,
    } as any);

    if (error) {
      toast.error("Failed to submit request");
      console.error(error);
    } else {
      toast.success("Payout request submitted!");
      setRequestAmount("");
      setShowForm(false);
      loadData();
    }
    setSubmitting(false);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; icon: any; label: string }> = {
      pending: { color: "text-amber-400 bg-amber-400/10", icon: Clock, label: "Pending" },
      approved: { color: "text-green-400 bg-green-400/10", icon: CheckCircle2, label: "Approved" },
      paid: { color: "text-green-400 bg-green-400/10", icon: CheckCircle2, label: "Paid" },
      rejected: { color: "text-red-400 bg-red-400/10", icon: XCircle, label: "Rejected" },
    };
    const s = map[status] || map.pending;
    const Icon = s.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.color}`}>
        <Icon size={10} /> {s.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[hsl(220,20%,4%)] text-[hsl(0,0%,92%)] flex flex-col">
      <DashboardSidebar profile={profile} />

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden lg:block w-16 shrink-0" />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-4 lg:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[hsl(142,60%,50%)]/15 flex items-center justify-center">
                <Wallet size={18} className="text-[hsl(142,60%,50%)]" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold">Payouts</h1>
                <p className="text-xs text-[hsl(220,15%,45%)]">Manage your earnings & withdrawals</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-[hsl(220,15%,35%)]" size={28} />
              </div>
            ) : !hasAccess ? (
              <div className="text-center py-20 text-[hsl(220,15%,35%)]">
                <Wallet size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Reach funded status to request payouts!</p>
              </div>
            ) : (
              <>
                {/* Lifetime Earnings + Certificates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Lifetime Earnings */}
                  <div className="rounded-2xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,6%)] p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy size={16} className={`text-[hsl(${BLUE})]`} />
                      <span className="text-xs text-[hsl(220,15%,45%)] uppercase tracking-wider">Lifetime Earnings</span>
                    </div>
                    <p className={`font-display text-4xl font-bold text-[hsl(${GREEN})]`}>
                      ${lifetimeEarnings.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-[hsl(220,15%,40%)] mt-2">
                      {payouts.filter((p) => p.status === "approved" || p.status === "paid").length} successful payouts
                    </p>
                  </div>

                  {/* Certificates Preview */}
                  <div className="rounded-2xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,6%)] p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy size={16} className="text-amber-400" />
                      <span className="text-xs text-[hsl(220,15%,45%)] uppercase tracking-wider">Achievements</span>
                    </div>
                    {certificates.length > 0 ? (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {certificates.map((cert, i) => (
                          <div key={i} className="shrink-0 w-20 text-center">
                            {cert.certificate_image_url ? (
                              <img
                                src={cert.certificate_image_url}
                                alt={cert.title}
                                className="w-20 h-14 object-cover rounded-lg border border-[hsl(220,15%,15%)]"
                              />
                            ) : (
                              <div className="w-20 h-14 rounded-lg bg-[hsl(220,15%,10%)] flex items-center justify-center">
                                <Trophy size={16} className="text-amber-400/40" />
                              </div>
                            )}
                            <p className="text-[9px] text-[hsl(220,15%,45%)] mt-1 truncate">{cert.title}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[hsl(220,15%,35%)]">No certificates yet</p>
                    )}
                  </div>
                </div>

                {/* Funded Account Selector + Reward Cycle */}
                {fundedAccounts.length > 0 && (
                  <div className="rounded-2xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,6%)] p-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <p className="text-xs text-[hsl(220,15%,45%)] mb-1">Funded Account</p>
                        {fundedAccounts.length === 1 ? (
                          <p className="font-display font-bold text-sm">
                            {selectedFunded?.challenges?.name || "Funded"} — ${(selectedFunded?.challenges?.account_size || 0).toLocaleString()}
                          </p>
                        ) : (
                          <select
                            value={selectedAccount || ""}
                            onChange={(e) => setSelectedAccount(e.target.value)}
                            className="bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,15%)] rounded-lg px-3 py-1.5 text-sm"
                          >
                            {fundedAccounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.challenges?.name || "Funded"} — ${(a.challenges?.account_size || 0).toLocaleString()}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-[hsl(220,15%,45%)] mb-2">Reward Cycle</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {REWARD_CYCLES.map((c) => (
                            <button
                              key={c.key}
                              onClick={() => updateRewardCycle(c.key)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                                (selectedFunded?.reward_cycle || "weekly") === c.key
                                  ? `bg-[hsl(${BLUE})] text-black`
                                  : "bg-[hsl(220,15%,10%)] text-[hsl(220,15%,50%)] hover:bg-[hsl(220,15%,14%)]"
                              }`}
                            >
                              {c.label} ({c.split}%)
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Eligible Amount */}
                    <div className="mt-4 pt-4 border-t border-[hsl(220,15%,12%)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-[hsl(220,15%,45%)]">Total Profit</p>
                        <p className="font-display text-lg font-bold">${(selectedFunded?.total_profit || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[hsl(220,15%,45%)]">Eligible to Withdraw ({currentCycle?.split}%)</p>
                        <p className={`font-display text-lg font-bold text-[hsl(${GREEN})]`}>
                          ${eligibleAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <Button
                        onClick={() => setShowForm(!showForm)}
                        disabled={eligibleAmount <= 0}
                        className={`rounded-xl px-6 py-2.5 text-sm font-semibold bg-[hsl(${GREEN})] hover:bg-[hsl(142,60%,40%)] text-black`}
                      >
                        <ArrowUpRight size={14} className="mr-1.5" />
                        Request Payout
                      </Button>
                    </div>

                    {/* Payout Request Form */}
                    {showForm && (
                      <div className="mt-4 pt-4 border-t border-[hsl(220,15%,12%)] space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-[hsl(220,15%,45%)] mb-1 block">Amount ($)</label>
                            <Input
                              type="number"
                              placeholder={`Max: $${eligibleAmount.toFixed(2)}`}
                              value={requestAmount}
                              onChange={(e) => setRequestAmount(e.target.value)}
                              className="bg-[hsl(220,15%,8%)] border-[hsl(220,15%,15%)] text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-[hsl(220,15%,45%)] mb-1 block">Payment Method</label>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setPaymentMethod("crypto")}
                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                                  paymentMethod === "crypto"
                                    ? `bg-[hsl(${BLUE})] text-black`
                                    : "bg-[hsl(220,15%,10%)] text-[hsl(220,15%,50%)]"
                                }`}
                              >
                                Crypto (USDT)
                              </button>
                              <button
                                onClick={() => setPaymentMethod("bank")}
                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                                  paymentMethod === "bank"
                                    ? `bg-[hsl(${BLUE})] text-black`
                                    : "bg-[hsl(220,15%,10%)] text-[hsl(220,15%,50%)]"
                                }`}
                              >
                                Bank Transfer
                              </button>
                            </div>
                          </div>
                        </div>

                        {paymentMethod === "crypto" ? (
                          <div>
                            <label className="text-xs text-[hsl(220,15%,45%)] mb-1 block">USDT Wallet Address (TRC20)</label>
                            <Input
                              placeholder="T..."
                              value={walletAddress}
                              onChange={(e) => setWalletAddress(e.target.value)}
                              className="bg-[hsl(220,15%,8%)] border-[hsl(220,15%,15%)] text-sm"
                            />
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-[hsl(220,15%,45%)] mb-1 block">Bank Name</label>
                              <Input
                                placeholder="Bank name"
                                value={bankDetails.bank_name}
                                onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })}
                                className="bg-[hsl(220,15%,8%)] border-[hsl(220,15%,15%)] text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-[hsl(220,15%,45%)] mb-1 block">Account Number</label>
                              <Input
                                placeholder="Account number"
                                value={bankDetails.account_number}
                                onChange={(e) => setBankDetails({ ...bankDetails, account_number: e.target.value })}
                                className="bg-[hsl(220,15%,8%)] border-[hsl(220,15%,15%)] text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-[hsl(220,15%,45%)] mb-1 block">IFSC / SWIFT Code</label>
                              <Input
                                placeholder="IFSC / SWIFT"
                                value={bankDetails.ifsc}
                                onChange={(e) => setBankDetails({ ...bankDetails, ifsc: e.target.value })}
                                className="bg-[hsl(220,15%,8%)] border-[hsl(220,15%,15%)] text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-[hsl(220,15%,45%)] mb-1 block">Account Holder Name</label>
                              <Input
                                placeholder="Full name"
                                value={bankDetails.account_holder}
                                onChange={(e) => setBankDetails({ ...bankDetails, account_holder: e.target.value })}
                                className="bg-[hsl(220,15%,8%)] border-[hsl(220,15%,15%)] text-sm"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex gap-3">
                          <Button
                            onClick={submitPayout}
                            disabled={submitting}
                            className={`rounded-xl px-6 py-2.5 text-sm font-semibold bg-[hsl(${GREEN})] hover:bg-[hsl(142,60%,40%)] text-black`}
                          >
                            {submitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <ArrowUpRight size={14} className="mr-1.5" />}
                            Submit Request
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setShowForm(false)}
                            className="rounded-xl px-5 py-2.5 text-sm border-[hsl(220,15%,15%)] text-[hsl(220,15%,50%)]"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Payout History */}
                <div className="rounded-2xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,6%)] overflow-hidden">
                  <div className="p-5 border-b border-[hsl(220,15%,12%)]">
                    <h2 className="font-display font-bold text-sm">Payout History</h2>
                  </div>

                  {payouts.length === 0 ? (
                    <div className="text-center py-12 text-[hsl(220,15%,35%)]">
                      <Wallet size={28} className="mx-auto mb-2 opacity-40" />
                      <p className="text-xs">No payout requests yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[hsl(220,15%,40%)] border-b border-[hsl(220,15%,10%)]">
                            <th className="text-left px-5 py-3 font-medium">Payout ID</th>
                            <th className="text-left px-5 py-3 font-medium">Amount</th>
                            <th className="text-left px-5 py-3 font-medium">Split</th>
                            <th className="text-left px-5 py-3 font-medium">Method</th>
                            <th className="text-left px-5 py-3 font-medium">Status</th>
                            <th className="text-left px-5 py-3 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payouts.map((p) => (
                            <tr
                              key={p.id}
                              className="border-b border-[hsl(220,15%,8%)] hover:bg-[hsl(220,15%,7%)] transition-colors"
                            >
                              <td className="px-5 py-3 font-mono text-[hsl(220,15%,55%)]">{p.payout_number}</td>
                              <td className={`px-5 py-3 font-bold text-[hsl(${GREEN})]`}>
                                ${p.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-5 py-3 text-[hsl(220,15%,50%)]">{p.profit_split_percentage}%</td>
                              <td className="px-5 py-3 text-[hsl(220,15%,50%)] capitalize">{p.payment_method}</td>
                              <td className="px-5 py-3">{statusBadge(p.status)}</td>
                              <td className="px-5 py-3 text-[hsl(220,15%,40%)]">
                                {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPayouts;
