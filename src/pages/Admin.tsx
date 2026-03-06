import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Trophy, Link2, Shield } from "lucide-react";
import { toast } from "sonner";

type Tab = "users" | "challenges" | "referrals";

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("users");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) {
        navigate("/auth");
        return;
      }
      if (!isAdmin) {
        toast.error("Access denied. Admin only.");
        navigate("/");
        return;
      }
      fetchAll();
    }
  }, [user, authLoading, isAdmin, adminLoading]);

  const fetchAll = async () => {
    const [p, c, r] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("challenges").select("*").order("account_size", { ascending: true }),
      supabase.from("affiliate_referrals").select("*").order("created_at", { ascending: false }),
    ]);
    if (p.data) setProfiles(p.data);
    if (c.data) setChallenges(c.data);
    if (r.data) setReferrals(r.data);
    setLoading(false);
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Shield className="animate-pulse" size={24} />
          <p>Verifying admin access...</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "users", label: "Users", icon: <Users size={18} />, count: profiles.length },
    { id: "challenges", label: "Challenges", icon: <Trophy size={18} />, count: challenges.length },
    { id: "referrals", label: "Referrals", icon: <Link2 size={18} />, count: referrals.length },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
                <Shield size={22} className="text-primary" /> Admin Panel
              </h1>
              <p className="text-sm text-muted-foreground">Manage your platform</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {t.icon}
              {t.label}
              <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                tab === t.id ? "bg-primary-foreground/20" : "bg-border"
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {tab === "users" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-display font-bold text-lg text-foreground">All Users</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b border-border bg-secondary/50">
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Referral Code</th>
                    <th className="px-5 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-4 text-sm text-foreground font-medium">{p.display_name || "—"}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{p.email || "—"}</td>
                      <td className="px-5 py-4">
                        <code className="text-xs bg-secondary px-2 py-1 rounded-md text-accent">{p.referral_code || "—"}</code>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {profiles.length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">No users yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Challenges Tab */}
        {tab === "challenges" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-display font-bold text-lg text-foreground">Challenges</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b border-border bg-secondary/50">
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Account Size</th>
                    <th className="px-5 py-3">Price</th>
                    <th className="px-5 py-3">Profit Target</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {challenges.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-4 text-sm text-foreground font-medium">{c.name}</td>
                      <td className="px-5 py-4 text-sm text-foreground">${c.account_size.toLocaleString()}</td>
                      <td className="px-5 py-4 text-sm text-foreground">${c.price}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{c.profit_target}</td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          c.is_active ? "bg-green-500/20 text-green-400" : "bg-destructive/20 text-destructive"
                        }`}>
                          {c.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {challenges.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No challenges yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Referrals Tab */}
        {tab === "referrals" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-display font-bold text-lg text-foreground">All Referrals</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b border-border bg-secondary/50">
                    <th className="px-5 py-3">Referrer ID</th>
                    <th className="px-5 py-3">Referred ID</th>
                    <th className="px-5 py-3">Commission</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-4">
                        <code className="text-xs bg-secondary px-2 py-1 rounded-md text-muted-foreground">{r.referrer_id.slice(0, 8)}...</code>
                      </td>
                      <td className="px-5 py-4">
                        <code className="text-xs bg-secondary px-2 py-1 rounded-md text-muted-foreground">{r.referred_id.slice(0, 8)}...</code>
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground">${(r.commission_amount || 0).toFixed(2)}</td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          r.commission_status === "paid" ? "bg-green-500/20 text-green-400" :
                          r.commission_status === "approved" ? "bg-blue-500/20 text-blue-400" :
                          "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {r.commission_status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {referrals.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No referrals yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
