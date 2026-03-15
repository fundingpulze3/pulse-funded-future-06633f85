import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Mail, Lock, User, ArrowLeft, Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUtmTracking, getStoredUtm } from "@/hooks/useUtmTracking";


const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useUtmTracking();
  const refCode = new URLSearchParams(window.location.search).get("ref");

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { toast.error(error.message); }
        else { toast.success("Welcome back!"); navigate("/"); }
      } else {
        const utm = getStoredUtm();
        const { error } = await supabase.auth.signUp({
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
        if (error) { toast.error(error.message); }
        else {
          toast.success("Account created successfully!");
          // Send welcome email
          try {
            await supabase.functions.invoke('send-transactional-email', {
              body: { type: 'welcome', data: { displayName: username || '' } },
            });
          } catch (err) {
            console.error('Failed to send welcome email:', err);
          }
          navigate("/");
        }
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) {
        toast.error(error.message || "Google sign-in failed");
      }
    } catch (err) {
      toast.error("Google sign-in failed");
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setEmail("");
    setPassword("");
    setUsername("");
  };


  const Spinner = ({ dark = false }: { dark?: boolean }) => (
    <div className={`w-5 h-5 border-2 rounded-full animate-spin ${dark ? 'border-foreground/30 border-t-foreground' : 'border-background/30 border-t-background'}`} />
  );

  // ─── Mobile layout ───
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm space-y-8">
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <img src={logo} alt="Funding Pulze" className="h-12 w-12 rounded-xl" />
          </motion.div>

          <motion.div
            className="flex bg-secondary rounded-full p-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <button
              onClick={() => { setIsLogin(true); setEmail(""); setPassword(""); setUsername(""); }}
              className={`flex-1 py-3 text-sm font-medium rounded-full transition-all duration-300 ${
                isLogin ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => { setIsLogin(false); setEmail(""); setPassword(""); setUsername(""); }}
              className={`flex-1 py-3 text-sm font-medium rounded-full transition-all duration-300 ${
                !isLogin ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              Sign Up
            </button>
          </motion.div>

          <motion.div
            className="glass-card p-6 rounded-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? "login" : "signup"}
                initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
                transition={{ duration: 0.3 }}
              >
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
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="h-12 pl-4 pr-10 rounded-xl bg-secondary border-border"
                    />
                    <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>

                  <Button type="submit" className="w-full h-12 rounded-xl font-medium" disabled={loading}>
                    {loading ? <Spinner /> : isLogin ? "Login" : "Create Account"}
                  </Button>

                  <div className="flex items-center gap-3 my-1">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">or</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="w-full h-12 rounded-xl border border-border bg-secondary flex items-center justify-center gap-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/><path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58Z" fill="#EA4335"/></svg>
                    Continue with Google
                  </button>

                </form>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
          >
            <ArrowLeft size={14} />
            Back to home
          </button>
        </div>
      </div>
    );
  }

  // ─── Desktop layout ───
  return (
    <div className="min-h-screen bg-background flex relative overflow-hidden">
      {/* Animated background shape */}
      <motion.div
        className="absolute inset-0 z-0"
        initial={false}
      >
        <motion.div
          className="absolute top-0 right-0 w-1/2 h-full"
          style={{ background: "hsl(var(--foreground))" }}
          animate={{
            clipPath: isLogin
              ? "polygon(15% 0%, 100% 0%, 100% 100%, 0% 100%)"
              : "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
          }}
          transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
        />
        <motion.div
          className="absolute top-0 left-0 w-1/2 h-full"
          style={{ background: "hsl(var(--foreground))" }}
          animate={{
            clipPath: !isLogin
              ? "polygon(0% 0%, 100% 0%, 85% 100%, 0% 100%)"
              : "polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)",
          }}
          transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
        />
      </motion.div>

      {/* Left side */}
      <div className="flex-1 flex items-center justify-center relative z-10 px-12">
        <AnimatePresence mode="wait">
          {isLogin ? (
            <motion.div
              key="login-form"
              className="w-full max-w-sm"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <div className="flex items-center gap-3 mb-10">
                <img src={logo} alt="Funding Pulze" className="h-9 w-9 rounded-lg" />
                <h1 className="font-display text-3xl font-bold text-foreground">Login</h1>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 bg-transparent border-0 border-b-2 border-border rounded-none px-0 pr-8 focus:border-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground text-foreground"
                  />
                  <Mail size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>

                <div className="relative">
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-12 bg-transparent border-0 border-b-2 border-border rounded-none px-0 pr-8 focus:border-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground text-foreground"
                  />
                  <Lock size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>

                <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl font-medium">
                  {loading ? <Spinner /> : "Login"}
                </Button>

                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full h-12 rounded-xl border border-border bg-secondary flex items-center justify-center gap-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/><path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58Z" fill="#EA4335"/></svg>
                  Continue with Google
                </button>


                <p className="text-sm text-muted-foreground text-center pt-2">
                  Don't have an account?{" "}
                  <button type="button" onClick={toggleMode} className="text-foreground hover:underline font-medium">
                    Register
                  </button>
                </p>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="register-info"
              className="text-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
            >
              <h2 className="font-display text-6xl font-bold text-background leading-tight">
                Hello<br />Friend!
              </h2>
              <div className="my-8">
                <img src={logo} alt="Funding Pulze" className="h-14 w-14 rounded-xl mx-auto opacity-80 invert" />
              </div>
              <p className="text-background/60 text-lg leading-relaxed max-w-xs mx-auto">
                Join the exclusive trading community today.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right side */}
      <div className="flex-1 flex items-center justify-center relative z-10 px-12">
        <AnimatePresence mode="wait">
          {isLogin ? (
            <motion.div
              key="login-info"
              className="text-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
            >
              <h2 className="font-display text-6xl font-bold text-background leading-tight">
                Welcome<br />Back!
              </h2>
              <div className="my-8">
                <img src={logo} alt="Funding Pulze" className="h-14 w-14 rounded-xl mx-auto opacity-80 invert" />
              </div>
              <p className="text-background/60 text-lg leading-relaxed max-w-xs mx-auto">
                Sign in to access exclusive trading insights and content.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="register-form"
              className="w-full max-w-sm"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <div className="flex items-center gap-3 mb-10">
                <img src={logo} alt="Funding Pulze" className="h-9 w-9 rounded-lg" />
                <h1 className="font-display text-3xl font-bold text-foreground">Sign Up</h1>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-12 bg-transparent border-0 border-b-2 border-border rounded-none px-0 pr-8 focus:border-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground text-foreground"
                  />
                  <User size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>

                <div className="relative">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 bg-transparent border-0 border-b-2 border-border rounded-none px-0 pr-8 focus:border-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground text-foreground"
                  />
                  <Mail size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>

                <div className="relative">
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-12 bg-transparent border-0 border-b-2 border-border rounded-none px-0 pr-8 focus:border-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground text-foreground"
                  />
                  <Lock size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>

                <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl font-medium">
                  {loading ? <Spinner /> : "Create Account"}
                </Button>

                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full h-12 rounded-xl border border-border bg-secondary flex items-center justify-center gap-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/><path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58Z" fill="#EA4335"/></svg>
                  Continue with Google
                </button>


                <p className="text-sm text-muted-foreground text-center pt-2">
                  Already have an account?{" "}
                  <button type="button" onClick={toggleMode} className="text-foreground hover:underline font-medium">
                    Login
                  </button>
                </p>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Back to home */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          Back to home
        </button>
      </div>
    </div>
  );
};

export default Auth;
