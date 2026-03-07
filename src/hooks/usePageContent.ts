import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PageSection {
  section_key: string;
  title: string | null;
  content: string;
}

export const usePageContent = (pageSlug: string) => {
  const [sections, setSections] = useState<Record<string, PageSection>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("page_content")
        .select("section_key, title, content")
        .eq("page_slug", pageSlug)
        .order("sort_order", { ascending: true });

      if (data && data.length > 0) {
        const map: Record<string, PageSection> = {};
        data.forEach((s) => { map[s.section_key] = s; });
        setSections(map);
      }
      setLoading(false);
    };
    fetch();
  }, [pageSlug]);

  const get = (key: string, fallback: { title?: string; content: string }) => {
    const s = sections[key];
    return {
      title: s?.title ?? fallback.title ?? "",
      content: s?.content ?? fallback.content,
    };
  };

  return { get, loading, hasCmsContent: Object.keys(sections).length > 0 };
};
