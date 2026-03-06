import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const getDelay = (index: number, isLogin: boolean) =>
  isLogin ? 0.3 + index * 0.08 : 0.05 + index * 0.05;

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const refCode = new URLSearchParams(window.location.search).get("ref");

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Logged in successfully!");
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: refCode ? { referred_by_code: refCode } : undefined,
          },
        });
        if (error) throw error;
        toast.success("Account created successfully!");
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formFields = [
    {
      id: "email",
      label: "Email",
      type: "email",
      value: email,
      onChange: (v: string) => setEmail(v),
      placeholder: "you@example.com",
      icon: Mail,
    },
    {
      id: "password",
      label: "Password",
      type: "password",
      value: password,
      onChange: (v: string) => setPassword(v),
      placeholder: "••••••••",
      icon: Lock,
      minLength: 6,
    },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 overflow-hidden relative">
      {/* Rotating background panel */}
      <motion.div
        className="absolute -top-1 right-0 w-[850px] h-[600px] z-0"
        style={{
          transformOrigin: "bottom right",
          background: "hsl(var(--foreground))",
        }}
        animate={{
          rotate: isLogin ? 10 : 0,
          skewY: isLogin ? 40 : 0,
        }}
        transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: isLogin ? 1.2 : 0.3 }}
      />

      {/* Accent glow */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none z-0"
        style={{
          background: "radial-gradient(circle, hsl(var(--glow-primary) / 0.15) 0%, transparent 70%)",
        }}
        animate={{ scale: isLogin ? 1 : 1.3, opacity: isLogin ? 0.6 : 0.3 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />

      <div className="w-full max-w-md relative z-10">
        <motion.button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <ArrowLeft size={16} /> Back to home
        </motion.button>

        <motion.div
          className="rounded-2xl p-8 relative overflow-hidden"
          style={{
            background: "hsl(var(--surface-elevated) / 0.4)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid hsl(var(--glow-primary) / 0.12)",
            boxShadow: "0 16px 48px hsl(var(--glow-primary) / 0.08)",
          }}
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? "login" : "signup"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="font-display text-3xl font-bold text-center mb-2 text-foreground">
                {isLogin ? "Welcome Back" : "Create Account"}
              </h1>
              <p className="text-muted-foreground text-center text-sm mb-8">
                {isLogin
                  ? "Sign in to your Funding Pulze account"
                  : "Start your trading journey today"}
              </p>
            </motion.div>
          </AnimatePresence>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {formFields.map((field, index) => (
              <motion.div
                key={field.id}
                animate={{
                  x: 0,
                  opacity: 1,
                  filter: "blur(0px)",
                }}
                initial={{
                  x: -40,
                  opacity: 0,
                  filter: "blur(10px)",
                }}
                transition={{
                  duration: 0.7,
                  ease: "easeOut",
                  delay: getDelay(index, isLogin),
                }}
              >
                <Label htmlFor={field.id} className="text-sm text-muted-foreground">
                  {field.label}
                </Label>
                <div className="relative mt-1">
                  <field.icon
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id={field.id}
                    type={field.type}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder={field.placeholder}
                    className="pl-10 rounded-xl bg-secondary border-border"
                    required
                    minLength={field.minLength}
                  />
                </div>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: getDelay(2, isLogin) }}
            >
              <Button type="submit" className="w-full rounded-xl py-5" disabled={loading}>
                {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
              </Button>
            </motion.div>
          </form>

          <motion.p
            className="text-center text-sm text-muted-foreground mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline font-medium"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
