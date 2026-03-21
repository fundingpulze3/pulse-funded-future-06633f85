import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Crown, Info, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

type StepType = "one" | "two";
type AccountSize = "$5K" | "$10K" | "$25K" | "$50K" | "$100K";

interface ChallengeRow {
  id: string;
  account_size: number;
  price: number;
  step_type: string;
  profit_target: string;
  max_drawdown: string;
  daily_drawdown: string;
  min_trading_days: string;
  leverage: string;
}

const sizeToLabel = (size: number): AccountSize => {
  const map: Record<number, AccountSize> = { 5000: "$5K", 10000: "$10K", 25000: "$25K", 50000: "$50K", 100000: "$100K" };
  return map[size] || "$50K";
};

const defaultPrices: Record<StepType, Record<AccountSize, string>> = {
  one: { "$5K": "$49", "$10K": "$89", "$25K": "$189", "$50K": "$309", "$100K": "$549" },
  two: { "$5K": "$29", "$10K": "$62", "$25K": "$149", "$50K": "$279", "$100K": "$519" },
};

const defaultRules: Record<StepType, { student: Record<string, string>; practitioner: Record<string, string>; master: Record<string, string> }> = {
  one: {
    student: { "Profit Target": "8%", "Maximum Loss": "10%", "Maximum Daily Loss": "5%", "Minimum Trading Days": "3 days", "Leverage": "1:100" },
    practitioner: { "Profit Target": "-", "Maximum Loss": "10%", "Maximum Daily Loss": "5%", "Minimum Trading Days": "-", "Leverage": "1:100" },
    master: { "Profit Target": "-", "Maximum Loss": "10%", "Maximum Daily Loss": "5%", "Minimum Trading Days": "-", "Leverage": "1:100" },
  },
  two: {
    student: { "Profit Target": "8%", "Maximum Loss": "10%", "Maximum Daily Loss": "5%", "Minimum Trading Days": "3 days", "Leverage": "1:100" },
    practitioner: { "Profit Target": "5%", "Maximum Loss": "10%", "Maximum Daily Loss": "5%", "Minimum Trading Days": "3 days", "Leverage": "1:100" },
    master: { "Profit Target": "-", "Maximum Loss": "10%", "Maximum Daily Loss": "5%", "Minimum Trading Days": "-", "Leverage": "1:100" },
  },
};

const ruleTooltips: Record<string, string> = {
  "Profit Target": "The minimum profit you must reach to pass this evaluation phase.",
  "Maximum Loss": "The maximum total drawdown allowed on your account from the initial balance.",
  "Maximum Daily Loss": "The maximum loss you can incur in a single trading day. Resets at midnight UTC.",
  "Minimum Trading Days": "The minimum number of days you must actively trade before passing.",
  "Leverage": "The maximum leverage available for your trading account.",
};

const rewardCycles = ["Weekly 60%", "Bi-weekly 80%", "On Demand 90%", "Monthly 100%"];
const accountSizes: AccountSize[] = ["$5K", "$10K", "$25K", "$50K", "$100K"];
const ruleLabels = ["Profit Target", "Maximum Loss", "Maximum Daily Loss", "Minimum Trading Days", "Leverage"];

