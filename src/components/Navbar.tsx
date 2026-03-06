import { useEffect, useRef, useState } from "react";
import { Moon, Sun, User, LogOut, Shield, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useNavigate } from "react-router-dom";

interface NavbarProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

const Navbar = ({ isDark, onToggleTheme }: NavbarProps) => {
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminCheck();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav
      ref={navRef}
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 rounded-2xl glow-border ${
        scrolled ? "glass py-2 px-6 w-[90%] max-w-5xl" : "glass py-3 px-8 w-[92%] max-w-6xl"
      }`}
    >
      <div className="flex items-center justify-between">
        <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="font-display text-xl font-bold text-foreground tracking-tight">
          Funding<span className="text-gradient"> Pulze</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          <a href="/#home" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-300">Home</a>
          <a href="/#rules" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-300">Challenges</a>
          <a
            href="/faq"
            onClick={(e) => { e.preventDefault(); navigate("/faq"); }}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-300"
          >
            FAQ
          </a>
          <a
            href="/affiliate"
            onClick={(e) => { e.preventDefault(); navigate("/affiliate"); }}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-300"
          >
            Affiliate Dashboard
          </a>
          <a
            href="https://help.fundingpulze.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-300 flex items-center gap-1"
          >
            <HelpCircle size={14} /> Help Center
          </a>
          {isAdmin && (
            <a
              href="/admin"
              onClick={(e) => { e.preventDefault(); navigate("/admin"); }}
              className="text-sm font-medium text-primary hover:text-accent transition-colors duration-300 flex items-center gap-1"
            >
              <Shield size={14} /> Admin
            </a>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <User size={16} className="text-primary-foreground" />
              </div>
              <button onClick={handleSignOut} className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Sign out">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Button size="sm" className="rounded-xl font-medium" onClick={() => navigate("/auth")}>
              Login
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
