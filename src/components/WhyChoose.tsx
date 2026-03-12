import { useEffect, useRef } from "react";
import { Zap, Headphones, Banknote, ShieldCheck } from "lucide-react";
import whyChooseBanner from "@/assets/why-choose-banner.jpg";

const features = [
  { icon: Zap, title: "Tight Spreads", desc: "Raw institutional spreads from 0.0 pips" },
  { icon: Headphones, title: "Fast Support", desc: "24/7 responsive support when you need it" },
  { icon: Banknote, title: "Fast Payouts", desc: "Get paid within 24 hours of request" },
  { icon: ShieldCheck, title: "No Payout Denial", desc: "Every valid payout request is honored" },
];

const WhyChoose = () => {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const loadGsap = async () => {
      const { gsap } = await import("gsap");
      const el = sectionRef.current;
      if (!el) return;

      gsap.fromTo(el.querySelector(".wc-header"), { y: 30, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.6,
      });
      gsap.fromTo(el.querySelectorAll(".wc-card"), { y: 40, opacity: 0, scale: 0.95 }, {
        y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.12, ease: "power3.out",
      });
    };
    loadGsap();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="wc-header font-display text-3xl sm:text-4xl font-bold text-center mb-12">
          Why Choose <span className="text-gradient">Funding Pulze</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="wc-card group relative rounded-2xl p-6 text-center cursor-default transition-all duration-500 hover:scale-[1.04] hover:-translate-y-1"
              style={{
                background: "hsl(var(--surface-elevated) / 0.35)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid hsl(var(--glow-primary) / 0.12)",
                boxShadow: "0 8px 32px hsl(var(--glow-primary) / 0.06)",
              }}
            >
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: "radial-gradient(circle at 50% 0%, hsl(var(--glow-primary) / 0.12) 0%, transparent 70%)",
                }}
              />

              <div className="relative z-10">
                <div
                  className="mx-auto mb-4 w-12 h-12 rounded-xl flex items-center justify-center transition-shadow duration-500 group-hover:shadow-[0_0_24px_hsl(var(--glow-primary)/0.3)]"
                  style={{ background: "hsl(var(--glow-primary) / 0.1)" }}
                >
                  <Icon size={22} className="text-primary" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-1.5">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChoose;