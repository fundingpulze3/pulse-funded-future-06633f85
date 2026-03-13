import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import logo from "@/assets/logo.png";

const footerLinks = {
  Company: [
    { label: "About", href: "/about" },
    { label: "Careers", href: "#" },
  ],
  Resources: [
    { label: "FAQ", href: "/faq" },
    { label: "Help Center", href: "/help" },
    { label: "Blog", href: "/blog" },
  ],
  Legal: [
    { label: "Terms", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
  ],
};

const socialLinks = [
  { label: "Twitter", href: "https://x.com/fundingpulze?s=21&t=HnmtAeK4eOjcPiFqGHz5lw" },
  { label: "Discord", href: "https://discord.gg/YgWhnxNewG" },
  { label: "Instagram", href: "https://www.instagram.com/funding_pulze?igsh=MXZnd2J3dGp6ZGxkbw==" },
];

const Footer = () => {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <footer ref={ref} className="relative border-t border-border/50 overflow-hidden">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-2/3 max-w-xl"
        style={{
          background: `linear-gradient(90deg, transparent, hsl(var(--glow-primary) / 0.15), transparent)`,
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-10">
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-5">
              <img src={logo} alt="Funding Pulze" className="h-8 w-8 rounded" />
              <h3 className="font-display text-xl font-bold">
                Funding<span className="text-gradient"> Pulze</span>
              </h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px]">
              Empowering traders worldwide with funded accounts and institutional capital.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links], colIdx) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 15 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + colIdx * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <h4 className="font-display font-semibold text-foreground text-sm mb-4 tracking-wide">
                {title}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 relative group"
                    >
                      {link.label}
                      <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-foreground/30 transition-all duration-300 group-hover:w-full" />
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        {/* Divider */}
        <div
          className="h-px w-full mb-8"
          style={{
            background: `linear-gradient(90deg, transparent, hsl(var(--border)), transparent)`,
          }}
        />

        {/* Bottom bar */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Funding Pulze. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-300"
              >
                {social.label}
              </a>
            ))}
          </div>
        </motion.div>

        {/* Large branding + disclaimer */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <h2 className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground/[0.04] select-none leading-none mb-4">
            FUNDINGPULZE
          </h2>
          <p className="text-[10px] sm:text-xs text-muted-foreground/60 max-w-2xl mx-auto leading-relaxed">
            Disclaimer: All accounts provided by Funding Pulze are simulated accounts. They are not real brokerage accounts and do not involve real capital. 
            All trading activity, profits, and losses are entirely simulated for educational and evaluation purposes only. 
            Past simulated performance is not indicative of future results. Trading involves risk and is not suitable for everyone.
          </p>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
