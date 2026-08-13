import { useEffect, useCallback } from "react";
import { db as supabase } from "@/integrations/db/client";

const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const UTM_STORAGE_KEY = "fp_utm_params";
const SESSION_ID_KEY = "fp_session_id";

export interface UtmData {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

/** Capture UTM params from URL and persist to sessionStorage */
export function captureUtmParams(): UtmData {
  const params = new URLSearchParams(window.location.search);
  const stored = getStoredUtm();

  const utm: UtmData = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null,
  };

  let hasNew = false;
  for (const key of UTM_PARAMS) {
    const value = params.get(key);
    if (value) {
      utm[key] = value;
      hasNew = true;
    } else {
      utm[key] = stored[key];
    }
  }

  // Only overwrite stored if we found new UTM params (first-touch attribution)
  if (hasNew) {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
    // Also persist to localStorage for cross-session attribution
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  }

  return utm;
}

/** Get stored UTM params (session first, then localStorage fallback) */
export function getStoredUtm(): UtmData {
  const empty: UtmData = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null,
  };

  try {
    const session = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (session) return JSON.parse(session);

    const local = localStorage.getItem(UTM_STORAGE_KEY);
    if (local) return JSON.parse(local);
  } catch {
    // ignore
  }

  return empty;
}

/** Check if there are any UTM params stored */
export function hasUtmData(utm: UtmData): boolean {
  return Object.values(utm).some((v) => v !== null && v !== "");
}

/** Hook: capture UTM on mount, log page visit */
export function useUtmTracking() {
  useEffect(() => {
    // Skip tracking for Lovable preview/editor
    const fullUrl = window.location.href;
    if (
      fullUrl.includes("lovable") ||
      fullUrl.includes("__lovable") ||
      document.referrer.includes("lovable")
    ) {
      return;
    }

    const utm = captureUtmParams();
    const sessionId = getSessionId();

    // Log page visit asynchronously
    supabase
      .from("page_visits")
      .insert({
        session_id: sessionId,
        page_url: window.location.pathname,
        referrer: document.referrer || null,
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
        utm_term: utm.utm_term,
        utm_content: utm.utm_content,
      } as any)
      .then(() => {});
  }, []);

  const getUtm = useCallback((): UtmData => {
    return getStoredUtm();
  }, []);

  return { getUtm };
}
