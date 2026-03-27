import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, CheckCircle, ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = url.searchParams;

    const hasRecoveryMarker =
      hashParams.get("type") === "recovery" ||
      searchParams.get("type") === "recovery" ||
      !!hashParams.get("access_token") ||
      !!searchParams.get("access_token") ||
      !!hashParams.get("token_hash") ||
      !!searchParams.get("token_hash") ||
      !!searchParams.get("code");

    const bootstrapRecoverySession = async () => {
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          setIsRecovery(true);
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session || hasRecoveryMarker) {
        setIsRecovery(true);
      }
    };

    bootstrapRecoverySession().catch(() => {
      if (hasRecoveryMarker) {
        setIsRecovery(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && !!session && hasRecoveryMarker)) {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
      } else {
        setSuccess(true);
        toast.success("Password updated successfully!");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery && !success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div className="w-full max-w-md text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
            <img src={logo} alt="Funding Pulze" className="h-12 w-12 rounded-xl mx-auto mb-6" />
            <h2 className="font-display text-2xl font-bold text-foreground mb-3">Invalid Reset Link</h2>
            <p className="text-muted-foreground mb-6">This link is invalid or has expired. Please request a new password reset.</p>
            <Button className="w-full h-12 rounded-xl" onClick={() => navigate("/auth")}>Go to Login</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div className="w-full max-w-md text-center" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground mb-3">Password Updated!</h2>
            <p className="text-muted-foreground mb-6">Your password has been changed successfully.</p>
            <Button className="w-full h-12 rounded-xl" onClick={() => navigate("/auth")}>Go to Login</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <motion.div className="w-full max-w-md" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex justify-center mb-8">
          <img src={logo} alt="Funding Pulze" className="h-12 w-12 rounded-xl" />
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-lg">
          <h2 className="font-display text-2xl font-bold text-foreground mb-2 text-center">Set New Password</h2>
          <p className="text-muted-foreground text-sm text-center mb-6">Enter your new password below</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 pl-4 pr-10 rounded-xl bg-secondary border-border"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 pl-4 pr-10 rounded-xl bg-secondary border-border"
              />
              <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>

            <Button type="submit" className="w-full h-12 rounded-xl font-medium" disabled={loading}>
              {loading ? (
                <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              ) : (
                "Update Password"
              )}
            </Button>
          </form>
        </div>

        <div className="flex justify-center mt-6">
          <button onClick={() => navigate("/auth")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={14} /> Back to login
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
