import { useEffect, useState } from "react";
import { ctraderInvestorUrl } from "@/lib/ctrader";

interface CTraderStatsProps {
  token?: string | null;
  isActive?: boolean;
}

const CTraderStats = ({ token, isActive = true }: CTraderStatsProps) => {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  useEffect(() => {
    setLoaded(false);
    setSlow(false);
    setDismissed(false);
    const t = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(t);
  }, [frameKey, token]);

  if (!token || !isActive) {
    return (
      <div className="w-full rounded-xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7%)] p-10 flex items-center justify-center">
        <p className="text-sm text-[hsl(220,15%,45%)]">No trading account linked yet.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px] md:h-[900px] rounded-xl overflow-hidden border border-[hsl(220,15%,12%)] bg-[#111]">
      <iframe
        key={frameKey}
        src={ctraderInvestorUrl(token)}
        className="w-full h-full border-0"
        loading="lazy"
        title="cTrader account statistics"
        onLoad={() => setLoaded(true)}
      />

      {!loaded && slow && !dismissed && (
        <div className="absolute inset-x-0 top-0 m-3 rounded-xl border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)]/95 backdrop-blur p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-xs text-[hsl(220,15%,70%)] flex-1">
            Stats are taking longer than usual to load. The trader may have revoked their Investor Access link.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setFrameKey((k) => k + 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[hsl(207,90%,77%)] text-[hsl(220,25%,8%)] hover:opacity-90 transition"
            >
              Retry
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 rounded-lg text-xs text-[hsl(220,15%,60%)] border border-[hsl(220,15%,18%)] hover:text-white transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CTraderStats;
