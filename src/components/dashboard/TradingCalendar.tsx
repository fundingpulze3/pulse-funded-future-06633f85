import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar, TrendingUp } from "lucide-react";

interface DailyTrade {
  date: string; // YYYY-MM-DD
  trades: number;
  pnl: number;
  pnlPercent: number;
}

interface TradingCalendarProps {
  balanceChart?: any[];
  profitByDay?: any[];
  symbols?: any[];
  totalTrades: number;
  profit: number;
  accountSize: number;
}

export default function TradingCalendar({
  balanceChart, profitByDay, symbols, totalTrades, profit, accountSize,
}: TradingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Extract daily PnL from balance chart time-series
  const dailyData = useMemo((): Map<string, DailyTrade> => {
    const map = new Map<string, DailyTrade>();

    if (balanceChart && Array.isArray(balanceChart) && balanceChart.length > 1) {
      // Group balance points by day and calculate daily PnL
      const dayGroups: Record<string, { first: number; last: number; count: number }> = {};

      balanceChart.forEach((p: any) => {
        const ts = p.timestamp ? p.timestamp * 1000 : Date.now();
        const dateStr = new Date(ts).toISOString().slice(0, 10);
        if (!dayGroups[dateStr]) {
          dayGroups[dateStr] = { first: p.balance, last: p.balance, count: 0 };
        }
        dayGroups[dateStr].last = p.balance;
        dayGroups[dateStr].count++;
      });

      const dates = Object.keys(dayGroups).sort();
      let prevClose = dates.length > 0 ? dayGroups[dates[0]].first : accountSize;

      dates.forEach(dateStr => {
        const g = dayGroups[dateStr];
        if (g.count <= 0) return;
        const dayPnl = g.last - prevClose;
        const dayPnlPct = prevClose > 0 ? (dayPnl / prevClose) * 100 : 0;
        // Only add days where balance changed (trades happened)
        if (Math.abs(dayPnl) > 0.001 || g.count > 2) {
          map.set(dateStr, {
            date: dateStr,
            trades: Math.max(1, Math.floor(g.count / 2)), // Approximate trades from data points
            pnl: Math.round(dayPnl * 100) / 100,
            pnlPercent: Math.round(dayPnlPct * 100) / 100,
          });
        }
        prevClose = g.last;
      });
    }

    return map;
  }, [balanceChart, accountSize]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  // Monthly PnL total
  const monthlyPnl = useMemo(() => {
    let total = 0;
    dailyData.forEach((v, k) => {
      if (k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) {
        total += v.pnl;
      }
    });
    return total;
  }, [dailyData, year, month]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-3 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-[hsl(207,90%,77%)]" />
          <h3 className="font-display font-bold text-sm">Daily Summary</h3>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
          monthlyPnl >= 0 ? "bg-[hsl(142,60%,50%)]/15 text-[hsl(142,60%,50%)]" : "bg-[hsl(0,70%,55%)]/15 text-[hsl(0,70%,55%)]"
        }`}>
          PnL: {monthlyPnl >= 0 ? "+" : ""}${monthlyPnl.toFixed(2)}
        </span>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[hsl(220,15%,12%)] transition-colors">
          <ChevronLeft size={16} className="text-[hsl(220,15%,50%)]" />
        </button>
        <span className="font-display font-bold text-sm min-w-[140px] text-center">
          {monthNames[month]} {year}
        </span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[hsl(220,15%,12%)] transition-colors">
          <ChevronRight size={16} className="text-[hsl(220,15%,50%)]" />
        </button>
        <button onClick={goToday} className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[hsl(220,15%,12%)] hover:bg-[hsl(220,15%,15%)] text-[11px] font-medium text-[hsl(220,15%,60%)] transition-colors">
          <Calendar size={12} /> Today
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1">
        {dayNames.map(d => (
          <div key={d} className="text-center text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-[hsl(220,15%,40%)] py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`e-${i}`} className="aspect-square rounded-md sm:rounded-lg bg-[hsl(220,15%,6%)]" />;
          }
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const data = dailyData.get(dateStr);
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

          return (
            <div
              key={dateStr}
              className={`aspect-square rounded-md sm:rounded-lg p-0.5 sm:p-1.5 flex flex-col justify-between transition-colors ${
                isToday ? "ring-1 ring-[hsl(207,90%,77%)] bg-[hsl(220,15%,10%)]" :
                data ? (data.pnl >= 0 ? "bg-[hsl(142,60%,50%)]/5 border border-[hsl(142,60%,50%)]/15" : "bg-[hsl(0,70%,55%)]/5 border border-[hsl(0,70%,55%)]/15") :
                "bg-[hsl(220,15%,8%)]"
              }`}
            >
              <div className="flex items-start justify-between">
                <span className={`text-[11px] font-bold ${isToday ? "text-[hsl(207,90%,77%)]" : "text-[hsl(220,15%,50%)]"}`}>
                  {day}
                </span>
                {data && <TrendingUp size={10} className={data.pnl >= 0 ? "text-[hsl(142,60%,50%)]" : "text-[hsl(0,70%,55%)]"} />}
              </div>
              {data && (
                <div className="mt-auto">
                  <p className="text-[9px] text-[hsl(220,15%,45%)]">Trades</p>
                  <p className="text-[10px] font-bold">{data.trades}</p>
                  <p className={`text-[10px] font-bold font-mono ${data.pnl >= 0 ? "text-[hsl(142,60%,50%)]" : "text-[hsl(0,70%,55%)]"}`}>
                    {data.pnl >= 0 ? "+" : ""}${data.pnl.toFixed(2)}
                  </p>
                  <div className="h-1 bg-[hsl(220,15%,15%)] rounded-full overflow-hidden mt-0.5">
                    <div
                      className={`h-full rounded-full ${data.pnl >= 0 ? "bg-[hsl(142,60%,50%)]" : "bg-[hsl(0,70%,55%)]"}`}
                      style={{ width: `${Math.min(Math.abs(data.pnlPercent) * 10, 100)}%` }}
                    />
                  </div>
                  <p className={`text-[9px] font-mono font-bold mt-0.5 ${data.pnl >= 0 ? "text-[hsl(142,60%,50%)]" : "text-[hsl(0,70%,55%)]"}`}>
                    {data.pnlPercent >= 0 ? "+" : ""}{data.pnlPercent.toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
