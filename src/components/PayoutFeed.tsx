const PAYOUTS = [
  { name: "J***n D.", amount: "$8,200", country: "🇺🇸", time: "2 min ago" },
  { name: "S***a W.", amount: "$12,450", country: "🇬🇧", time: "8 min ago" },
  { name: "A***d K.", amount: "$5,600", country: "🇦🇪", time: "14 min ago" },
  { name: "M***a L.", amount: "$22,100", country: "🇪🇸", time: "23 min ago" },
  { name: "C***n W.", amount: "$6,800", country: "🇸🇬", time: "31 min ago" },
  { name: "D***d R.", amount: "$15,300", country: "🇨🇦", time: "45 min ago" },
  { name: "L***s P.", amount: "$9,750", country: "🇧🇷", time: "1 hr ago" },
  { name: "T***a M.", amount: "$18,200", country: "🇩🇪", time: "2 hrs ago" },
  { name: "R***t S.", amount: "$4,300", country: "🇮🇳", time: "3 hrs ago" },
  { name: "E***a N.", amount: "$11,600", country: "🇫🇷", time: "4 hrs ago" },
];

const PayoutRow = ({ name, amount, country, time }: typeof PAYOUTS[0]) => (
  <div className="flex items-center justify-between px-6 py-4 border-b border-border/20 last:border-0">
    <div className="flex items-center gap-3">
      <span className="text-xl">{country}</span>
      <span className="text-sm text-foreground font-medium">{name}</span>
    </div>
    <span className="text-sm font-bold text-foreground">{amount}</span>
    <span className="text-xs text-muted-foreground">{time}</span>
  </div>
);

const PayoutFeed = () => {
  const doubled = [...PAYOUTS, ...PAYOUTS];

  return (
    <section className="py-24 px-6">
      <div className="max-w-2xl mx-auto">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-muted-foreground/60 mb-3 font-medium">
          Live Activity
        </p>
        <h2 className="text-center font-display text-3xl sm:text-4xl font-bold mb-4">
          Recent Payouts
        </h2>
        <p className="text-center text-muted-foreground mb-12 text-sm">
          Real traders, real profits, real payouts
        </p>

        <div className="relative rounded-2xl border border-border/30 bg-card/50 overflow-hidden h-[400px]">
          {/* Scrolling content */}
          <div className="animate-payout-scroll">
            {doubled.map((p, i) => (
              <PayoutRow key={i} {...p} />
            ))}
          </div>

          {/* Fade top/bottom */}
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-card to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent z-10 pointer-events-none" />
        </div>
      </div>
    </section>
  );
};

export default PayoutFeed;
