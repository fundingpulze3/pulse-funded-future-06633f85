import { useState, useEffect } from "react";
import { db as supabase } from "@/integrations/db/client";

export const useKillSwitch = () => {
  const [isKilled, setIsKilled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase
        .from("page_content")
        .select("content")
        .eq("page_slug", "system")
        .eq("section_key", "kill_switch")
        .maybeSingle();

      setIsKilled(data?.content === "true");
      setLoading(false);
    };
    check();
  }, []);

  const toggle = async (value: boolean) => {
    const { data: existing, error: selErr } = await supabase
      .from("page_content")
      .select("id")
      .eq("page_slug", "system")
      .eq("section_key", "kill_switch")
      .maybeSingle();

    if (selErr) throw selErr;

    if (existing) {
      const { error } = await supabase
        .from("page_content")
        .update({ content: value ? "true" : "false" })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("page_content").insert({
        page_slug: "system",
        section_key: "kill_switch",
        title: "Kill Switch",
        content: value ? "true" : "false",
      });
      if (error) throw error;
    }
    setIsKilled(value);
  };

  return { isKilled, loading, toggle };
};
