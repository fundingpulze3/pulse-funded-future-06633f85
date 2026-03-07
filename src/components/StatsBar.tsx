import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const stats = [
  { label: "Funded Traders", value: 2800, prefix: "", suffix: "+" },
  { label: "Total Payouts", value: 4.2, prefix: "$", suffix: "M+", decimals: 1 },
  { label: "Countries", value: 85, prefix: "", suffix: "+" },
  { label: "Profit Split", value: 90, prefix: "", suffix: "%" },
];

const CountUp = ({
  target,
  decimals = 0,
  prefix = "",
  suffix = "",
  trigger,
}: {
  target: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  trigger: boolean;
}) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    let start = 0;
    const duration = 2000;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      start = eased * target;
      setCurrent(start);
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [trigger, target]);

  return (
    <span className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
      {prefix}
      {current.toFixed(decimals)}
      {suffix}
    </span>
  );
};

const StatsBar = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="relative py-16 px-6">
      <div
        ref={ref}
        className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4"
      >
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="text-center"
          >
            <CountUp
              target={stat.value}
              decimals={stat.decimals ?? 0}
              prefix={stat.prefix}
              suffix={stat.suffix}
              trigger={inView}
            />
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground tracking-wide uppercase">
              {stat.label}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Bottom separator */}
      <div className="max-w-5xl mx-auto mt-16">
        <div className="h-px bg-border/60" />
      </div>
    </section>
  );
};

export default StatsBar;
