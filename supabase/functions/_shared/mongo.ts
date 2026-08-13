// Shared MongoDB access layer.
// Compiles PostgREST-style ops (see src/integrations/db/query-builder.ts)
// into MongoDB queries, and enforces access rules that replace RLS.
import { MongoClient, Db } from "npm:mongodb@6";

let client: MongoClient | null = null;
let dbRef: Db | null = null;

export async function getDb(): Promise<Db> {
  if (dbRef) return dbRef;
  const uri = Deno.env.get("MONGODB_URI");
  if (!uri) throw new Error("MONGODB_URI not configured");
  client = new MongoClient(uri, { maxPoolSize: 5 });
  await client.connect();
  dbRef = client.db();
  return dbRef;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Filter { op: string; col: string; val: any; inner?: string }
export interface QueryOp {
  collection: string;
  action: "select" | "insert" | "update" | "upsert" | "delete";
  select?: string;
  filters: Filter[];
  order: { col: string; ascending: boolean }[];
  limit?: number;
  range?: { from: number; to: number };
  values?: any;
  onConflict?: string;
  single?: boolean;
  maybeSingle?: boolean;
  count?: "exact" | null;
  head?: boolean;
}

export interface Ctx {
  userId: string | null;
  isAdmin: boolean;
  serviceRole: boolean;
}

// ---------------------------------------------------------------------------
// Access policy — the RLS replacement
// ---------------------------------------------------------------------------
type Policy = {
  /** field holding the owning user's id */
  owner?: string;
  /** anyone (even signed out) may read */
  publicRead?: boolean;
  /** additional constraint applied to public reads */
  publicReadWhere?: Record<string, any>;
  /** signed-in users may insert rows they own */
  ownerInsert?: boolean;
  /** signed-in users may update/delete rows they own */
  ownerWrite?: boolean;
  /** any signed-in user may read all rows */
  authRead?: boolean;
  /** any signed-in user may insert (e.g. analytics, feedback) */
  anyInsert?: boolean;
};

const POLICIES: Record<string, Policy> = {
  // Public marketing / content
  blog_posts: { publicRead: true, publicReadWhere: { is_published: true } },
  help_articles: { publicRead: true, publicReadWhere: { is_published: true } },
  help_collections: { publicRead: true },
  page_content: { publicRead: true },
  challenges: { publicRead: true },
  announcement_bar: { publicRead: true },
  certificates: { publicRead: true },
  certificate_templates: { publicRead: true },
  knowledge_base: { publicRead: true },
  coupons: { publicRead: true },
  help_article_feedback: { publicRead: true, anyInsert: true },
  page_visits: { publicRead: false, anyInsert: true },

  // User-owned
  profiles: { owner: "user_id", ownerWrite: true, ownerInsert: true },
  challenge_purchases: { owner: "user_id", ownerInsert: true },
  kyc_submissions: { owner: "user_id", ownerInsert: true, ownerWrite: true },
  payout_requests: { owner: "user_id", ownerInsert: true },
  user_certificates: { owner: "user_id" },
  account_status_history: { owner: "user_id" },
  ai_conversations: { owner: "user_id", ownerInsert: true, ownerWrite: true },
  blog_ai_conversations: { owner: "user_id", ownerInsert: true, ownerWrite: true },
  trading_credentials: { owner: "assigned_to" },
  user_roles: { owner: "user_id" },
  affiliate_referrals: { owner: "referrer_user_id" },
  help_support_tickets: { owner: "user_id", ownerInsert: true, ownerWrite: true },

  // Child tables reachable only through an owned parent — read for signed-in
  ai_messages: { authRead: true, anyInsert: true },
  blog_ai_messages: { authRead: true, anyInsert: true },
  support_ticket_messages: { authRead: true, anyInsert: true },
  ctrader_snapshots: { authRead: true },
  ctrader_sync_state: { authRead: true },

  // Trading competitions — public leaderboard, users manage their own entry
  competitions: { publicRead: true },
  competition_participants: {
    publicRead: true,
    owner: "user_id",
    ownerInsert: true,
    ownerWrite: true,
    authRead: true,
  },
};

/** Everything not listed above is admin-only. */
function policyFor(c: string): Policy { return POLICIES[c] ?? {}; }

export function applyPolicy(op: QueryOp, ctx: Ctx): QueryOp {
  if (ctx.serviceRole || ctx.isAdmin) return op;
  const p = policyFor(op.collection);

  if (op.action === "select") {
    if (ctx.userId && p.owner) {
      // Owner sees their rows; public rows stay visible when allowed.
      if (p.publicRead) {
        op.filters.push({ op: "__or_owner_public", col: p.owner, val: p.publicReadWhere ?? {} });
      } else {
        op.filters.push({ op: "eq", col: p.owner, val: ctx.userId });
      }
      return op;
    }
    if (ctx.userId && p.authRead) return op;
    if (p.publicRead) {
      if (p.publicReadWhere) {
        for (const [k, v] of Object.entries(p.publicReadWhere)) {
          op.filters.push({ op: "eq", col: k, val: v });
        }
      }
      return op;
    }
    throw new Error(`Not authorized to read ${op.collection}`);
  }

  if (op.action === "insert" || op.action === "upsert") {
    if (!ctx.userId) throw new Error(`Not authorized to write ${op.collection}`);
    if (p.anyInsert) return op;
    if (p.ownerInsert && p.owner) {
      const rows = Array.isArray(op.values) ? op.values : [op.values];
      for (const r of rows) {
        if (r[p.owner] && r[p.owner] !== ctx.userId) {
          throw new Error(`Cannot write ${op.collection} for another user`);
        }
        r[p.owner] = ctx.userId;
      }
      return op;
    }
    throw new Error(`Not authorized to write ${op.collection}`);
  }

  // update / delete
  if (!ctx.userId || !p.ownerWrite || !p.owner) {
    throw new Error(`Not authorized to modify ${op.collection}`);
  }
  op.filters.push({ op: "eq", col: p.owner, val: ctx.userId });
  return op;
}

// ---------------------------------------------------------------------------
// Filter compilation
// ---------------------------------------------------------------------------
function likeToRegex(pattern: string, ci: boolean) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return { $regex: `^${escaped}$`, $options: ci ? "i" : "" };
}

