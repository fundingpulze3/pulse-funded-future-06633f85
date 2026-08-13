// PostgREST-compatible query builder that compiles to a serializable "op"
// executed against MongoDB. Shared shape between the browser client and the
// server-side executor.

export type FilterOp =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
  | "like" | "ilike" | "in" | "is" | "contains" | "not" | "or" | "match";

export interface Filter {
  op: FilterOp;
  col: string;
  val: any;
  /** for `not`, the inner operator */
  inner?: string;
}

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

export interface DbResult<T = any> {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
  status?: number;
}

export type Executor = (op: QueryOp) => Promise<DbResult>;

export class QueryBuilder<T = any> implements PromiseLike<DbResult<T>> {
  private op: QueryOp;
  private exec: Executor;

  constructor(collection: string, exec: Executor) {
    this.exec = exec;
    this.op = { collection, action: "select", filters: [], order: [] };
  }

  // ---- verbs -------------------------------------------------------------
  select(sel = "*", opts?: { count?: "exact"; head?: boolean }) {
    if (this.op.action === "select") this.op.select = sel;
    else this.op.select = sel; // returning clause for mutations
    if (opts?.count) this.op.count = opts.count;
    if (opts?.head) this.op.head = true;
    return this;
  }

  insert(values: any) {
    this.op.action = "insert";
    this.op.values = values;
    return this;
  }

  update(values: any) {
    this.op.action = "update";
    this.op.values = values;
    return this;
  }

  upsert(values: any, opts?: { onConflict?: string }) {
    this.op.action = "upsert";
    this.op.values = values;
    this.op.onConflict = opts?.onConflict;
    return this;
  }

  delete() {
    this.op.action = "delete";
    return this;
  }

  // ---- filters -----------------------------------------------------------
  private add(op: FilterOp, col: string, val: any, inner?: string) {
    this.op.filters.push({ op, col, val, inner });
    return this;
  }

  eq(col: string, val: any) { return this.add("eq", col, val); }
  neq(col: string, val: any) { return this.add("neq", col, val); }
  gt(col: string, val: any) { return this.add("gt", col, val); }
  gte(col: string, val: any) { return this.add("gte", col, val); }
  lt(col: string, val: any) { return this.add("lt", col, val); }
  lte(col: string, val: any) { return this.add("lte", col, val); }
  like(col: string, val: string) { return this.add("like", col, val); }
  ilike(col: string, val: string) { return this.add("ilike", col, val); }
  in(col: string, val: any[]) { return this.add("in", col, val); }
  is(col: string, val: any) { return this.add("is", col, val); }
  contains(col: string, val: any) { return this.add("contains", col, val); }
  match(obj: Record<string, any>) { return this.add("match", "", obj); }
  not(col: string, inner: string, val: any) { return this.add("not", col, val, inner); }
  /** PostgREST `or("a.eq.1,b.eq.2")` string syntax */
  or(expr: string) { return this.add("or", "", expr); }
  filter(col: string, op: string, val: any) { return this.add(op as FilterOp, col, val); }

  // ---- modifiers ---------------------------------------------------------
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.op.order.push({ col, ascending: opts?.ascending !== false });
    return this;
  }

  limit(n: number) { this.op.limit = n; return this; }

  range(from: number, to: number) { this.op.range = { from, to }; return this; }

  single() { this.op.single = true; return this as unknown as QueryBuilder<T>; }
  maybeSingle() { this.op.maybeSingle = true; return this as unknown as QueryBuilder<T>; }
  returns<U>() { return this as unknown as QueryBuilder<U>; }
  abortSignal(_s: AbortSignal) { return this; }

  // ---- execution ---------------------------------------------------------
  toOp(): QueryOp { return this.op; }

  then<R1 = DbResult<T>, R2 = never>(
    onfulfilled?: ((v: DbResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((r: any) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.exec(this.op).then(onfulfilled as any, onrejected);
  }

  catch(onrejected: (r: any) => any) {
    return (this.exec(this.op) as Promise<DbResult<T>>).catch(onrejected);
  }
}
