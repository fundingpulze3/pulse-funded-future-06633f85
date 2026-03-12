import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Mail, Lock, User, ArrowLeft } from "lucide-react";
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
        else { toast.success("Account created successfully!"); navigate("/"); }
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
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

                <div className="relative flex items-center gap-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 rounded-xl font-medium gap-2"
                  onClick={handleGoogleSignIn}
                >
                  <GoogleIcon />
                  Continue with Google
                </Button>

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
