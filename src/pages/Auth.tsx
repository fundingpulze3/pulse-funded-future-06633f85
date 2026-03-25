import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
  const { user } = useAuth();
  const navigate = useNavigate();

  useUtmTracking();
  const refCode = new URLSearchParams(window.location.search).get("ref");

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        clearTimeout(timeout);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Welcome back!");
          navigate("/");
        }
      } else {
        const utm = getStoredUtm();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
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
        });
        clearTimeout(timeout);

        if (error) {
          toast.error(error.message);
        } else if (data.user && !data.session) {
          // Email confirmation required
          setEmailSent(true);
          toast.success("Check your email to verify your account!");
          try {
            await supabase.functions.invoke("send-transactional-email", {
              body: { type: "welcome", data: { displayName: username || "" } },
            });
          } catch {}
        } else if (data.session) {
          toast.success("Account created!");
          navigate("/");
        }
      }
    } catch (err: any) {
      clearTimeout(timeout);
      if (err?.name === "AbortError") {
        toast.error("Request timed out. Please try again.");
      } else {
        toast.error(err?.message || "Something went wrong");
      }
      // Clear any corrupted auth data
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

  // Email verification sent screen
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