const Shop = () => {
  const [step, setStep] = useState<StepType>("one");
  const [account, setAccount] = useState<AccountSize>("$50K");
  const [prices, setPrices] = useState(defaultPrices);
  const [rules, setRules] = useState(defaultRules);
  const [dbLoaded, setDbLoaded] = useState(false);
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Fetch challenges from DB
  useEffect(() => {
    const fetchChallenges = async () => {
      const { data } = await supabase
        .from("challenges")
        .select("id, account_size, price, step_type, profit_target, max_drawdown, daily_drawdown, min_trading_days, leverage")
        .eq("is_active", true)
        .order("account_size", { ascending: true });

      if (!data || data.length === 0) return;

      const newPrices: Record<StepType, Record<AccountSize, string>> = { one: {} as any, two: {} as any };
      const newRules: Record<StepType, { student: Record<string, string>; practitioner: Record<string, string>; master: Record<string, string> }> = {
        one: { student: {}, practitioner: {}, master: {} },
        two: { student: {}, practitioner: {}, master: {} },
      };

      data.forEach((c: ChallengeRow) => {
        const stepKey: StepType = c.step_type === "one_step" ? "one" : "two";
        const sizeLabel = sizeToLabel(c.account_size);

        newPrices[stepKey][sizeLabel] = `$${c.price}`;

        // Student phase uses DB values
        newRules[stepKey].student[sizeLabel] = "loaded";
        const studentRules: Record<string, string> = {
          "Profit Target": c.profit_target,
          "Maximum Loss": c.max_drawdown,
          "Maximum Daily Loss": c.daily_drawdown,
          "Minimum Trading Days": c.min_trading_days,
          "Leverage": c.leverage,
        };

        // For 1-step: only student has target, practitioner & master are funded
        if (stepKey === "one") {
          newRules.one.student = studentRules;
          newRules.one.practitioner = { "Profit Target": "-", "Maximum Loss": c.max_drawdown, "Maximum Daily Loss": c.daily_drawdown, "Minimum Trading Days": "-", "Leverage": c.leverage };
          newRules.one.master = { "Profit Target": "-", "Maximum Loss": c.max_drawdown, "Maximum Daily Loss": c.daily_drawdown, "Minimum Trading Days": "-", "Leverage": c.leverage };
        } else {
          newRules.two.student = studentRules;
          newRules.two.practitioner = { "Profit Target": "5%", "Maximum Loss": c.max_drawdown, "Maximum Daily Loss": c.daily_drawdown, "Minimum Trading Days": c.min_trading_days, "Leverage": c.leverage };
          newRules.two.master = { "Profit Target": "-", "Maximum Loss": c.max_drawdown, "Maximum Daily Loss": c.daily_drawdown, "Minimum Trading Days": "-", "Leverage": c.leverage };
        }
      });

      setPrices(newPrices);
      setRules(newRules);
      setDbLoaded(true);
    };
    fetchChallenges();
  }, []);

  useEffect(() => {
    const loadGsap = async () => {
      const { gsap } = await import("gsap");
      const el = sectionRef.current;
      if (!el) return;
      gsap.fromTo(el.querySelector(".section-header"), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 });
      gsap.fromTo(el.querySelector(".shop-card"), { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 });
    };
    loadGsap();
  }, []);

  useEffect(() => {
    const animateTable = async () => {
      const { gsap } = await import("gsap");
      if (tableRef.current) {
        gsap.fromTo(tableRef.current.querySelectorAll(".rule-row"), { opacity: 0, x: -15 }, { opacity: 1, x: 0, duration: 0.35, stagger: 0.05, ease: "power2.out" });
      }
    };
    animateTable();
  }, [step, account]);

  const currentRules = rules[step];
  const price = prices[step][account] || "$0";
  const sizeNum = account.replace("$", "").replace("K", "k");

  return (
    <section ref={sectionRef} id="challenges" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="section-header text-center mb-10 sm:mb-14">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">
            Start Your <span className="text-gradient">Challenge</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">Choose your path and account size.</p>
        </div>

        <div className="shop-card glass-card p-4 sm:p-8 md:p-10">
          {/* Selectors with labels */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-center gap-6 sm:gap-8 mb-8">
            {/* Path selector */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 ml-1 tracking-wider">Path</p>
              <div className="inline-flex surface-elevated rounded-full p-1 glow-border">
                {(["one", "two"] as StepType[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStep(s)}
                    className={`px-5 sm:px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                      step === s ? "bg-highlight text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s === "one" ? "1 Step" : "2 Step"}
                  </button>
                ))}
              </div>
            </div>

            {/* Account Size selector */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 ml-1 tracking-wider">Account Size</p>
              <div className="inline-flex surface-elevated rounded-full p-1 glow-border flex-wrap">
                {accountSizes.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAccount(a)}
                    className={`px-3 sm:px-4 py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 ${
                      account === a ? "bg-highlight text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reward Cycles */}
          <div className="rounded-xl p-4 mb-8 sm:mb-10 text-center border border-border/40 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2 tracking-wider uppercase">Reward Cycles</p>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              {rewardCycles.map((cycle) => (
                <div key={cycle} className="flex items-center gap-2 text-sm text-foreground">
                  <Check size={16} className="text-highlight" />
                  <span>{cycle}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Evaluation Stage Label */}
          <p className="text-center text-sm text-muted-foreground mb-3">(Evaluation Stage)</p>

          {/* Stage Progress */}
          <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-4">
            <div />
            <div className="flex justify-center">
              <span className="w-8 h-8 rounded-full border border-highlight/50 flex items-center justify-center text-xs font-semibold text-foreground">1</span>
            </div>
            <div className="flex justify-center">
              <span className="w-8 h-8 rounded-full border border-highlight/50 flex items-center justify-center text-xs font-semibold text-foreground">2</span>
            </div>
            <div className="flex justify-center">
              <Crown size={22} className="text-highlight" />
            </div>
          </div>

          {/* Column Headers */}
          <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-2">
            <div />
            <p className="text-center font-display font-bold text-[10px] sm:text-lg text-foreground">Student</p>
            <p className="text-center font-display font-bold text-[10px] sm:text-lg text-foreground">Practitioner</p>
            <p className="text-center font-display font-bold text-[10px] sm:text-lg text-foreground">Master</p>
          </div>

          {/* Rules Table */}
          <div ref={tableRef} className="divide-y divide-border/50">
            {ruleLabels.map((label) => (
              <div key={label} className="rule-row grid grid-cols-4 gap-2 sm:gap-4 py-3 sm:py-4 items-center">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="text-[10px] leading-tight sm:text-sm">{label}</span>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground/40 hover:text-highlight transition-colors shrink-0 p-0.5 rounded-full hover:bg-highlight/10"
                      >
                        <Info size={14} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                      {ruleTooltips[label]}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-center text-[10px] sm:text-sm font-medium text-foreground">{currentRules.student[label]}</p>
                <p className="text-center text-[10px] sm:text-sm font-medium text-foreground">{currentRules.practitioner[label]}</p>
                <p className="text-center text-[10px] sm:text-sm font-medium text-foreground">{currentRules.master[label]}</p>
              </div>
            ))}
          </div>

          {/* Bottom Bar */}
          <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-6">
            <div className="flex items-center gap-6 sm:gap-8">
              <div>
                <span className="text-xs sm:text-sm text-muted-foreground">Account size: </span>
                <span className="font-display text-2xl sm:text-3xl font-bold text-foreground">{sizeNum}</span>
              </div>
              <div>
                <span className="text-xs sm:text-sm text-muted-foreground">Price: </span>
                <span className="font-display text-3xl sm:text-4xl font-bold text-foreground">{price}</span>
              </div>
            </div>
            <Button
              size="lg"
              className="rounded-xl px-8 sm:px-10 py-5 sm:py-6 text-sm sm:text-base glow-box w-full sm:w-auto bg-highlight hover:bg-highlight/90 text-primary-foreground"
              onClick={() => {
                const priceNum = price.replace("$", "");
                const stepLabel = step === "one" ? "1-step" : "2-step";
                navigate(`/checkout?step=${stepLabel}&size=${account}&price=${priceNum}`);
              }}
            >
              Buy Challenge
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Shop;
