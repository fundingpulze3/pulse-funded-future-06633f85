import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FileText } from "lucide-react";
import { usePageContent } from "@/hooks/usePageContent";

const sections = [
  {
    title: "1. Acceptance of Terms",
    content: `By accessing or using Funding Pulze ("Platform"), you agree to be bound by these Terms and Conditions. If you do not agree, you must not use our services. These terms apply to all users, including visitors, registered users, and traders.`,
  },
  {
    title: "2. Eligibility",
    content: `You must be at least 18 years old and legally capable of entering binding contracts. By using our Platform, you represent that you meet these requirements. We reserve the right to refuse service to anyone at our discretion.`,
  },
  {
    title: "3. Account Registration",
    content: `You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate information during registration and to update it as needed. Any activity under your account is your responsibility.`,
  },
  {
    title: "4. Challenge Rules & Evaluation",
    content: `All trading challenges are subject to specific rules including profit targets, drawdown limits, and minimum trading days as displayed at the time of purchase. Funding Pulze reserves the right to modify challenge parameters with prior notice. Violation of any rule may result in account termination.`,
  },
  {
    title: "5. Payments & Refunds",
    content: `All challenge fees are non-refundable once the trading evaluation has begun. Payments are processed through secure third-party providers. Funded account payouts are subject to verification and compliance with all trading rules.`,
  },
  {
    title: "6. Prohibited Activities",
    content: `Users may not: engage in any form of market manipulation; use exploitative trading strategies (arbitrage of platform feeds, latency abuse); share account credentials; use automated systems unless explicitly permitted; or engage in any activity that violates applicable laws.`,
  },
  {
    title: "7. Intellectual Property",
    content: `All content, branding, and technology on the Platform are owned by Funding Pulze. You may not reproduce, distribute, or create derivative works without written permission. Your trading data and performance metrics may be used in anonymized, aggregated form.`,
  },
  {
    title: "8. Limitation of Liability",
    content: `Funding Pulze is not liable for any indirect, incidental, or consequential damages arising from use of the Platform. Our total liability shall not exceed the amount you paid for the specific service giving rise to the claim. Trading involves risk, and past performance does not guarantee future results.`,
  },
  {
    title: "9. Termination",
    content: `We may suspend or terminate your account at any time for violation of these terms. Upon termination, your right to use the Platform ceases immediately. Provisions regarding intellectual property, limitation of liability, and dispute resolution survive termination.`,
  },
  {
    title: "10. Governing Law",
    content: `These Terms shall be governed by and construed in accordance with applicable international commercial laws. Any disputes shall be resolved through binding arbitration. By using our services, you waive any right to participate in class-action lawsuits.`,
  },
];

const defaultSections = sections;

const Terms = () => {
  const [isDark, setIsDark] = useState(true);
  const heroRef = useRef<HTMLDivElement>(null);
  const { hasCmsContent, orderedSections } = usePageContent("terms");

  const displaySections = hasCmsContent
    ? orderedSections.map((s) => ({ title: s.title || "", content: s.content }))
    : defaultSections;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    const load = async () => {
      const { gsap } = await import("gsap");
      if (heroRef.current) {
        gsap.fromTo(heroRef.current.querySelector(".legal-title"), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" });
        gsap.fromTo(heroRef.current.querySelector(".legal-sub"), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, delay: 0.15, ease: "power3.out" });
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />

      <section ref={heroRef} className="pt-32 pb-16 px-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glow-border surface-elevated text-sm text-muted-foreground mb-8">
          <FileText size={14} className="text-foreground" />
          <span>Legal Agreement</span>
        </div>
        <h1 className="legal-title font-display text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 opacity-0">
          Terms & <span className="text-gradient">Conditions</span>
        </h1>
        <p className="legal-sub text-muted-foreground max-w-lg mx-auto opacity-0">
          Last updated: March 2026. Please read carefully before using our services.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-24">
        <div className="space-y-6">
          {sections.map((s, i) => (
            <SectionCard key={s.title} title={s.title} content={s.content} index={i} />
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
};

const SectionCard = ({ title, content, index }: { title: string; content: string; index: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      className="glass-card p-8 hover:glow-box transition-shadow duration-500"
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
    >
      <h2 className="font-display text-lg font-semibold mb-3">{title}</h2>
      <p className="text-muted-foreground leading-relaxed text-sm">{content}</p>
    </motion.div>
  );
};

export default Terms;
