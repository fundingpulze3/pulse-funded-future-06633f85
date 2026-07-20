import { supabase } from "@/integrations/supabase/client";

export type GeneratePayload = {
  topic: string;
  primary_keyword: string;
  secondary_keywords?: string;
  training_context?: string;
};

const BASE = (import.meta.env.VITE_BLOG_ENGINE_URL || "").replace(/\/$/, "");

/**
 * Calls the blog engine service on Render when VITE_BLOG_ENGINE_URL is set,
 * otherwise falls back to the Supabase edge function so nothing breaks.
 */
export async function generateBlog(payload: GeneratePayload) {
  if (!BASE) {
    const { data, error } = await supabase.functions.invoke("generate-seo-blog", { body: payload });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error || `Engine error (${res.status})`);
  return data;
}

/** Runs the auto-publish timer once, now. Admin only. */
export async function runAutoPublishNow() {
  if (!BASE) throw new Error("Set VITE_BLOG_ENGINE_URL to the Render service URL first.");
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BASE}/api/auto-publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error || `Engine error (${res.status})`);
  return data;
}
