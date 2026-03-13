import { useRef, useCallback, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight, Users, MessageCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

const CELL = 32;
const RADIUS = 160;

const Community = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const smoothRef = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef(0);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const [hovered, setHovered] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    smoothRef.current.x += (mouseRef.current.x - smoothRef.current.x) * 0.07;
    smoothRef.current.y += (mouseRef.current.y - smoothRef.current.y) * 0.07;

    const rect = section.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    ctx.clearRect(0, 0, w, h);

    const isDark = document.documentElement.classList.contains("dark");
    const dotColor = isDark ? "255,255,255" : "0,0,0";
    const mx = smoothRef.current.x;
    const my = smoothRef.current.y;

    // Draw dot grid with proximity ripple
    for (let x = CELL; x < w; x += CELL) {
      for (let y = CELL; y < h; y += CELL) {
        const dx = x - mx;
        const dy = y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        const falloff = Math.max(0, 1 - d / RADIUS);
        const ease = falloff * falloff;

        // Repel dots away from cursor
        const angle = Math.atan2(dy, dx);
        const push = ease * 8;
        const px = x + Math.cos(angle) * push;
        const py = y + Math.sin(angle) * push;

        const baseAlpha = 0.04;
        const alpha = baseAlpha + ease * 0.35;
        const size = 1 + ease * 2.5;

        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${dotColor},${alpha})`;
        ctx.fill();

        // Connection lines between nearby active dots
        if (ease > 0.15) {
          // Connect to right neighbor
          const nx = x + CELL;
          const ndx = nx - mx;
          const nd = Math.sqrt(ndx * ndx + dy * dy);
          const nf = Math.max(0, 1 - nd / RADIUS);
          if (nf > 0.15 && nx < w) {
            const ne = nf * nf;
            const npx = nx + Math.cos(Math.atan2(dy, ndx)) * ne * 8;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(npx, py + Math.sin(Math.atan2(dy, ndx)) * ne * 8);
            ctx.strokeStyle = `rgba(${dotColor},${Math.min(ease, ne) * 0.2})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
          // Connect to bottom neighbor
          const ny = y + CELL;
          const ndy = ny - my;
          const nd2 = Math.sqrt(dx * dx + ndy * ndy);
          const nf2 = Math.max(0, 1 - nd2 / RADIUS);
          if (nf2 > 0.15 && ny < h) {
            const ne2 = nf2 * nf2;
            const npy = ny + Math.sin(Math.atan2(ndy, dx)) * ne2 * 8;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(Math.atan2(ndy, dx)) * ne2 * 8, npy);
            ctx.strokeStyle = `rgba(${dotColor},${Math.min(ease, ne2) * 0.2})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    // Soft glow at cursor
    if (mx > -500) {
      const grad = ctx.createRadialGradient(mx, my, 0, mx, my, RADIUS);
      grad.addColorStop(0, `rgba(${dotColor},0.025)`);
      grad.addColorStop(1, `rgba(${dotColor},0)`);
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

  const stats = [
    { icon: Users, label: "Active Traders", value: "12,000+" },
    { icon: MessageCircle, label: "Daily Messages", value: "5,000+" },
    { icon: Globe, label: "Countries", value: "85+" },
  ];

  return (
    <section
      ref={sectionRef}
      className="relative py-16 sm:py-32 overflow-hidden"
    >
      {/* Interactive dot-grid canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="inline-block text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground mb-4">
            Community
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-6xl font-bold leading-tight mb-5">
            Trade Together.{" "}
            <span className="text-gradient">Grow Together.</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Join thousands of funded traders sharing strategies, insights, and wins in our thriving Discord community.
          </p>
        </motion.div>

        {/* Stats row */}
        <motion.div
          className="grid grid-cols-3 gap-4 sm:gap-8 mb-14 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <s.icon size={20} className="mx-auto mb-2 text-muted-foreground/60" />
              <p className="font-display text-2xl sm:text-3xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* CTA card */}
        <motion.div
          className="relative max-w-xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="relative glass-card p-8 sm:p-10 text-center group cursor-pointer"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {/* Animated border glow on hover */}
            <div
              className="absolute -inset-px rounded-xl transition-opacity duration-500"
              style={{
                opacity: hovered ? 1 : 0,
                background: `linear-gradient(135deg, hsl(var(--glow-primary) / 0.15), transparent 50%, hsl(var(--glow-primary) / 0.1))`,
              }}
            />

            <div className="relative z-10">
              {/* Discord icon */}
              <motion.div
                className="w-14 h-14 rounded-2xl surface-elevated glow-border flex items-center justify-center mx-auto mb-6"
                animate={hovered ? { scale: 1.08, rotate: -3 } : { scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <svg viewBox="0 0 24 24" className="w-7 h-7 text-foreground" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
              </motion.div>

              <h3 className="font-display text-xl sm:text-2xl font-bold mb-3">
                Join Our Discord
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-7 max-w-sm mx-auto">
                Real-time trade alerts, mentorship channels, and a network of consistently profitable traders.
              </p>

              <motion.div
                animate={hovered ? { y: -2 } : { y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Button
                  size="lg"
                  className="rounded-xl text-base px-8 py-6 glow-box"
                  asChild
                >
                  <a
                    href="https://discord.gg/lovable-dev"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Join Community
                    <ArrowRight size={18} className="ml-2" />
                  </a>
                </Button>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Community;
