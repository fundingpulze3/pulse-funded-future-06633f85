import { useRef } from "react";

const PlatformPreview = () => {
  const frameRef = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1000px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
  };

  const onLeave = () => {
    const el = frameRef.current;
    if (el) el.style.transform = "perspective(1000px) rotateY(0deg) rotateX(0deg)";
  };

  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-muted-foreground/60 mb-3 font-medium">
          Your Trading Hub
        </p>
        <h2 className="text-center font-display text-3xl sm:text-4xl font-bold mb-4">
          Professional Dashboard
        </h2>
        <p className="text-center text-muted-foreground mb-16 text-sm max-w-lg mx-auto">
          Track your challenge progress, analyze performance, and manage payouts — all in one place
        </p>

        <div
          ref={frameRef}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          className="relative transition-transform duration-300 ease-out"
        >
          {/* Browser frame */}
          <div className="rounded-2xl border border-border/40 bg-card/80 overflow-hidden glow-box">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-muted/30">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
                <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground">
                  dashboard.fundingpulze.com
                </div>
              </div>
            </div>

            {/* Dashboard mockup */}
            <div className="p-6 sm:p-8 grid grid-cols-3 gap-4 min-h-[300px] sm:min-h-[400px]">
              {/* Stat cards */}
              <div className="rounded-xl bg-muted/30 p-4 flex flex-col justify-between border border-border/20">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Account Balance</span>
                <span className="text-xl sm:text-2xl font-display font-bold">$52,340</span>
                <span className="text-xs text-green-500">+4.68%</span>
              </div>
              <div className="rounded-xl bg-muted/30 p-4 flex flex-col justify-between border border-border/20">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Profit Target</span>
                <div className="flex items-end gap-1">
                  <span className="text-xl sm:text-2xl font-display font-bold">78%</span>
                  <span className="text-xs text-muted-foreground mb-1">/ 100%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div className="h-full w-[78%] rounded-full bg-foreground" />
                </div>
              </div>
              <div className="rounded-xl bg-muted/30 p-4 flex flex-col justify-between border border-border/20">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Total Payouts</span>
                <span className="text-xl sm:text-2xl font-display font-bold">$18,200</span>
                <span className="text-xs text-muted-foreground">3 payouts</span>
              </div>

              {/* Chart placeholder */}
              <div className="col-span-2 rounded-xl bg-muted/20 p-4 border border-border/20 flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-4">Equity Curve</span>
                <div className="flex-1 flex items-end gap-1">
                  {[35, 42, 38, 55, 48, 62, 58, 70, 65, 78, 72, 85, 80, 88, 92, 86, 95].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-foreground/20 hover:bg-foreground/40 transition-colors"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* Recent trades */}
              <div className="rounded-xl bg-muted/20 p-4 border border-border/20">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Recent Trades</span>
                <div className="mt-3 space-y-2">
                  {[
                    { pair: "EUR/USD", pnl: "+$240" },
                    { pair: "GBP/JPY", pnl: "+$180" },
                    { pair: "XAU/USD", pnl: "-$65" },
                    { pair: "US30", pnl: "+$520" },
                  ].map((t) => (
                    <div key={t.pair} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t.pair}</span>
                      <span className={t.pnl.startsWith("+") ? "text-green-500" : "text-destructive"}>
                        {t.pnl}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PlatformPreview;
