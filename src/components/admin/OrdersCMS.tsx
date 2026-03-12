import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, ShoppingCart, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrdersCMSProps {
  purchases: any[];
  profiles: any[];
  challenges: any[];
  getProfileName: (userId: string) => string;
  getChallengeNameById: (id: string) => string;
  onRefresh: () => void;
}

type StatusFilter = "all" | "pending" | "completed" | "cancelled";

export default function OrdersCMS({
  purchases, profiles, challenges, getProfileName, getChallengeNameById, onRefresh,
}: OrdersCMSProps) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = purchases;
    if (filter !== "all") list = list.filter(p => p.payment_status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => {
        const name = getProfileName(p.user_id).toLowerCase();
        const challenge = getChallengeNameById(p.challenge_id).toLowerCase();
        return name.includes(q) || challenge.includes(q) || p.id.includes(q);
      });
    }
    return list;
  }, [purchases, filter, search, getProfileName, getChallengeNameById]);

  const counts = useMemo(() => ({
    all: purchases.length,
    pending: purchases.filter(p => p.payment_status === "pending").length,
    completed: purchases.filter(p => p.payment_status === "completed").length,
    cancelled: purchases.filter(p => p.payment_status === "cancelled").length,
  }), [purchases]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    const paymentStatus = status === "confirmed" ? "completed" : status;
    const orderStatus = status === "confirmed" ? "active" : status;
    const { error } = await supabase.from("challenge_purchases").update({ payment_status: paymentStatus, status: orderStatus }).eq("id", id);
    if (error) { toast.error(error.message); setUpdating(null); return; }

    // Auto-assign credentials when confirming
    if (status === "confirmed") {
      const order = purchases.find(p => p.id === id);
      if (order) {
        // Find a free credential for this challenge
        const { data: freeCred } = await supabase
          .from("trading_credentials")
          .select("id")
          .eq("challenge_id", order.challenge_id)
          .eq("is_assigned", false)
          .limit(1)
          .single();

        if (freeCred) {
          await supabase
            .from("trading_credentials")
            .update({
              is_assigned: true,
              assigned_to: order.user_id,
              purchase_id: order.id,
              assigned_at: new Date().toISOString(),
            })
            .eq("id", freeCred.id)
            .eq("is_assigned", false);
          toast.success("Credentials auto-assigned!");
        } else {
          toast.warning("No free credentials available for this challenge.");
        }

        // Send confirmation email
        try {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              type: "purchase_confirmation",
              data: {
                challengeName: getChallengeNameById(order.challenge_id),
                accountSize: getChallengeNameById(order.challenge_id),
                amountPaid: `$${order.amount_paid}`,
              },
            },
          });
        } catch (e) {
          console.error("Email failed:", e);
        }
      }
    }

    toast.success(`Order ${status}!`);
    setUpdating(null);
    onRefresh();
  };

  const filters: { key: StatusFilter; label: string; color: string }[] = [
    { key: "all", label: "All", color: "" },
    { key: "pending", label: "Pending", color: "bg-amber-100 text-amber-700" },
    { key: "confirmed", label: "Confirmed", color: "bg-emerald-100 text-emerald-700" },
    { key: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-700" },
  ];

  const statusBadge = (status: string) => {
    if (status === "confirmed") return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 size={11} /> Confirmed</span>;
    if (status === "cancelled") return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700"><XCircle size={11} /> Cancelled</span>;
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock size={11} /> Pending</span>;
  };

  const exportCSV = () => {
    if (!filtered.length) return;
    const rows = filtered.map(p => ({
      id: p.id,
      user: getProfileName(p.user_id),
      challenge: getChallengeNameById(p.challenge_id),
      amount: p.amount_paid,
      status: p.payment_status,
      swap_free: p.swap_free,
      date: new Date(p.created_at).toLocaleString(),
    }));
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(","), ...rows.map(r => keys.map(k => `"${String((r as any)[k] ?? "")}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "orders.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">Orders</h2>
          <p className="text-xs text-[hsl(0,0%,50%)] mt-0.5">{purchases.length} total orders</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCSV} className="text-xs rounded-lg border-[hsl(0,0%,88%)]">Export CSV</Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`p-4 rounded-xl border transition-all text-left ${
              filter === f.key
                ? "bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] border-[hsl(0,0%,0%)]"
                : "bg-[hsl(0,0%,100%)] text-[hsl(0,0%,20%)] border-[hsl(0,0%,90%)] hover:border-[hsl(0,0%,70%)]"
            }`}
          >
            <p className={`text-[10px] font-medium uppercase tracking-wider ${filter === f.key ? "text-[hsl(0,0%,70%)]" : "text-[hsl(0,0%,50%)]"}`}>{f.label}</p>
            <p className="text-2xl font-display font-bold mt-1">{counts[f.key]}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(0,0%,55%)]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by user, challenge, or ID..."
          className="h-9 w-full pl-9 pr-3 rounded-lg bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] text-xs text-[hsl(0,0%,20%)] placeholder:text-[hsl(0,0%,55%)] focus:outline-none focus:ring-1 focus:ring-[hsl(0,0%,70%)]"
        />
      </div>

      {/* Table */}
      <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-[hsl(0,0%,45%)] border-b border-[hsl(0,0%,92%)]">
              <th className="px-5 py-3 font-medium">User</th>
              <th className="px-5 py-3 font-medium">Challenge</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Swap Free</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-xs text-[hsl(0,0%,55%)]">No orders found</td></tr>
            )}
            {filtered.map(order => (
              <tr key={order.id} className="border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)] transition-colors">
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-[hsl(0,0%,10%)]">{getProfileName(order.user_id)}</p>
                  <p className="text-[10px] text-[hsl(0,0%,55%)] font-mono">{order.user_id.slice(0, 8)}...</p>
                </td>
                <td className="px-5 py-3 text-sm text-[hsl(0,0%,30%)]">{getChallengeNameById(order.challenge_id)}</td>
                <td className="px-5 py-3 text-sm font-semibold text-[hsl(0,0%,10%)]">${order.amount_paid}</td>
                <td className="px-5 py-3 text-xs text-[hsl(0,0%,45%)]">{order.swap_free ? "Yes" : "No"}</td>
                <td className="px-5 py-3">{statusBadge(order.payment_status)}</td>
                <td className="px-5 py-3 text-xs text-[hsl(0,0%,50%)]">{new Date(order.created_at).toLocaleString()}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    {order.payment_status !== "confirmed" && (
                      <Button
                        size="sm"
                        onClick={() => updateStatus(order.id, "confirmed")}
                        disabled={updating === order.id}
                        className="h-7 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                      >
                        <CheckCircle2 size={12} className="mr-1" /> Confirm
                      </Button>
                    )}
                    {order.payment_status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(order.id, "cancelled")}
                        disabled={updating === order.id}
                        className="h-7 px-2.5 text-[11px] border-red-200 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <XCircle size={12} className="mr-1" /> Cancel
                      </Button>
                    )}
                    {order.payment_status !== "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(order.id, "pending")}
                        disabled={updating === order.id}
                        className="h-7 px-2.5 text-[11px] border-amber-200 text-amber-600 hover:bg-amber-50 rounded-lg"
                      >
                        <Clock size={12} className="mr-1" /> Pending
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
