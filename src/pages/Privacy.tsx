import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Shield } from "lucide-react";
import { usePageContent } from "@/hooks/usePageContent";

const sections = [
  {
    title: "Information We Collect",
    content: `We collect information you provide directly, including your name, email address, and payment details when you register or purchase a challenge. We also automatically collect usage data such as IP address, browser type, pages visited, and interaction patterns to improve our services.`,
  },
  {
    title: "How We Use Your Information",
    content: `Your information is used to: provide and maintain our services; process transactions and send related notices; send promotional communications (with your consent); monitor and analyze usage trends; detect and prevent fraud; and comply with legal obligations.`,
  },
  {
    title: "Data Sharing & Disclosure",
    content: `We do not sell your personal information. We may share data with trusted service providers who assist in operating our platform (payment processors, analytics providers), when required by law, or to protect our rights and safety. All third-party providers are contractually bound to protect your data.`,
  },
  {
    title: "Data Security",
    content: `We implement industry-standard security measures including encryption, secure servers, and regular audits. While no system is 100% secure, we continuously work to protect your information from unauthorized access, alteration, or destruction.`,
  },
  {
    title: "Cookies & Tracking",
    content: `We use cookies and similar technologies to enhance your experience, remember preferences, and analyze site traffic. You can control cookie settings through your browser. Disabling cookies may limit some platform functionality.`,
  },
  {
    title: "Your Rights",
    content: `You have the right to access, correct, or delete your personal data. You may also opt out of marketing communications at any time. To exercise these rights, contact us at support@fundingpulze.com. We will respond within 30 days.`,
  },
  {
    title: "Data Retention",
    content: `We retain your personal information for as long as your account is active or as needed to provide services. We may retain certain data longer to comply with legal obligations, resolve disputes, and enforce agreements.`,
  },
  {
    title: "Changes to This Policy",
    content: `We may update this Privacy Policy periodically. We will notify you of material changes via email or a prominent notice on our platform. Your continued use after changes constitutes acceptance of the updated policy.`,
  },
];

const defaultSections = sections;

const Privacy = () => {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const heroRef = useRef<HTMLDivElement>(null);
  const { get, hasCmsContent } = usePageContent("privacy");

  // Build sections from CMS or use defaults
  const displaySections = hasCmsContent
    ? defaultSections.map((s, i) => ({
        title: get(`section-${i}`, { title: s.title, content: s.content }).title,
        content: get(`section-${i}`, { title: s.title, content: s.content }).content,
      }))
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
          <Shield size={14} className="text-foreground" />
          <span>Your Data, Protected</span>
        </div>
        <h1 className="legal-title font-display text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 opacity-0">
          Privacy <span className="text-gradient">Policy</span>
        </h1>
        <p className="legal-sub text-muted-foreground max-w-lg mx-auto opacity-0">
          Last updated: March 2026. We take your privacy seriously.
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
      <h2 className="font-display text-xl font-semibold mb-3">{title}</h2>
      <p className="text-muted-foreground leading-relaxed text-sm">{content}</p>
    </motion.div>
  );
};

export default Privacy;
