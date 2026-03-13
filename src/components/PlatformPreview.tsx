import { useRef } from "react";
import dashboardPreview from "@/assets/dashboard-preview.png";

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
    <section className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-muted-foreground/60 mb-3 font-medium">
          Your Trading Hub
        </p>
        <h2 className="text-center font-display text-3xl sm:text-4xl font-bold mb-4">
          Professional <span className="text-highlight">Dashboard</span>
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

            {/* Real dashboard screenshot */}
            <img
              src={dashboardPreview}
              alt="Funding Pulze Trading Dashboard — Account Overview with equity curve, balance, and drawdown metrics"
              className="w-full h-auto block"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default PlatformPreview;
