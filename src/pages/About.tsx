import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import logo from "@/assets/logo.png";
import { Target, Eye, Sparkles, Users, Globe, TrendingUp, ArrowRight, Zap, Shield, Award } from "lucide-react";
import { usePageContent } from "@/hooks/usePageContent";

/* ─── Interactive Grid Canvas ─── */
const GRID = 28;
const RADIUS = 180;

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

    smoothRef.current.x += (mouseRef.current.x - smoothRef.current.x) * 0.06;
    smoothRef.current.y += (mouseRef.current.y - smoothRef.current.y) * 0.06;

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

    ctx.strokeStyle = `rgba(${c},0.012)`;
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
            ctx.arc(x, y, 0.6 + e * 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${c},${e * 0.35})`;
            ctx.fill();
          }
        }
      }
      const grad = ctx.createRadialGradient(mx, my, 0, mx, my, RADIUS);
      grad.addColorStop(0, `rgba(${c},0.02)`);
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

/* ─── Animated Counter ─── */
const AnimatedNumber = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || !ref.current) return;
    let start = 0;
    const duration = 2000;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      start = Math.floor(eased * value);
      if (ref.current) ref.current.textContent = `${start.toLocaleString()}${suffix}`;
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, value, suffix]);

  return <span ref={ref} className="tabular-nums">0{suffix}</span>;
};

/* ─── Data ─── */
const values = [
  { icon: Target, title: "Precision", desc: "Data-driven evaluation with transparent, fair rules for every trader." },
  { icon: Globe, title: "Global Access", desc: "Funding opportunities for traders worldwide, without borders." },
  { icon: TrendingUp, title: "Growth", desc: "Scale from evaluation to funded accounts up to $100K and beyond." },
  { icon: Users, title: "Community", desc: "A thriving network of disciplined traders pushing each other forward." },
];

const stats = [
  { value: 15000, suffix: "+", label: "Traders Funded" },
  { value: 50, suffix: "M+", label: "Capital Deployed" },
  { value: 180, suffix: "+", label: "Countries" },
  { value: 99, suffix: "%", label: "Uptime" },
];

const milestones = [
  { year: "2023", title: "Founded", desc: "Funding Pulze launched with a mission to democratize trading capital." },
  { year: "2024", title: "10K Traders", desc: "Surpassed 10,000 funded traders across 150+ countries." },
  { year: "2025", title: "$50M Deployed", desc: "Over $50 million in trading capital deployed to skilled traders." },
  { year: "2026", title: "Next Chapter", desc: "Expanding with new platforms, AI-powered analytics, and more." },
];

/* ─── Main Component ─── */
const About = () => {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const heroRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const { get } = usePageContent("about");

  const hero = get("hero", { title: "Built by Mentors,\nfor Traders.", content: "Funding Pulze was founded on a simple belief — skilled traders deserve access to capital, not gatekeeping." });
  const mission = get("mission", { title: "Our Mission", content: "To democratize access to trading capital by providing a transparent, fair, and technology-driven evaluation process. We remove financial barriers so talented traders can focus on what they do best — trading." });
  const vision = get("vision", { title: "Our Vision", content: "To become the world's most trusted prop trading firm — where every trader, regardless of background or capital, has a fair shot at building generational wealth through the financial markets." });
  const founder = get("founder", { title: "Funding Pulze", content: "\"I started Funding Pulze because I believe every skilled trader deserves a chance to prove themselves — without risking their own capital. We're building the most transparent, trader-first prop firm in the world.\"" });

  // Parallax for hero
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // GSAP scroll-triggered animations
  useEffect(() => {
    const load = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      // Hero entrance
      const el = heroRef.current;
      if (el) {
        const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
        tl.fromTo(el.querySelector(".about-badge"), { y: 40, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.8 })
          .fromTo(el.querySelector(".about-title"), { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, "-=0.5")
          .fromTo(el.querySelector(".about-sub"), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, "-=0.5")
          .fromTo(el.querySelector(".about-cta"), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, "-=0.3");
      }

      // Timeline items stagger
      if (timelineRef.current) {
        gsap.utils.toArray<HTMLElement>(".timeline-item").forEach((item, i) => {
          gsap.fromTo(item,
            { y: 60, opacity: 0 },
            {
              y: 0, opacity: 1, duration: 0.8, delay: i * 0.15,
              ease: "power3.out",
              scrollTrigger: { trigger: item, start: "top 85%", once: true }
            }
          );
        });
      }

      // Parallax floating elements
      gsap.utils.toArray<HTMLElement>(".float-element").forEach((el) => {
        gsap.to(el, {
          y: -30,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 1.5 }
        });
      });
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />

      {/* ═══ HERO ═══ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <InteractiveGrid />

        {/* Floating decorative elements */}
        <div className="absolute top-[20%] left-[8%] w-20 h-20 rounded-full border border-border/20 float-element opacity-30" />
        <div className="absolute top-[30%] right-[12%] w-14 h-14 rounded-2xl border border-border/15 float-element opacity-20 rotate-12" />
        <div className="absolute bottom-[25%] left-[15%] w-10 h-10 rounded-full bg-foreground/[0.02] float-element" />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 text-center max-w-4xl mx-auto px-6"
        >
          <div className="about-badge inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full glow-border surface-elevated text-sm text-muted-foreground mb-10 opacity-0">
            <Sparkles size={14} className="text-foreground" />
            <span className="tracking-wide">Our Story</span>
          </div>

          <h1 className="about-title font-display text-4xl sm:text-6xl lg:text-8xl font-bold leading-[0.95] tracking-tight mb-8 opacity-0 whitespace-pre-line">
            {hero.title}
          </h1>

          <p className="about-sub text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed opacity-0 font-light">
            {hero.content}
          </p>

          <div className="about-cta mt-12 opacity-0">
            <a href="#mission" className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-foreground text-background font-medium text-sm hover:opacity-90 transition-opacity">
              Learn More <ArrowRight size={16} />
            </a>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-1.5">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
              animate={{ y: [0, 12, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="py-20 px-6 border-y border-border/30">
        <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0 lg:divide-x divide-border/30">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="text-center lg:px-8"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
            >
              <p className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-sm text-muted-foreground mt-2 tracking-wide">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ MISSION & VISION ═══ */}
      <section id="mission" className="py-20 sm:py-32 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Mission — Full width cinematic */}
          <MissionCard
            icon={<Target size={24} />}
            label="Mission"
            title={mission.title}
            content={mission.content}
            direction="left"
          />

          <div className="h-20" />

          {/* Vision */}
          <MissionCard
            icon={<Eye size={24} />}
            label="Vision"
            title={vision.title}
            content={vision.content}
            direction="right"
          />
        </div>
      </section>

      {/* ═══ VALUES ═══ */}
      <section className="py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-foreground/[0.01] to-transparent" />
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">Core Values</p>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              What We <span className="text-gradient">Stand For</span>
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                className="group relative p-8 rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-border hover:shadow-[0_20px_60px_-15px_hsl(var(--foreground)/0.08)] transition-all duration-700"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="w-14 h-14 rounded-2xl surface-elevated glow-border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                  <v.icon size={22} className="text-foreground" />
                </div>
                <h3 className="font-display font-bold text-xl mb-3">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>

                {/* Hover glow */}
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-br from-foreground/[0.02] to-transparent" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TIMELINE ═══ */}
      <section ref={timelineRef} className="py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">Journey</p>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              Our <span className="text-gradient">Timeline</span>
            </h2>
          </motion.div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-8 lg:left-1/2 top-0 bottom-0 w-px bg-border/50 lg:-translate-x-px" />

            {milestones.map((m, i) => (
              <div
                key={m.year}
                className={`timeline-item relative flex items-start gap-8 mb-16 last:mb-0 opacity-0 ${
                  i % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
                }`}
              >
                {/* Dot */}
                <div className="absolute left-8 lg:left-1/2 w-4 h-4 rounded-full bg-foreground border-4 border-background -translate-x-1/2 z-10 mt-1.5" />

                {/* Content */}
                <div className={`ml-16 lg:ml-0 lg:w-[calc(50%-40px)] ${i % 2 === 0 ? "lg:pr-8 lg:text-right" : "lg:pl-8"}`}>
                  <span className="inline-block font-display text-xs font-bold tracking-[0.2em] text-muted-foreground mb-2">{m.year}</span>
                  <h3 className="font-display text-2xl font-bold mb-2">{m.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{m.desc}</p>
                </div>

                {/* Spacer for other side */}
                <div className="hidden lg:block lg:w-[calc(50%-40px)]" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FOUNDER ═══ */}
      <section className="py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-foreground/[0.015] to-transparent" />
        <div className="max-w-3xl mx-auto relative z-10">
          <motion.div
            className="relative rounded-[2rem] border border-border/50 p-12 sm:p-16 text-center overflow-hidden"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Background texture */}
            <div className="absolute inset-0 bg-card/60 backdrop-blur-xl" />
            <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-foreground/[0.02] blur-3xl" />
            <div className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-foreground/[0.015] blur-3xl" />

            {/* Corner accents */}
            <div className="absolute top-6 left-6 w-12 h-12 border-l-2 border-t-2 border-border/30 rounded-tl-xl" />
            <div className="absolute bottom-6 right-6 w-12 h-12 border-r-2 border-b-2 border-border/30 rounded-br-xl" />

            <div className="relative z-10">
              <div className="w-24 h-24 rounded-3xl surface-elevated glow-border glow-box flex items-center justify-center mx-auto mb-8">
                <img src={logo} alt="Funding Pulze" className="w-14 h-14 rounded-xl" />
              </div>

              <p className="text-xs text-muted-foreground uppercase tracking-[0.25em] mb-4">Founder & CEO</p>
              <h2 className="font-display text-4xl font-bold mb-2">{founder.title}</h2>
              <p className="text-sm text-muted-foreground mb-10">Visionary Trader & Entrepreneur</p>

              <blockquote className="text-muted-foreground leading-[1.9] text-lg sm:text-xl italic max-w-xl mx-auto font-light">
                {founder.content}
              </blockquote>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Ready to Start?
            </h2>
            <p className="text-xl text-muted-foreground max-w-xl mx-auto mb-10 font-light">
              Join thousands of traders who trust Funding Pulze to fuel their journey.
            </p>
            <a
              href="/#rules"
              className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-foreground text-background font-semibold hover:opacity-90 transition-opacity text-lg"
            >
              View Challenges <ArrowRight size={20} />
            </a>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

/* ─── Mission/Vision Card ─── */
const MissionCard = ({ icon, label, title, content, direction }: {
  icon: React.ReactNode; label: string; title: string; content: string; direction: "left" | "right";
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      className={`relative rounded-[2rem] border border-border/40 p-10 sm:p-14 overflow-hidden bg-card/30 backdrop-blur-sm ${
        direction === "right" ? "lg:ml-auto lg:max-w-2xl" : "lg:mr-auto lg:max-w-2xl"
      }`}
      initial={{ opacity: 0, x: direction === "left" ? -60 : 60 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute top-0 right-0 w-40 h-40 rounded-bl-full bg-foreground/[0.015]" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl surface-elevated glow-border flex items-center justify-center">
            {icon}
          </div>
          <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-medium">{label}</span>
        </div>

        <h2 className="font-display text-3xl sm:text-4xl font-bold mb-6 tracking-tight">{title}</h2>
        <p className="text-muted-foreground leading-[1.85] text-lg font-light">
          {content}
        </p>
      </div>
    </motion.div>
  );
};

export default About;
