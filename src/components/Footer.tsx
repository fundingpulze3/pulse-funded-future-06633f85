const footerLinks = {
  Company: ["About", "Careers"],
  Resources: [
    { label: "FAQ", href: "/faq" },
    { label: "Help Center", href: "https://help.fundingpulze.com", external: true },
    { label: "Blog", href: "#" },
  ],
  Legal: ["Terms", "Privacy Policy"],
};

const Footer = () => {
  return (
    <footer className="border-t border-border py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <h3 className="font-display text-xl font-bold mb-4">
              Funding<span className="text-gradient"> Pulze</span>
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Empowering traders worldwide with funded accounts and capital.
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-semibold text-foreground text-sm mb-4">{title}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => {
                  if (typeof link === "string") {
                    return (
                      <li key={link}>
                        <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300">
                          {link}
                        </a>
                      </li>
                    );
                  }
                  return (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noopener noreferrer" : undefined}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
                      >
                        {link.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Funding Pulze. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
