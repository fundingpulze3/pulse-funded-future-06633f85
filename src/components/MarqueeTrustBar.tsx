const LOGOS = [
  "MetaTrader 5", "cTrader", "TradingView", "Bloomberg", "Reuters",
  "CME Group", "IC Markets", "Pepperstone", "FXCM", "Oanda",
  "Saxo Bank", "IG Group", "Dukascopy", "Interactive Brokers",
];

const LogoItem = ({ name }: { name: string }) => (
  <div className="flex items-center gap-2 px-8 py-3 text-muted-foreground/50 text-sm font-medium tracking-widest uppercase whitespace-nowrap select-none">
    <div className="w-6 h-6 rounded-md bg-muted/50 flex items-center justify-center text-[10px] font-bold text-muted-foreground/40">
      {name[0]}
    </div>
    {name}
  </div>
);

const MarqueeTrustBar = () => {
  const doubled = [...LOGOS, ...LOGOS];

  return (
    <section className="relative py-8 overflow-hidden border-y border-border/30">
      <p className="text-center text-xs uppercase tracking-[0.3em] text-muted-foreground/40 mb-6 font-medium">
        Trusted Technology Partners
      </p>

      {/* Row 1 — scroll left */}
      <div className="marquee-container mb-3">
        <div className="marquee-track animate-marquee-left">
          {doubled.map((name, i) => (
            <LogoItem key={`r1-${i}`} name={name} />
          ))}
        </div>
      </div>

      {/* Row 2 — scroll right */}
      <div className="marquee-container">
        <div className="marquee-track animate-marquee-right">
          {[...doubled].reverse().map((name, i) => (
            <LogoItem key={`r2-${i}`} name={name} />
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
