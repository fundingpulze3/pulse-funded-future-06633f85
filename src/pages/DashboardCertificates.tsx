import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Award, Download, Eye } from "lucide-react";
import { motion } from "framer-motion";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

interface UserCert {
  id: string;
  title: string;
  description: string | null;
  certificate_type: string;
  certificate_image_url: string | null;
  pdf_url: string | null;
  account_number: string | null;
  created_at: string;
}

const DashboardCertificates = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [certs, setCerts] = useState<UserCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ display_name: string | null } | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    if (!meta) { meta = document.createElement("meta"); meta.name = "robots"; document.head.appendChild(meta); }
    meta.content = "noindex, nofollow";
    return () => { if (meta) meta.remove(); };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth"); return; }
    if (user) {
      Promise.all([
        supabase.from("user_certificates").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
      ]).then(([certRes, profRes]) => {
        const validTypes = ["phase1_passed", "phase2_passed", "funded", "payout"];
        const realCerts = ((certRes.data as any) || []).filter((c: any) => validTypes.includes(c.certificate_type));
        setCerts(realCerts);
        setProfile(profRes.data);
        setLoading(false);
      });
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,4%)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[hsl(207,90%,77%)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const typeLabel: Record<string, string> = {
    phase1_passed: "Phase 1 Passed",
    phase2_passed: "Phase 2 Passed",
    funded: "Funded",
    payout: "Payout",
  };

  return (
    <div className="min-h-screen bg-[hsl(220,20%,4%)] text-[hsl(0,0%,92%)] flex flex-col">
      <DashboardSidebar profile={profile} />

      <div className="flex flex-1 overflow-hidden">
        {/* Spacer for desktop sidebar */}
        <div className="hidden lg:block w-16 shrink-0" />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-4 lg:p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-[hsl(207,90%,77%)]/15 flex items-center justify-center">
                <Award size={18} className="text-[hsl(207,90%,77%)]" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold">My Certificates</h1>
                <p className="text-xs text-[hsl(220,15%,45%)]">{certs.length} certificate{certs.length !== 1 ? "s" : ""} earned</p>
              </div>
            </div>

            {certs.length === 0 ? (
              <div className="text-center py-20 text-[hsl(220,15%,35%)]">
                <Award size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No certificates earned yet. Keep trading!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {certs.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,12%)] overflow-hidden group"
                  >
                    {c.certificate_image_url && (
                      <div
                        className="aspect-[16/11] bg-[hsl(220,15%,5%)] overflow-hidden cursor-pointer relative"
                        onClick={() => setLightbox(c.certificate_image_url)}
                      >
                        <img src={c.certificate_image_url} alt={c.title} className="w-full h-full object-contain p-3" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <Eye size={20} className="opacity-0 group-hover:opacity-80 text-white transition-opacity" />
                        </div>
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-xs font-bold">{c.title}</p>
                      <p className="text-[10px] text-[hsl(220,15%,40%)] mt-0.5">
                        {typeLabel[c.certificate_type] || c.certificate_type} {c.account_number ? `· #${c.account_number}` : ""}
                      </p>
                      <p className="text-[10px] text-[hsl(220,15%,35%)] mt-1">{new Date(c.created_at).toLocaleDateString()}</p>
                      {c.pdf_url && (
                        <a href={c.pdf_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-[hsl(207,90%,77%)] hover:underline">
                          <Download size={10} /> Download PDF
                        </a>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Certificate" className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default DashboardCertificates;
