import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Crown, Info } from "lucide-react";

type StepType = "one" | "two";
type AccountSize = "$5K" | "$10K" | "$25K" | "$50K" | "$100K";

const accountPrices: Record<StepType, Record<AccountSize, string>> = {
  one: { "$5K": "$49", "$10K": "$89", "$25K": "$179", "$50K": "$249", "$100K": "$449" },
  two: { "$5K": "$39", "$10K": "$79", "$25K": "$159", "$50K": "$289", "$100K": "$499" },
};

const rulesData: Record<StepType, { student: Record<string, string>; practitioner: Record<string, string>; master: Record<string, string> }> = {
  one: {
    student: { "Profit Target": "$4,000 (8%)", "Maximum Loss": "10%", "Maximum Daily Loss": "5%", "Minimum Trading Days": "3 days", "Leverage": "1:100" },
    practitioner: { "Profit Target": "-", "Maximum Loss": "10%", "Maximum Daily Loss": "5%", "Minimum Trading Days": "-", "Leverage": "1:100" },
    master: { "Profit Target": "-", "Maximum Loss": "10%", "Maximum Daily Loss": "5%", "Minimum Trading Days": "-", "Leverage": "1:100" },
  },
  two: {
    student: { "Profit Target": "$4,000 (8%)", "Maximum Loss": "10%", "Maximum Daily Loss": "5%", "Minimum Trading Days": "3 days", "Leverage": "1:100" },
    practitioner: { "Profit Target": "$2,500 (5%)", "Maximum Loss": "10%", "Maximum Daily Loss": "5%", "Minimum Trading Days": "3 days", "Leverage": "1:100" },
    master: { "Profit Target": "-", "Maximum Loss": "10%", "Maximum Daily Loss": "5%", "Minimum Trading Days": "-", "Leverage": "1:100" },
  },
};

const rewardCycles = ["Weekly 60%", "Bi-weekly 80%", "On Demand 90%", "Monthly 100%"];
const accountSizes: AccountSize[] = ["$5K", "$10K", "$25K", "$50K", "$100K"];
const ruleLabels = ["Profit Target", "Maximum Loss", "Maximum Daily Loss", "Minimum Trading Days", "Leverage"];

const Shop = () => {
  const [step, setStep] = useState<StepType>("two");
  const [account, setAccount] = useState<AccountSize>("$50K");
  const sectionRef = useRef<HTMLElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadGsap = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      const el = sectionRef.current;
      if (!el) return;
      gsap.fromTo(el.querySelector(".section-header"), { y: 40, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.7, scrollTrigger: { trigger: el, start: "top 80%" },
      });
      gsap.fromTo(el.querySelector(".shop-card"), { y: 50, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.8, scrollTrigger: { trigger: el, start: "top 70%" },
      });
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

  const rules = rulesData[step];
  const price = accountPrices[step][account];
  const sizeNum = account.replace("$", "").replace("K", "k");

  return (
    <section ref={sectionRef} id="rules" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="section-header text-center mb-14">
          <h2 className="font-display text-4xl sm:text-5xl font-bold mb-4">
            Start Your <span className="text-gradient">Challenge</span>
          </h2>
          <p className="text-muted-foreground text-lg">Choose your path and account size.</p>
        </div>

        <div className="shop-card glass-card p-6 sm:p-10">
          {/* Step & Account Selectors */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <div className="inline-flex surface-elevated rounded-full p-1 glow-border">
              {(["one", "two"] as StepType[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStep(s)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    step === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "one" ? "1 Step" : "2 Step"}
                </button>
              ))}
            </div>

            <div className="inline-flex surface-elevated rounded-full p-1 glow-border">
              {accountSizes.map((a) => (
                <button
                  key={a}
                  onClick={() => setAccount(a)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    account === a ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Reward Cycles */}
          <div className="rounded-xl p-4 mb-10 text-center" style={{ background: "linear-gradient(135deg, hsl(var(--glow-primary) / 0.25), hsl(var(--glow-accent) / 0.1))" }}>
            <p className="text-xs text-muted-foreground mb-2 tracking-wider uppercase">Reward Cycles</p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {rewardCycles.map((cycle) => (
                <div key={cycle} className="flex items-center gap-2 text-sm text-foreground">
                  <Check size={16} className="text-primary" />
                  <span>{cycle}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Evaluation Stage Label */}
          <p className="text-center text-sm text-muted-foreground mb-3">(Evaluation Stage)</p>

          {/* Stage Progress */}
          <div className="flex items-center justify-center gap-0 mb-8">
            <div className="flex items-center gap-0">
              <span className="w-8 h-8 rounded-full border border-primary flex items-center justify-center text-xs font-semibold text-primary">1</span>
              <div className="w-24 sm:w-40 h-px bg-border" />
              <span className="w-8 h-8 rounded-full border border-primary flex items-center justify-center text-xs font-semibold text-primary">2</span>
            </div>
            <div className="w-16 sm:w-24 h-px bg-border" />
            <Crown size={24} className="text-primary" />
          </div>

          {/* Column Headers */}
          <div className="grid grid-cols-4 gap-4 mb-2">
            <div />
            <p className="text-center font-display font-bold text-lg text-foreground">Student</p>
            <p className="text-center font-display font-bold text-lg text-foreground">Practitioner</p>
            <p className="text-center font-display font-bold text-lg text-foreground">Master</p>
          </div>

          {/* Rules Table */}
          <div ref={tableRef} className="divide-y divide-border">
            {ruleLabels.map((label) => (
              <div key={label} className="rule-row grid grid-cols-4 gap-4 py-4 items-center">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  {label}
                  <Info size={13} className="text-muted-foreground/50" />
                </div>
                <p className="text-center text-sm font-medium text-foreground">{rules.student[label]}</p>
                <p className="text-center text-sm font-medium text-foreground">{rules.practitioner[label]}</p>
                <p className="text-center text-sm font-medium text-foreground">{rules.master[label]}</p>
              </div>
            ))}
          </div>

          {/* Bottom Bar */}
          <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-8">
              <div>
                <span className="text-sm text-muted-foreground">Account size: </span>
                <span className="font-display text-3xl font-bold text-foreground">{sizeNum}</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Price: </span>
                <span className="font-display text-4xl font-bold text-foreground">{price}</span>
                <p className="text-xs text-muted-foreground mt-1">Add-on available: <span className="font-medium text-foreground">Swap Free</span> (+10%)</p>
              </div>
            </div>
            <Button size="lg" className="rounded-xl px-10 py-6 text-base glow-box">
              Buy Challenge
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Shop;
