import { useNavigate, useLocation } from "react-router-dom";
import { Home, Users, Award, Wallet, Plus, Zap, HelpCircle, Settings, LogOut, Menu, X, Receipt, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const navItems = [
  { key: "overview", label: "Overview", route: "/dashboard", icon: Home },
  { key: "affiliate", label: "Affiliate", route: "/dashboard?view=affiliate", icon: Users },
  { key: "certificates", label: "Certificates", route: "/dashboard/certificates", icon: Award },
  { key: "payouts", label: "Payouts", route: "/dashboard/payouts", icon: Wallet },
  { key: "billing", label: "Billing", route: "/dashboard/billing", icon: Receipt },
  { key: "settings", label: "Settings", route: "/dashboard/settings", icon: Settings },
];

interface Props {
  profile?: { display_name: string | null } | null;
}

const DashboardSidebar = ({ profile }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (route: string) => {
    if (route === "/dashboard") return location.pathname === "/dashboard" && !location.search.includes("view=affiliate");
    if (route.includes("?view=affiliate")) return location.search.includes("view=affiliate");
    return location.pathname === route;
  };

  return (
    <>
      {/* Top Bar */}
      <header className="h-14 border-b border-[hsl(220,15%,12%)] bg-[hsl(220,20%,6%)] flex items-center px-4 lg:px-6 z-50 sticky top-0">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden mr-3 p-1.5 rounded-lg hover:bg-[hsl(220,15%,12%)] transition-colors"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/dashboard")}>
          <div className="w-8 h-8 rounded-lg bg-[hsl(207,90%,77%)] flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-sm tracking-wide hidden sm:inline">FUNDING PULZE</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/help")} className="p-2 rounded-lg hover:bg-[hsl(220,15%,12%)] text-[hsl(220,15%,50%)] hover:text-white transition-colors">
            <HelpCircle size={16} />
          </button>
          <button onClick={() => navigate("/dashboard/settings")} className="p-2 rounded-lg hover:bg-[hsl(220,15%,12%)] text-[hsl(220,15%,50%)] hover:text-white transition-colors">
            <Settings size={16} />
          </button>
          <button onClick={async () => { await signOut(); navigate("/"); }} className="p-2 rounded-lg hover:bg-[hsl(0,70%,55%)]/10 text-[hsl(220,15%,50%)] hover:text-[hsl(0,70%,55%)] transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Icon-only nav strip (desktop) */}
      <nav className="hidden lg:flex fixed top-14 left-0 bottom-0 flex-col items-center w-16 bg-[hsl(220,20%,5%)] border-r border-[hsl(220,15%,12%)] py-4 gap-1 z-40">
        <button
          onClick={() => navigate("/#rules")}
          className="w-10 h-10 rounded-xl bg-[hsl(207,90%,77%)] hover:bg-[hsl(207,90%,72%)] flex items-center justify-center text-white mb-4 transition-colors shadow-[0_0_16px_hsl(210,80%,55%,0.3)]"
          title="New Challenge"
        >
          <Plus size={20} />
        </button>

        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => navigate(item.route)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              isActive(item.route)
                ? "bg-[hsl(207,90%,77%)]/15 text-[hsl(207,90%,77%)]"
                : "text-[hsl(220,15%,40%)] hover:text-[hsl(0,0%,85%)] hover:bg-[hsl(220,15%,10%)]"
            }`}
            title={item.label}
          >
            <item.icon size={20} />
          </button>
        ))}

        <div className="flex-1" />

        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(207,90%,77%)] to-[hsl(207,85%,65%)] flex items-center justify-center text-white font-bold text-xs cursor-pointer" title={profile?.display_name || "Profile"}>
          {(profile?.display_name || "T")[0].toUpperCase()}
        </div>
      </nav>

      {/* Mobile nav drawer */}
      <div className={`
        fixed lg:hidden z-50 top-14 bottom-0 left-0 w-[260px] bg-[hsl(220,20%,5%)] border-r border-[hsl(220,15%,12%)]
        flex flex-col p-3 gap-1 transition-transform duration-300
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <button
          onClick={() => { navigate("/#rules"); setMobileOpen(false); }}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium bg-[hsl(207,90%,77%)]/15 text-[hsl(207,90%,77%)] mb-2"
        >
          <Plus size={14} /> New Challenge
        </button>
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => { navigate(item.route); setMobileOpen(false); }}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              isActive(item.route)
                ? "bg-[hsl(207,90%,77%)]/15 text-[hsl(207,90%,77%)]"
                : "text-[hsl(220,15%,50%)] hover:text-[hsl(0,0%,85%)] hover:bg-[hsl(220,15%,10%)]"
            }`}
          >
            <item.icon size={14} />
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
};

export default DashboardSidebar;
