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
      {/* Maintenance Overlay */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xl">
        <div className="text-center px-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/20 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4">Under Maintenance</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">We're working on something awesome. Please check back soon!</p>
        </div>
      </div>

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
