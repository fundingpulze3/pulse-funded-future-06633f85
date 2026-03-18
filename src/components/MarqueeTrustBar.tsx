const PHRASES = [
  "Upto 90% Profit Split",
  "Instant Payout",
  "Your Skills Our Capital",
  "Made by Mentors, for Traders",
  "Scale Upto $1M",
  "No Consistency Rules",
  "Backed by Mentors",
  "Risk Free Reward Full",
  "24/7 Support",
  "Trusted Globally",
  "Trade with Freedom",
  "Prove It Once, Trade Forever",
  "Stop Trading Small, Start Trading Funded",
];

const PhraseItem = ({ text }: { text: string }) => (
  <div className="flex items-center gap-3 px-8 py-3 text-muted-foreground/60 text-sm font-medium tracking-widest uppercase whitespace-nowrap select-none">
    <span className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
    {text}
  </div>
);

const MarqueeTrustBar = () => {
  const doubled = [...PHRASES, ...PHRASES];

  return (
    <section className="relative py-8 overflow-hidden border-y border-border/30">
      <p className="text-center text-xs uppercase tracking-[0.3em] text-primary/60 mb-6 font-semibold">
        Best in the Business
      </p>

      {/* Row 1 — scroll left */}
      <div className="marquee-container mb-3">
        <div className="marquee-track animate-marquee-left">
          {doubled.map((text, i) => (
            <PhraseItem key={`r1-${i}`} text={text} />
          ))}
        </div>
      </div>

      {/* Row 2 — scroll right */}
      <div className="marquee-container">
        <div className="marquee-track animate-marquee-right">
          {[...doubled].reverse().map((text, i) => (
            <PhraseItem key={`r2-${i}`} text={text} />
          ))}
        </div>
      </div>

      {/* Fade edges */}
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
    </section>
  );
};

export default MarqueeTrustBar;
