import { useEffect, useRef, useState } from "react";
import { User, LogOut, Shield, Menu, X, LayoutDashboard } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

interface NavbarProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

const navLinks = [
  { label: "Home", href: "/#home", route: "/" },
  { label: "Challenges", href: "/#challenges" },
  { label: "Blog", href: "/blog", route: "/blog" },
  { label: "Help Center", href: "/help", route: "/help" },
  { label: "FAQ", href: "/faq", route: "/faq" },
  { label: "About", href: "/about", route: "/about" },
];

const Navbar = ({ isDark, onToggleTheme }: NavbarProps) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
    setMobileOpen(false);
  };

  const handleNav = (e: React.MouseEvent, link: typeof navLinks[0]) => {
    e.preventDefault();
    if (link.route) {
      navigate(link.route);
    } else if (link.href.startsWith("/#")) {
      // Hash link on same page
      if (window.location.pathname === "/") {
        const el = document.querySelector(link.href.replace("/", ""));
        el?.scrollIntoView({ behavior: "smooth" });
      } else {
        navigate("/");
        setTimeout(() => {
          const el = document.querySelector(link.href.replace("/", ""));
          el?.scrollIntoView({ behavior: "smooth" });
        }, 300);
      }
    }
    setMobileOpen(false);
  };

  return (
    <>
      <nav
        ref={navRef}
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 rounded-2xl glow-border ${
          scrolled ? "glass py-2 px-4 sm:px-6 w-[94%] max-w-5xl" : "glass py-3 px-4 sm:px-8 w-[96%] sm:w-[92%] max-w-6xl"
        }`}
      >
        <div className="flex items-center justify-between">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); setMobileOpen(false); }} className="flex items-center gap-2">
            <img src={logo} alt="Funding Pulze" className="h-8 w-8 rounded" />
            <span className="font-display text-xl font-bold text-foreground tracking-tight">Funding<span className="text-gradient"> Pulze</span></span>
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-5">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNav(e, link)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-300"
              >
                {link.label}
              </a>
            ))}
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

          <div className="flex items-center gap-2 sm:gap-3">

            {user ? (
              <div className="hidden sm:flex items-center relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
                >
                  <User size={16} className="text-background" />
                </button>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-12 z-50 w-44 rounded-xl border border-border bg-background shadow-xl py-1.5">
                      <button
                        onClick={() => { navigate("/dashboard"); setProfileOpen(false); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                      >
                        <LayoutDashboard size={15} /> Dashboards
                      </button>
                      <button
                        onClick={() => { handleSignOut(); setProfileOpen(false); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                      >
                        <LogOut size={15} /> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Button size="sm" className="hidden sm:inline-flex rounded-xl font-medium" onClick={() => navigate("/auth")}>
                Login
              </Button>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="absolute right-0 top-0 h-full w-[280px] bg-background border-l border-border shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col h-full pt-20 pb-8 px-6">
                <nav className="flex-1 space-y-1">
                  {navLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      onClick={(e) => handleNav(e, link)}
                      className="block py-3 px-4 rounded-xl text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
                    >
                      {link.label}
                    </a>
                  ))}
                  {isAdmin && (
                    <a
                      href="/admin"
                      onClick={(e) => { e.preventDefault(); navigate("/admin"); setMobileOpen(false); }}
                      className="flex items-center gap-2 py-3 px-4 rounded-xl text-base font-medium text-primary hover:bg-accent/50 transition-all"
                    >
                      <Shield size={16} /> Admin
                    </a>
                  )}
                </nav>

                {/* Bottom section */}
                <div className="border-t border-border pt-4 space-y-3">
                  {user ? (
                    <>
                      <button
                        onClick={() => { navigate("/dashboard"); setMobileOpen(false); }}
                        className="flex items-center gap-2 w-full py-3 px-4 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
                      >
                        <LayoutDashboard size={16} /> Dashboard
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 w-full py-3 px-4 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
                      >
                        <LogOut size={16} /> Sign Out
                      </button>
                    </>
                  ) : (
                    <Button className="w-full rounded-xl" onClick={() => { navigate("/auth"); setMobileOpen(false); }}>
                      Login
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
