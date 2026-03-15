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
      left: `$${dailyDDLeft.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      progress: dailyDDProgress,
      percent: `${currentDailyDD.toFixed(1)}%`,
      maxLabel: `Max $${dailyDDAmount.toLocaleString(undefined, { minimumFractionDigits: 0 })}`,
      color: dailyDDProgress > 80 ? "hsl(0,70%,55%)" : dailyDDProgress > 50 ? "hsl(45,80%,55%)" : "hsl(142,60%,50%)",
      passed: !isBreached && currentDailyDD < dailyDDNum,
    },
    {
      label: "Max Loss Limit",
      icon: Shield,
      left: `$${maxDDLeft.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      progress: maxDDProgress,
      percent: `${currentMaxDD.toFixed(1)}%`,
      maxLabel: `Max $${maxDDAmount.toLocaleString(undefined, { minimumFractionDigits: 0 })}`,
      color: maxDDProgress > 80 ? "hsl(0,70%,55%)" : maxDDProgress > 50 ? "hsl(45,80%,55%)" : "hsl(142,60%,50%)",
      passed: !isBreached && currentMaxDD < maxDDNum,
    },
    {
      label: "Profit Target",
      icon: Target,
      left: `$${profitLeft.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      progress: profitProgress,
      percent: `${profitProgress.toFixed(0)}%`,
      maxLabel: `Target $${profitTargetAmount.toLocaleString(undefined, { minimumFractionDigits: 0 })}`,
      color: profitProgress >= 100 ? "hsl(142,60%,50%)" : "hsl(207,90%,77%)",
      passed: profitProgress >= 100,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2">
      {objectives.map((obj, i) => (
        <motion.div
          key={obj.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-3"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <obj.icon size={12} style={{ color: obj.color }} />
              <span className="text-[11px] font-semibold" style={{ color: obj.color }}>{obj.label}</span>
            </div>
            {obj.passed ? (
              <CheckCircle size={13} style={{ color: "hsl(142,60%,50%)" }} />
            ) : (
              <AlertTriangle size={13} style={{ color: obj.color }} />
            )}
          </div>
          <p className="text-sm font-bold mb-1.5">{obj.left} <span className="text-[10px] text-[hsl(220,15%,40%)] font-normal">left</span></p>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 h-1.5 bg-[hsl(220,15%,15%)] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: obj.color }}
                initial={{ width: 0 }}
                animate={{ width: `${obj.progress}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <span className="text-[10px] font-mono font-bold min-w-[32px] text-right">{obj.percent}</span>
          </div>
          <p className="text-[10px] text-[hsl(220,15%,40%)]">{obj.maxLabel}</p>
        </motion.div>
      ))}
    </div>
  );
}
