import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowRight, Mail, Lock, User, ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUtmTracking, getStoredUtm } from "@/hooks/useUtmTracking";
import { lovable } from "@/integrations/lovable/index";

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

  const handleGoogleSignIn = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) toast.error(error.message);
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setEmail("");
    setPassword("");
    setUsername("");
  };

  const getDelay = (index: number, entering: boolean) => {
    return entering ? index * 0.1 : (5 - index) * 0.1;
  };

  // ─── Mobile layout ───
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo */}
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <img src={logo} alt="Funding Pulze" className="h-12 w-12 rounded-xl" />
          </motion.div>

          {/* Mode Toggle */}
          <motion.div
            className="flex bg-secondary rounded-full p-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 text-sm font-medium rounded-full transition-all duration-300 ${
                isLogin ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 text-sm font-medium rounded-full transition-all duration-300 ${
                !isLogin ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              Sign Up
            </button>
          </motion.div>

          {/* Form Card */}
          <motion.div
            className="glass-card p-6 rounded-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
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
                {loading ? (
                  <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                ) : isLogin ? "Login" : "Create Account"}
              </Button>

              <div className="relative flex items-center gap-4 my-2">
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
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </Button>
            </form>
          </motion.div>

          {/* Back to home */}
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

  // ─── Desktop layout — side by side with rotating panels ───
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex relative overflow-hidden">
        {/* Rotating background panels */}
        <motion.div
          className="absolute -top-1 right-0 w-[850px] h-[600px] z-[1]"
          style={{ transformOrigin: "bottom right", background: "hsl(var(--foreground))" }}
          animate={{ rotate: isLogin ? 10 : 0, skewY: isLogin ? 40 : 0 }}
          transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: isLogin ? 1.2 : 0.3 }}
        />
        <motion.div
          className="absolute -bottom-1 left-0 w-[850px] h-[600px] z-[1]"
          style={{ transformOrigin: "top left", background: "hsl(var(--foreground) / 0.06)" }}
          animate={{ rotate: isLogin ? 0 : -10, skewY: isLogin ? 0 : -40 }}
          transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: isLogin ? 0.3 : 1.2 }}
        />

        {/* ───── Login Form (Left) ───── */}
        <div className="flex-1 flex items-center justify-center relative z-10 px-12">
          <div className="w-full max-w-sm">
            <motion.div
              animate={{
                x: isLogin ? 0 : "-120%",
                opacity: isLogin ? 1 : 0,
                filter: isLogin ? "blur(0px)" : "blur(10px)",
              }}
              transition={{ duration: 0.7, ease: "easeOut", delay: getDelay(0, isLogin) }}
            >
              <div className="flex items-center gap-3 mb-10">
                <img src={logo} alt="Funding Pulze" className="h-9 w-9 rounded-lg" />
                <h1 className="font-display text-3xl font-bold text-foreground">Login</h1>
              </div>
            </motion.div>

            <form onSubmit={isLogin ? handleSubmit : (e) => e.preventDefault()} className="space-y-6">
              <motion.div
                animate={{
                  x: isLogin ? 0 : "-120%",
                  opacity: isLogin ? 1 : 0,
                  filter: isLogin ? "blur(0px)" : "blur(10px)",
                }}
                transition={{ duration: 0.7, ease: "easeOut", delay: getDelay(1, isLogin) }}
              >
                <div className="relative">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={!isLogin}
                    className="h-12 bg-transparent border-0 border-b-2 border-border rounded-none px-0 pr-8 focus:border-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
                  />
                  <Mail size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </motion.div>

              <motion.div
                animate={{
                  x: isLogin ? 0 : "-120%",
                  opacity: isLogin ? 1 : 0,
                  filter: isLogin ? "blur(0px)" : "blur(10px)",
                }}
                transition={{ duration: 0.7, ease: "easeOut", delay: getDelay(2, isLogin) }}
              >
                <div className="relative">
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={!isLogin}
                    minLength={6}
                    className="h-12 bg-transparent border-0 border-b-2 border-border rounded-none px-0 pr-8 focus:border-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
                  />
                  <Lock size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </motion.div>

              <motion.div
                animate={{
                  x: isLogin ? 0 : "-120%",
                  opacity: isLogin ? 1 : 0,
                  filter: isLogin ? "blur(0px)" : "blur(10px)",
                }}
                transition={{ duration: 0.7, ease: "easeOut", delay: getDelay(3, isLogin) }}
              >
                <Button type="submit" disabled={loading || !isLogin} className="w-full h-12 rounded-xl font-medium">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  ) : "Login"}
                </Button>
              </motion.div>

              <motion.div
                animate={{
                  x: isLogin ? 0 : "-120%",
                  opacity: isLogin ? 1 : 0,
                  filter: isLogin ? "blur(0px)" : "blur(10px)",
                }}
                transition={{ duration: 0.7, ease: "easeOut", delay: getDelay(3.5, isLogin) }}
              >
                <div className="relative flex items-center gap-4 my-1">
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
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Continue with Google
                </Button>
              </motion.div>

              <motion.p
                className="text-sm text-muted-foreground text-center"
                animate={{
                  x: isLogin ? 0 : "-120%",
                  opacity: isLogin ? 1 : 0,
                  filter: isLogin ? "blur(0px)" : "blur(10px)",
                }}
                transition={{ duration: 0.7, ease: "easeOut", delay: getDelay(4, isLogin) }}
              >
                Don't have an account?{" "}
                <button type="button" onClick={toggleMode} className="text-primary hover:underline font-medium">
                  Register
                </button>
              </motion.p>
            </form>
          </div>
        </div>

        {/* ───── Login Info Text (Right) ───── */}
        <div className="flex-1 flex items-center justify-center relative z-10 px-12">
          <motion.div
            className="text-center"
            animate={{
              opacity: isLogin ? 1 : 0,
              y: isLogin ? 0 : 30,
              filter: isLogin ? "blur(0px)" : "blur(8px)",
            }}
            transition={{ duration: 0.8, ease: "easeOut", delay: isLogin ? 0.8 : 0 }}
          >
            <h2 className="font-display text-5xl font-bold text-background leading-tight">
              Welcome<br />Back!
            </h2>
            <div className="my-6">
              <img src={logo} alt="Funding Pulze" className="h-14 w-14 rounded-xl mx-auto opacity-80" />
            </div>
            <p className="text-background/60 text-lg leading-relaxed">
              Sign in to access exclusive<br />trading insights and content.
            </p>
          </motion.div>
        </div>

        {/* ───── Register Form (Right, overlapping) ───── */}
        <div className="absolute inset-0 flex z-10 pointer-events-none">
          <div className="flex-1" />
          <div className="flex-1 flex items-center justify-center px-12 pointer-events-auto">
            <div className="w-full max-w-sm">
              <motion.div
                animate={{
                  x: !isLogin ? 0 : "120%",
                  opacity: !isLogin ? 1 : 0,
                  filter: !isLogin ? "blur(0px)" : "blur(10px)",
                }}
                transition={{ duration: 0.7, ease: "easeOut", delay: getDelay(0, !isLogin) }}
              >
                <div className="flex items-center gap-3 mb-10">
                  <img src={logo} alt="Funding Pulze" className="h-9 w-9 rounded-lg" />
                  <h1 className="font-display text-3xl font-bold text-background">Sign Up</h1>
                </div>
              </motion.div>

              <form onSubmit={!isLogin ? handleSubmit : (e) => e.preventDefault()} className="space-y-6">
                <motion.div
                  animate={{
                    x: !isLogin ? 0 : "120%",
                    opacity: !isLogin ? 1 : 0,
                    filter: !isLogin ? "blur(0px)" : "blur(10px)",
                  }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: getDelay(1, !isLogin) }}
                >
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLogin}
                      className="h-12 bg-transparent border-0 border-b-2 border-background/20 rounded-none px-0 pr-8 text-background placeholder:text-background/40 focus:border-background/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <User size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-background/40" />
                  </div>
                </motion.div>

                <motion.div
                  animate={{
                    x: !isLogin ? 0 : "120%",
                    opacity: !isLogin ? 1 : 0,
                    filter: !isLogin ? "blur(0px)" : "blur(10px)",
                  }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: getDelay(2, !isLogin) }}
                >
                  <div className="relative">
                    <Input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLogin}
                      className="h-12 bg-transparent border-0 border-b-2 border-background/20 rounded-none px-0 pr-8 text-background placeholder:text-background/40 focus:border-background/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <Mail size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-background/40" />
                  </div>
                </motion.div>

                <motion.div
                  animate={{
                    x: !isLogin ? 0 : "120%",
                    opacity: !isLogin ? 1 : 0,
                    filter: !isLogin ? "blur(0px)" : "blur(10px)",
                  }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: getDelay(3, !isLogin) }}
                >
                  <div className="relative">
                    <Input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLogin}
                      minLength={6}
                      className="h-12 bg-transparent border-0 border-b-2 border-background/20 rounded-none px-0 pr-8 text-background placeholder:text-background/40 focus:border-background/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <Lock size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-background/40" />
                  </div>
                </motion.div>

                <motion.div
                  animate={{
                    x: !isLogin ? 0 : "120%",
                    opacity: !isLogin ? 1 : 0,
                    filter: !isLogin ? "blur(0px)" : "blur(10px)",
                  }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: getDelay(4, !isLogin) }}
                >
                  <Button
                    type="submit"
                    disabled={loading || isLogin}
                    className="w-full h-12 rounded-xl font-medium bg-background text-foreground hover:bg-background/90"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                    ) : "Register"}
                  </Button>
                </motion.div>

                <motion.div
                  animate={{
                    x: !isLogin ? 0 : "120%",
                    opacity: !isLogin ? 1 : 0,
                    filter: !isLogin ? "blur(0px)" : "blur(10px)",
                  }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: getDelay(4.5, !isLogin) }}
                >
                  <div className="relative flex items-center gap-4 my-1">
                    <div className="flex-1 h-px bg-background/20" />
                    <span className="text-xs text-background/40">or</span>
                    <div className="flex-1 h-px bg-background/20" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 rounded-xl font-medium gap-2 bg-background text-foreground hover:bg-background/90 border-background/20"
                    onClick={handleGoogleSignIn}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Continue with Google
                  </Button>
                </motion.div>

                <motion.p
                  className="text-sm text-background/60 text-center"
                  animate={{
                    x: !isLogin ? 0 : "120%",
                    opacity: !isLogin ? 1 : 0,
                    filter: !isLogin ? "blur(0px)" : "blur(10px)",
                  }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: getDelay(5, !isLogin) }}
                >
                  Already have an account?{" "}
                  <button type="button" onClick={toggleMode} className="text-background hover:underline font-medium">
                    Login
                  </button>
                </motion.p>
              </form>
            </div>
          </div>
        </div>

        {/* ───── Register Info Text (Left, overlapping) ───── */}
        <div className="absolute inset-0 flex z-10 pointer-events-none">
          <div className="flex-1 flex items-center justify-center px-12">
            <motion.div
              className="text-center"
              animate={{
                opacity: !isLogin ? 1 : 0,
                y: !isLogin ? 0 : 30,
                filter: !isLogin ? "blur(0px)" : "blur(8px)",
              }}
              transition={{ duration: 0.8, ease: "easeOut", delay: !isLogin ? 0.8 : 0 }}
            >
              <h2 className="font-display text-5xl font-bold text-foreground leading-tight">
                Hello<br />Friend!
              </h2>
              <div className="my-6">
                <img src={logo} alt="Funding Pulze" className="h-14 w-14 rounded-xl mx-auto opacity-80" />
              </div>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Join the exclusive trading<br />community today.
              </p>
            </motion.div>
          </div>
          <div className="flex-1" />
        </div>
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
