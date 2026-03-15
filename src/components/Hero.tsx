import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";
import LiveTicker from "@/components/LiveTicker";
import heroBg from "@/assets/hero-bg.png";

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

const Hero = () => {
  const sectionRef = useRef<HTMLElement>(null);

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
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <img src={heroBg} alt="" className="w-full h-full object-cover object-center" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <div className="relative z-10 text-center max-w-4xl mx-auto px-6 drop-shadow-lg">
        <div className="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full glow-border surface-elevated text-sm text-muted-foreground mb-8">
          <Zap size={14} className="text-primary" />
          <span>#1 TOP TRADING FIRM</span>
        </div>

        <h1 className="hero-title font-display text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight mb-6">
          Get Funded.{" "}
          <span className="text-gradient">Trade Big.</span>
          <br />
          Keep the Profits.
        </h1>

        <p className="hero-sub text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2">
          Prove your trading skills and access accounts up to $100K. No risk on your capital — all the upside is yours.
        </p>

        <div className="hero-buttons flex flex-col sm:flex-row items-center justify-center gap-4">
          <MagneticButton>
            <Button size="lg" className="rounded-xl text-sm sm:text-base px-6 sm:px-8 py-5 sm:py-6 glow-box"
              onClick={() => document.getElementById("challenges")?.scrollIntoView({ behavior: "smooth" })}>
              Start Challenge <ArrowRight size={18} className="ml-2" />
            </Button>
          </MagneticButton>
          <MagneticButton>
            <Button variant="outline" size="lg" className="rounded-xl text-sm sm:text-base px-6 sm:px-8 py-5 sm:py-6"
              onClick={() => document.getElementById("challenges")?.scrollIntoView({ behavior: "smooth" })}>
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