function parseOrExpr(expr: string): any[] {
  // "a.eq.1,b.ilike.%x%"
  return expr.split(/,(?![^(]*\))/).map((part) => {
    const [col, op, ...rest] = part.split(".");
    const raw = rest.join(".");
    const val = raw === "null" ? null : raw === "true" ? true : raw === "false" ? false : raw;
    switch (op) {
      case "eq": return { [col]: val };
      case "neq": return { [col]: { $ne: val } };
      case "gt": return { [col]: { $gt: val } };
      case "gte": return { [col]: { $gte: val } };
      case "lt": return { [col]: { $lt: val } };
      case "lte": return { [col]: { $lte: val } };
      case "is": return { [col]: val };
      case "like": return { [col]: likeToRegex(String(val), false) };
      case "ilike": return { [col]: likeToRegex(String(val), true) };
      case "in": return { [col]: { $in: String(raw).replace(/^\(|\)$/g, "").split(",") } };
      default: return {};
    }
  });
}

export function compileFilters(filters: Filter[], ctxUserId?: string | null): Record<string, any> {
  const and: any[] = [];
  for (const f of filters) {
    switch (f.op) {
      case "eq": and.push({ [f.col]: f.val }); break;
      case "neq": and.push({ [f.col]: { $ne: f.val } }); break;
      case "gt": and.push({ [f.col]: { $gt: f.val } }); break;
      case "gte": and.push({ [f.col]: { $gte: f.val } }); break;
      case "lt": and.push({ [f.col]: { $lt: f.val } }); break;
      case "lte": and.push({ [f.col]: { $lte: f.val } }); break;
      case "in": and.push({ [f.col]: { $in: f.val } }); break;
      case "is": and.push({ [f.col]: f.val === null ? null : f.val }); break;
      case "like": and.push({ [f.col]: likeToRegex(String(f.val), false) }); break;
      case "ilike": and.push({ [f.col]: likeToRegex(String(f.val), true) }); break;
      case "contains": and.push({ [f.col]: { $all: Array.isArray(f.val) ? f.val : [f.val] } }); break;
      case "match": Object.entries(f.val ?? {}).forEach(([k, v]) => and.push({ [k]: v })); break;
      case "not": {
        const inner = f.inner ?? "eq";
        if (inner === "is") and.push({ [f.col]: { $ne: f.val } });
        else and.push({ [f.col]: { $not: { $eq: f.val } } });
        break;
      }
      case "or": and.push({ $or: parseOrExpr(String(f.val)) }); break;
      case "__or_owner_public": {
        and.push({ $or: [{ [f.col]: ctxUserId }, f.val && Object.keys(f.val).length ? f.val : {}] });
        break;
      }
    }
  }
  return and.length ? { $and: and } : {};
}

