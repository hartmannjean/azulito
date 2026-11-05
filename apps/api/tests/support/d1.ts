import { DatabaseSync } from "node:sqlite";

type Row = Record<string, unknown>;

function normalize(value: unknown): string | number | bigint | null | Uint8Array {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  return value as string | number | bigint | Uint8Array;
}

/**
 * Imita o contrato do D1 que a api usa (`prepare().bind().all/first/run` e
 * `batch`) sobre o SQLite do Node. O motor é o mesmo (SQLite), então as
 * queries e as migrations reais rodam como no D1.
 */
export class D1Shim {
  readonly sqlite: DatabaseSync;
  constructor(sqlite: DatabaseSync) {
    this.sqlite = sqlite;
  }

  prepare(sql: string) {
    return new D1Statement(this.sqlite, sql, []);
  }

  /** D1 executa o batch numa transação: tudo ou nada. */
  async batch(statements: D1Statement[]) {
    this.sqlite.exec("begin");
    try {
      const out = [];
      for (const statement of statements) out.push(await statement.all());
      this.sqlite.exec("commit");
      return out;
    } catch (error) {
      this.sqlite.exec("rollback");
      throw error;
    }
  }

  async exec(sql: string) {
    this.sqlite.exec(sql);
  }
}

export class D1Statement {
  private readonly sqlite: DatabaseSync;
  private readonly sql: string;
  private readonly params: unknown[];
  constructor(sqlite: DatabaseSync, sql: string, params: unknown[]) {
    this.sqlite = sqlite;
    this.sql = sql;
    this.params = params;
  }

  bind(...values: unknown[]) {
    return new D1Statement(this.sqlite, this.sql, values);
  }

  private run_() {
    const statement = this.sqlite.prepare(this.sql);
    const params = this.params.map(normalize);
    if (statement.columns().length > 0) {
      const results = statement.all(...params).map((row) => ({ ...(row as Row) }));
      // INSERT/UPDATE/DELETE ... RETURNING: o D1 devolve as linhas E o `changes`.
      const isWrite = /^\s*(insert|update|delete|replace)\b/i.test(this.sql);
      const changes = isWrite ? Number((this.sqlite.prepare("select changes() as c").get() as { c: number }).c) : 0;
      return { results, meta: { changes, last_row_id: null } };
    }
    const info = statement.run(...params);
    return { results: [], meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
  }

  async all() {
    return this.run_();
  }

  async first() {
    const { results } = this.run_();
    return results[0] ?? null;
  }

  async run() {
    return this.run_();
  }
}
