import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Briefcase, MapPin, ArrowRight, Users, Globe2, Zap } from "lucide-react";

const openRoles = [
  {
    title: "Risk Analyst",
    department: "Risk & Compliance",
    location: "Remote",
    type: "Full-time",
  },
  {
    title: "Customer Support Specialist",
    department: "Support",
    location: "Remote",
    type: "Full-time",
  },
  {
    title: "Growth Marketer",
    department: "Marketing",
    location: "Remote",
    type: "Full-time",
  },
  {
    title: "Backend Engineer",
    department: "Engineering",
    location: "Remote",
    type: "Full-time",
  },
];

const perks = [
  { icon: Globe2, title: "Remote-first", desc: "Work from anywhere in the world." },
  { icon: Zap, title: "Fast-moving", desc: "Ship real features that traders use every day." },
  { icon: Users, title: "Small team, big impact", desc: "Your work directly shapes the product." },
];

const Careers = () => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />

      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glow-border surface-elevated text-sm text-muted-foreground mb-6">
            <Briefcase size={14} className="text-primary" />
            <span>Careers</span>
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold mb-4">
            Build the future of <span className="text-gradient">funded trading</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            We're a small, remote team empowering traders worldwide with funded accounts.
            If you want your work to matter, we'd love to hear from you.
          </p>
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          {perks.map((p) => (
            <div key={p.title} className="surface-elevated rounded-2xl border border-border p-6 text-center">
              <p.icon size={22} className="text-primary mx-auto mb-3" />
              <h3 className="font-display font-bold text-sm mb-1">{p.title}</h3>
              <p className="text-xs text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-xl sm:text-2xl font-bold mb-6">Open Positions</h2>
          <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden surface-elevated">
            {openRoles.map((role) => (
              <a
                key={role.title}
                href={`mailto:careers@fundingpulze.com?subject=${encodeURIComponent(
                  "Application: " + role.title
                )}`}
                className="flex items-center justify-between gap-4 px-6 py-5 hover:bg-muted/40 transition-colors group"
              >
                <div>
                  <p className="font-semibold text-sm sm:text-base">{role.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    <span>{role.department}</span>
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {role.location}
                    </span>
                    <span>{role.type}</span>
                  </div>
                </div>
                <ArrowRight
                  size={16}
                  className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all shrink-0"
                />
              </a>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Don't see a role that fits? Send your resume to{" "}
            <a href="mailto:careers@fundingpulze.com" className="underline hover:text-foreground">
              careers@fundingpulze.com
            </a>
            .
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Careers;
