import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, Copy, Users, DollarSign, Clock, Award, Wallet,
  BarChart3, Mail, Calendar, ChevronRight
} from "lucide-react";
import { motion } from "framer-motion";

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
  amount_paid: number;
  status: string;
  payment_status: string;
  swap_free: boolean;
  created_at: string;
  challenges: { name: string; account_size: number } | null;
}

interface Certificate {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  created_at: string;
}

const REFERRAL_DOMAIN = "https://fundingpulze.com";

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) fetchAllData();
  }, [user, authLoading]);

  const fetchAllData = async () => {
    const [profileRes, referralsRes, purchasesRes, certsRes] = await Promise.all([
      supabase.from("profiles").select("referral_code, display_name, email, avatar_url, created_at").eq("user_id", user!.id).single(),
      supabase.from("affiliate_referrals").select("*").eq("referrer_id", user!.id),
      supabase.from("challenge_purchases").select("*, challenges(name, account_size)").eq("user_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("certificates").select("*").eq("is_visible", true).order("sort_order"),
    ]);
    if (profileRes.data) setProfile(profileRes.data);
    if (referralsRes.data) setReferrals(referralsRes.data);
    if (purchasesRes.data) setPurchases(purchasesRes.data as unknown as Purchase[]);
    if (certsRes.data) setCertificates(certsRes.data);
    setLoading(false);
  };

  const copyReferralLink = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(`${REFERRAL_DOMAIN}?ref=${profile.referral_code}`);
      toast.success("Referral link copied!");
    }
  };

  const totalEarnings = referrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  const pendingEarnings = referrals.filter(r => r.commission_status === "pending").reduce((sum, r) => sum + (r.commission_amount || 0), 0);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabItems = [
    { value: "profile", label: "Profile", icon: User },
    { value: "accounts", label: "Accounts", icon: BarChart3 },
    { value: "affiliate", label: "Affiliate", icon: Users },
    { value: "certificates", label: "Certificates", icon: Award },
    { value: "payout", label: "Payout", icon: Wallet },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar isDark={true} onToggleTheme={() => {}} />

      <div className="max-w-6xl mx-auto pt-28 pb-16 px-4 sm:px-6">
        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-1">
            Welcome, <span className="text-gradient">{profile?.display_name || "Trader"}</span>
          </h1>
          <p className="text-muted-foreground text-sm">Manage your account, track earnings, and view certificates.</p>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex overflow-x-auto bg-secondary/50 rounded-xl p-1 mb-8 gap-1">
            {tabItems.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 min-w-[100px] flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium data-[state=active]:bg-foreground data-[state=active]:text-background transition-all"
              >
                <tab.icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ─── Profile ─── */}
          <TabsContent value="profile">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="glass-card p-6 sm:p-8">
                <div className="flex items-center gap-5 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-border flex items-center justify-center">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                      <User size={28} className="text-primary" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold text-foreground">{profile?.display_name || "—"}</h2>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow icon={Mail} label="Email" value={user?.email || "—"} />
                  <InfoRow icon={User} label="Display Name" value={profile?.display_name || "—"} />
                  <InfoRow icon={Calendar} label="Member Since" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"} />
                  <InfoRow icon={Users} label="Referral Code" value={profile?.referral_code || "—"} />
                </div>
              </div>

              <div className="glass-card p-6">
                <h3 className="font-display font-bold text-foreground mb-3">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <QuickAction label="View Challenges" onClick={() => navigate("/#rules")} />
                  <QuickAction label="Help Center" onClick={() => navigate("/help")} />
                  <QuickAction label="Sign Out" onClick={async () => { await signOut(); navigate("/"); }} />
                </div>
              </div>
            </motion.div>
          </TabsContent>

          {/* ─── Accounts ─── */}
          <TabsContent value="accounts">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <StatCard icon={BarChart3} value={purchases.length.toString()} label="Total Accounts" />
                <StatCard icon={DollarSign} value={`$${purchases.reduce((s, p) => s + p.amount_paid, 0).toFixed(0)}`} label="Total Invested" />
                <StatCard icon={Award} value={purchases.filter(p => p.status === "active").length.toString()} label="Active Accounts" />
              </div>

              <div className="glass-card overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h2 className="font-display font-bold text-foreground">Your Accounts</h2>
                </div>
                {purchases.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">
                    <BarChart3 size={32} className="mx-auto mb-3 opacity-40" />
                    <p>No accounts yet.</p>
                    <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate("/#rules")}>
                      Browse Challenges
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b border-border">
                          <th className="px-5 py-3">Challenge</th>
                          <th className="px-5 py-3">Size</th>
                          <th className="px-5 py-3">Paid</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.map((p) => (
                          <tr key={p.id} className="border-b border-border last:border-0 text-sm">
                            <td className="px-5 py-4 text-foreground font-medium">{p.challenges?.name || "—"}</td>
                            <td className="px-5 py-4 text-foreground">${(p.challenges?.account_size || 0).toLocaleString()}</td>
                            <td className="px-5 py-4 text-foreground">${p.amount_paid}</td>
                            <td className="px-5 py-4">
                              <StatusBadge status={p.status} />
                            </td>
                            <td className="px-5 py-4 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </TabsContent>

          {/* ─── Affiliate ─── */}
          <TabsContent value="affiliate">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Referral link */}
              <div className="glass-card p-6">
                <p className="text-sm text-muted-foreground mb-2">Your Referral Link</p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 surface-elevated rounded-lg px-4 py-3 text-sm text-foreground truncate">
                    {REFERRAL_DOMAIN}?ref={profile?.referral_code}
                  </code>
                  <Button onClick={copyReferralLink} variant="outline" size="sm" className="rounded-xl shrink-0">
                    <Copy size={16} className="mr-2" /> Copy
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard icon={Users} value={referrals.length.toString()} label="Total Referrals" />
                <StatCard icon={DollarSign} value={`$${totalEarnings.toFixed(2)}`} label="Total Earnings" />
                <StatCard icon={Clock} value={`$${pendingEarnings.toFixed(2)}`} label="Pending" />
              </div>

              {/* History */}
              <div className="glass-card overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h2 className="font-display font-bold text-foreground">Referral History</h2>
                </div>
                {referrals.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">
                    No referrals yet. Share your link to start earning!
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b border-border">
                          <th className="px-5 py-3">Date</th>
                          <th className="px-5 py-3">Commission</th>
                          <th className="px-5 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referrals.map((r) => (
                          <tr key={r.id} className="border-b border-border last:border-0 text-sm">
                            <td className="px-5 py-4 text-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                            <td className="px-5 py-4 text-foreground">${(r.commission_amount || 0).toFixed(2)}</td>
                            <td className="px-5 py-4"><StatusBadge status={r.commission_status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </TabsContent>

          {/* ─── Certificates ─── */}
          <TabsContent value="certificates">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {certificates.length === 0 ? (
                <div className="glass-card p-10 text-center text-muted-foreground">
                  <Award size={32} className="mx-auto mb-3 opacity-40" />
                  <p>No certificates available yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {certificates.map((cert) => (
                    <div key={cert.id} className="glass-card overflow-hidden group">
                      <div className="aspect-[4/3] overflow-hidden">
                        <img
                          src={cert.image_url}
                          alt={cert.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-4">
                        <h3 className="font-display font-bold text-foreground mb-1">{cert.title}</h3>
                        {cert.description && <p className="text-xs text-muted-foreground">{cert.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* ─── Payout ─── */}
          <TabsContent value="payout">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard icon={DollarSign} value={`$${totalEarnings.toFixed(2)}`} label="Lifetime Earnings" />
                <StatCard icon={Clock} value={`$${pendingEarnings.toFixed(2)}`} label="Pending Payout" />
              </div>

              <div className="glass-card p-6 sm:p-8">
                <h2 className="font-display font-bold text-foreground mb-4">Payout Information</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Payouts are processed once your commission is approved. Approved commissions are paid out within 5-7 business days via your preferred payment method. If you have questions, contact our support team.
                </p>
                <Button variant="outline" className="mt-5 rounded-xl" onClick={() => navigate("/help")}>
                  Contact Support
                </Button>
              </div>

              {/* Payout history from referrals that are paid */}
              {referrals.filter(r => r.commission_status === "paid").length > 0 && (
                <div className="glass-card overflow-hidden">
                  <div className="p-5 border-b border-border">
                    <h2 className="font-display font-bold text-foreground">Payout History</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b border-border">
                          <th className="px-5 py-3">Date</th>
                          <th className="px-5 py-3">Amount</th>
                          <th className="px-5 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referrals.filter(r => r.commission_status === "paid").map((r) => (
                          <tr key={r.id} className="border-b border-border last:border-0 text-sm">
                            <td className="px-5 py-4 text-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                            <td className="px-5 py-4 text-foreground">${(r.commission_amount || 0).toFixed(2)}</td>
                            <td className="px-5 py-4"><StatusBadge status="paid" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      <Footer />
    </div>
  );
};

/* ─── Sub-components ─── */

const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
    <Icon size={16} className="text-muted-foreground shrink-0" />
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground font-medium truncate">{value}</p>
    </div>
  </div>
);

const StatCard = ({ icon: Icon, value, label }: { icon: any; value: string; label: string }) => (
  <div className="glass-card p-5 text-center">
    <Icon size={22} className="text-primary mx-auto mb-2" />
    <p className="text-2xl font-bold font-display text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground mt-1">{label}</p>
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    paid: "bg-green-500/15 text-green-400",
    approved: "bg-blue-500/15 text-blue-400",
    active: "bg-green-500/15 text-green-400",
    pending: "bg-yellow-500/15 text-yellow-400",
    completed: "bg-green-500/15 text-green-400",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colors[status] || "bg-secondary text-muted-foreground"}`}>
      {status}
    </span>
  );
};

const QuickAction = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center justify-between w-full p-3 rounded-xl bg-secondary/30 hover:bg-secondary/60 transition-colors text-sm text-foreground font-medium"
  >
    {label}
    <ChevronRight size={16} className="text-muted-foreground" />
  </button>
);

export default Dashboard;
