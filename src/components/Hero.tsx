import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";

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
        .fromTo(el.querySelector(".hero-buttons"), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, "-=0.2")
        .fromTo(el.querySelector(".hero-glow"), { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.2 }, "-=0.8");
    };
    loadGsap();
  }, []);

  return (
    <section ref={sectionRef} id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-16">
      {/* Glow effect */}
      <div className="hero-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-0" 
           style={{ background: "radial-gradient(circle, hsl(var(--glow-primary) / 0.15) 0%, transparent 70%)" }} />
      
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
