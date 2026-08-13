import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db as supabase } from "@/integrations/db/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff, CheckCircle } from "lucide-react";
import logo from "@/assets/logo.png";
import { useUtmTracking, getStoredUtm } from "@/hooks/useUtmTracking";

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useUtmTracking();

  const getAuthRedirectBaseUrl = () => {
    const host = window.location.hostname;
    if (host.includes("lovableproject.com") || host.includes("lovable.app")) {
      return "https://fundingpulze.com";
    }
    return window.location.origin;
  };

  const refCode = new URLSearchParams(window.location.search).get("ref");

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const withTimeout = <T,>(promise: Promise<T>, ms = 15000): Promise<T> =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out. Please try again.")), ms)
      ),
    ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await withTimeout(
          supabase.auth.signInWithPassword({ email, password })
        );

        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Welcome back!");
          navigate("/");
        }
      } else {
        const utm = getStoredUtm();
        const { data, error } = await withTimeout(
          supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: getAuthRedirectBaseUrl(),
              data: {
                ...(username ? { display_name: username } : {}),
                ...(refCode ? { referred_by_code: refCode } : {}),
                ...(utm.utm_source ? { utm_source: utm.utm_source } : {}),
                ...(utm.utm_medium ? { utm_medium: utm.utm_medium } : {}),
                ...(utm.utm_campaign ? { utm_campaign: utm.utm_campaign } : {}),
                ...(utm.utm_term ? { utm_term: utm.utm_term } : {}),
                ...(utm.utm_content ? { utm_content: utm.utm_content } : {}),
              },
            },
          })
        );

        if (error) {
          toast.error(error.message);
        } else if (data.user && !data.session) {
          setEmailSent(true);
          (window as any).fbq?.('track', 'CompleteRegistration');
          toast.success("Check your email to verify your account!");
          supabase.functions
            .invoke("send-transactional-email", {
              body: { type: "welcome", data: { displayName: username || "" } },
            })
            .catch(() => {});
        } else if (data.session) {
          (window as any).fbq?.('track', 'CompleteRegistration');
          toast.success("Account created!");
          navigate("/");
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong");
      try {
        localStorage.removeItem("sb-rpshiyvndmnogbhbgmfm-auth-token");
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === "login" ? "signup" : "login"));
    setEmail("");
    setPassword("");
    setUsername("");
    setEmailSent(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotLoading) return;
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${getAuthRedirectBaseUrl()}/reset-password`,
      });
      if (error) {
        toast.error(error.message);
      } else {
        setForgotSent(true);
        toast.success("Password reset link sent to your email!");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAuthRedirectBaseUrl(),
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        toast.error(error.message || "Google sign-in failed");
        setLoading(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Google sign-in failed");
      setLoading(false);
    }
  };

  // Forgot password flow
  if (forgotMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div className="w-full max-w-md" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <div className="flex justify-center mb-8">
            <img src={logo} alt="Funding Pulze" className="h-12 w-12 rounded-xl" />
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-lg">
            {forgotSent ? (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground mb-3 text-center">Check Your Email</h2>
                <p className="text-muted-foreground text-center mb-6">
                  We've sent a password reset link to <span className="font-medium text-foreground">{forgotEmail}</span>. Click the link in your email to reset your password.
                </p>
                <Button variant="outline" className="w-full h-11 rounded-xl" onClick={() => { setForgotMode(false); setForgotSent(false); setForgotEmail(""); }}>
                  Back to Login
                </Button>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl font-bold text-foreground mb-2 text-center">Forgot Password?</h2>
                <p className="text-muted-foreground text-sm text-center mb-6">Enter your email and we'll send you a reset link</p>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="relative">
                    <Input type="email" placeholder="Email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required className="h-12 pl-4 pr-10 rounded-xl bg-secondary border-border" />
                    <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                  <Button type="submit" className="w-full h-12 rounded-xl font-medium" disabled={forgotLoading}>
                    {forgotLoading ? <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" /> : "Send Reset Link"}
                  </Button>
                </form>
                <button type="button" onClick={() => setForgotMode(false)} className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full mt-4">
                  <ArrowLeft size={14} /> Back to Login
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    );
  }


  if (emailSent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          className="w-full max-w-md text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
        >
          <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground mb-3">
              Verify Your Email
            </h2>
            <p className="text-muted-foreground mb-6">
              We've sent a verification link to{" "}
              <span className="font-medium text-foreground">{email}</span>.
              <br />
              Click the link in your email to activate your account.
            </p>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl"
                onClick={() => {
                  setEmailSent(false);
                  setMode("login");
                }}
              >
                Go to Login
              </Button>
              <button
                onClick={() => navigate("/")}
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <ArrowLeft size={14} />
                Back to home
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={logo} alt="Funding Pulze" className="h-12 w-12 rounded-xl" />
        </div>

        {/* Toggle */}
        <div className="flex bg-secondary rounded-full p-1 mb-8">
          <button
            onClick={() => mode !== "login" && switchMode()}
            className={`flex-1 py-2.5 text-sm font-medium rounded-full transition-all duration-200 ${
              mode === "login"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => mode !== "signup" && switchMode()}
            className={`flex-1 py-2.5 text-sm font-medium rounded-full transition-all duration-200 ${
              mode === "signup"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-lg">
          <h2 className="font-display text-2xl font-bold text-foreground mb-6 text-center">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-12 pl-4 pr-10 rounded-xl bg-secondary border-border"
                />
                <User
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
              </div>
            )}

            <div className="relative">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 pl-4 pr-10 rounded-xl bg-secondary border-border"
              />
              <Mail
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </div>

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
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

            <Button
              type="submit"
              className="w-full h-12 rounded-xl font-medium"
              disabled={loading}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              ) : mode === "login" ? (
                "Login"
              ) : (
                "Create Account"
              )}
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 rounded-xl font-medium gap-2"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.3-7.2 2.3-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.7 35.8 44 30.3 44 24c0-1.2-.1-2.3-.4-3.5z"/>
              </svg>
              Continue with Google
            </Button>

            {mode === "login" && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setForgotMode(true)}
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <p className="text-sm text-muted-foreground text-center pt-2">
              {mode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={switchMode}
                className="text-foreground hover:underline font-medium"
              >
                {mode === "login" ? "Sign Up" : "Login"}
              </button>
            </p>
          </form>
        </div>

        <div className="flex justify-center mt-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} />
            Back to home
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
