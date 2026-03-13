import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Wallet, ArrowLeft } from "lucide-react";

const DashboardPayouts = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.add("dark");
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    if (!meta) { meta = document.createElement("meta"); meta.name = "robots"; document.head.appendChild(meta); }
    meta.content = "noindex, nofollow";
    return () => { if (meta) meta.remove(); };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading]);

  return (
    <div className="min-h-screen bg-[hsl(220,20%,4%)] text-[hsl(0,0%,92%)]">
      <header className="h-14 border-b border-[hsl(220,15%,12%)] bg-[hsl(220,20%,6%)] flex items-center px-4 lg:px-6 sticky top-0 z-50">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-sm text-[hsl(220,15%,50%)] hover:text-white transition-colors">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </header>

      <div className="max-w-5xl mx-auto p-4 lg:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-[hsl(142,60%,50%)]/15 flex items-center justify-center">
            <Wallet size={18} className="text-[hsl(142,60%,50%)]" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">Payouts</h1>
            <p className="text-xs text-[hsl(220,15%,45%)]">Your payout history</p>
          </div>
        </div>

        <div className="text-center py-20 text-[hsl(220,15%,35%)]">
          <Wallet size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No payouts yet. Reach funded status to request payouts!</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPayouts;
