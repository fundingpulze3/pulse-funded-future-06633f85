import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Copy, Users, DollarSign, Clock } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface Profile {
  referral_code: string | null;
  display_name: string | null;
}

interface Referral {
  id: string;
  commission_amount: number | null;
  commission_status: string;
  created_at: string;
}

const AffiliateDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) fetchData();
  }, [user, authLoading]);

  const fetchData = async () => {
    const [profileRes, referralsRes] = await Promise.all([
      supabase.from("profiles").select("referral_code, display_name").eq("user_id", user!.id).single(),
      supabase.from("affiliate_referrals").select("*").eq("referrer_id", user!.id),
    ]);
    if (profileRes.data) setProfile(profileRes.data);
    if (referralsRes.data) setReferrals(referralsRes.data);
    setLoading(false);
  };

  const copyReferralLink = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(`${window.location.origin}?ref=${profile.referral_code}`);
      toast.success("Referral link copied!");
    }
  };

  const totalEarnings = referrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  const pendingEarnings = referrals.filter(r => r.commission_status === "pending").reduce((sum, r) => sum + (r.commission_amount || 0), 0);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="font-display text-4xl font-bold mb-2">
            Affiliate <span className="text-gradient">Dashboard</span>
          </h1>
          <p className="text-muted-foreground">Track your referrals and earnings.</p>
        </div>

        {/* Referral Link */}
        <div className="glass-card p-6 mb-8">
          <p className="text-sm text-muted-foreground mb-2">Your Referral Link</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 surface-elevated rounded-lg px-4 py-3 text-sm text-foreground truncate">
              {window.location.origin}?ref={profile?.referral_code}
            </code>
            <Button onClick={copyReferralLink} variant="outline" size="sm" className="rounded-xl shrink-0">
              <Copy size={16} className="mr-2" /> Copy
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="glass-card p-6 text-center">
            <Users size={24} className="text-primary mx-auto mb-3" />
            <p className="text-3xl font-bold font-display text-foreground">{referrals.length}</p>
            <p className="text-sm text-muted-foreground">Total Referrals</p>
          </div>
          <div className="glass-card p-6 text-center">
            <DollarSign size={24} className="text-primary mx-auto mb-3" />
            <p className="text-3xl font-bold font-display text-foreground">${totalEarnings.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Total Earnings</p>
          </div>
          <div className="glass-card p-6 text-center">
            <Clock size={24} className="text-primary mx-auto mb-3" />
            <p className="text-3xl font-bold font-display text-foreground">${pendingEarnings.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
        </div>

        {/* Referrals Table */}
        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="font-display font-bold text-lg text-foreground">Referral History</h2>
          </div>
          {referrals.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              No referrals yet. Share your link to start earning!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b border-border">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Commission</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-6 py-4 text-sm text-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">${(r.commission_amount || 0).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          r.commission_status === "paid" ? "bg-green-500/20 text-green-400" :
                          r.commission_status === "approved" ? "bg-blue-500/20 text-blue-400" :
                          "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {r.commission_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AffiliateDashboard;
