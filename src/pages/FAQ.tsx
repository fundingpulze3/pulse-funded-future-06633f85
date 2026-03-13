import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ChevronDown } from "lucide-react";

const faqData = [
  {
    category: "Getting Started",
    items: [
      { q: "What is Funding Pulze?", a: "Funding Pulze is a proprietary trading firm that provides funded trading accounts to skilled traders worldwide. We evaluate your trading ability through our challenge programs, and once you pass, you trade with our capital — keeping up to 100% of the profits you generate. Our mission is to remove financial barriers so talented traders can focus on what they do best." },
      { q: "How do I start a challenge?", a: "Getting started is simple: 1) Browse our challenge options and choose between a 1-Step or 2-Step evaluation. 2) Select your preferred account size ($10K to $200K). 3) Complete checkout using crypto or PayPal. 4) Receive your trading credentials instantly via email. You can begin trading immediately — there's no waiting period." },
      { q: "What platforms do you support?", a: "We support the three most popular trading platforms: MetaTrader 4 (MT4), MetaTrader 5 (MT5), and cTrader. You can choose your preferred platform during account setup. All platforms support desktop, web, and mobile trading, so you can manage your positions from anywhere." },
      { q: "Do I need trading experience to start?", a: "While we welcome traders of all levels, our challenges are designed for those with a solid understanding of trading fundamentals. We recommend practicing on a demo account first if you're new to trading. That said, many of our most successful funded traders started with just 6-12 months of experience." },
      { q: "What instruments can I trade?", a: "You can trade Forex pairs (majors, minors, and exotics), commodities (Gold, Silver, Oil), indices (US30, NAS100, SPX500), and cryptocurrencies (BTC, ETH). We offer over 100+ tradable instruments across all account types." },
    ],
  },
  {
    category: "Challenge Rules & Evaluation",
    items: [
      { q: "What is the profit target?", a: "The profit target varies by challenge type. For a 2-Step challenge: Phase 1 requires 8% and Phase 2 requires 5%. For a 1-Step challenge, you need to reach 8% in a single phase. There is no time limit — take as long as you need to reach your target safely." },
      { q: "What is the maximum drawdown?", a: "The maximum overall drawdown is 10% of your initial account balance. This means your account equity cannot fall below 90% of the starting balance at any point during the evaluation. For example, on a $100,000 account, your equity must stay above $90,000." },
      { q: "What is the daily drawdown limit?", a: "The maximum daily drawdown is 5%, calculated from your account balance at the start of each trading day (midnight server time, UTC). This resets every day. For instance, if your balance is $102,000 at the start of the day, you cannot lose more than $5,100 during that 24-hour period." },
      { q: "How many trading days are required?", a: "You must trade for a minimum of 3 active trading days during each evaluation phase. An active trading day is defined as any day where you open and close at least one position. There is no maximum time limit — trade at your own pace without pressure." },
      { q: "Can I hold trades over the weekend?", a: "Yes, you can hold trades over the weekend. However, we recommend being cautious with weekend holds due to potential gaps at market open on Monday, which could affect your drawdown limits. Swap-free accounts are available for traders who prefer to avoid overnight fees." },
      { q: "What happens if I fail the challenge?", a: "If you breach any of the drawdown rules or violate the trading guidelines, the challenge ends. However, you can purchase a new challenge at any time and try again. Many of our funded traders passed on their second or third attempt — persistence pays off." },
      { q: "Are there any restricted trading strategies?", a: "We allow most legitimate trading strategies including scalping, day trading, swing trading, and news trading. However, exploitative strategies such as latency arbitrage, copy trading from other prop firm accounts, or using guaranteed stop-loss exploits are not permitted." },
    ],
  },
  {
    category: "Payouts & Rewards",
    items: [
      { q: "How do reward cycles work?", a: "We offer four flexible payout schedules to match your trading style: Weekly (60% profit split), Bi-weekly (80% profit split), On Demand (90% profit split), and Monthly (100% profit split — you keep everything). You can switch between cycles at any time from your dashboard." },
      { q: "How do I withdraw my profits?", a: "Withdrawals are processed through your trader dashboard. We support multiple payout methods: bank wire transfer, cryptocurrency (USDT, BTC, ETH), and PayPal. Most payouts are processed within 24-48 hours. There's no minimum withdrawal amount for funded accounts." },
      { q: "When do I receive my first payout?", a: "Your first payout is available after your initial trading cycle is complete (7, 14, or 30 days depending on your chosen reward cycle). After the first cycle, payouts continue on schedule as long as your account remains in good standing." },
      { q: "Can I scale up my funded account?", a: "Yes! Funded traders who demonstrate consistent profitability may be eligible for account scaling. Our scaling plan allows you to increase your account size up to $2,000,000 based on your performance track record. Details are provided in your funded trader agreement." },
    ],
  },
  {
    category: "Account & Billing",
    items: [
      { q: "What payment methods do you accept?", a: "We accept cryptocurrency payments through NOWPayments (supporting BTC, ETH, USDT, and 200+ altcoins) and PayPal (cards, balance, and linked bank accounts). All payments are processed securely with instant confirmation." },
      { q: "Can I get a refund?", a: "We offer a full refund of your challenge fee when you successfully pass the evaluation and receive your funded account — it's our way of rewarding your achievement. For other refund inquiries, please contact our support team within 14 days of purchase." },
      { q: "Do you offer discount codes?", a: "Yes! We regularly offer promotional discount codes ranging from 10% to 30% off challenge fees. Follow us on our social media channels (Discord, Twitter, Instagram) for the latest deals. You can also check our website banner for any active promotions." },
      { q: "Is there a free trial available?", a: "We don't currently offer free trials, but our challenge prices are competitive and include a fee refund upon passing. We also run periodic promotions with significant discounts, making it accessible for traders at all budget levels." },
    ],
  },
  {
    category: "Technical & Support",
    items: [
      { q: "How do I contact support?", a: "Our support team is available 24/7 through multiple channels: live chat on our website (powered by PULZEX AI), email at support@fundingpulze.com, or through our Help Center. Average response time is under 2 hours for email inquiries." },
      { q: "What if I experience a platform issue during my challenge?", a: "If you encounter any technical issues (server downtime, platform errors, etc.) that affect your trading, contact our support team immediately with screenshots and details. We review all technical complaints fairly and may extend your challenge or adjust results if the issue was on our end." },
      { q: "Can I use Expert Advisors (EAs) or bots?", a: "Yes, you are welcome to use Expert Advisors and automated trading systems on your account. However, the EA must be your own — using shared or commercially distributed EAs that are also being used on other prop firm accounts may be flagged. High-frequency trading (HFT) bots are not permitted." },
      { q: "How do I access my trading dashboard?", a: "After purchasing a challenge, you'll receive login credentials via email within minutes. Log in to your trader dashboard at our website to view your account stats, performance metrics, drawdown status, and payout history — all in real time." },
    ],
  },
];