// ---------------------------------------------------------------------------
// Embedded selects:  "*, challenges(name, account_size)"
// ---------------------------------------------------------------------------
interface Embed { table: string; fields: string[] }

function parseSelect(sel?: string): { fields: string[]; embeds: Embed[] } {
  const embeds: Embed[] = [];
  if (!sel || sel === "*") return { fields: [], embeds };
  const rest = sel.replace(/(\w+)\s*\(([^)]*)\)/g, (_m, table, inner) => {
    embeds.push({ table, fields: inner.split(",").map((s: string) => s.trim()).filter(Boolean) });
    return "";
  });
  const fields = rest.split(",").map((s) => s.trim()).filter((s) => s && s !== "*");
  return { fields, embeds };
}

/** foreign-key column used to join an embedded table */
function fkFor(table: string): string {
  const singular = table.endsWith("s") ? table.slice(0, -1) : table;
  return `${singular}_id`;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------
export async function runOp(rawOp: QueryOp, ctx: Ctx) {
  const db = await getDb();
  const op = applyPolicy({ ...rawOp, filters: [...(rawOp.filters ?? [])] }, ctx);
  const col = db.collection(op.collection);
  const now = new Date().toISOString();

  if (op.action === "insert" || op.action === "upsert") {
    const rows = (Array.isArray(op.values) ? op.values : [op.values]).map((r: any) => ({
      id: r.id ?? crypto.randomUUID(),
      created_at: r.created_at ?? now,
      updated_at: now,
      ...r,
    })).map((r: any) => ({ ...r, _id: r.id }));

    if (op.action === "upsert") {
      const key = op.onConflict?.split(",").map((s) => s.trim()) ?? ["id"];
      for (const r of rows) {
        const q: Record<string, any> = {};
        for (const k of key) q[k] = r[k];
        await col.updateOne(q, { $set: { ...r, updated_at: now } }, { upsert: true });
      }
    } else {
      await col.insertMany(rows as any[]);
    }
    const data = rows.map(strip);
    return { data: op.single || op.maybeSingle ? data[0] ?? null : op.select ? data : null, count: data.length };
  }

  const filter = compileFilters(op.filters, ctx.userId);

  if (op.action === "update") {
    const patch = { ...op.values, updated_at: now };
    delete patch._id;
    const found = await col.find(filter).toArray();
    await col.updateMany(filter, { $set: patch });
    const data = found.map((d: any) => strip({ ...d, ...patch }));
    return { data: op.single || op.maybeSingle ? data[0] ?? null : op.select ? data : null, count: data.length };
  }

  if (op.action === "delete") {
    const found = op.select ? await col.find(filter).toArray() : [];
    const res = await col.deleteMany(filter);
    return { data: op.select ? found.map(strip) : null, count: res.deletedCount };
  }

  // select
  const total = op.count === "exact" ? await col.countDocuments(filter) : null;
  if (op.head) return { data: null, count: total };

  const sort: Record<string, 1 | -1> = {};
  for (const o of op.order) sort[o.col] = o.ascending ? 1 : -1;

  let cursor = col.find(filter);
  if (Object.keys(sort).length) cursor = cursor.sort(sort);
  if (op.range) cursor = cursor.skip(op.range.from).limit(op.range.to - op.range.from + 1);
  if (op.limit) cursor = cursor.limit(op.limit);
  if (op.single || op.maybeSingle) cursor = cursor.limit(2);

  let docs = (await cursor.toArray()).map(strip);

  // resolve embedded relations
  const { embeds } = parseSelect(op.select);
  for (const e of embeds) {
    const fk = fkFor(e.table);
    const ids = [...new Set(docs.map((d: any) => d[fk]).filter(Boolean))];
    if (!ids.length) { docs.forEach((d: any) => (d[e.table] = null)); continue; }
    const related = await db.collection(e.table).find({ id: { $in: ids } }).toArray();
    const map = new Map(related.map((r: any) => [r.id, strip(r)]));
    docs.forEach((d: any) => (d[e.table] = map.get(d[fk]) ?? null));
  }

  if (op.single) {
    if (docs.length !== 1) {
      return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" }, count: total };
    }
    return { data: docs[0], count: total };
  }
  if (op.maybeSingle) return { data: docs[0] ?? null, count: total };
  return { data: docs, count: total };
}

function strip(doc: any) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

// ---------------------------------------------------------------------------
// Server-side supabase-compatible facade for edge functions
// ---------------------------------------------------------------------------
export function mongoFrom(collection: string, ctx: Ctx = { userId: null, isAdmin: true, serviceRole: true }) {
  const op: QueryOp = { collection, action: "select", filters: [], order: [] };
  const builder: any = {
    select(sel = "*", o?: any) { op.select = sel; if (o?.count) op.count = o.count; if (o?.head) op.head = true; return builder; },
    insert(v: any) { op.action = "insert"; op.values = v; return builder; },
    update(v: any) { op.action = "update"; op.values = v; return builder; },
    upsert(v: any, o?: any) { op.action = "upsert"; op.values = v; op.onConflict = o?.onConflict; return builder; },
    delete() { op.action = "delete"; return builder; },
    order(c: string, o?: any) { op.order.push({ col: c, ascending: o?.ascending !== false }); return builder; },
    limit(n: number) { op.limit = n; return builder; },
    range(a: number, b: number) { op.range = { from: a, to: b }; return builder; },
    single() { op.single = true; return builder; },
    maybeSingle() { op.maybeSingle = true; return builder; },
    then(res: any, rej: any) {
      return runOp(op, ctx)
        .then((r: any) => ({ data: r.data ?? null, error: r.error ?? null, count: r.count ?? null }))
        .catch((e: Error) => ({ data: null, error: { message: e.message }, count: null }))
        .then(res, rej);
    },
  };
  const ops = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is", "contains", "match", "or"];
  for (const name of ops) {
    builder[name] = (c: string, v?: any) => {
      if (name === "or") op.filters.push({ op: "or", col: "", val: c });
      else if (name === "match") op.filters.push({ op: "match", col: "", val: c });
      else op.filters.push({ op: name, col: c, val: v });
      return builder;
    };
  }
  builder.not = (c: string, inner: string, v: any) => { op.filters.push({ op: "not", col: c, val: v, inner }); return builder; };
  builder.filter = (c: string, o: string, v: any) => { op.filters.push({ op: o as any, col: c, val: v }); return builder; };
  return builder;
}

/**
 * Redirects `client.from(...)` on an existing service-role Supabase client to
 * MongoDB, leaving auth / storage / functions untouched.
 */
export function attachMongo<T extends { from: (t: string) => any }>(client: T): T {
  (client as any).from = (collection: string) =>
    mongoFrom(collection, { userId: null, isAdmin: true, serviceRole: true });
  return client;
}
