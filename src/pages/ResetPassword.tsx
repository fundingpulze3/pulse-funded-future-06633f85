import { useState, useEffect } from "react";
import { db as supabase } from "@/integrations/db/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, CheckCircle, ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";

type RecoveryParams = {
  accessToken: string | null;
  code: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  type: string | null;
};

const getRecoveryParams = (): RecoveryParams => {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const searchParams = url.searchParams;

  const readParam = (key: string) => hashParams.get(key) || searchParams.get(key);

  return {
    accessToken: readParam("access_token"),
    code: readParam("code"),
    refreshToken: readParam("refresh_token"),
    tokenHash: readParam("token_hash"),
    type: readParam("type"),
  };
};

const hasRecoveryMarker = (params: RecoveryParams) =>
  params.type === "recovery" ||
  !!params.code ||
  !!params.accessToken ||
  !!params.refreshToken ||
  !!params.tokenHash;

const cleanRecoveryUrl = () => {
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);
};

const ensureRecoverySession = async (params: RecoveryParams): Promise<boolean> => {
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (!error) return true;
  }

  if (params.type === "recovery" && params.tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: params.tokenHash,
    });
    if (!error) return true;
  }

  if (params.accessToken && params.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    if (!error) return true;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return !!session;
};

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const params = getRecoveryParams();
    const hasRecoveryIntent = hasRecoveryMarker(params);

    const bootstrapRecoverySession = async () => {
      const recovered = await ensureRecoverySession(params);
      if (!mounted) return;

      setIsRecovery(recovered || hasRecoveryIntent);
      setCheckingLink(false);

      if (recovered && hasRecoveryIntent) {
        cleanRecoveryUrl();
      }
    };

    bootstrapRecoverySession().catch(() => {
      if (!mounted) return;
      setIsRecovery(hasRecoveryIntent);
      setCheckingLink(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && !!session && hasRecoveryIntent)) {
        setIsRecovery(true);
        setCheckingLink(false);
        if (hasRecoveryIntent) {
          cleanRecoveryUrl();
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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
      const recovered = await ensureRecoverySession(getRecoveryParams());
      if (!recovered) {
        setIsRecovery(false);
        toast.error("Reset link is invalid or expired. Please request a new one.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
      } else {
        setSuccess(true);
        toast.success("Password updated successfully!");
        cleanRecoveryUrl();
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (checkingLink && !success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

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
