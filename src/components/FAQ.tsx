import { useEffect, useRef } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "What is Funding Pulze?",
    a: "Funding Pulze is a proprietary trading firm that provides funded accounts to skilled traders. Pass our evaluation challenge and trade with our capital while keeping up to 90% of the profits.",
  },
  {
    q: "How do funded accounts work?",
    a: "Choose an account size, complete the challenge by hitting the profit target while respecting drawdown limits, and receive a funded account. Trade real capital with no personal financial risk.",
  },
  {
    q: "What is the payout structure?",
    a: "Traders receive up to 90% of profits generated on their funded accounts. Payouts are processed bi-weekly with no minimum withdrawal amount after the first payout cycle.",
  },
  {
    q: "What trading strategies are allowed?",
    a: "We allow all trading styles including scalping, swing trading, day trading, and algorithmic trading. News trading and weekend holding are also permitted on all account types.",
  },
  {
    q: "How long do I have to complete the challenge?",
    a: "There is no time limit on our challenges. Take as long as you need to reach the profit target while maintaining the drawdown rules. The only requirement is a minimum of 5 trading days.",
  },
];

const FAQ = () => {
  const sectionRef = useRef<HTMLElement>(null);

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
      gsap.fromTo(el.querySelectorAll("[data-faq]"), { y: 30, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.5, stagger: 0.08, scrollTrigger: { trigger: el, start: "top 70%" },
      });
    };
    loadGsap();
  }, []);

  return (
    <section ref={sectionRef} id="faq" className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="section-header text-center mb-12">
          <h2 className="font-display text-4xl sm:text-5xl font-bold mb-4">
            Frequently Asked <span className="text-gradient">Questions</span>
          </h2>
          <p className="text-muted-foreground text-lg">Everything you need to know about Funding Pulze.</p>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`} data-faq className="glass-card px-6 border-none">
              <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline py-5">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQ;
