import { useEffect, useState } from "react";
import { db as supabase } from "@/integrations/db/client";
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
      className="w-full py-2 pl-4 pr-10 sm:pr-12 text-center text-[11px] leading-snug sm:text-sm font-medium relative z-[60] flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5"
      style={{ backgroundColor: announcement.bg_color, color: announcement.text_color }}
    >
      <span className="break-words">{announcement.message}</span>
      {announcement.link_url && announcement.link_text && (
        <a
          href={announcement.link_url}
          className="underline font-semibold hover:opacity-80 transition-opacity whitespace-nowrap"
          style={{ color: announcement.text_color }}
        >
          {announcement.link_text}
        </a>
      )}
      <button
        aria-label="Dismiss announcement"
        onClick={() => setDismissed(true)}
        className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity p-1"
        style={{ color: announcement.text_color }}
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default AnnouncementBar;
