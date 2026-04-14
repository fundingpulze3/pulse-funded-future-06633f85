import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import AnnouncementBar from "@/components/AnnouncementBar";
import Hero from "@/components/Hero";
import MarqueeTrustBar from "@/components/MarqueeTrustBar";
import WhyChoose from "@/components/WhyChoose";
import ComparisonSection from "@/components/ComparisonSection";
import Shop from "@/components/Shop";
import PayoutFeed from "@/components/PayoutFeed";
import CertificateShowcase from "@/components/CertificateShowcase";
import Roadmap from "@/components/Roadmap";
import PlatformPreview from "@/components/PlatformPreview";
import StatsBar from "@/components/StatsBar";
import Testimonials from "@/components/Testimonials";
import Community from "@/components/Community";
import GlobeCTA from "@/components/GlobeCTA";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/ScrollProgress";
import { useUtmTracking } from "@/hooks/useUtmTracking";

const Index = () => {
  const [isDark, setIsDark] = useState(true);
  useUtmTracking();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Scroll to hash section on load
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
      }, 400);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground relative">

      <AnnouncementBar />
      <ScrollProgress />
      <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />
      <Hero />
      <MarqueeTrustBar />
      <StatsBar />
      <WhyChoose />
      <ComparisonSection />
      <div className="section-divider" />
      <Shop />
      <PayoutFeed />
      <div className="section-divider" />
      <Roadmap />
      <PlatformPreview />
      <div className="section-divider" />
      <CertificateShowcase />
      <Testimonials />
      <Community />
      <GlobeCTA />
      <Footer />
    </div>
  );
};

export default Index;
