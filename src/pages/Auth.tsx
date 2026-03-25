import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.png";
import { useUtmTracking, getStoredUtm } from "@/hooks/useUtmTracking";

const Spinner = ({ dark = false }: { dark?: boolean }) => (
  <div className={`w-5 h-5 border-2 rounded-full animate-spin ${dark ? 'border-foreground/30 border-t-foreground' : 'border-background/30 border-t-background'}`} />
);

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useUtmTracking();
  const refCode = new URLSearchParams(window.location.search).get("ref");

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) toast.error(error.message);
        else { toast.success("Welcome back!"); navigate("/"); }
      } else {
        const utm = getStoredUtm();
        const { error } = await supabase.auth.signUp({
          email, password,
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
        if (error) toast.error(error.message);
        else {
          toast.success("Account created!");
          try {
            await supabase.functions.invoke('send-transactional-email', {
              body: { type: 'welcome', data: { displayName: username || '' } },
            });
          } catch {}
          navigate("/");
        }
      }
    } catch { toast.error("An unexpected error occurred"); }
    finally { setLoading(false); }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) toast.error(error.message || "Google sign-in failed");
    } catch { toast.error("Google sign-in failed"); }
  };

  const switchMode = () => {
    setIsLogin(p => !p);
    setEmail(""); setPassword(""); setUsername("");
  };

  const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/><path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58Z" fill="#EA4335"/></svg>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={logo} alt="Funding Pulze" className="h-12 w-12 rounded-xl" />
        </div>

        {/* Toggle */}
        <div className="flex bg-secondary rounded-full p-1 mb-8">
          <button
            onClick={() => { if (!isLogin) switchMode(); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-full transition-all duration-200 ${
              isLogin ? "bg-foreground text-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => { if (isLogin) switchMode(); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-full transition-all duration-200 ${
              !isLogin ? "bg-foreground text-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form Card */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-lg">
          <h2 className="font-display text-2xl font-bold text-foreground mb-6 text-center">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-12 pl-4 pr-10 rounded-xl bg-secondary border-border"
                />
                <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
              <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <Button type="submit" className="w-full h-12 rounded-xl font-medium" disabled={loading}>
              {loading ? <Spinner /> : isLogin ? "Login" : "Create Account"}
            </Button>

            {/* Google sign-in hidden for now */}

            <p className="text-sm text-muted-foreground text-center pt-2">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button type="button" onClick={switchMode} className="text-foreground hover:underline font-medium">
                {isLogin ? "Sign Up" : "Login"}
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
