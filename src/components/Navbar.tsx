import { useEffect, useRef, useState } from "react";
import { Moon, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

const Navbar = ({ isDark, onToggleTheme }: NavbarProps) => {
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const loadGsap = async () => {
      const { gsap } = await import("gsap");
      if (navRef.current) {
        gsap.fromTo(navRef.current, { y: -80, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" });
      }
    };
    loadGsap();
  }, []);

  const navItems = [
    { label: "Home", href: "#home" },
    { label: "FAQ", href: "#faq" },
    { label: "Affiliate Dashboard", href: "#affiliate" },
  ];

  return (
    <nav
      ref={navRef}
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 rounded-2xl glow-border ${
        scrolled ? "glass py-2 px-6 w-[90%] max-w-5xl" : "glass py-3 px-8 w-[92%] max-w-6xl"
      }`}
    >
      <div className="flex items-center justify-between">
        <a href="#home" className="font-display text-xl font-bold text-foreground tracking-tight">
          Funding<span className="text-gradient"> Pulze</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Button size="sm" className="rounded-xl font-medium">
            Login
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
