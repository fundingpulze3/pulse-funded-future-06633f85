import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const challenges = [
  { size: "$5K", price: "$49", target: "8%", drawdown: "5%", popular: false },
  { size: "$10K", price: "$89", target: "8%", drawdown: "5%", popular: false },
  { size: "$25K", price: "$179", target: "8%", drawdown: "5%", popular: true },
  { size: "$50K", price: "$299", target: "8%", drawdown: "5%", popular: false },
  { size: "$100K", price: "$499", target: "8%", drawdown: "5%", popular: false },
];

const Challenges = () => {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const loadGsap = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const el = sectionRef.current;
      if (!el) return;

      gsap.fromTo(
        el.querySelector(".section-header"),
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, scrollTrigger: { trigger: el, start: "top 80%" } }
      );

      gsap.fromTo(
        el.querySelectorAll(".challenge-card"),
        { y: 60, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, scrollTrigger: { trigger: el, start: "top 70%" } }
      );
    };
    loadGsap();
  }, []);

  return (
    <section ref={sectionRef} id="challenges" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="section-header text-center mb-16">
          <h2 className="font-display text-4xl sm:text-5xl font-bold mb-4">
            Choose Your <span className="text-gradient">Challenge</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Select an account size and prove your skills. Pass the challenge and trade with our capital.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {challenges.map((c) => (
            <div
              key={c.size}
              className={`challenge-card glass-card p-6 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1 ${
                c.popular ? "glow-box glow-border" : ""
              }`}
            >
              {c.popular && (
                <span className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Most Popular</span>
              )}
              <h3 className="font-display text-3xl font-bold text-foreground mb-1">{c.size}</h3>
              <p className="text-4xl font-bold text-gradient mb-6">{c.price}</p>

              <div className="w-full space-y-3 mb-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-primary shrink-0" />
                  <span>Profit Target: {c.target}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-primary shrink-0" />
                  <span>Max Drawdown: {c.drawdown}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-primary shrink-0" />
                  <span>Up to 90% Profit Split</span>
                </div>
              </div>

              <Button className="w-full rounded-xl" variant={c.popular ? "default" : "outline"}>
                Get Started
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Challenges;