const FAQ = () => {
  const [isDark, setIsDark] = useState(true);
  const [openIndex, setOpenIndex] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const toggle = (key: string) => setOpenIndex(openIndex === key ? null : key);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />

      <section className="pt-24 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Frequently Asked <span className="text-gradient">Questions</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Everything you need to know about Funding Pulze.
            </p>
          </div>

          <div className="space-y-10">
            {faqData.map((section) => (
              <div key={section.category}>
                <h2 className="font-display text-xl font-semibold text-foreground mb-4">{section.category}</h2>
                <div className="space-y-2">
                  {section.items.map((item, idx) => {
                    const key = `${section.category}-${idx}`;
                    const isOpen = openIndex === key;
                    return (
                      <div key={key} className="glass-card overflow-hidden">
                        <button
                          onClick={() => toggle(key)}
                          className="w-full flex items-center justify-between p-5 text-left"
                        >
                          <span className="text-sm font-medium text-foreground pr-4">{item.q}</span>
                          <ChevronDown
                            size={18}
                            className={`text-muted-foreground shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        <div
                          className={`overflow-hidden transition-all duration-300 ${
                            isOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
                          }`}
                        >
                          <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center glass-card p-8">
            <h3 className="font-display text-lg font-semibold mb-2">Still have questions?</h3>
            <p className="text-sm text-muted-foreground mb-4">Our support team is here to help 24/7.</p>
            <a
              href="https://help.fundingpulze.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Visit Help Center →
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default FAQ;
