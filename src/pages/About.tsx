import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useInView } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import logo from "@/assets/logo.png";
import { Target, Eye, Sparkles, Users, Globe, TrendingUp } from "lucide-react";

const GRID = 32;
const RADIUS = 160;

const InteractiveGrid = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const smoothRef = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    smoothRef.current.x += (mouseRef.current.x - smoothRef.current.x) * 0.08;
    smoothRef.current.y += (mouseRef.current.y - smoothRef.current.y) * 0.08;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width, h = rect.height;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, w, h);
    const mx = smoothRef.current.x, my = smoothRef.current.y;
    const isDark = document.documentElement.classList.contains("dark");
    const c = isDark ? "255,255,255" : "0,0,0";

    // Base grid
    ctx.strokeStyle = `rgba(${c},0.015)`;
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x += GRID) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += GRID) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    if (mx > -500) {
      for (let x = 0; x <= w; x += GRID) {
        for (let y = 0; y <= h; y += GRID) {
          const dx = x - mx, dy = y - my;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < RADIUS) {
            const f = 1 - d / RADIUS;
            const e = f * f * f;
            ctx.beginPath();
            ctx.arc(x, y, 0.8 + e * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${c},${e * 0.4})`;
            ctx.fill();
          }
        }
      }

      const grad = ctx.createRadialGradient(mx, my, 0, mx, my, RADIUS);
      grad.addColorStop(0, `rgba(${c},0.025)`);
      grad.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => { mouseRef.current = { x: -1000, y: -1000 }; };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" aria-hidden="true" />
    </div>
  );
};

const values = [
  { icon: Target, title: "Precision", desc: "Data-driven evaluation with transparent, fair rules for every trader." },
  { icon: Globe, title: "Global Access", desc: "Funding opportunities for traders worldwide, without borders." },
  { icon: TrendingUp, title: "Growth", desc: "Scale from evaluation to funded accounts up to $100K and beyond." },
  { icon: Users, title: "Community", desc: "A thriving network of disciplined traders pushing each other forward." },
];

const About = () => {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const heroRef = useRef<HTMLDivElement>(null);
  const missionRef = useRef<HTMLDivElement>(null);
  const valuesRef = useRef<HTMLDivElement>(null);
  const founderRef = useRef<HTMLDivElement>(null);
  const missionInView = useInView(missionRef, { once: true, margin: "-60px" });
  const valuesInView = useInView(valuesRef, { once: true, margin: "-60px" });
  const founderInView = useInView(founderRef, { once: true, margin: "-60px" });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    const load = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      const el = heroRef.current;
      if (!el) return;
      gsap.timeline({ defaults: { ease: "power3.out" }, scrollTrigger: { trigger: el, start: "top 85%", once: true } })
        .fromTo(el.querySelector(".about-badge"), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 })
        .fromTo(el.querySelector(".about-title"), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, "-=0.3")
        .fromTo(el.querySelector(".about-sub"), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, "-=0.3");
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />

      {/* Hero */}
      <section ref={heroRef} className="relative min-h-[70vh] flex items-center justify-center overflow-hidden pt-28 pb-20">
        <InteractiveGrid />
        <div className="relative z-10 text-center max-w-3xl mx-auto px-6">
          <div className="about-badge inline-flex items-center gap-2 px-4 py-2 rounded-full glow-border surface-elevated text-sm text-muted-foreground mb-8 opacity-0">
            <Sparkles size={14} className="text-foreground" />
            <span>Our Story</span>
          </div>
          <h1 className="about-title font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6 opacity-0">
            Built by Traders,{" "}
            <span className="text-gradient">for Traders.</span>
          </h1>
          <p className="about-sub text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed opacity-0">
            Funding Pulze was founded on a simple belief — skilled traders deserve access to capital, not gatekeeping.
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section ref={missionRef} className="relative py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          <motion.div
            className="glass-card p-10 relative overflow-hidden group"
            initial={{ opacity: 0, x: -30 }}
            animate={missionInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-[0.03] bg-foreground" />
            <div className="w-12 h-12 rounded-xl surface-elevated glow-border flex items-center justify-center mb-6">
              <Target size={22} className="text-foreground" />
            </div>
            <h2 className="font-display text-2xl font-bold mb-4">Our Mission</h2>
            <p className="text-muted-foreground leading-relaxed">
              To democratize access to trading capital by providing a transparent, fair, and technology-driven evaluation process. We remove financial barriers so talented traders can focus on what they do best — trading.
            </p>
          </motion.div>

          <motion.div
            className="glass-card p-10 relative overflow-hidden group"
            initial={{ opacity: 0, x: 30 }}
            animate={missionInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-[0.03] bg-foreground" />
            <div className="w-12 h-12 rounded-xl surface-elevated glow-border flex items-center justify-center mb-6">
              <Eye size={22} className="text-foreground" />
            </div>
            <h2 className="font-display text-2xl font-bold mb-4">Our Vision</h2>
            <p className="text-muted-foreground leading-relaxed">
              To become the world's most trusted prop trading firm — where every trader, regardless of background or capital, has a fair shot at building generational wealth through the financial markets.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section ref={valuesRef} className="relative py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={valuesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              What We <span className="text-gradient">Stand For</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              The principles that guide every decision at Funding Pulze.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                className="glass-card p-8 text-center group hover:glow-box transition-shadow duration-500"
                initial={{ opacity: 0, y: 25 }}
                animate={valuesInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="w-12 h-12 rounded-xl surface-elevated glow-border flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-300">
                  <v.icon size={20} className="text-foreground" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder */}
      <section ref={founderRef} className="relative py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            className="glass-card p-12 text-center relative overflow-hidden"
            initial={{ opacity: 0, y: 30 }}
            animate={founderInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Decorative corner accents */}
            <div className="absolute top-4 left-4 w-8 h-8 border-l border-t border-border/40 rounded-tl-lg" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-r border-b border-border/40 rounded-br-lg" />

            <div className="w-20 h-20 rounded-2xl surface-elevated glow-border glow-box flex items-center justify-center mx-auto mb-6">
              <img src={logo} alt="Funding Pulze" className="w-12 h-12 rounded-lg" />
            </div>

            <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mb-3">Founder & CEO</p>
            <h2 className="font-display text-3xl font-bold mb-2">Funding Pulze</h2>
            <p className="text-sm text-muted-foreground mb-8">Visionary Trader & Entrepreneur</p>

            <blockquote className="text-muted-foreground leading-relaxed text-lg italic max-w-xl mx-auto">
              "I started Funding Pulze because I believe every skilled trader deserves a chance to prove themselves — without risking their own capital. We're building the most transparent, trader-first prop firm in the world."
            </blockquote>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
