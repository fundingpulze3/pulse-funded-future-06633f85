import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
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
import LoadingScreen from "@/components/LoadingScreen";
import ScrollProgress from "@/components/ScrollProgress";
import { useUtmTracking } from "@/hooks/useUtmTracking";

const Index = () => {
  const [isDark, setIsDark] = useState(false);
  const [loading, setLoading] = useState(true);
  useUtmTracking();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  if (loading) {
    return <LoadingScreen onComplete={() => setLoading(false)} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />
      <Hero />
      <StatsBar />
      <WhyChoose />
      <Shop />
      <Roadmap />
      <CertificateShowcase />
      <Testimonials />
      <Community />
      <GlobeCTA />
      <Footer />
    </div>
  );
};

export default Index;
