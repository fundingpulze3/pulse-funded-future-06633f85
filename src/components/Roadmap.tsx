import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ShoppingCart, Target, TrendingUp, Wallet } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: ShoppingCart,
    title: "Choose Your Challenge",
    description:
      "Select an account size that matches your trading ambitions. Pick from our range of evaluation programs designed for every level.",
    accent: "Purchase",
  },
  {
    number: "02",
    icon: Target,
    title: "Prove Your Skill",
    description:
      "Trade within our defined risk parameters and hit your profit target. Show consistency, discipline, and real edge in the markets.",
    accent: "Evaluate",
  },
  {
    number: "03",
    icon: TrendingUp,
    title: "Get Funded",
    description:
      "Pass the evaluation and receive your funded account. Trade with our capital — no personal risk, full upside potential.",
    accent: "Fund",
  },
  {
    number: "04",
    icon: Wallet,
    title: "Earn & Withdraw",
    description:
      "Keep up to 90% of the profits you generate. Request payouts on a regular schedule with fast, hassle-free processing.",
    accent: "Profit",
  },
];

const Roadmap = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  return (
    <section className="py-28 px-6 relative overflow-hidden">
      {/* Ambient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-foreground/[0.015] blur-[150px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative" ref={containerRef}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-foreground/[0.05] border border-border/50 text-xs font-medium text-muted-foreground mb-5">
            <TrendingUp size={13} />
            Your Journey
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            From Trader to{" "}
            <span className="relative">
              Funded
              <motion.span
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
                className="absolute -bottom-1 left-0 right-0 h-[3px] bg-highlight origin-left rounded-full"
              />
            </span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto text-sm md:text-base">
            Four simple steps between you and a fully funded trading account.
            No shortcuts — just skill, discipline, and profit.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical connector line — desktop only */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2">
            <motion.div
              initial={{ scaleY: 0 }}
              animate={isInView ? { scaleY: 1 } : {}}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              className="w-full h-full bg-gradient-to-b from-border via-foreground/15 to-border origin-top"
            />
          </div>

          <div className="flex flex-col gap-6 lg:gap-0">
            {steps.map((step, i) => {
              const isLeft = i % 2 === 0;

              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 40, x: isLeft ? -30 : 30 }}
                  whileInView={{ opacity: 1, y: 0, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{
                    duration: 0.7,
                    delay: i * 0.12,
                    ease: [0.21, 0.68, 0.35, 1],
                  }}
                  className={`relative lg:grid lg:grid-cols-2 lg:gap-16 items-center ${
                    i !== steps.length - 1 ? "lg:pb-20" : ""
                  }`}
                >
                  {/* Node dot on timeline — desktop */}
                  <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <motion.div
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.12, type: "spring", stiffness: 300, damping: 20 }}
                      className="relative"
                    >
                      <div className="w-12 h-12 rounded-full bg-background border-2 border-foreground/15 flex items-center justify-center shadow-lg">
                        <span className="text-xs font-display font-bold text-foreground">
                          {step.number}
                        </span>
                      </div>
                      {/* Pulse ring */}
                      <div className="absolute inset-0 rounded-full border border-foreground/10 animate-pulse-glow" />
                    </motion.div>
                  </div>

                  {/* Card */}
                  <div
                    className={`${
                      isLeft ? "lg:col-start-1 lg:pr-8" : "lg:col-start-2 lg:pl-8"
                    } ${!isLeft ? "lg:col-start-2" : ""}`}
                  >
                    <div className="group relative rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-7 transition-all duration-500 hover:border-foreground/15 hover:shadow-lg hover:shadow-foreground/[0.03]">
                      {/* Mobile step number */}
                      <div className="lg:hidden flex items-center gap-3 mb-4">
                        <div className="w-9 h-9 rounded-full bg-foreground/[0.06] border border-border/50 flex items-center justify-center">
                          <span className="text-[11px] font-display font-bold text-foreground">
                            {step.number}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
                          Step {step.number}
                        </span>
                      </div>

                      {/* Accent tag */}
                      <span className="inline-block text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-3">
                        {step.accent}
                      </span>

                      {/* Icon + Title */}
                      <div className="flex items-start gap-4 mb-3">
                        <div className="shrink-0 w-10 h-10 rounded-xl bg-foreground/[0.04] border border-border/30 flex items-center justify-center transition-colors duration-300 group-hover:bg-foreground/[0.07]">
                          <step.icon
                            size={18}
                            strokeWidth={1.5}
                            className="text-foreground/70 transition-colors group-hover:text-foreground"
                          />
                        </div>
                        <h3 className="font-display text-lg md:text-xl font-bold leading-tight pt-1.5">
                          {step.title}
                        </h3>
                      </div>

                      <p className="text-sm text-muted-foreground leading-relaxed pl-14">
                        {step.description}
                      </p>

                      {/* Subtle corner decoration */}
                      <div className="absolute top-3 right-3 w-6 h-6 border-t border-r border-foreground/[0.06] rounded-tr-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="absolute bottom-3 left-3 w-6 h-6 border-b border-l border-foreground/[0.06] rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </div>
                  </div>

                  {/* Empty column for alternating layout — desktop */}
                  {isLeft && <div className="hidden lg:block" />}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Roadmap;
