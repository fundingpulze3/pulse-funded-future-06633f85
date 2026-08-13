// Drop-in replacement for the Supabase Postgres client.
//
//  - `.from(...)`  -> MongoDB (via the `mongo-api` edge gateway)
//  - `.rpc(...)`   -> emulated against MongoDB
//  - `.auth`, `.storage`, `.functions`, `.channel` -> unchanged, still handled
//    by the existing backend (auth and file storage were kept there on purpose).
import { supabase as backend } from "@/integrations/supabase/client";
import { QueryBuilder, type DbResult, type QueryOp } from "./query-builder";

const GATEWAY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mongo-api`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function execute(op: QueryOp): Promise<DbResult> {
  let lastMessage = "Request failed";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { data: { session } } = await backend.auth.getSession();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      let res: Response;
      try {
        res = await fetch(GATEWAY, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: ANON,
            Authorization: `Bearer ${session?.access_token ?? ANON}`,
          },
          body: JSON.stringify({ op }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      // transient gateway/cold-start failures — retry
      if (res.status >= 500 || res.status === 429) {
        lastMessage = `Server busy (${res.status})`;
        if (attempt < MAX_ATTEMPTS) { await sleep(400 * attempt); continue; }
      }

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          data: null,
          error: { message: body?.error?.message ?? `Request failed (${res.status})` },
          count: null,
        };
      }
      return { data: body?.data ?? null, error: body?.error ?? null, count: body?.count ?? null };
    } catch (e) {
      // network error / abort — "Failed to fetch" lands here
      lastMessage =
        (e as Error).name === "AbortError"
          ? "The database took too long to respond. Please try again."
          : "Could not reach the database. Check your connection and try again.";
      if (attempt < MAX_ATTEMPTS) {
        await sleep(400 * attempt);
        continue;
      }
    }
  }

  return { data: null, error: { message: lastMessage }, count: null };
}


async function rpc(name: string, args: Record<string, any> = {}): Promise<DbResult> {
  if (name === "get_user_role" || name === "has_role") {
    const uid = args._user_id ?? args.user_id ?? args.uid;
    const r = await new QueryBuilder("user_roles", execute).select("role").eq("user_id", uid);
    if (r.error) return r;
    const roles = ((r.data as any[]) ?? []).map((x) => x.role);
    if (name === "has_role") {
      return { data: roles.includes(args._role ?? args.role), error: null };
    }
    const rank = ["administrator", "admin", "employee", "user"];
    const best = rank.find((x) => roles.includes(x)) ?? null;
    return { data: best, error: null };
  }
  return { data: null, error: { message: `Unsupported function: ${name}` } };
}

export const db = {
  from: <T = any>(collection: string) => new QueryBuilder<T>(collection, execute),
  rpc,
  // untouched surfaces — still the existing backend
  auth: backend.auth,
  storage: backend.storage,
  functions: backend.functions,
  channel: backend.channel.bind(backend),
  removeChannel: backend.removeChannel.bind(backend),
  realtime: backend.realtime,
};

export type { DbResult };
