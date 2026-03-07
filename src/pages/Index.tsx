import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import WhyChoose from "@/components/WhyChoose";
import Shop from "@/components/Shop";
import CertificateShowcase from "@/components/CertificateShowcase";
import Roadmap from "@/components/Roadmap";
import Footer from "@/components/Footer";
import LoadingScreen from "@/components/LoadingScreen";
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
      <WhyChoose />
      <Roadmap />
      <CertificateShowcase />
      <Shop />
      <Footer />
    </div>
  );
};

export default Index;
