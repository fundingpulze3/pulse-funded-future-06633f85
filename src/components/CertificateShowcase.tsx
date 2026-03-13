import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Award, ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";

interface Certificate {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  sort_order: number;
}

const CertificateShowcase = () => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("certificates")
        .select("id, title, description, image_url, sort_order")
        .eq("is_visible", true)
        .order("sort_order", { ascending: true });
      if (data) setCertificates(data);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading || certificates.length === 0) return null;

  const active = certificates[activeIndex];

  return (
    <section className="py-24 px-6 relative overflow-hidden">
      {/* Subtle ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-foreground/[0.02] blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-foreground/[0.05] border border-border/50 text-xs font-medium text-muted-foreground mb-5">
            <Award size={13} />
            Trusted & Verified
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
            Our Testimonials
          </h2>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto text-sm md:text-base">
            Trusted by traders worldwide. See what our partners and certifications say about us.
          </p>
        </motion.div>

        {/* Main showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
          {/* Left — Active Certificate (Large Preview) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative group"
          >
            {/* Glass card */}
            <div className="rounded-2xl overflow-hidden border border-border/50 bg-card/50 backdrop-blur-sm">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="relative aspect-[16/10] overflow-hidden cursor-pointer"
                  onClick={() => setLightboxOpen(true)}
                >
                  <img
                    src={active.image_url}
                    alt={active.title}
                    className="w-full h-full object-contain bg-background/50 p-6 transition-transform duration-700 group-hover:scale-[1.02]"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/[0.03] transition-colors duration-300 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-12 h-12 rounded-full bg-background/80 backdrop-blur-md border border-border/50 flex items-center justify-center shadow-lg">
                        <ZoomIn size={18} className="text-foreground" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Info bar */}
              <div className="px-6 py-5 border-t border-border/30">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                  >
                    <h3 className="font-display text-lg font-bold">{active.title}</h3>
                    {active.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{active.description}</p>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-mono">
                    {String(activeIndex + 1).padStart(2, "0")} / {String(certificates.length).padStart(2, "0")}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setActiveIndex(activeIndex > 0 ? activeIndex - 1 : certificates.length - 1)}
                      className="w-8 h-8 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition-all"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => setActiveIndex(activeIndex < certificates.length - 1 ? activeIndex + 1 : 0)}
                      className="w-8 h-8 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition-all"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right — Thumbnail Grid */}
          <div className="flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
            {certificates.map((cert, i) => (
              <motion.button
                key={cert.id}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                onClick={() => setActiveIndex(i)}
                className={`shrink-0 w-[140px] lg:w-full rounded-xl overflow-hidden border transition-all duration-300 ${
                  i === activeIndex
                    ? "border-foreground/20 shadow-md ring-1 ring-foreground/10 scale-[1.02]"
                    : "border-border/30 hover:border-border/60 opacity-60 hover:opacity-100"
                }`}
              >
                <div className="aspect-[4/3] overflow-hidden bg-background/50">
                  <img
                    src={cert.image_url}
                    alt={cert.title}
                    className="w-full h-full object-contain p-2 transition-transform duration-300 hover:scale-105"
                  />
                </div>
                <div className="px-3 py-2 text-left">
                  <p className={`text-[11px] font-medium truncate ${
                    i === activeIndex ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {cert.title}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-xl"
            onClick={() => setLightboxOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-5xl max-h-[90vh] mx-6"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={active.image_url}
                alt={active.title}
                className="w-full h-full object-contain rounded-2xl"
              />
              <button
                onClick={() => setLightboxOpen(false)}
                className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-background border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background/90 to-transparent rounded-b-2xl">
                <h3 className="font-display text-xl font-bold">{active.title}</h3>
                {active.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{active.description}</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default CertificateShowcase;
