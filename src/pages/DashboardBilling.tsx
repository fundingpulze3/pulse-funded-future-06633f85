import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db as supabase } from "@/integrations/db/client";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Receipt, Loader2 } from "lucide-react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

interface Order {
  id: string;
  amount_paid: number;
  status: string;
  payment_status: string;
  swap_free: boolean;
  created_at: string;
  challenge: { name: string; account_size: number; step_type: string } | null;
}

const statusColor: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  confirmed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

const DashboardBilling = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ display_name: string | null } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: p }, { data: o }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("user_id", user.id).single(),
        supabase
          .from("challenge_purchases")
          .select("id, amount_paid, status, payment_status, swap_free, created_at, challenges(name, account_size, step_type)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      setProfile(p);
      setOrders(
        (o || []).filter((r: any) => r.status !== "pending").map((r: any) => ({
          ...r,
          challenge: r.challenges || null,
        }))
      );
      setLoading(false);
    };
    load();
  }, [user]);

  return (
    <div className="min-h-screen bg-[hsl(220,20%,4%)] text-white flex flex-col">
      <DashboardSidebar profile={profile} />
      <div className="flex flex-1">
        <div className="hidden lg:block w-16 shrink-0" />
        <main className="flex-1 p-4 lg:p-8 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-2 mb-6">
            <Receipt size={18} className="text-[hsl(207,90%,77%)]" />
            <h1 className="text-xl font-bold">Billing & Orders</h1>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-[hsl(207,90%,77%)]" size={28} />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-20 text-[hsl(220,15%,40%)] text-sm">
              No orders yet. Purchase a challenge to get started.
            </div>
          ) : (
            <div className="rounded-xl border border-[hsl(220,15%,12%)] overflow-hidden bg-[hsl(220,18%,6%)]">
              <Table>
                <TableHeader>
                  <TableRow className="border-[hsl(220,15%,12%)] hover:bg-transparent">
                    <TableHead className="text-[hsl(220,15%,45%)] text-[11px] font-medium">Date</TableHead>
                    <TableHead className="text-[hsl(220,15%,45%)] text-[11px] font-medium">Challenge</TableHead>
                    <TableHead className="text-[hsl(220,15%,45%)] text-[11px] font-medium">Type</TableHead>
                    <TableHead className="text-[hsl(220,15%,45%)] text-[11px] font-medium">Amount</TableHead>
                    <TableHead className="text-[hsl(220,15%,45%)] text-[11px] font-medium">Payment</TableHead>
                    <TableHead className="text-[hsl(220,15%,45%)] text-[11px] font-medium">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map(order => (
                    <TableRow key={order.id} className="border-[hsl(220,15%,12%)] hover:bg-[hsl(220,15%,8%)]">
                      <TableCell className="text-xs text-[hsl(220,15%,60%)]">
                        {format(new Date(order.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {order.challenge?.name || "—"}
                        {order.challenge && (
                          <span className="ml-1.5 text-[hsl(220,15%,40%)]">
                            ${order.challenge.account_size.toLocaleString()}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-[hsl(220,15%,50%)]">
                        {order.challenge?.step_type || "—"}
                        {order.swap_free && <span className="ml-1 text-[hsl(207,90%,77%)]">• Swap-Free</span>}
                      </TableCell>
                      <TableCell className="text-xs font-medium">${order.amount_paid}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${statusColor[order.payment_status] || "border-[hsl(220,15%,20%)] text-[hsl(220,15%,50%)]"}`}>
                          {order.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${statusColor[order.status] || "border-[hsl(220,15%,20%)] text-[hsl(220,15%,50%)]"}`}>
                          {order.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default DashboardBilling;
