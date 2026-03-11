import { useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";
import LiveTicker from "@/components/LiveTicker";

const MagneticButton = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const btnRef = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) * 0.25;
    const dy = (e.clientY - cy) * 0.25;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const onLeave = () => {
    const el = btnRef.current;
    if (el) el.style.transform = "translate(0, 0)";
  };

  return (
    <div
      ref={btnRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`transition-transform duration-300 ease-out ${className || ""}`}
    >
      {children}
    </div>
  );
};

const GRID_SIZE = 28;

const Hero = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const smoothMouse = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    smoothMouse.current.x += (mouseRef.current.x - smoothMouse.current.x) * 0.08;
    smoothMouse.current.y += (mouseRef.current.y - smoothMouse.current.y) * 0.08;

    const rect = section.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, w, h);

    const mx = smoothMouse.current.x;
    const my = smoothMouse.current.y;
    const radius = 180;
    const isDark = document.documentElement.classList.contains("dark");
    const lineColor = isDark ? "255,255,255" : "0,0,0";

    ctx.strokeStyle = `rgba(${lineColor},0.018)`;
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    if (mx > -500) {
      const bulgeStrength = 6;

      for (let x = 0; x <= w; x += GRID_SIZE) {
        ctx.beginPath();
        for (let y = 0; y <= h; y += 4) {
          const dx = x - mx;
          const dy = y - my;
          const d = Math.sqrt(dx * dx + dy * dy);
          const falloff = Math.max(0, 1 - d / radius);
          const ease = falloff * falloff * falloff;
          const angle = Math.atan2(dy, dx);
          const pushX = Math.cos(angle) * ease * bulgeStrength;
          const drawX = x + pushX;
          if (y === 0) ctx.moveTo(drawX, y);
          else ctx.lineTo(drawX, y);
        }
        const colDist = Math.abs(x - mx);
        const colFalloff = Math.max(0, 1 - colDist / radius);
        const alpha = 0.018 + colFalloff * colFalloff * 0.18;
        ctx.strokeStyle = `rgba(${lineColor},${alpha})`;
        ctx.lineWidth = 0.5 + colFalloff * 0.5;
        ctx.stroke();
      }

      for (let y = 0; y <= h; y += GRID_SIZE) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const dx = x - mx;
          const dy = y - my;
          const d = Math.sqrt(dx * dx + dy * dy);
          const falloff = Math.max(0, 1 - d / radius);
          const ease = falloff * falloff * falloff;
          const angle = Math.atan2(dy, dx);
          const pushY = Math.sin(angle) * ease * bulgeStrength;
          const drawY = y + pushY;
          if (x === 0) ctx.moveTo(x, drawY);
          else ctx.lineTo(x, drawY);
        }
        const rowDist = Math.abs(y - my);
        const rowFalloff = Math.max(0, 1 - rowDist / radius);
        const alpha = 0.018 + rowFalloff * rowFalloff * 0.18;
        ctx.strokeStyle = `rgba(${lineColor},${alpha})`;
        ctx.lineWidth = 0.5 + rowFalloff * 0.5;
        ctx.stroke();
      }

      for (let x = 0; x <= w; x += GRID_SIZE) {
        for (let y = 0; y <= h; y += GRID_SIZE) {
          const dx = x - mx;
          const dy = y - my;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < radius) {
            const falloff = 1 - d / radius;
            const ease = falloff * falloff * falloff;
            const angle = Math.atan2(dy, dx);
            const bx = x + Math.cos(angle) * ease * bulgeStrength;
            const by = y + Math.sin(angle) * ease * bulgeStrength;
            const dotAlpha = ease * 0.5;
            const dotSize = 0.8 + ease * 2;
            ctx.beginPath();
            ctx.arc(bx, by, dotSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${lineColor},${dotAlpha})`;
            ctx.fill();
          }
        }
      }

      const grad = ctx.createRadialGradient(mx, my, 0, mx, my, radius * 1.2);
      grad.addColorStop(0, `rgba(${lineColor},0.03)`);
      grad.addColorStop(0.5, `rgba(${lineColor},0.01)`);
      grad.addColorStop(1, `rgba(${lineColor},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const onMove = (e: MouseEvent) => {
      const rect = section.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    section.addEventListener("mousemove", onMove);
    section.addEventListener("mouseleave", onLeave);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      section.removeEventListener("mousemove", onMove);
      section.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  useEffect(() => {
    const loadGsap = async () => {
      const { gsap } = await import("gsap");
      const el = sectionRef.current;
      if (!el) return;

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(el.querySelector(".hero-badge"), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 })
        .fromTo(el.querySelector(".hero-title"), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, "-=0.3")
        .fromTo(el.querySelector(".hero-sub"), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, "-=0.3")
        .fromTo(el.querySelector(".hero-buttons"), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, "-=0.2");
    };
    loadGsap();
  }, []);

  return (
    <section ref={sectionRef} id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-16">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
        <div className="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full glow-border surface-elevated text-sm text-muted-foreground mb-8">
          <Zap size={14} className="text-primary" />
          <span>The Future of Prop Trading</span>
        </div>

        <h1 className="hero-title font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6">
          Get Funded.{" "}
          <span className="text-gradient">Trade Big.</span>
          <br />
          Keep the Profits.
        </h1>

        <p className="hero-sub text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Prove your trading skills and access accounts up to $100K. No risk on your capital — all the upside is yours.
        </p>

        <div className="hero-buttons flex flex-col sm:flex-row items-center justify-center gap-4">
          <MagneticButton>
            <Button size="lg" className="rounded-xl text-sm sm:text-base px-6 sm:px-8 py-5 sm:py-6 glow-box">
              Start Challenge <ArrowRight size={18} className="ml-2" />
            </Button>
          </MagneticButton>
          <MagneticButton>
            <Button variant="outline" size="lg" className="rounded-xl text-base px-8 py-6">
              View Rules
            </Button>
          </MagneticButton>
        </div>

        <LiveTicker />
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-foreground/[0.06] animate-particle-float"
            style={{
              left: `${Math.random() * 100}%`,
              bottom: `-5%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${6 + Math.random() * 8}s`,
            }}
          />
        ))}
      </div>
    </section>
  );
};

export default Hero;
