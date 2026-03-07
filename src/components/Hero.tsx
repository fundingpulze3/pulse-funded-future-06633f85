import { useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";

const GRID_SIZE = 48;

const Hero = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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

    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;
    const radius = 220;
    const isDark = document.documentElement.classList.contains("dark");
    const lineColor = isDark ? "255,255,255" : "0,0,0";

    // Draw grid lines
    for (let x = 0; x <= w; x += GRID_SIZE) {
      const dist = Math.abs(x - mx);
      const yDist = Math.min(Math.abs(my), Math.abs(my - h));
      const closeness = Math.max(0, 1 - Math.sqrt(dist * dist + yDist * yDist * 0.1) / radius);
      const alpha = 0.03 + closeness * 0.12;

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.strokeStyle = `rgba(${lineColor},${alpha})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    for (let y = 0; y <= h; y += GRID_SIZE) {
      const dist = Math.abs(y - my);
      const xDist = Math.min(Math.abs(mx), Math.abs(mx - w));
      const closeness = Math.max(0, 1 - Math.sqrt(dist * dist + xDist * xDist * 0.1) / radius);
      const alpha = 0.03 + closeness * 0.12;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.strokeStyle = `rgba(${lineColor},${alpha})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Draw intersection dots near cursor
    for (let x = 0; x <= w; x += GRID_SIZE) {
      for (let y = 0; y <= h; y += GRID_SIZE) {
        const dx = x - mx;
        const dy = y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < radius) {
          const intensity = 1 - d / radius;
          const dotAlpha = intensity * 0.35;
          const dotSize = 1 + intensity * 1.5;
          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${lineColor},${dotAlpha})`;
          ctx.fill();
        }
      }
    }

    // Radial glow around cursor
    if (mx > -500) {
      const grad = ctx.createRadialGradient(mx, my, 0, mx, my, radius);
      grad.addColorStop(0, `rgba(${lineColor},0.04)`);
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
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      const el = sectionRef.current;
      if (!el) return;

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
      });
      tl.fromTo(el.querySelector(".hero-badge"), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 })
        .fromTo(el.querySelector(".hero-title"), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, "-=0.3")
        .fromTo(el.querySelector(".hero-sub"), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, "-=0.3")
        .fromTo(el.querySelector(".hero-buttons"), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, "-=0.2");
    };
    loadGsap();
  }, []);

  return (
    <section ref={sectionRef} id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-16">
      {/* Interactive grid canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
        <div className="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full glow-border surface-elevated text-sm text-muted-foreground mb-8 opacity-0">
          <Zap size={14} className="text-primary" />
          <span>The Future of Prop Trading</span>
        </div>

        <h1 className="hero-title font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6 opacity-0">
          Get Funded.{" "}
          <span className="text-gradient">Trade Big.</span>
          <br />
          Keep the Profits.
        </h1>

        <p className="hero-sub text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed opacity-0">
          Prove your trading skills and access accounts up to $100K. No risk on your capital — all the upside is yours.
        </p>

        <div className="hero-buttons flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0">
          <Button size="lg" className="rounded-xl text-base px-8 py-6 glow-box">
            Start Challenge <ArrowRight size={18} className="ml-2" />
          </Button>
          <Button variant="outline" size="lg" className="rounded-xl text-base px-8 py-6">
            View Rules
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Hero;
