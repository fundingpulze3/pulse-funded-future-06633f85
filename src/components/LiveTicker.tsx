import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

const EVENTS = [
  { text: "John D. just got funded", amount: "$50,000", flag: "🇺🇸" },
  { text: "Payout of $8,200 sent to", name: "Sarah W.", flag: "🇬🇧" },
  { text: "Ahmed K. passed Phase 2", amount: "$25,000", flag: "🇦🇪" },
  { text: "New payout processed", amount: "$12,450", flag: "🇩🇪" },
  { text: "Maria L. just got funded", amount: "$100,000", flag: "🇪🇸" },
  { text: "Payout of $6,800 sent to", name: "Chen W.", flag: "🇸🇬" },
  { text: "David R. passed Phase 1", amount: "$50,000", flag: "🇨🇦" },
  { text: "New payout processed", amount: "$22,100", flag: "🇦🇺" },
];

const LiveTicker = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % EVENTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const event = EVENTS[index];

  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/40 glow-border text-sm text-muted-foreground mt-6 h-10 overflow-hidden">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="inline-flex items-center gap-1.5"
        >
          <span>{event.flag}</span>
          <span>{event.text}</span>
          {event.amount && <span className="font-semibold text-foreground">{event.amount}</span>}
          {event.name && <span className="font-semibold text-foreground">{event.name}</span>}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

export default LiveTicker;
