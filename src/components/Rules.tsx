import { useEffect, useRef, useState } from "react";

const rulesData = {
  one: [
    { label: "Profit Target", value: "8%" },
    { label: "Daily Drawdown", value: "4%" },
    { label: "Maximum Drawdown", value: "8%" },
    { label: "Minimum Trading Days", value: "5 Days" },
    { label: "Leverage", value: "1:100" },
    { label: "Trading Style", value: "All styles allowed" },
  ],
  two: [
    { label: "Phase 1 Profit Target", value: "8%" },
    { label: "Phase 2 Profit Target", value: "5%" },
    { label: "Daily Drawdown", value: "5%" },
    { label: "Maximum Drawdown", value: "10%" },
    { label: "Minimum Trading Days", value: "5 Days per phase" },
    { label: "Trading Style", value: "All styles allowed" },
  ],
};

const Rules = () => {
  const [activeTab, setActiveTab] = useState<"one" | "two">("one");
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const loadGsap = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      const el = sectionRef.current;
      if (!el) return;
      gsap.fromTo(el.querySelector(".section-header"), { y: 40, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.7, scrollTrigger: { trigger: el, start: "top 80%" },
      });
    };
    loadGsap();
  }, []);

  useEffect(() => {
    const animateContent = async () => {
      const { gsap } = await import("gsap");
      if (contentRef.current) {
        gsap.fromTo(
          contentRef.current.querySelectorAll(".rule-row"),
          { x: -20, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.4, stagger: 0.06, ease: "power2.out" }
        );
      }
    };
    animateContent();
  }, [activeTab]);

  const rules = rulesData[activeTab];

  return (
    <section ref={sectionRef} id="rules" className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="section-header text-center mb-12">
          <h2 className="font-display text-4xl sm:text-5xl font-bold mb-4">
            Challenge <span className="text-gradient">Rules</span>
          </h2>
          <p className="text-muted-foreground text-lg">Transparent rules. No hidden conditions.</p>
        </div>

        <div className="flex justify-center mb-10">
          <div className="inline-flex surface-elevated rounded-xl p-1 glow-border">
            <button
              onClick={() => setActiveTab("one")}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeTab === "one" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              One Step
            </button>
            <button
              onClick={() => setActiveTab("two")}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeTab === "two" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Two Step
            </button>
          </div>
        </div>

        <div ref={contentRef} className="glass-card p-6 sm:p-8 space-y-0 divide-y divide-border">
          {rules.map((rule) => (
            <div key={rule.label} className="rule-row flex justify-between items-center py-4">
              <span className="text-muted-foreground text-sm">{rule.label}</span>
              <span className="font-semibold text-foreground text-sm">{rule.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Rules;
