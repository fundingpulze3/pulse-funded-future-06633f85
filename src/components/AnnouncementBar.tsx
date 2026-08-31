import { useEffect, useState } from "react";
import { db as supabase } from "@/integrations/db/client";
import { X, Sparkles } from "lucide-react";

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

  // Auto-detect a coupon-code-like token (e.g. "FP50") inside the message and
  // render it as its own pill, so admins can keep writing plain messages in
  // the CMS without needing a separate "code" field.
  const codeMatch = announcement.message.match(/\b[A-Z]{2,}\d{1,4}\b/);
  const code = codeMatch?.[0];
  const before = code ? announcement.message.slice(0, codeMatch.index) : announcement.message;
  const after = code ? announcement.message.slice((codeMatch.index ?? 0) + code.length) : "";

  return (
    <div
      className="relative z-[60] w-full overflow-hidden"
      style={{ backgroundColor: announcement.bg_color, color: announcement.text_color }}
    >
      {/* Subtle diagonal sheen for extra polish, independent of the admin-set color */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0" />

      <div className="relative w-full py-2.5 pl-4 pr-11 sm:pr-14 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center text-[11px] leading-snug sm:text-sm font-medium">
        <Sparkles size={13} className="shrink-0 opacity-90" />

        <span className="break-words">
          {before.trim()}
          {code && (
            <span
              className="mx-1.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs font-bold tracking-wider align-middle"
              style={{ backgroundColor: announcement.text_color, color: announcement.bg_color }}
            >
              {code}
            </span>
          )}
          {after.trim()}
        </span>

        {announcement.link_url && announcement.link_text && (
          <a
            href={announcement.link_url}
            className="underline font-semibold hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: announcement.text_color }}
          >
            {announcement.link_text}
          </a>
        )}
      </div>

      <button
        aria-label="Dismiss announcement"
        onClick={() => setDismissed(true)}
        className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 rounded-full p-1 opacity-70 hover:opacity-100 hover:bg-black/10 transition-all"
        style={{ color: announcement.text_color }}
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default AnnouncementBar;
