import { Shield, Target, TrendingDown, CheckCircle, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

interface TradingObjectivesProps {
  profitTarget: string;
  dailyDrawdown: string;
  maxDrawdown: string;
  currentProfit: number;
  currentDailyDD: number;
  currentMaxDD: number;
  accountSize: number;
  status: string;
}

export default function TradingObjectives({
  profitTarget, dailyDrawdown, maxDrawdown,
  currentProfit, currentDailyDD, currentMaxDD, accountSize, status,
}: TradingObjectivesProps) {
  const profitTargetNum = parseFloat(profitTarget) || 8;
  const dailyDDNum = parseFloat(dailyDrawdown) || 5;
  const maxDDNum = parseFloat(maxDrawdown) || 10;

  const profitPercent = accountSize > 0 ? (currentProfit / accountSize) * 100 : 0;
  const profitProgress = Math.min((profitPercent / profitTargetNum) * 100, 100);
  const dailyDDProgress = Math.min((currentDailyDD / dailyDDNum) * 100, 100);
  const maxDDProgress = Math.min((currentMaxDD / maxDDNum) * 100, 100);

  const profitTargetAmount = (profitTargetNum / 100) * accountSize;
  const profitLeft = Math.max(profitTargetAmount - currentProfit, 0);
  const dailyDDAmount = (dailyDDNum / 100) * accountSize;
  const dailyDDLeft = Math.max(dailyDDAmount - ((currentDailyDD / 100) * accountSize), 0);
  const maxDDAmount = (maxDDNum / 100) * accountSize;
  const maxDDLeft = Math.max(maxDDAmount - ((currentMaxDD / 100) * accountSize), 0);

  const isPassed = status === "completed" || status === "passed" || status === "funded";
  const isBreached = status === "breached" || status === "failed";

  const objectives = [
    {
      label: "Daily Loss Limit",
      icon: TrendingDown,
      left: `$${dailyDDLeft.toLocaleString(undefined, { minimumFractionDigits: 2 })} Left`,
      progress: dailyDDProgress,
      percent: `${currentDailyDD.toFixed(1)}%`,
      maxLabel: `Maximum $${dailyDDAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} daily loss`,
      thresholdLabel: `Threshold at: $${(accountSize - dailyDDAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      color: dailyDDProgress > 80 ? "hsl(0,70%,55%)" : dailyDDProgress > 50 ? "hsl(45,80%,55%)" : "hsl(142,60%,50%)",
      passed: !isBreached && currentDailyDD < dailyDDNum,
    },
    {
      label: "Max Loss Limit",
      icon: Shield,
      left: `$${maxDDLeft.toLocaleString(undefined, { minimumFractionDigits: 2 })} Left`,
      progress: maxDDProgress,
      percent: `${currentMaxDD.toFixed(1)}%`,
      maxLabel: `Maximum $${maxDDAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} loss`,
      thresholdLabel: `Threshold at: $${(accountSize - maxDDAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      color: maxDDProgress > 80 ? "hsl(0,70%,55%)" : maxDDProgress > 50 ? "hsl(45,80%,55%)" : "hsl(142,60%,50%)",
      passed: !isBreached && currentMaxDD < maxDDNum,
    },
    {
      label: "Profit Target",
      icon: Target,
      left: `$${profitLeft.toLocaleString(undefined, { minimumFractionDigits: 2 })} Left`,
      progress: profitProgress,
      percent: `${profitProgress.toFixed(0)}%`,
      maxLabel: `$${profitTargetAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} Profit target`,
      thresholdLabel: "",
      color: profitProgress >= 100 ? "hsl(142,60%,50%)" : "hsl(207,90%,77%)",
      passed: profitProgress >= 100,
    },
  ];

  return (
    <div className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-sm flex items-center gap-2">
          <Target size={14} className="text-[hsl(207,90%,77%)]" />
          Trading Objectives
        </h3>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
          isPassed ? "bg-[hsl(142,60%,50%)]/15 text-[hsl(142,60%,50%)]" :
          isBreached ? "bg-[hsl(0,70%,55%)]/15 text-[hsl(0,70%,55%)]" :
          "bg-[hsl(207,90%,77%)]/15 text-[hsl(207,90%,77%)]"
        }`}>
          {isPassed ? "● Passed" : isBreached ? "● Breached" : "● In Progress"}
        </span>
      </div>

      <div className="space-y-4">
        {objectives.map((obj, i) => (
          <motion.div
            key={obj.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,14%)] p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold" style={{ color: obj.color }}>{obj.label}</span>
              {obj.passed ? (
                <CheckCircle size={18} style={{ color: "hsl(142,60%,50%)" }} />
              ) : (
                <AlertTriangle size={18} style={{ color: obj.color }} />
              )}
            </div>
            <p className="text-lg font-bold mb-2">{obj.left}</p>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 h-2 bg-[hsl(220,15%,15%)] rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: obj.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${obj.progress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              <span className="text-xs font-mono font-bold min-w-[40px] text-right">{obj.percent}</span>
            </div>
            <p className="text-[11px] text-[hsl(220,15%,45%)]">{obj.maxLabel}</p>
            {obj.thresholdLabel && (
              <p className="text-[11px] text-[hsl(220,15%,40%)]">{obj.thresholdLabel}</p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
