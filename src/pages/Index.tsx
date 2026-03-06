import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Shop from "@/components/Shop";
import Footer from "@/components/Footer";

const Index = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />
      <Hero />
      <Shop />
      <Footer />
    </div>
  );
};

export default Index;
