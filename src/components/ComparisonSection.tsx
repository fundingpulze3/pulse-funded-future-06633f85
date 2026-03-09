import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const METRICS = [
  { label: "Profit Split", ours: 90, theirs: 70, suffix: "%" },
  { label: "Payout Speed", ours: 95, theirs: 40, oursLabel: "24hrs", theirsLabel: "7-14 days" },
  { label: "Spreads", ours: 85, theirs: 45, oursLabel: "From 0.0", theirsLabel: "From 1.2" },
  { label: "Support Response", ours: 92, theirs: 30, oursLabel: "< 2hrs", theirsLabel: "24-48hrs" },
  { label: "Challenge Price", ours: 88, theirs: 50, oursLabel: "From $49", theirsLabel: "From $99+" },
];

const ComparisonSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-muted-foreground/60 mb-3 font-medium">
          Why Switch?
        </p>
        <h2 className="text-center font-display text-3xl sm:text-4xl font-bold mb-16">
          Funding Pulze vs <span className="text-muted-foreground/40">The Rest</span>
        </h2>

        <div className="space-y-8">
          {METRICS.map((m, i) => (
            <div key={m.label} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{m.label}</span>
                <div className="flex gap-6 text-xs">
                  <span className="text-muted-foreground/50">Others: {m.theirsLabel || `${m.theirs}%`}</span>
                  <span className="font-semibold text-foreground">Us: {m.oursLabel || `${m.ours}%`}</span>
                </div>
              </div>

              {/* Bar background */}
              <div className="relative h-2 rounded-full bg-muted/50 overflow-hidden">
                {/* Theirs */}
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/15"
                  initial={{ width: 0 }}
                  animate={inView ? { width: `${m.theirs}%` } : {}}
                  transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                />
                {/* Ours */}
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-foreground"
                  initial={{ width: 0 }}
                  animate={inView ? { width: `${m.ours}%` } : {}}
                  transition={{ duration: 1.2, delay: i * 0.1 + 0.2, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ComparisonSection;
