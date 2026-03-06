import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ChevronDown } from "lucide-react";

const faqData = [
  {
    category: "Getting Started",
    items: [
      { q: "What is Funding Pulze?", a: "Funding Pulze is a proprietary trading firm that provides funded trading accounts to skilled traders. Pass our evaluation challenge and trade with our capital — you keep up to 100% of the profits." },
      { q: "How do I start a challenge?", a: "Simply choose your preferred challenge type (1-Step or 2-Step), select an account size, and complete the checkout. You'll receive your trading credentials instantly after payment." },
      { q: "What platforms do you support?", a: "We support MetaTrader 4 (MT4), MetaTrader 5 (MT5), and cTrader. You can choose your preferred platform during account setup." },
    ],
  },
  {
    category: "Challenge Rules",
    items: [
      { q: "What is the profit target?", a: "The profit target varies by challenge type. For a 2-Step challenge, Phase 1 requires 8% and Phase 2 requires 5%. For a 1-Step challenge, you need to reach 8% in a single phase." },
      { q: "What is the maximum drawdown?", a: "The maximum overall drawdown is 10% of your initial account balance. This means your account equity cannot fall below 90% of the starting balance at any point." },
      { q: "What is the daily drawdown limit?", a: "The maximum daily drawdown is 5%. This is calculated based on your account balance at the start of each trading day (midnight UTC)." },
      { q: "How many trading days are required?", a: "You must trade for a minimum of 3 days during each evaluation phase. There is no maximum time limit — take as long as you need." },
    ],
  },
  {
    category: "Payouts & Rewards",
    items: [
      { q: "How do reward cycles work?", a: "We offer flexible payout schedules: Weekly (60% profit split), Bi-weekly (80%), On Demand (90%), and Monthly (100%). Choose the cycle that best fits your trading style." },
      { q: "How do I withdraw my profits?", a: "Withdrawals can be made through your trader dashboard. We process payouts via bank transfer, crypto (USDT, BTC), and PayPal within 24-48 hours." },
    ],
  },
  {
    category: "Account & Billing",
    items: [
      { q: "What payment methods do you accept?", a: "We accept cryptocurrency payments through NOWPayments (BTC, ETH, USDT, and 200+ coins) and PayPal (cards, balance)." },
      { q: "Can I get a refund?", a: "We offer a full refund if you pass the challenge and receive your funded account. Please refer to our Terms of Service for the detailed refund policy." },
      { q: "Do you offer discount codes?", a: "Yes! We periodically offer coupon codes for discounts. You can apply them at checkout. Follow our social media channels for the latest promotions." },
    ],
  },
];

const FAQ = () => {
  const [isDark, setIsDark] = useState(false);
  const [openIndex, setOpenIndex] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const toggle = (key: string) => setOpenIndex(openIndex === key ? null : key);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />

      <section className="pt-32 pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h1 className="font-display text-4xl sm:text-5xl font-bold mb-4">
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
