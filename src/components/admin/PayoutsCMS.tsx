import { useEffect, useState } from "react";
import { db as supabase } from "@/integrations/db/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Clock, Wallet, Search,
  DollarSign, Loader2, ChevronDown,
} from "lucide-react";

type PayoutRow = {
  id: string;
  user_id: string;
  purchase_id: string;
  payout_number: string;
  amount: number;
  profit_split_percentage: number;
  reward_cycle: string;
  status: string;
  payment_method: string;
  payment_details: Record<string, string>;
  review_note: string | null;
  created_at: string;
  profiles?: { display_name: string | null; email: string | null };
};

const PayoutsCMS = () => {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected" | "paid">("all");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [profitModal, setProfitModal] = useState<{ purchaseId: string; currentProfit: number } | null>(null);
  const [newProfit, setNewProfit] = useState("");

  useEffect(() => {
    loadPayouts();
  }, []);

  const loadPayouts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payout_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    // Fetch profiles for all user_ids
    const userIds = [...new Set((data || []).map((p: any) => p.user_id))];
    let profilesMap: Record<string, { display_name: string | null; email: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", userIds);
      (profiles || []).forEach((p: any) => {
        profilesMap[p.user_id] = { display_name: p.display_name, email: p.email };
      });
    }

    setPayouts(
      (data || []).map((p: any) => ({
        ...p,
        profiles: profilesMap[p.user_id] || { display_name: null, email: null },
      }))
    );
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string, note?: string) => {
    setUpdating(id);
    const updateData: any = {
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id,
    };
    if (note) updateData.review_note = note;

    const { error } = await supabase.from("payout_requests").update(updateData).eq("id", id);
    if (error) {
      toast.error("Failed to update");
    } else {
      toast.success(`Payout ${status}!`);
      loadPayouts();
    }
    setUpdating(null);
  };

  const updateProfit = async () => {
    if (!profitModal) return;
    const val = parseFloat(newProfit);
    if (isNaN(val) || val < 0) { toast.error("Invalid amount"); return; }

    const { error } = await supabase
      .from("challenge_purchases")
      .update({ total_profit: val } as any)
      .eq("id", profitModal.purchaseId);

    if (error) {
      toast.error("Failed to update profit");
    } else {
      toast.success("Profit updated!");
      setProfitModal(null);
      setNewProfit("");
    }
  };

  const filtered = payouts.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        p.payout_number.toLowerCase().includes(s) ||
        p.profiles?.display_name?.toLowerCase().includes(s) ||
        p.profiles?.email?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      pending: { cls: "bg-amber-100 text-amber-700", label: "Pending" },
      approved: { cls: "bg-green-100 text-green-700", label: "Approved" },
      paid: { cls: "bg-green-100 text-green-700", label: "Paid" },
      rejected: { cls: "bg-red-100 text-red-700", label: "Rejected" },
    };
    const s = map[status] || map.pending;
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.cls}`}>{s.label}</span>;
  };

  const totalPending = payouts.filter((p) => p.status === "pending").length;
  const totalApproved = payouts.filter((p) => p.status === "approved" || p.status === "paid").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] p-4">
          <p className="text-[10px] text-[hsl(0,0%,50%)] uppercase tracking-wider">Total Requests</p>
          <p className="text-2xl font-bold">{payouts.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] p-4">
          <p className="text-[10px] text-amber-600 uppercase tracking-wider">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{totalPending}</p>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] p-4">
          <p className="text-[10px] text-green-600 uppercase tracking-wider">Total Paid</p>
          <p className="text-2xl font-bold text-green-600">${totalApproved.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "pending", "approved", "paid", "rejected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all capitalize ${
                filter === f
                  ? "bg-[hsl(0,0%,5%)] text-white"
                  : "bg-[hsl(0,0%,93%)] text-[hsl(0,0%,40%)] hover:bg-[hsl(0,0%,88%)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(0,0%,50%)]" />
          <Input
            placeholder="Search by name, email, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs bg-white border-[hsl(0,0%,90%)]"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-[hsl(0,0%,60%)]" size={24} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[hsl(0,0%,55%)]">
          <Wallet size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No payout requests found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[hsl(0,0%,45%)] border-b border-[hsl(0,0%,92%)] bg-[hsl(0,0%,97%)]">
                  <th className="text-left px-4 py-3 font-medium">Payout ID</th>
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 font-medium">Split</th>
                  <th className="text-left px-4 py-3 font-medium">Method</th>
                  <th className="text-left px-4 py-3 font-medium">Details</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-[hsl(0,0%,95%)] hover:bg-[hsl(0,0%,98%)]">
                    <td className="px-4 py-3 font-mono text-[hsl(0,0%,40%)]">{p.payout_number}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[hsl(0,0%,10%)]">{p.profiles?.display_name || "—"}</p>
                      <p className="text-[10px] text-[hsl(0,0%,50%)]">{p.profiles?.email || "—"}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-green-600">${p.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[hsl(0,0%,40%)]">{p.profit_split_percentage}%</td>
                    <td className="px-4 py-3 text-[hsl(0,0%,40%)] capitalize">{p.payment_method}</td>
                    <td className="px-4 py-3 text-[10px] text-[hsl(0,0%,50%)]">
                      {p.payment_method === "crypto" ? (
                        <span className="font-mono break-all">{p.payment_details?.wallet_address || "—"}</span>
                      ) : (
                        <span>{p.payment_details?.bank_name} • {p.payment_details?.account_number}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{statusBadge(p.status)}</td>
                    <td className="px-4 py-3 text-[hsl(0,0%,50%)]">
                      {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      {p.status === "pending" ? (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => updateStatus(p.id, "approved")}
                            disabled={updating === p.id}
                            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                            title="Approve"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <button
                            onClick={() => updateStatus(p.id, "rejected")}
                            disabled={updating === p.id}
                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            title="Reject"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      ) : p.status === "approved" ? (
                        <button
                          onClick={() => updateStatus(p.id, "paid")}
                          disabled={updating === p.id}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-semibold transition-colors"
                        >
                          Mark Paid
                        </button>
                      ) : (
                        <span className="text-[10px] text-[hsl(0,0%,55%)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayoutsCMS;
