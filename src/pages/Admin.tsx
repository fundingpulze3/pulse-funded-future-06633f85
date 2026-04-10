import { useEffect, useState, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Users, Trophy, Link2, Shield, Plus, Pencil, Trash2, Wallet, Upload,
  CheckCircle2, XCircle, DollarSign, Ticket, Home, LogOut,
  LayoutDashboard, ShoppingCart, TrendingUp, BarChart3, Globe, LogIn, BookOpen, FileText, Award, Layers, Headphones, Brain,
  LineChart as LineChartIcon, Search as SearchIcon, Bell, Key,
  Image as ImageIcon, ShieldCheck, Menu, X as XIcon, Sparkles, Smartphone, IndianRupee, Power, Mail,
} from "lucide-react";
import HelpCenterCMS from "@/components/admin/HelpCenterCMS";
import BlogCMS from "@/components/admin/BlogCMS";
import CertificatesCMS from "@/components/admin/CertificatesCMS";
import PagesCMS from "@/components/admin/PagesCMS";
import SupportTicketsCMS from "@/components/admin/SupportTicketsCMS";
import KnowledgeBaseCMS from "@/components/admin/KnowledgeBaseCMS";
import Dashboard from "@/components/admin/Dashboard";
import CredentialsManager from "@/components/admin/CredentialsManager";
import OrdersCMS from "@/components/admin/OrdersCMS";
import UserCertificatesCMS from "@/components/admin/UserCertificatesCMS";
import CertificateTemplateManager from "@/components/admin/CertificateTemplateManager";
import UserPhaseManager from "@/components/admin/UserPhaseManager";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import SEOManager from "@/components/admin/SEOManager";
import RevenueAnalytics from "@/components/admin/RevenueAnalytics";

import KYCManager from "@/components/admin/KYCManager";
import PayoutsCMS from "@/components/admin/PayoutsCMS";
import BlogAIChat from "@/components/admin/BlogAIChat";
import UPISettings from "@/components/admin/UPISettings";
import UPIOrdersCMS from "@/components/admin/UPIOrdersCMS";
import RolesManager from "@/components/admin/RolesManager";
import ImportUsers from "@/components/admin/ImportUsers";
import EmailMarketing from "@/components/admin/EmailMarketing";
import { useKillSwitch } from "@/hooks/useKillSwitch";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

type Tab = "dashboard" | "analytics" | "revenue" | "seo" | "users" | "challenges" | "orders" | "referrals" | "coupons" | "utm" | "helpcenter" | "support" | "blog" | "blog_ai" | "certificates" | "pages" | "knowledgebase" | "credentials" | "user_certificates" | "cert_templates" | "user_phases" | "kyc" | "payouts" | "upi_settings" | "upi_orders" | "roles" | "email_marketing";

interface ChallengeForm {
  name: string; account_size: string; price: string; profit_target: string;
  daily_drawdown: string; max_drawdown: string; min_trading_days: string;
  leverage: string; step_type: string; is_active: boolean;
}

const emptyChallengeForm: ChallengeForm = {
  name: "", account_size: "", price: "", profit_target: "", daily_drawdown: "",
  max_drawdown: "", min_trading_days: "", leverage: "1:100", step_type: "1-step", is_active: true,
};

interface CouponForm {
  code: string; discount_type: string; discount_value: string;
  max_uses: string; is_active: boolean; expires_at: string;
}

const emptyCouponForm: CouponForm = {
  code: "", discount_type: "percentage", discount_value: "", max_uses: "", is_active: true, expires_at: "",
};

const HIDDEN_ADMIN_EMAILS = ["s.saurav2006@gmail.com"];
const ADMIN_TABS: Tab[] = ["dashboard", "analytics", "revenue", "seo", "users", "challenges", "orders", "referrals", "coupons", "utm", "helpcenter", "support", "blog", "blog_ai", "certificates", "pages", "knowledgebase", "credentials", "user_certificates", "cert_templates", "user_phases", "kyc", "payouts", "upi_settings", "upi_orders", "roles", "email_marketing"];

const getInitialAdminTab = (): Tab => {
  if (typeof window === "undefined") return "dashboard";
  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  return requestedTab && ADMIN_TABS.includes(requestedTab as Tab) ? (requestedTab as Tab) : "dashboard";
};

