import { useEffect, useRef, useState } from "react";
import { parseCTraderToken, isValidCTraderToken, ctraderInvestorUrl } from "@/lib/ctrader";

type Status = "idle" | "loading" | "loaded" | "timeout";

const CTraderTester = () => {
  const [input, setInput] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [ms, setMs] = useState<number | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    if (status !== "loading") return;
    const t = setTimeout(() => setStatus((s) => (s === "loading" ? "timeout" : s)), 20000);
    return () => clearTimeout(t);
  }, [status, frameKey]);

  const parsed = parseCTraderToken(input);
  const valid = parsed.token ? isValidCTraderToken(parsed.token) : false;

  const runTest = () => {
    if (!valid) return;
    setToken(parsed.token);
    setStatus("loading");
    setMs(null);
    startedAt.current = performance.now();
    setFrameKey((k) => k + 1);
  };

  const badge = {
    idle: { label: "Not tested", cls: "border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[hsl(220,15%,55%)]" },
    loading: { label: "Fetching…", cls: "border-[hsl(207,60%,30%)] bg-[hsl(207,60%,10%)] text-[hsl(207,90%,77%)]" },
    loaded: { label: "Fetched OK", cls: "border-[hsl(150,60%,25%)] bg-[hsl(150,60%,10%)] text-[hsl(150,70%,60%)]" },
    timeout: { label: "No response", cls: "border-[hsl(0,60%,30%)] bg-[hsl(0,60%,10%)] text-[hsl(0,70%,65%)]" },
  }[status];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7%)] p-4 sm:p-5 space-y-3">
        <div>
          <h2 className="font-display font-bold text-base">cTrader Link Tester</h2>
          <p className="text-xs text-[hsl(220,15%,50%)] mt-1">
            Paste any cTrader Investor Access link to check whether its stats actually load. Nothing is saved — this is a sandbox.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runTest()}
            placeholder="https://ct.spotware.com/investor/XXXXXXX"
            className="flex-1 rounded-lg bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,16%)] px-3 py-2 text-sm outline-none focus:border-[hsl(207,90%,77%)]"
          />
          <button
            onClick={runTest}
            disabled={!valid}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[hsl(207,90%,77%)] text-[hsl(220,25%,8%)] disabled:opacity-40 hover:opacity-90 transition"
          >
            Test Link
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border ${badge.cls}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {badge.label}
          </span>
          {parsed.token && (
            <span className="text-[hsl(220,15%,50%)]">
              Token: <span className={valid ? "text-[hsl(150,70%,60%)]" : "text-[hsl(0,70%,65%)]"}>{parsed.token}</span>
              {!valid && " — doesn't look like a valid investor token"}
            </span>
          )}
          {ms !== null && <span className="text-[hsl(220,15%,40%)]">Loaded in {(ms / 1000).toFixed(1)}s</span>}
        </div>

        {status === "timeout" && (
          <p className="text-xs text-[hsl(0,70%,65%)]">
            The panel didn't respond within 20s. The link may be revoked/expired, or cTrader is unreachable from this network.
          </p>
        )}
      </div>

      {token && (
        <div className="relative w-full h-[600px] md:h-[900px] rounded-xl overflow-hidden border border-[hsl(220,15%,12%)] bg-[#111]">
          <iframe
            key={frameKey}
            src={ctraderInvestorUrl(token)}
            className="w-full h-full border-0"
            title="cTrader link test"
            onLoad={() => {
              setMs(performance.now() - startedAt.current);
              setStatus("loaded");
            }}
          />
        </div>
      )}
    </div>
  );
};

export default CTraderTester;
