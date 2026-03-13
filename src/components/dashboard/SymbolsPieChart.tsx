import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface SymbolsPieChartProps {
  symbols: any[];
}

const COLORS = [
  "hsl(207,90%,77%)", "hsl(142,60%,50%)", "hsl(0,70%,55%)",
  "hsl(45,80%,55%)", "hsl(280,70%,60%)", "hsl(180,60%,50%)",
  "hsl(320,70%,60%)", "hsl(100,60%,50%)",
];

export default function SymbolsPieChart({ symbols }: SymbolsPieChartProps) {
  if (!symbols || symbols.length === 0) return null;

  const data = symbols.map((s: any) => ({
    name: s.name,
    value: Math.abs(Number(s.profit || 0)),
    profit: Number(s.profit || 0),
    trades: s.trades || 0,
  }));

  return (
    <div className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] p-5">
      <h3 className="font-display font-bold text-sm mb-4">Symbol Distribution</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={45}
                strokeWidth={0}
              >
                {data.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(220,20%,8%)",
                  border: "1px solid hsl(220,15%,15%)",
                  borderRadius: "8px",
                  color: "white",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {data.map((s: any, i: number) => (
            <div key={s.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="font-mono font-medium">{s.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[hsl(220,15%,45%)]">{s.trades} trades</span>
                <span className={`font-bold ${s.profit >= 0 ? "text-[hsl(142,60%,50%)]" : "text-[hsl(0,70%,55%)]"}`}>
                  ${s.profit.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
