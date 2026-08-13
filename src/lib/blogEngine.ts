import { db as supabase } from "@/integrations/db/client";

const BASE = (import.meta.env.VITE_BLOG_ENGINE_URL || "").replace(/\/$/, "");

async function post(path: string, body: unknown = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error || `Engine error (${res.status})`);
  return data;
}

export type GeneratePayload = {
  topic: string;
  primary_keyword: string;
  secondary_keywords?: string;
  training_context?: string;
};

/** Article generation for the CMS editor. Uses the engine when configured. */
export async function generateBlog(payload: GeneratePayload) {
  if (BASE) return post("/api/generate-article", payload);
  const { data, error } = await supabase.functions.invoke("generate-seo-blog", { body: payload });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Writes + publishes one post immediately. */
export async function runAutoPublishNow() {
  if (!BASE) throw new Error("Set VITE_BLOG_ENGINE_URL to your Render service URL first.");
  return post("/api/run-slot");
}

export const engineConfigured = () => !!BASE;

export async function getEngineStatus() {
  if (!BASE) throw new Error("engine not configured");
  const res = await fetch(`${BASE}/api/status`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error || "engine unreachable");
  return data;
}

export async function saveEngineSettings(body: { auto?: boolean; slots?: string }) {
  return post("/api/settings", body);
}