const Admin = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, userRole, loading: adminLoading } = useAdminCheck();
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const { isKilled, toggle: toggleKillSwitch } = useKillSwitch();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(getInitialAdminTab);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [pageVisits, setPageVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
  const [challengeForm, setChallengeForm] = useState<ChallengeForm>(emptyChallengeForm);
  const [saving, setSaving] = useState(false);

  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [couponForm, setCouponForm] = useState<CouponForm>(emptyCouponForm);
  const [couponSaving, setCouponSaving] = useState(false);
  const [importUsersOpen, setImportUsersOpen] = useState(false);

  // SEO: noindex for admin pages
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex, nofollow";
    return () => { if (meta) meta.remove(); };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    let gPressed = false;
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.key === "g") { gPressed = true; setTimeout(() => { gPressed = false; }, 500); return; }
      if (gPressed) {
        const map: Record<string, Tab> = { d: "dashboard", a: "analytics", r: "revenue", s: "seo", u: "users" };
        if (map[e.key]) { setTab(map[e.key]); gPressed = false; }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const requestedTab = new URLSearchParams(location.search).get("tab");
    if (requestedTab && ADMIN_TABS.includes(requestedTab as Tab) && requestedTab !== tab) {
      setTab(requestedTab as Tab);
    }
  }, [location.search, tab]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("tab") === tab) return;
    params.set("tab", tab);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [tab, location.pathname, location.search, navigate]);

  const hasInitialized = useState(false);
  useEffect(() => {
    // Wait until BOTH auth and admin checks are fully resolved
    if (authLoading || adminLoading) return;
    if (!user) { navigate("/auth", { replace: true }); return; }
    if (!isAdmin) { toast.error("Access denied."); navigate("/", { replace: true }); return; }
    // Employee can only see support — default to support tab
    if (userRole === "employee") setTab("support");
    if (!hasInitialized[0]) {
      hasInitialized[0] = true;
      fetchAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, adminLoading]);

  // Paginated fetch helper to get ALL rows beyond 1000 limit
  const fetchAllRows = async (table: string, orderCol: string, ascending: boolean = false) => {
    const allData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase.from(table as any).select("*").order(orderCol, { ascending }).range(from, from + batchSize - 1);
      if (error || !data || data.length === 0) break;
      allData.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    return allData;
  };

  const fetchAll = async () => {
    try {
      const [profilesData, c, r, cp, pu, ur] = await Promise.all([
        fetchAllRows("profiles", "created_at", false),
        supabase.from("challenges").select("*").order("account_size", { ascending: true }),
        supabase.from("affiliate_referrals").select("*").order("created_at", { ascending: false }),
        supabase.from("coupons").select("*").order("created_at", { ascending: false }),
        supabase.from("challenge_purchases").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*"),
      ]);

      // Fetch page_visits with pagination
      const pageVisitsData = await fetchAllRows("page_visits", "created_at", false);

      setProfiles(profilesData);
      if (c.data) setChallenges(c.data);
      if (r.data) setReferrals(r.data);
      if (cp.data) setCoupons(cp.data);
      if (pu.data) setPurchases(pu.data);
      setPageVisits(pageVisitsData);
      if (ur.data) {
        const roleMap: Record<string, string> = {};
        ur.data.forEach((r: any) => { roleMap[r.user_id] = r.role; });
        setUserRoles(roleMap);
      }
    } catch (err) {
      console.error("Error fetching admin data:", err);
      toast.error("Some data failed to load");
    } finally {
      setLoading(false);
    }
  };

  // UTM analytics
  const filteredVisits = useMemo(() =>
    pageVisits.filter((v: any) => !v.page_url?.includes("lovable") && !v.page_url?.includes("__lovable") && !v.referrer?.includes("lovable")),
    [pageVisits]
  );

  const utmSourceStats = useMemo(() => {
    const sources: Record<string, { visits: number; signups: number }> = {};
    filteredVisits.forEach((v) => { const src = v.utm_source || "(direct)"; if (!sources[src]) sources[src] = { visits: 0, signups: 0 }; sources[src].visits++; });
    profiles.forEach((p: any) => { const src = p.utm_source || "(direct)"; if (!sources[src]) sources[src] = { visits: 0, signups: 0 }; sources[src].signups++; });
    return Object.entries(sources).map(([source, data]) => ({ source, ...data, conversionRate: data.visits > 0 ? ((data.signups / data.visits) * 100).toFixed(1) : "0" })).sort((a, b) => b.visits - a.visits);
  }, [filteredVisits, profiles]);

  const utmCampaignStats = useMemo(() => {
    const campaigns: Record<string, { visits: number; signups: number }> = {};
    filteredVisits.filter(v => v.utm_campaign).forEach((v) => { const c = v.utm_campaign!; if (!campaigns[c]) campaigns[c] = { visits: 0, signups: 0 }; campaigns[c].visits++; });
    profiles.filter((p: any) => p.utm_campaign).forEach((p: any) => { const c = p.utm_campaign; if (!campaigns[c]) campaigns[c] = { visits: 0, signups: 0 }; campaigns[c].signups++; });
    return Object.entries(campaigns).map(([campaign, data]) => ({ campaign, ...data, conversionRate: data.visits > 0 ? ((data.signups / data.visits) * 100).toFixed(1) : "0" })).sort((a, b) => b.visits - a.visits);
  }, [filteredVisits, profiles]);

  const utmMediumStats = useMemo(() => {
    const mediums: Record<string, { visits: number; signups: number }> = {};
    filteredVisits.filter(v => v.utm_medium).forEach((v) => { const m = v.utm_medium!; if (!mediums[m]) mediums[m] = { visits: 0, signups: 0 }; mediums[m].visits++; });
    profiles.filter((p: any) => p.utm_medium).forEach((p: any) => { const m = p.utm_medium; if (!mediums[m]) mediums[m] = { visits: 0, signups: 0 }; mediums[m].signups++; });
    return Object.entries(mediums).map(([medium, data]) => ({ medium, ...data, conversionRate: data.visits > 0 ? ((data.signups / data.visits) * 100).toFixed(1) : "0" })).sort((a, b) => b.visits - a.visits);
  }, [filteredVisits, profiles]);

  // ---- Challenge CRUD ----
  const openCreateChallenge = () => { setChallengeForm(emptyChallengeForm); setEditingChallengeId(null); setChallengeDialogOpen(true); };
  const openEditChallenge = (c: any) => {
    setChallengeForm({ name: c.name, account_size: String(c.account_size), price: String(c.price), profit_target: c.profit_target, daily_drawdown: c.daily_drawdown, max_drawdown: c.max_drawdown, min_trading_days: c.min_trading_days, leverage: c.leverage, step_type: c.step_type, is_active: c.is_active });
    setEditingChallengeId(c.id); setChallengeDialogOpen(true);
  };
  const saveChallenge = async () => {
    setSaving(true);
    const payload = { name: challengeForm.name, account_size: Number(challengeForm.account_size), price: Number(challengeForm.price), profit_target: challengeForm.profit_target, daily_drawdown: challengeForm.daily_drawdown, max_drawdown: challengeForm.max_drawdown, min_trading_days: challengeForm.min_trading_days, leverage: challengeForm.leverage, step_type: challengeForm.step_type, is_active: challengeForm.is_active };
    if (editingChallengeId) {
      const { error } = await supabase.from("challenges").update(payload).eq("id", editingChallengeId);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Challenge updated!");
    } else {
      const { error } = await supabase.from("challenges").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Challenge created!");
    }
    setChallengeDialogOpen(false); setSaving(false); fetchAll();
  };
  const deleteChallenge = async (id: string) => {
    if (!confirm("Delete this challenge?")) return;
    const { error } = await supabase.from("challenges").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Challenge deleted."); fetchAll();
  };

  // ---- Coupon CRUD ----
  const openCreateCoupon = () => { setCouponForm(emptyCouponForm); setEditingCouponId(null); setCouponDialogOpen(true); };
  const openEditCoupon = (c: any) => {
    setCouponForm({ code: c.code, discount_type: c.discount_type, discount_value: String(c.discount_value), max_uses: c.max_uses ? String(c.max_uses) : "", is_active: c.is_active, expires_at: c.expires_at ? c.expires_at.slice(0, 16) : "" });
    setEditingCouponId(c.id); setCouponDialogOpen(true);
  };
  const saveCoupon = async () => {
    setCouponSaving(true);
    const payload: any = { code: couponForm.code.toUpperCase().trim(), discount_type: couponForm.discount_type, discount_value: Number(couponForm.discount_value), max_uses: couponForm.max_uses ? Number(couponForm.max_uses) : null, is_active: couponForm.is_active, expires_at: couponForm.expires_at ? new Date(couponForm.expires_at).toISOString() : null };
    if (editingCouponId) {
      const { error } = await supabase.from("coupons").update(payload).eq("id", editingCouponId);
      if (error) { toast.error(error.message); setCouponSaving(false); return; }
      toast.success("Coupon updated!");
    } else {
      const { error } = await supabase.from("coupons").insert(payload);
      if (error) { toast.error(error.message); setCouponSaving(false); return; }
      toast.success("Coupon created!");
    }
    setCouponDialogOpen(false); setCouponSaving(false); fetchAll();
  };
  const deleteCoupon = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Coupon deleted."); fetchAll();
  };

  const updateReferralStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("affiliate_referrals").update({ commission_status: status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Commission ${status}!`); fetchAll();
  };

  const getProfileName = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    return p?.display_name || p?.email || userId.slice(0, 8) + "...";
  };

  const getChallengeNameById = (id: string) => {
    const c = challenges.find(ch => ch.id === id);
    return c?.name || "Unknown";
  };

  // CSV export helper
  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(","), ...data.map(row => keys.map(k => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,0%)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[hsl(0,0%,50%)]">
          <Shield className="animate-pulse" size={24} />
          <p className="font-mono text-sm">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Role-based sidebar: employee only sees support
  const allSidebarGroups = [
    {
      label: "MASTER",
      items: [
        { id: "user_certificates" as Tab, label: "PDF / Certs", icon: <FileText size={18} /> },
      ],
      roles: ["administrator"],
    },
    {
      label: "Certificates",
      items: [
        { id: "cert_templates" as Tab, label: "Cert Templates", icon: <ImageIcon size={18} /> },
      ],
      roles: ["administrator", "admin"],
    },
    {
      label: "Overview",
      items: [
        { id: "dashboard" as Tab, label: "Dashboard", icon: <LayoutDashboard size={18} /> },
        { id: "analytics" as Tab, label: "Analytics", icon: <LineChartIcon size={18} /> },
        { id: "revenue" as Tab, label: "Revenue", icon: <DollarSign size={18} /> },
        { id: "seo" as Tab, label: "SEO", icon: <SearchIcon size={18} /> },
      ],
      roles: ["administrator", "admin"],
    },
    {
      label: "Management",
      items: [
        { id: "user_phases" as Tab, label: "User Accounts", icon: <Shield size={18} /> },
        { id: "users" as Tab, label: "Users", icon: <Users size={18} /> },
        { id: "challenges" as Tab, label: "Challenges", icon: <Trophy size={18} /> },
        { id: "orders" as Tab, label: "Orders", icon: <ShoppingCart size={18} /> },
        { id: "credentials" as Tab, label: "Credentials", icon: <Key size={18} /> },
        { id: "referrals" as Tab, label: "Referrals", icon: <Link2 size={18} /> },
        { id: "coupons" as Tab, label: "Coupons", icon: <Ticket size={18} /> },
        { id: "kyc" as Tab, label: "KYC", icon: <ShieldCheck size={18} /> },
        { id: "payouts" as Tab, label: "Payouts", icon: <Wallet size={18} /> },
        { id: "upi_orders" as Tab, label: "UPI Payments", icon: <IndianRupee size={18} /> },
        { id: "upi_settings" as Tab, label: "UPI Settings", icon: <Smartphone size={18} /> },
        { id: "utm" as Tab, label: "UTM Tracker", icon: <Globe size={18} /> },
        { id: "email_marketing" as Tab, label: "Email Marketing", icon: <Mail size={18} /> },
        { id: "roles" as Tab, label: "Roles", icon: <ShieldCheck size={18} /> },
      ],
      roles: ["administrator", "admin"],
    },
    {
      label: "Content",
      items: [
        { id: "helpcenter" as Tab, label: "Help Center", icon: <BookOpen size={18} /> },
        { id: "support" as Tab, label: "Support", icon: <Headphones size={18} /> },
        { id: "blog" as Tab, label: "Blog", icon: <FileText size={18} /> },
        { id: "blog_ai" as Tab, label: "Blog AI", icon: <Sparkles size={18} /> },
        { id: "certificates" as Tab, label: "Certificates", icon: <Award size={18} /> },
        { id: "pages" as Tab, label: "Pages", icon: <Layers size={18} /> },
        { id: "knowledgebase" as Tab, label: "PULZEX KB", icon: <Brain size={18} /> },
      ],
      roles: ["administrator", "admin"],
    },
    {
      label: "Support",
      items: [
        { id: "support" as Tab, label: "Support Tickets", icon: <Headphones size={18} /> },
      ],
      roles: ["employee"],
    },
  ];

  const sidebarGroups = allSidebarGroups.filter(g => g.roles.includes(userRole || ""));

  const tabLabels: Record<Tab, string> = {
    dashboard: "Dashboard", analytics: "Analytics", revenue: "Revenue", seo: "SEO Manager",
    users: "Users", challenges: "Challenges", orders: "Orders", referrals: "Referrals", coupons: "Coupons",
    utm: "UTM Tracker", helpcenter: "Help Center", support: "Support", blog: "Blog",
    blog_ai: "Blog AI",
    certificates: "Certificates", pages: "Pages", knowledgebase: "PULZEX KB",
    credentials: "Credentials", user_certificates: "User Certificates",
    cert_templates: "Certificate Templates", user_phases: "User Phases", kyc: "KYC Verification",
    payouts: "Payouts",
    upi_settings: "UPI Settings",
    upi_orders: "UPI Payments",
    roles: "Role Management",
    email_marketing: "Email Marketing",
  };

  // Helper to assign/change a user's role
  const changeUserRole = async (userId: string, newRole: string) => {
    // NEVER allow modifying the administrator role
    if (userRoles[userId] === "administrator") {
      toast.error("Cannot modify the administrator role");
      return;
    }
    // NEVER allow assigning administrator role
    if (newRole === "administrator") {
      toast.error("Cannot assign administrator role");
      return;
    }
    if (newRole === "none") {
      await supabase.from("user_roles").delete().eq("user_id", userId).neq("role", "administrator");
    } else {
      await supabase.from("user_roles").delete().eq("user_id", userId).neq("role", "administrator");
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Role updated!");
    fetchAll();
  };

  // Filter profiles: hide administrator accounts from the users list
  const visibleProfiles = profiles.filter(p => {
    // Hide users with administrator role
    if (userRoles[p.user_id] === "administrator") return false;
    // Hide users whose email is in the hidden list
    if (HIDDEN_ADMIN_EMAILS.includes(p.email?.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[hsl(0,0%,100%)] text-[hsl(0,0%,10%)] flex light" data-theme="light" style={{"--background":"0 0% 98%","--foreground":"0 0% 5%","--card":"0 0% 100%","--card-foreground":"0 0% 5%","--popover":"0 0% 100%","--popover-foreground":"0 0% 5%","--primary":"0 0% 5%","--primary-foreground":"0 0% 100%","--secondary":"0 0% 94%","--secondary-foreground":"0 0% 10%","--muted":"0 0% 94%","--muted-foreground":"0 0% 40%","--accent":"0 0% 90%","--accent-foreground":"0 0% 5%","--destructive":"0 84% 60%","--destructive-foreground":"0 0% 100%","--border":"0 0% 88%","--input":"0 0% 88%","--ring":"0 0% 20%"} as React.CSSProperties}>

      {/* ===== Mobile Sidebar Overlay ===== */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-[hsl(0,0%,98%)] border-r border-[hsl(0,0%,90%)] flex flex-col animate-in slide-in-from-left duration-200">
            {/* Brand */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-[hsl(0,0%,90%)]">
              <div className="flex items-center gap-2">
                <img src={logo} alt="Funding Pulze" className="h-7 w-7 rounded-lg shrink-0" />
                <div>
                  <p className="font-display text-xs font-bold text-[hsl(0,0%,5%)] leading-tight">Funding Pulze</p>
                  <p className="text-[9px] text-[hsl(0,0%,50%)]">Admin Panel</p>
                </div>
              </div>
              <button onClick={() => setMobileSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-[hsl(0,0%,93%)]">
                <XIcon size={18} className="text-[hsl(0,0%,45%)]" />
              </button>
            </div>
            {/* Nav */}
            <nav className="flex-1 py-3 px-2 space-y-4 overflow-auto">
              {sidebarGroups.map(group => (
                <div key={group.label}>
                  <p className="text-[9px] font-semibold text-[hsl(0,0%,50%)] uppercase tracking-widest px-2 mb-1.5">{group.label}</p>
                  <div className="space-y-0.5">
                    {group.items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => { setTab(item.id); setMobileSidebarOpen(false); }}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all ${
                          tab === item.id
                            ? "bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] shadow-sm"
                            : "text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,15%)] hover:bg-[hsl(0,0%,93%)]"
                        }`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            {/* Bottom */}
            <div className="border-t border-[hsl(0,0%,90%)] p-2 space-y-0.5">
              {userRole === "administrator" && (
                <button
                  onClick={async () => {
                    const next = !isKilled;
                    if (next && !confirm("⚠️ This will turn the entire website into a Hello World page. Continue?")) return;
                    await toggleKillSwitch(next);
                    toast.success(next ? "Kill switch ACTIVATED — site is now Hello World" : "Kill switch DEACTIVATED — site restored");
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                    isKilled ? "bg-red-100 text-red-700 hover:bg-red-200" : "text-[hsl(0,0%,45%)] hover:text-red-600 hover:bg-red-50"
                  }`}
                >
                  <Power size={18} /><span>{isKilled ? "Restore Site" : "Kill Switch"}</span>
                </button>
              )}
              <button onClick={() => { navigate("/"); setMobileSidebarOpen(false); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,15%)] hover:bg-[hsl(0,0%,93%)] transition-colors">
                <Home size={18} /><span>Back to Site</span>
              </button>
              <button onClick={() => { signOut(); navigate("/"); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,15%)] hover:bg-[hsl(0,0%,93%)] transition-colors">
                <LogOut size={18} /><span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Desktop Sidebar ===== */}
      <div className={`${sidebarCollapsed ? "w-16" : "w-56"} bg-[hsl(0,0%,98%)] border-r border-[hsl(0,0%,90%)] hidden md:flex flex-col shrink-0 transition-all duration-200`}>
        {/* Brand */}
        <div className="h-14 flex items-center gap-2 px-4 border-b border-[hsl(0,0%,90%)] cursor-pointer" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
          <img src={logo} alt="Funding Pulze" className="h-7 w-7 rounded-lg shrink-0" />
          {!sidebarCollapsed && (
            <div>
              <p className="font-display text-xs font-bold text-[hsl(0,0%,5%)] leading-tight">Funding Pulze</p>
              <p className="text-[9px] text-[hsl(0,0%,50%)]">Admin Panel</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-4 overflow-auto">
          {sidebarGroups.map(group => (
            <div key={group.label}>
              {!sidebarCollapsed && (
                <p className="text-[9px] font-semibold text-[hsl(0,0%,50%)] uppercase tracking-widest px-2 mb-1.5">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-2 ${sidebarCollapsed ? "justify-center px-0" : "px-2.5"} py-2 rounded-lg text-[12px] font-medium transition-all ${
                      tab === item.id
                        ? "bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] shadow-sm"
                        : "text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,15%)] hover:bg-[hsl(0,0%,93%)]"
                    }`}
                  >
                    {item.icon}
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="border-t border-[hsl(0,0%,90%)] p-2 space-y-0.5">
          {userRole === "administrator" && (
            <button
              onClick={async () => {
                const next = !isKilled;
                if (next && !confirm("⚠️ This will turn the entire website into a Hello World page. Continue?")) return;
                await toggleKillSwitch(next);
                toast.success(next ? "Kill switch ACTIVATED — site is now Hello World" : "Kill switch DEACTIVATED — site restored");
              }}
              title={sidebarCollapsed ? (isKilled ? "Restore Site" : "Kill Switch") : undefined}
              className={`w-full flex items-center gap-2 ${sidebarCollapsed ? "justify-center px-0" : "px-2.5"} py-2 rounded-lg text-[12px] font-medium transition-colors ${
                isKilled ? "bg-red-100 text-red-700 hover:bg-red-200" : "text-[hsl(0,0%,45%)] hover:text-red-600 hover:bg-red-50"
              }`}
            >
              <Power size={18} />{!sidebarCollapsed && <span>{isKilled ? "Restore Site" : "Kill Switch"}</span>}
            </button>
          )}
          <button onClick={() => navigate("/")} className={`w-full flex items-center gap-2 ${sidebarCollapsed ? "justify-center px-0" : "px-2.5"} py-2 rounded-lg text-[12px] text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,15%)] hover:bg-[hsl(0,0%,93%)] transition-colors`}>
            <Home size={18} />{!sidebarCollapsed && <span>Back to Site</span>}
          </button>
          <button onClick={() => { signOut(); navigate("/"); }} className={`w-full flex items-center gap-2 ${sidebarCollapsed ? "justify-center px-0" : "px-2.5"} py-2 rounded-lg text-[12px] text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,15%)] hover:bg-[hsl(0,0%,93%)] transition-colors`}>
            <LogOut size={18} />{!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </div>

      {/* ===== Main Content ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 border-b border-[hsl(0,0%,90%)] flex items-center justify-between px-3 md:px-6 shrink-0 bg-[hsl(0,0%,100%)]">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileSidebarOpen(true)} className="md:hidden p-1.5 rounded-lg hover:bg-[hsl(0,0%,93%)]">
              <Menu size={20} className="text-[hsl(0,0%,30%)]" />
            </button>
            <h1 className="font-display text-base md:text-lg font-bold text-[hsl(0,0%,5%)]">{tabLabels[tab]}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <SearchIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(0,0%,55%)]" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search... (G+D, G+A, G+R, G+S)"
                className="h-8 w-52 pl-8 pr-3 rounded-lg bg-[hsl(0,0%,96%)] border border-[hsl(0,0%,90%)] text-xs text-[hsl(0,0%,20%)] placeholder:text-[hsl(0,0%,55%)] focus:outline-none focus:ring-1 focus:ring-[hsl(0,0%,70%)]"
              />
            </div>
            <div className="w-7 h-7 rounded-full bg-[hsl(0,0%,0%)] flex items-center justify-center">
              <span className="text-[hsl(0,0%,100%)] text-[10px] font-bold">
                {user?.email?.charAt(0).toUpperCase() || "A"}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-3 md:p-6 bg-[hsl(0,0%,96%)]">

          {/* ===== Dashboard Tab ===== */}
          {tab === "dashboard" && (
            <Dashboard
              profiles={profiles}
              purchases={purchases}
              referrals={referrals}
              challenges={challenges}
              pageVisits={pageVisits}
              getProfileName={getProfileName}
              getChallengeNameById={getChallengeNameById}
            />
          )}

          {/* ===== Analytics Tab ===== */}
          {tab === "analytics" && (
            <AnalyticsDashboard pageVisits={pageVisits} profiles={profiles} />
          )}

          {/* ===== Revenue Tab ===== */}
          {tab === "revenue" && (
            <RevenueAnalytics
              purchases={purchases}
              challenges={challenges}
              coupons={coupons}
              profiles={profiles}
              getProfileName={getProfileName}
              getChallengeNameById={getChallengeNameById}
            />
          )}

          {/* ===== SEO Tab ===== */}
          {tab === "seo" && (
            <SEOManager />
          )}


          {/* ===== Users Tab ===== */}
          {tab === "users" && (
            <div>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">Users</h2>
                  <p className="text-xs text-[hsl(0,0%,50%)] mt-0.5">{visibleProfiles.length} registered users</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setImportUsersOpen(true)} className="text-xs rounded-lg border-[hsl(0,0%,88%)]">
                    <Upload size={14} className="mr-1" /> Import Users
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportCSV(visibleProfiles, "users")} className="text-xs rounded-lg border-[hsl(0,0%,88%)]">Export CSV</Button>
                </div>
              </div>
              <ImportUsers open={importUsersOpen} onOpenChange={setImportUsersOpen} onImportComplete={fetchAll} />
              <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-[hsl(0,0%,45%)] border-b border-[hsl(0,0%,92%)]">
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Email</th>
                      <th className="px-5 py-3 font-medium">Role</th>
                      <th className="px-5 py-3 font-medium">Referral Code</th>
                      <th className="px-5 py-3 font-medium">Joined</th>
                      <th className="px-5 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProfiles.filter(p => !searchQuery || p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.email?.toLowerCase().includes(searchQuery.toLowerCase())).map((p) => (
                      <tr key={p.id} className="border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)] transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-[hsl(0,0%,10%)]">{p.display_name || "—"}</td>
                        <td className="px-5 py-3 text-sm text-[hsl(0,0%,45%)]">{p.email || "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${userRoles[p.user_id] ? "bg-[hsl(0,0%,92%)] text-[hsl(0,0%,20%)]" : "text-[hsl(0,0%,55%)]"}`}>
                            {userRoles[p.user_id] || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3"><code className="text-xs bg-[hsl(0,0%,95%)] border border-[hsl(0,0%,88%)] px-2 py-0.5 rounded font-mono text-[hsl(0,0%,30%)]">{p.referral_code || "—"}</code></td>
                        <td className="px-5 py-3 text-sm text-[hsl(0,0%,50%)]">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="px-5 py-3">
                          <button
                            onClick={async () => {
                              const toastId = toast.loading("Generating login link...");
                              try {
                                const { data: { session } } = await supabase.auth.getSession();
                                const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-impersonate`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ user_id: p.user_id }) });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error);
                                toast.dismiss(toastId);
                                window.open(data.url + `&redirect_to=${window.location.origin}`, "_blank");
                              } catch (err: any) { toast.dismiss(toastId); toast.error(err.message || "Failed to impersonate"); }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] text-xs font-medium hover:bg-[hsl(0,0%,15%)] transition-colors"
                          >
                            <LogIn size={12} /> Login
                          </button>
                        </td>
                      </tr>
                    ))}
                    {visibleProfiles.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No users yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== Orders Tab ===== */}
          {tab === "orders" && (
            <OrdersCMS
              purchases={purchases}
              profiles={profiles}
              challenges={challenges}
              getProfileName={getProfileName}
              getProfileByUserId={(userId: string) => profiles.find((p: any) => p.user_id === userId)}
              getChallengeNameById={getChallengeNameById}
              onRefresh={fetchAll}
            />
          )}

          {/* ===== Challenges Tab ===== */}
          {tab === "challenges" && (
            <div>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">Challenges</h2>
                  <p className="text-xs text-[hsl(0,0%,50%)] mt-0.5">{challenges.length} challenges</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => exportCSV(challenges, "challenges")} className="text-xs rounded-lg border-[hsl(0,0%,88%)]">Export CSV</Button>
                  <Button size="sm" onClick={openCreateChallenge} className="bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)] rounded-lg text-xs font-medium">
                    <Plus size={14} className="mr-1" /> New Challenge
                  </Button>
                </div>
              </div>
              <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-[hsl(0,0%,45%)] border-b border-[hsl(0,0%,92%)]">
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Size</th>
                      <th className="px-5 py-3 font-medium">Price</th>
                      <th className="px-5 py-3 font-medium">Target</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {challenges.map((c) => (
                      <tr key={c.id} className="border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)] transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-[hsl(0,0%,10%)]">{c.name}</td>
                        <td className="px-5 py-3 text-sm">${c.account_size.toLocaleString()}</td>
                        <td className="px-5 py-3 text-sm">${c.price}</td>
                        <td className="px-5 py-3 text-sm text-[hsl(0,0%,45%)]">{c.profit_target}</td>
                        <td className="px-5 py-3 text-sm text-[hsl(0,0%,45%)]">{c.step_type}</td>
                        <td className="px-5 py-3">
                          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${c.is_active ? "bg-[hsl(0,0%,92%)] text-[hsl(0,0%,25%)]" : "bg-[hsl(0,0%,96%)] text-[hsl(0,0%,60%)]"}`}>
                            {c.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditChallenge(c)} className="p-1.5 rounded-lg text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,10%)] hover:bg-[hsl(0,0%,93%)] transition-colors"><Pencil size={14} /></button>
                            <button onClick={() => deleteChallenge(c.id)} className="p-1.5 rounded-lg text-[hsl(0,0%,50%)] hover:text-[hsl(0,84%,50%)] hover:bg-[hsl(0,84%,95%)] transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {challenges.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No challenges yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== Referrals Tab ===== */}
          {tab === "referrals" && (
            <div>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">Referrals</h2>
                  <p className="text-xs text-[hsl(0,0%,50%)] mt-0.5">{referrals.length} referrals</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => exportCSV(referrals, "referrals")} className="text-xs rounded-lg border-[hsl(0,0%,88%)]">Export CSV</Button>
              </div>
              <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-[hsl(0,0%,45%)] border-b border-[hsl(0,0%,92%)]">
                      <th className="px-5 py-3 font-medium">Referrer</th>
                      <th className="px-5 py-3 font-medium">Referred</th>
                      <th className="px-5 py-3 font-medium">Commission</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((r) => (
                      <tr key={r.id} className="border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)] transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-[hsl(0,0%,10%)]">{getProfileName(r.referrer_id)}</td>
                        <td className="px-5 py-3 text-sm">{getProfileName(r.referred_id)}</td>
                        <td className="px-5 py-3 text-sm font-semibold">${(r.commission_amount || 0).toFixed(2)}</td>
                        <td className="px-5 py-3">
                          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                            r.commission_status === "paid" ? "bg-[hsl(0,0%,90%)] text-[hsl(0,0%,20%)]" :
                            r.commission_status === "approved" ? "bg-[hsl(0,0%,92%)] text-[hsl(0,0%,30%)]" :
                            r.commission_status === "rejected" ? "bg-[hsl(0,0%,96%)] text-[hsl(0,0%,55%)]" :
                            "bg-[hsl(0,0%,94%)] text-[hsl(0,0%,40%)]"
                          }`}>{r.commission_status}</span>
                        </td>
                        <td className="px-5 py-3 text-sm text-[hsl(0,0%,50%)]">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {r.commission_status === "pending" && (
                              <>
                                <button onClick={() => updateReferralStatus(r.id, "approved")} className="p-1.5 rounded-lg text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,10%)] hover:bg-[hsl(0,0%,93%)] transition-colors" title="Approve"><CheckCircle2 size={15} /></button>
                                <button onClick={() => updateReferralStatus(r.id, "rejected")} className="p-1.5 rounded-lg text-[hsl(0,0%,50%)] hover:text-[hsl(0,84%,50%)] hover:bg-[hsl(0,84%,95%)] transition-colors" title="Reject"><XCircle size={15} /></button>
                              </>
                            )}
                            {r.commission_status === "approved" && (
                              <button onClick={() => updateReferralStatus(r.id, "paid")} className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)] transition-colors">Mark Paid</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {referrals.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No referrals yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== Coupons Tab ===== */}
          {tab === "coupons" && (
            <div>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">Coupons</h2>
                  <p className="text-xs text-[hsl(0,0%,50%)] mt-0.5">{coupons.length} coupon codes</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => exportCSV(coupons, "coupons")} className="text-xs rounded-lg border-[hsl(0,0%,88%)]">Export CSV</Button>
                  <Button size="sm" onClick={openCreateCoupon} className="bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)] rounded-lg text-xs font-medium">
                    <Plus size={14} className="mr-1" /> New Coupon
                  </Button>
                </div>
              </div>
              <div className="bg-[hsl(0,0%,100%)] border border-[hsl(0,0%,90%)] rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-[hsl(0,0%,45%)] border-b border-[hsl(0,0%,92%)]">
                      <th className="px-5 py-3 font-medium">Code</th>
                      <th className="px-5 py-3 font-medium">Discount</th>
                      <th className="px-5 py-3 font-medium">Uses</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Expires</th>
                      <th className="px-5 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((c) => (
                      <tr key={c.id} className="border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)] transition-colors">
                        <td className="px-5 py-3"><code className="text-sm font-mono font-semibold tracking-wider text-[hsl(0,0%,10%)]">{c.code}</code></td>
                        <td className="px-5 py-3 text-sm">{c.discount_type === "percentage" ? `${c.discount_value}%` : `$${c.discount_value}`}</td>
                        <td className="px-5 py-3 text-sm text-[hsl(0,0%,45%)]">{c.current_uses}{c.max_uses ? ` / ${c.max_uses}` : " / ∞"}</td>
                        <td className="px-5 py-3">
                          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${c.is_active ? "bg-[hsl(0,0%,92%)] text-[hsl(0,0%,25%)]" : "bg-[hsl(0,0%,96%)] text-[hsl(0,0%,60%)]"}`}>
                            {c.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-[hsl(0,0%,50%)]">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "Never"}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditCoupon(c)} className="p-1.5 rounded-lg text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,10%)] hover:bg-[hsl(0,0%,93%)] transition-colors"><Pencil size={14} /></button>
                            <button onClick={() => deleteCoupon(c.id)} className="p-1.5 rounded-lg text-[hsl(0,0%,50%)] hover:text-[hsl(0,84%,50%)] hover:bg-[hsl(0,84%,95%)] transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {coupons.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No coupons yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== UTM Tracker Tab ===== */}
          {tab === "utm" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
                  <span className="text-xs font-medium text-[hsl(0,0%,45%)] uppercase tracking-wide">Total Page Visits</span>
                  <p className="text-2xl font-display font-bold text-[hsl(0,0%,5%)] mt-2">{filteredVisits.length.toLocaleString()}</p>
                </div>
                <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
                  <span className="text-xs font-medium text-[hsl(0,0%,45%)] uppercase tracking-wide">UTM-Tagged Visits</span>
                  <p className="text-2xl font-display font-bold text-[hsl(0,0%,5%)] mt-2">{filteredVisits.filter(v => v.utm_source).length.toLocaleString()}</p>
                </div>
                <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
                  <span className="text-xs font-medium text-[hsl(0,0%,45%)] uppercase tracking-wide">Unique Sources</span>
                  <p className="text-2xl font-display font-bold text-[hsl(0,0%,5%)] mt-2">{new Set(filteredVisits.filter(v => v.utm_source).map(v => v.utm_source)).size}</p>
                </div>
              </div>

              {/* By Source */}
              <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[hsl(0,0%,92%)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe size={18} className="text-[hsl(0,0%,40%)]" />
                    <h3 className="font-display font-semibold text-[hsl(0,0%,10%)]">Performance by Source</h3>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => exportCSV(utmSourceStats, "utm-sources")} className="text-xs rounded-lg border-[hsl(0,0%,88%)]">Export CSV</Button>
                </div>
                <div className="overflow-x-auto"><table className="w-full text-sm min-w-[500px]">
                  <thead><tr className="bg-[hsl(0,0%,97%)] text-[hsl(0,0%,45%)] text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Source</th>
                    <th className="text-left px-5 py-3 font-medium">Visits</th>
                    <th className="text-left px-5 py-3 font-medium">Signups</th>
                    <th className="text-left px-5 py-3 font-medium">Conv. Rate</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[hsl(0,0%,95%)]">
                    {utmSourceStats.map((row) => (
                      <tr key={row.source} className="hover:bg-[hsl(0,0%,98%)] transition-colors">
                        <td className="px-5 py-3 font-medium text-[hsl(0,0%,10%)]">{row.source}</td>
                        <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{row.visits}</td>
                        <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{row.signups}</td>
                        <td className="px-5 py-3"><span className="px-2 py-0.5 bg-[hsl(0,0%,95%)] rounded text-xs font-mono">{row.conversionRate}%</span></td>
                      </tr>
                    ))}
                    {utmSourceStats.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No visit data yet.</td></tr>}
                  </tbody>
                </table></div>
              </div>

              {/* By Campaign */}
              <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[hsl(0,0%,92%)] flex items-center gap-2">
                  <TrendingUp size={18} className="text-[hsl(0,0%,40%)]" />
                  <h3 className="font-display font-semibold text-[hsl(0,0%,10%)]">Performance by Campaign</h3>
                </div>
                <div className="overflow-x-auto"><table className="w-full text-sm min-w-[500px]">
                  <thead><tr className="bg-[hsl(0,0%,97%)] text-[hsl(0,0%,45%)] text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Campaign</th>
                    <th className="text-left px-5 py-3 font-medium">Visits</th>
                    <th className="text-left px-5 py-3 font-medium">Signups</th>
                    <th className="text-left px-5 py-3 font-medium">Conv. Rate</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[hsl(0,0%,95%)]">
                    {utmCampaignStats.map((row) => (
                      <tr key={row.campaign} className="hover:bg-[hsl(0,0%,98%)] transition-colors">
                        <td className="px-5 py-3 font-medium text-[hsl(0,0%,10%)]">{row.campaign}</td>
                        <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{row.visits}</td>
                        <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{row.signups}</td>
                        <td className="px-5 py-3"><span className="px-2 py-0.5 bg-[hsl(0,0%,95%)] rounded text-xs font-mono">{row.conversionRate}%</span></td>
                      </tr>
                    ))}
                    {utmCampaignStats.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No campaign data yet.</td></tr>}
                  </tbody>
                </table></div>
              </div>

              {/* By Medium */}
              <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[hsl(0,0%,92%)] flex items-center gap-2">
                  <BarChart3 size={18} className="text-[hsl(0,0%,40%)]" />
                  <h3 className="font-display font-semibold text-[hsl(0,0%,10%)]">Performance by Medium</h3>
                </div>
                <div className="overflow-x-auto"><table className="w-full text-sm min-w-[500px]">
                  <thead><tr className="bg-[hsl(0,0%,97%)] text-[hsl(0,0%,45%)] text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Medium</th>
                    <th className="text-left px-5 py-3 font-medium">Visits</th>
                    <th className="text-left px-5 py-3 font-medium">Signups</th>
                    <th className="text-left px-5 py-3 font-medium">Conv. Rate</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[hsl(0,0%,95%)]">
                    {utmMediumStats.map((row) => (
                      <tr key={row.medium} className="hover:bg-[hsl(0,0%,98%)] transition-colors">
                        <td className="px-5 py-3 font-medium text-[hsl(0,0%,10%)]">{row.medium}</td>
                        <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{row.visits}</td>
                        <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{row.signups}</td>
                        <td className="px-5 py-3"><span className="px-2 py-0.5 bg-[hsl(0,0%,95%)] rounded text-xs font-mono">{row.conversionRate}%</span></td>
                      </tr>
                    ))}
                    {utmMediumStats.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No medium data yet.</td></tr>}
                  </tbody>
                </table></div>
              </div>

              <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[hsl(0,0%,92%)]">
                  <h3 className="font-display font-semibold text-[hsl(0,0%,10%)]">Recent Visits</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-[hsl(0,0%,97%)] text-[hsl(0,0%,45%)] text-xs uppercase tracking-wider">
                      <th className="text-left px-5 py-3 font-medium">Date</th>
                      <th className="text-left px-5 py-3 font-medium">Page</th>
                      <th className="text-left px-5 py-3 font-medium">Source</th>
                      <th className="text-left px-5 py-3 font-medium">Medium</th>
                      <th className="text-left px-5 py-3 font-medium">Campaign</th>
                      <th className="text-left px-5 py-3 font-medium">Referrer</th>
                    </tr></thead>
                    <tbody className="divide-y divide-[hsl(0,0%,95%)]">
                      {filteredVisits.slice(0, 50).map((v: any) => (
                        <tr key={v.id} className="hover:bg-[hsl(0,0%,98%)] transition-colors">
                          <td className="px-5 py-3 text-[hsl(0,0%,40%)] whitespace-nowrap">{new Date(v.created_at).toLocaleString()}</td>
                          <td className="px-5 py-3 font-mono text-xs text-[hsl(0,0%,30%)]">{v.page_url}</td>
                          <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{v.utm_source || "—"}</td>
                          <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{v.utm_medium || "—"}</td>
                          <td className="px-5 py-3 text-[hsl(0,0%,40%)]">{v.utm_campaign || "—"}</td>
                          <td className="px-5 py-3 text-[hsl(0,0%,40%)] text-xs max-w-[200px] truncate">{v.referrer || "—"}</td>
                        </tr>
                      ))}
                      {filteredVisits.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No visits recorded yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === "helpcenter" && <HelpCenterCMS />}
          {tab === "support" && <SupportTicketsCMS />}
          {tab === "blog" && <BlogCMS />}
          {tab === "blog_ai" && <BlogAIChat />}
          {tab === "certificates" && <CertificatesCMS />}
          {tab === "pages" && <PagesCMS />}
          {tab === "knowledgebase" && <KnowledgeBaseCMS />}
          {tab === "credentials" && <CredentialsManager />}
          {tab === "user_certificates" && <UserCertificatesCMS />}
          {tab === "cert_templates" && <CertificateTemplateManager />}
           {tab === "user_phases" && <UserPhaseManager />}
           {tab === "kyc" && <KYCManager />}
            {tab === "payouts" && <PayoutsCMS />}
            {tab === "upi_settings" && <UPISettings />}
            {tab === "upi_orders" && <UPIOrdersCMS purchases={purchases} profiles={profiles} challenges={challenges} getProfileName={getProfileName} getProfileByUserId={(userId: string) => profiles.find((p: any) => p.user_id === userId)} getChallengeNameById={getChallengeNameById} onRefresh={fetchAll} />}

          {/* ===== Roles Tab ===== */}
          {tab === "roles" && (
            <RolesManager
              profiles={visibleProfiles}
              userRoles={userRoles}
              onRoleChange={changeUserRole}
            />
          )}

          {/* ===== Email Marketing Tab ===== */}
          {tab === "email_marketing" && (
            <EmailMarketing />
          )}
        </div>
      </div>

      {/* ===== Challenge Dialog ===== */}
      <Dialog open={challengeDialogOpen} onOpenChange={setChallengeDialogOpen}>
        <DialogContent className="bg-[hsl(0,0%,100%)] border-[hsl(0,0%,90%)] text-[hsl(0,0%,10%)] max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-display font-semibold">{editingChallengeId ? "Edit Challenge" : "Create Challenge"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="col-span-2">
              <Label className="text-[hsl(0,0%,45%)] text-xs">Name</Label>
              <Input value={challengeForm.name} onChange={(e) => setChallengeForm({ ...challengeForm, name: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="e.g. $10K 1-Step" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Account Size ($)</Label>
              <Input type="number" value={challengeForm.account_size} onChange={(e) => setChallengeForm({ ...challengeForm, account_size: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Price ($)</Label>
              <Input type="number" value={challengeForm.price} onChange={(e) => setChallengeForm({ ...challengeForm, price: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Profit Target</Label>
              <Input value={challengeForm.profit_target} onChange={(e) => setChallengeForm({ ...challengeForm, profit_target: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="8%" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Daily Drawdown</Label>
              <Input value={challengeForm.daily_drawdown} onChange={(e) => setChallengeForm({ ...challengeForm, daily_drawdown: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="5%" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Max Drawdown</Label>
              <Input value={challengeForm.max_drawdown} onChange={(e) => setChallengeForm({ ...challengeForm, max_drawdown: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="10%" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Min Trading Days</Label>
              <Input value={challengeForm.min_trading_days} onChange={(e) => setChallengeForm({ ...challengeForm, min_trading_days: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="5" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Leverage</Label>
              <Input value={challengeForm.leverage} onChange={(e) => setChallengeForm({ ...challengeForm, leverage: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="1:100" />
            </div>
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Step Type</Label>
              <select value={challengeForm.step_type} onChange={(e) => setChallengeForm({ ...challengeForm, step_type: e.target.value })} className="mt-1 w-full rounded-lg bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,88%)] px-3 py-2 text-sm">
                <option value="1-step">1-Step</option>
                <option value="2-step">2-Step</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={challengeForm.is_active} onChange={(e) => setChallengeForm({ ...challengeForm, is_active: e.target.checked })} className="rounded" />
                <span className="text-sm">Active</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg border-[hsl(0,0%,88%)] text-[hsl(0,0%,45%)] hover:bg-[hsl(0,0%,96%)]" onClick={() => setChallengeDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-lg bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]" onClick={saveChallenge} disabled={saving || !challengeForm.name || !challengeForm.account_size}>
              {saving ? "Saving..." : editingChallengeId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Coupon Dialog ===== */}
      <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
        <DialogContent className="bg-[hsl(0,0%,100%)] border-[hsl(0,0%,90%)] text-[hsl(0,0%,10%)] max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-display font-semibold">{editingCouponId ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label className="text-[hsl(0,0%,45%)] text-xs">Coupon Code</Label>
              <Input value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg font-mono uppercase tracking-wider" placeholder="SAVE20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[hsl(0,0%,45%)] text-xs">Discount Type</Label>
                <select value={couponForm.discount_type} onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })} className="mt-1 w-full rounded-lg bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,88%)] px-3 py-2 text-sm">
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed ($)</option>
                </select>
              </div>
              <div>
                <Label className="text-[hsl(0,0%,45%)] text-xs">Discount Value</Label>
                <Input type="number" value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="20" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[hsl(0,0%,45%)] text-xs">Max Uses (empty = unlimited)</Label>
                <Input type="number" value={couponForm.max_uses} onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" placeholder="100" />
              </div>
              <div>
                <Label className="text-[hsl(0,0%,45%)] text-xs">Expires At (optional)</Label>
                <Input type="datetime-local" value={couponForm.expires_at} onChange={(e) => setCouponForm({ ...couponForm, expires_at: e.target.value })} className="mt-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" checked={couponForm.is_active} onChange={(e) => setCouponForm({ ...couponForm, is_active: e.target.checked })} className="rounded" />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg border-[hsl(0,0%,88%)] text-[hsl(0,0%,45%)] hover:bg-[hsl(0,0%,96%)]" onClick={() => setCouponDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-lg bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]" onClick={saveCoupon} disabled={couponSaving || !couponForm.code || !couponForm.discount_value}>
              {couponSaving ? "Saving..." : editingCouponId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
