import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

const AnnouncementBar = () => {
  const [announcement, setAnnouncement] = useState<{
    message: string;
    bg_color: string;
    text_color: string;
    link_url: string | null;
    link_text: string | null;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("announcement_bar")
        .select("message, bg_color, text_color, link_url, link_text, is_active")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (data && data.message) setAnnouncement(data);
    };
    fetch();
  }, []);

  if (!announcement || dismissed) return null;

  return (
    <div
      className="w-full py-2.5 px-4 text-center text-sm font-medium relative z-[60] flex items-center justify-center gap-2"
      style={{ backgroundColor: announcement.bg_color, color: announcement.text_color }}
    >
      <span>{announcement.message}</span>
      {announcement.link_url && announcement.link_text && (
        <a
          href={announcement.link_url}
          className="underline font-semibold hover:opacity-80 transition-opacity"
          style={{ color: announcement.text_color }}
        >
          {announcement.link_text}
        </a>
      )}
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity"
        style={{ color: announcement.text_color }}
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default AnnouncementBar;
