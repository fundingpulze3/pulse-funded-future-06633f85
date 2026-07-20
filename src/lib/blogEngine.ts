import { supabase } from "@/integrations/supabase/client";

export type GeneratePayload = {
  topic: string;
  primary_keyword: string;
  secondary_keywords?: string;
  training_context?: string;
};

/** One-off article generation for the CMS editor (Claude, cost-capped). */
export async function generateBlog(payload: GeneratePayload) {
  const { data, error } = await supabase.functions.invoke("generate-seo-blog", { body: payload });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Runs one auto-post slot immediately. Admin only. */
export async function runAutoPublishNow() {
  const { data, error } = await supabase.functions.invoke("blog-engine", { body: { action: "run_slot" } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
