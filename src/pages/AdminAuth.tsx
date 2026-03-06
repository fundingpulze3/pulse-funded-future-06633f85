import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Mail, Lock, Shield } from "lucide-react";
import logo from "@/assets/logo.png";

const AdminAuth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/admin");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Welcome back, Admin.");
        navigate("/admin");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(0,0%,2%)] flex items-center justify-center relative overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(0,0%,50%) 1px, transparent 1px), linear-gradient(90deg, hsl(0,0%,50%) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Glow accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[hsl(0,0%,8%)] blur-[120px]" />

      <motion.div
        className="relative z-10 w-full max-w-sm px-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Logo + Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[hsl(0,0%,8%)] border border-[hsl(0,0%,15%)] mb-5">
            <img src={logo} alt="Funding Pulze" className="h-8 w-8 rounded-lg" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[hsl(0,0%,95%)] tracking-tight">
            Admin Portal
          </h1>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <Shield size={12} className="text-[hsl(0,0%,40%)]" />
            <p className="text-xs text-[hsl(0,0%,40%)] font-mono uppercase tracking-widest">
              Authorized Personnel Only
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-[hsl(0,0%,6%)] border border-[hsl(0,0%,14%)] rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[hsl(0,0%,45%)] uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="admin@fundingpulze.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 bg-[hsl(0,0%,4%)] border-[hsl(0,0%,14%)] text-[hsl(0,0%,90%)] placeholder:text-[hsl(0,0%,25%)] rounded-xl pr-10 focus:border-[hsl(0,0%,30%)] focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Mail size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(0,0%,25%)]" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[hsl(0,0%,45%)] uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-11 bg-[hsl(0,0%,4%)] border-[hsl(0,0%,14%)] text-[hsl(0,0%,90%)] placeholder:text-[hsl(0,0%,25%)] rounded-xl pr-10 focus:border-[hsl(0,0%,30%)] focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(0,0%,25%)]" />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl font-medium bg-[hsl(0,0%,95%)] text-[hsl(0,0%,5%)] hover:bg-[hsl(0,0%,85%)] transition-colors"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-[hsl(0,0%,5%)]/30 border-t-[hsl(0,0%,5%)] rounded-full animate-spin" />
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-[hsl(0,0%,25%)] mt-8 font-mono">
          © {new Date().getFullYear()} Funding Pulze — Secure Access
        </p>
      </motion.div>
    </div>
  );
};

export default AdminAuth;
