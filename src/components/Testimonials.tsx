import { useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Quote, Star, ChevronLeft, ChevronRight } from "lucide-react";

const testimonials = [
  {
    name: "Marcus Chen",
    role: "Forex Trader",
    location: "Singapore",
    avatar: "MC",
    rating: 5,
    text: "Funding Pulze changed everything. I went from demo trading to managing a $50K funded account in under three weeks. The evaluation was tough but fair — exactly what a serious trader needs.",
    profit: "$12,400",
    funded: "$50,000",
  },
  {
    name: "Sarah Williams",
    role: "Swing Trader",
    location: "London, UK",
    avatar: "SW",
    rating: 5,
    text: "The payout process is genuinely fast. I requested my first withdrawal on a Monday and had it in my account by Wednesday. No hoops, no delays. This is how prop firms should operate.",
    profit: "$8,750",
    funded: "$25,000",
  },
  {
    name: "Ahmed Al-Rashid",
    role: "Day Trader",
    location: "Dubai, UAE",
    avatar: "AR",
    rating: 5,
    text: "I've tried four other prop firms before finding Funding Pulze. The difference is night and day — transparent rules, real spreads, and a support team that actually understands trading.",
    profit: "$21,300",
    funded: "$100,000",
  },
  {
    name: "Elena Petrova",
    role: "Scalper",
    location: "Berlin, Germany",
    avatar: "EP",
    rating: 5,
    text: "As a scalper, execution speed matters more than anything. Funding Pulze delivers institutional-grade fills with no slippage games. Finally a firm that respects how I trade.",
    profit: "$6,200",
    funded: "$25,000",
  },
  {
    name: "David Okonkwo",
    role: "Position Trader",
    location: "Lagos, Nigeria",
    avatar: "DO",
    rating: 5,
    text: "From Africa to funded — Funding Pulze gave me an opportunity I couldn't find locally. The 90% profit split is real, and the community support helped me refine my edge.",
    profit: "$15,800",
    funded: "$50,000",
  },
  {
    name: "James Park",
    role: "Algo Trader",
    location: "Seoul, South Korea",
    avatar: "JP",
    rating: 5,
    text: "They actually allow EAs and algorithmic strategies. Most firms say they do but then restrict you. Funding Pulze is built for modern traders who take this seriously.",
    profit: "$9,600",
    funded: "$50,000",
  },
];

const TestimonialCard = ({
  t,
  isActive,
  onClick,
}: {
  t: (typeof testimonials)[0];
  isActive: boolean;
  onClick: () => void;
}) => (
  <motion.button
    layout
    onClick={onClick}
    className={`text-left w-full rounded-2xl border p-6 transition-all duration-500 relative overflow-hidden group ${
      isActive
        ? "border-foreground/15 bg-card/80 backdrop-blur-md shadow-xl shadow-foreground/[0.04] scale-[1.01]"
        : "border-border/30 bg-card/30 backdrop-blur-sm hover:border-border/50 hover:bg-card/50"
    }`}
    whileHover={{ y: -2 }}
    transition={{ type: "spring", stiffness: 400, damping: 30 }}
  >
    {/* Subtle glow on active */}
    {isActive && (
      <motion.div
        layoutId="testimonial-glow"
        className="absolute -inset-px rounded-2xl border border-foreground/10 pointer-events-none"
        transition={{ type: "spring", stiffness: 200, damping: 30 }}
      />
    )}

    {/* Quote icon */}
    <div className="mb-4">
      <Quote
        size={20}
        className={`transition-colors duration-300 ${
          isActive ? "text-foreground/30" : "text-foreground/10"
        }`}
      />
    </div>

    {/* Text */}
    <p
      className={`text-sm leading-relaxed mb-5 transition-colors duration-300 ${
        isActive ? "text-foreground/90" : "text-muted-foreground"
      }`}
    >
      "{t.text}"
    </p>

    {/* Rating */}
    <div className="flex gap-0.5 mb-4">
      {Array.from({ length: t.rating }).map((_, i) => (
        <Star
          key={i}
          size={12}
          className={`fill-current transition-colors duration-300 ${
            isActive ? "text-foreground/50" : "text-foreground/20"
          }`}
        />
      ))}
    </div>

    {/* Author */}
    <div className="flex items-center gap-3">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300 ${
          isActive
            ? "bg-foreground text-background"
            : "bg-foreground/[0.06] text-muted-foreground"
        }`}
      >
        {t.avatar}
      </div>
      <div>
        <p
          className={`text-xs font-semibold transition-colors duration-300 ${
            isActive ? "text-foreground" : "text-foreground/70"
          }`}
        >
          {t.name}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {t.role} · {t.location}
        </p>
      </div>
    </div>

    {/* Stats strip */}
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: "auto", marginTop: 16 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="flex gap-4 pt-4 border-t border-border/30">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
                Funded
              </p>
              <p className="text-sm font-display font-bold">{t.funded}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
                Profit
              </p>
              <p className="text-sm font-display font-bold text-foreground/80">
                {t.profit}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Corner accents on hover */}
    <div className="absolute top-2.5 right-2.5 w-5 h-5 border-t border-r border-foreground/[0.05] rounded-tr-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="absolute bottom-2.5 left-2.5 w-5 h-5 border-b border-l border-foreground/[0.05] rounded-bl-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
  </motion.button>
);

const Testimonials = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [active, setActive] = useState(0);
  const [page, setPage] = useState(0);
  const perPage = 3;
  const totalPages = Math.ceil(testimonials.length / perPage);

  const visible = testimonials.slice(page * perPage, page * perPage + perPage);

  const goNext = () => {
    setPage((p) => (p + 1) % totalPages);
    setActive(0);
  };
  const goPrev = () => {
    setPage((p) => (p - 1 + totalPages) % totalPages);
    setActive(0);
  };

  return (
    <section className="py-28 px-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full bg-foreground/[0.015] blur-[140px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative" ref={ref}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row md:items-end md:justify-between mb-14 gap-6"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-foreground/[0.05] border border-border/50 text-xs font-medium text-muted-foreground mb-5">
              <Star size={13} />
              Trader Stories
            </div>
            <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
              Real Results.{" "}
              <span className="text-muted-foreground/60">Real Traders.</span>
            </h2>
            <p className="mt-3 text-muted-foreground text-sm md:text-base max-w-md">
              Don't take our word for it — hear from traders who turned their
              skills into funded success.
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-muted-foreground font-mono mr-2">
              {String(page + 1).padStart(2, "0")} /{" "}
              {String(totalPages).padStart(2, "0")}
            </span>
            <button
              onClick={goPrev}
              className="w-10 h-10 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goNext}
              className="w-10 h-10 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </motion.div>

        {/* Cards grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.4, ease: [0.21, 0.68, 0.35, 1] }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5"
          >
            {visible.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <TestimonialCard
                  t={t}
                  isActive={active === i}
                  onClick={() => setActive(i)}
                />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default Testimonials;
