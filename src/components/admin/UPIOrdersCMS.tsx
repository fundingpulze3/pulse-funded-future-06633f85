import { useState, useMemo } from "react";
import { db as supabase } from "@/integrations/db/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Search, IndianRupee, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UPIOrdersCMSProps {
  purchases: any[];
  profiles: any[];
  challenges: any[];
  getProfileName: (userId: string) => string;
  getProfileByUserId: (userId: string) => any;
  getChallengeNameById: (id: string) => string;
  onRefresh: () => void;
}

const USD_TO_INR = 85;

export default function UPIOrdersCMS({
  purchases, profiles, challenges, getProfileName, getProfileByUserId, getChallengeNameById, onRefresh,
}: UPIOrdersCMSProps) {
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "cancelled">("all");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const upiOrders = useMemo(() => purchases.filter(p => p.payment_method === "upi"), [purchases]);

  const filtered = useMemo(() => {
    let list = upiOrders;
    if (filter !== "all") list = list.filter(p => p.payment_status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => {
        const name = getProfileName(p.user_id).toLowerCase();
        const utr = (p.utr_number || "").toLowerCase();
        return name.includes(q) || utr.includes(q) || p.id.includes(q);
      });
    }
    return list;
  }, [upiOrders, filter, search, getProfileName]);

  const counts = useMemo(() => ({
    all: upiOrders.length,
    pending: upiOrders.filter(p => p.payment_status === "pending").length,
    completed: upiOrders.filter(p => p.payment_status === "completed").length,
    cancelled: upiOrders.filter(p => p.payment_status === "cancelled").length,
  }), [upiOrders]);

  const updateStatus = async (id: string, status: "confirmed" | "cancelled") => {
    setUpdating(id);
    const paymentStatus = status === "confirmed" ? "completed" : "cancelled";
    const orderStatus = status === "confirmed" ? "active" : "cancelled";
    const { error } = await supabase.from("challenge_purchases").update({ payment_status: paymentStatus, status: orderStatus }).eq("id", id);
    if (error) { toast.error(error.message); setUpdating(null); return; }

    if (status === "confirmed") {
      const order = upiOrders.find(p => p.id === id);
      if (order) {
        const challenge = challenges.find(c => c.id === order.challenge_id);
        const challengeName = challenge?.name || getChallengeNameById(order.challenge_id);
        const accountSize = challenge ? `$${((challenge as any).account_size / 1000).toFixed(0)}K` : "";

        const { data: freeCred } = await supabase
          .from("trading_credentials")
          .select("id, mt5_login, mt5_password, mt5_server")
          .eq("challenge_id", order.challenge_id)
          .eq("is_assigned", false)
          .is("assigned_to", null)
          .is("assigned_at", null)
          .limit(1)
          .maybeSingle();

        if (freeCred) {
          await supabase.from("trading_credentials").update({
            is_assigned: true, assigned_to: order.user_id, purchase_id: order.id, assigned_at: new Date().toISOString(),
          }).eq("id", freeCred.id).eq("is_assigned", false);
          toast.success("Credentials auto-assigned!");

          try {
            await supabase.functions.invoke("send-transactional-email", {
              body: { type: "credentials", recipientUserId: order.user_id, data: { mt5Login: freeCred.mt5_login, mt5Password: freeCred.mt5_password, mt5Server: freeCred.mt5_server, challengeName, accountSize } },
            });
            toast.success("Credentials email sent!");
          } catch (e) { console.error(e); }
        } else {
          toast.warning("No free credentials for this challenge.");
        }

        try {
          await supabase.functions.invoke("send-transactional-email", {
            body: { type: "purchase_confirmation", recipientUserId: order.user_id, data: { challengeName, accountSize, amountPaid: `$${order.amount_paid}` } },
          });
          toast.success("Confirmation email sent!");
        } catch (e) { console.error(e); }
      }
    }

    toast.success(`UPI order ${status === "confirmed" ? "confirmed" : "cancelled"}!`);
    setUpdating(null);
    onRefresh();
  };

  const copyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    toast.success("UTR copied!");
  };

  const statusBadge = (status: string) => {
    if (status === "completed") return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 size={11} /> Confirmed</span>;
    if (status === "cancelled") return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700"><XCircle size={11} /> Rejected</span>;
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock size={11} /> Pending</span>;
  };

  const filters: { key: typeof filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "completed", label: "Confirmed" },
    { key: "cancelled", label: "Rejected" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">UPI Payments</h2>
        <p className="text-xs text-[hsl(0,0%,50%)] mt-0.5">Review and confirm/reject UPI manual payments</p>
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
          placeholder="Search by user, UTR, or ID..."
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
              <th className="px-5 py-3 font-medium">UTR Number</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-xs text-[hsl(0,0%,55%)]">No UPI orders found</td></tr>
            )}
            {filtered.map(order => (
              <tr key={order.id} className="border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)] transition-colors">
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-[hsl(0,0%,10%)]">{getProfileName(order.user_id)}</p>
                  <p className="text-[10px] text-[hsl(0,0%,55%)] font-mono">{order.user_id.slice(0, 8)}...</p>
                </td>
                <td className="px-5 py-3 text-sm text-[hsl(0,0%,30%)]">{getChallengeNameById(order.challenge_id)}</td>
                <td className="px-5 py-3">
                  <p className="text-sm font-semibold text-[hsl(0,0%,10%)]">${order.amount_paid}</p>
                  <p className="text-[10px] text-[hsl(0,0%,50%)] flex items-center gap-0.5"><IndianRupee size={10} />≈ ₹{Math.round(order.amount_paid * USD_TO_INR)}</p>
                </td>
                <td className="px-5 py-3">
                  {order.utr_number ? (
                    <button onClick={() => copyUtr(order.utr_number)} className="flex items-center gap-1.5 text-xs font-mono text-[hsl(0,0%,20%)] hover:text-[hsl(0,0%,0%)] transition-colors bg-[hsl(0,0%,96%)] rounded-md px-2 py-1">
                      {order.utr_number}
                      <Copy size={11} className="text-[hsl(0,0%,45%)]" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-[hsl(0,0%,55%)]">Not submitted</span>
                  )}
                </td>
                <td className="px-5 py-3">{statusBadge(order.payment_status)}</td>
                <td className="px-5 py-3 text-xs text-[hsl(0,0%,50%)]">{new Date(order.created_at).toLocaleString()}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    {order.payment_status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => updateStatus(order.id, "confirmed")}
                          disabled={updating === order.id}
                          className="h-7 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                        >
                          <CheckCircle2 size={12} className="mr-1" /> Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(order.id, "cancelled")}
                          disabled={updating === order.id}
                          className="h-7 px-2.5 text-[11px] border-red-200 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <XCircle size={12} className="mr-1" /> Reject
                        </Button>
                      </>
                    )}
                    {order.payment_status !== "pending" && (
                      <span className="text-[10px] text-[hsl(0,0%,55%)]">—</span>
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
