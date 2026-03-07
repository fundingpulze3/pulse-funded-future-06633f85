import { useRef, useCallback, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoCircle from "@/assets/logo-circle.png";

const GlobeCTA = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const timeRef = useRef(0);
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const parent = canvas.parentElement!;
    const w = parent.clientWidth;
    const h = parent.clientHeight;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    ctx.clearRect(0, 0, w, h);
    timeRef.current += 0.003;
    const t = timeRef.current;

    const isDark = document.documentElement.classList.contains("dark");
    const lineColor = isDark ? "255,255,255" : "0,0,0";

    const cx = w / 2;
    const cy = h; // globe center at bottom
    const r = Math.min(w * 0.42, 320);

    // Draw latitude arcs (horizontal curves on sphere)
    const latCount = 10;
    for (let i = 1; i < latCount; i++) {
      const lat = (i / latCount) * Math.PI * 0.5; // 0 to 90 degrees (top hemisphere)
      const ry = r * Math.cos(lat); // y-radius of this latitude ring
      const yOff = r * Math.sin(lat); // how far up from center
      const alpha = 0.04 + (i / latCount) * 0.08;

      ctx.beginPath();
      ctx.ellipse(cx, cy - yOff, ry, ry * 0.15, 0, Math.PI, 2 * Math.PI);
      ctx.strokeStyle = `rgba(${lineColor},${alpha})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // Draw longitude arcs (vertical curves rotating)
    const lonCount = 14;
    for (let i = 0; i < lonCount; i++) {
      const lon = (i / lonCount) * Math.PI + t; // rotate over time
      const alpha = 0.03 + Math.abs(Math.sin(lon)) * 0.08;

      ctx.beginPath();
      for (let j = 0; j <= 40; j++) {
        const lat = (j / 40) * Math.PI * 0.5;
        const x = cx + r * Math.cos(lat) * Math.cos(lon);
        const y = cy - r * Math.sin(lat);
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${lineColor},${alpha})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Dots at intersections
    for (let i = 1; i < latCount; i++) {
      const lat = (i / latCount) * Math.PI * 0.5;
      for (let j = 0; j < lonCount; j++) {
        const lon = (j / lonCount) * Math.PI + t;
        const x = cx + r * Math.cos(lat) * Math.cos(lon);
        const y = cy - r * Math.sin(lat);

        // Only draw dots on the "front" side
        if (Math.cos(lon) > -0.2) {
          const depth = (Math.cos(lon) + 0.2) / 1.2;
          const dotAlpha = depth * 0.25;
          const dotSize = 0.8 + depth * 1.2;

          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${lineColor},${dotAlpha})`;
          ctx.fill();
        }
      }
    }

    // Ambient glow at globe top
    const grad = ctx.createRadialGradient(cx, cy - r * 0.6, 0, cx, cy - r * 0.6, r * 0.8);
    grad.addColorStop(0, `rgba(${lineColor},0.03)`);
    grad.addColorStop(0.5, `rgba(${lineColor},0.01)`);
    grad.addColorStop(1, `rgba(${lineColor},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Horizon glow line
    const horizGrad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    horizGrad.addColorStop(0, `rgba(${lineColor},0)`);
    horizGrad.addColorStop(0.3, `rgba(${lineColor},0.06)`);
    horizGrad.addColorStop(0.5, `rgba(${lineColor},0.1)`);
    horizGrad.addColorStop(0.7, `rgba(${lineColor},0.06)`);
    horizGrad.addColorStop(1, `rgba(${lineColor},0)`);
    ctx.fillStyle = horizGrad;
    ctx.fillRect(cx - r * 1.3, cy - 1, r * 2.6, 2);

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      {/* Content area */}
      <div className="relative z-10 text-center pt-24 sm:pt-32 pb-0">
        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-5 max-w-3xl mx-auto px-6">
            Ready to Get{" "}
            <span className="text-gradient">Funded?</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto px-6 leading-relaxed mb-10">
            Join traders across the globe and start your funded journey today. No risk on your capital.
          </p>
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 sm:mb-20 px-6"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <Button size="lg" className="rounded-xl text-base px-8 py-6 glow-box" asChild>
            <a href="#shop">
              Start Challenge <ArrowRight size={18} className="ml-2" />
            </a>
          </Button>
          <Button variant="outline" size="lg" className="rounded-xl text-base px-8 py-6" asChild>
            <a href="/faq">Learn More</a>
          </Button>
        </motion.div>
      </div>

      {/* Globe + Logo horizon area */}
      <div className="relative w-full h-[340px] sm:h-[420px]">
        {/* Globe canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
        />

        {/* Horizon glow — layered radial glows at the globe's equator line */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[200px] pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 70% 50% at 50% 100%, hsl(var(--glow-primary) / 0.07), transparent)`,
          }}
        />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl h-[120px] pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 60% 60% at 50% 100%, hsl(var(--glow-primary) / 0.05), transparent)`,
          }}
        />
        {/* Sharp horizon line */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-3/4 max-w-2xl pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, hsl(var(--glow-primary) / 0.2), hsl(var(--glow-primary) / 0.35), hsl(var(--glow-primary) / 0.2), transparent)`,
          }}
        />

        {/* Logo rising from horizon */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 z-20"
          style={{ bottom: -2 }}
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative">
            {/* Glow behind logo */}
            <div
              className="absolute -inset-8 sm:-inset-12 rounded-full animate-pulse-glow pointer-events-none"
              style={{
                background: `radial-gradient(circle, hsl(var(--glow-primary) / 0.12), hsl(var(--glow-primary) / 0.04) 40%, transparent 70%)`,
              }}
            />
            {/* Secondary soft ring */}
            <div
              className="absolute -inset-4 sm:-inset-6 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle, hsl(var(--glow-primary) / 0.06), transparent 60%)`,
              }}
            />
            {/* Logo container — bottom half clipped to simulate rising */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20">
              {/* The logo itself, translated up so bottom half sits at horizon */}
              <div
                className="w-full h-full rounded-full overflow-hidden"
                style={{
                  boxShadow: `0 0 30px hsl(var(--glow-primary) / 0.1), 0 0 60px hsl(var(--glow-primary) / 0.05)`,
                }}
              >
                <img
                  src={logoCircle}
                  alt="Funding Pulze"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Fade-to-background at very bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-12"
          style={{
            background: `linear-gradient(to top, hsl(var(--background)), transparent)`,
          }}
        />
      </div>
    </section>
  );
};

export default GlobeCTA;
