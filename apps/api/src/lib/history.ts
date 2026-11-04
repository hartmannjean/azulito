import { getDb } from "./db.js";

/**
 * Operações INVERSAS gravadas no log de ações. São montadas pelo servidor a
 * partir do estado anterior e nunca aceitas do cliente; mesmo assim, todo
 * statement filtra por `user_id` e as colunas de `tx_fields` passam por
 * allowlist antes de entrar no SQL.
 */
export type TxFieldRow = {
  id: string;
  category?: string | null;
  category_source?: string | null;
  reference_month?: string | null;
};

export type UndoOp =
  | { op: "tx_fields"; rows: TxFieldRow[] }
  | { op: "delete_transactions"; ids: string[] }
  | { op: "delete_import"; id: string }
  | { op: "rule"; merchant_key: string; category: string | null }
  | { op: "budget"; category: string; monthly_limit: number | null }
  | { op: "user_category"; name: string; exists: boolean }
  | { op: "card_cycle"; account_id: string; closing_day: number | null; due_day: number | null }
  | { op: "snapshot"; month: string; balance: number | null }
  | { op: "insight"; content: string | null; created_at: string | null };

export type ActionKind =
  | "category_set"
  | "reference_month"
  | "categorize"
  | "budget_set"
  | "budget_remove"
  | "category_create"
  | "category_delete"
  | "card_cycle"
  | "savings_set"
  | "savings_remove"
  | "insight"
  | "import";

const TX_COLUMNS = new Set(["category", "category_source", "reference_month"]);
const CHUNK = 50;
const KEEP_PER_USER = 100;
// Acima disso o log ficaria enorme (e o D1 limita o tamanho da linha): a ação
// continua valendo, só deixa de ter desfazer.
const MAX_UNDO_ITEMS = 3000;

export function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function statementsFor(userId: string, op: UndoOp): D1PreparedStatement[] {
  const db = getDb();
  switch (op.op) {
    case "tx_fields":
      return op.rows.map((row) => {
        const columns = Object.keys(row).filter((key) => TX_COLUMNS.has(key));
        const values = columns.map((column) => (row as Record<string, unknown>)[column] ?? null);
        const sets = columns.map((column) => `${column} = ?`).join(", ");
        return db
          .prepare(`update transactions set ${sets} where id = ? and user_id = ?`)
          .bind(...values, row.id, userId);
      });
    case "delete_transactions":
      return chunks(op.ids, CHUNK).map((ids) =>
        db
          .prepare(`delete from transactions where user_id = ? and id in (${ids.map(() => "?").join(",")})`)
          .bind(userId, ...ids),
      );
    case "delete_import":
      return [db.prepare("delete from imports where id = ? and user_id = ?").bind(op.id, userId)];
    case "rule":
      return [
        op.category === null
          ? db.prepare("delete from merchant_rules where user_id = ? and merchant_key = ?").bind(userId, op.merchant_key)
          : db
              .prepare(
                `insert into merchant_rules (user_id, merchant_key, category) values (?, ?, ?)
                 on conflict (user_id, merchant_key) do update set category = excluded.category`,
              )
              .bind(userId, op.merchant_key, op.category),
      ];
    case "budget":
      return [
        op.monthly_limit === null
          ? db.prepare("delete from budgets where user_id = ? and category = ?").bind(userId, op.category)
          : db
              .prepare(
                `insert into budgets (user_id, category, monthly_limit) values (?, ?, ?)
                 on conflict (user_id, category) do update set monthly_limit = excluded.monthly_limit`,
              )
              .bind(userId, op.category, op.monthly_limit),
      ];
    case "user_category":
      return [
        op.exists
          ? db
              .prepare("insert into user_categories (user_id, name) values (?, ?) on conflict (user_id, name) do nothing")
              .bind(userId, op.name)
          : db.prepare("delete from user_categories where user_id = ? and name = ?").bind(userId, op.name),
      ];
    case "card_cycle":
      return [
        db
          .prepare("update accounts set closing_day = ?, due_day = ? where id = ? and user_id = ?")
          .bind(op.closing_day, op.due_day, op.account_id, userId),
      ];
    case "snapshot":
      return [
        op.balance === null
          ? db.prepare("delete from savings_snapshots where user_id = ? and month = ?").bind(userId, op.month)
          : db
              .prepare(
                `insert into savings_snapshots (user_id, month, balance) values (?, ?, ?)
                 on conflict (user_id, month) do update set balance = excluded.balance`,
              )
              .bind(userId, op.month, op.balance),
      ];
    case "insight":
      return [
        op.content === null
          ? db.prepare("delete from ai_insights where user_id = ? and kind = 'savings'").bind(userId)
          : db
              .prepare(
                `insert into ai_insights (user_id, kind, content, created_at) values (?, 'savings', ?, ?)
                 on conflict (user_id, kind) do update set content = excluded.content, created_at = excluded.created_at`,
              )
              .bind(userId, op.content, op.created_at ?? new Date().toISOString()),
      ];
  }
}

/**
 * Grava a ação com o necessário para desfazê-la. Nunca derruba a ação do
 * usuário: se o log falhar, a ação já foi feita e só perde o desfazer.
 */
export async function logAction(
  userId: string,
  kind: ActionKind,
  meta: Record<string, unknown>,
  ops: UndoOp[],
): Promise<void> {
  try {
    const items = ops.reduce(
      (sum, op) => sum + ("rows" in op ? op.rows.length : "ids" in op ? op.ids.length : 1),
      0,
    );
    if (items > MAX_UNDO_ITEMS) return;

    const db = getDb();
    await db
      .prepare("insert into action_log (user_id, kind, meta, undo) values (?, ?, ?, ?)")
      .bind(userId, kind, JSON.stringify(meta), JSON.stringify(ops))
      .run();
    await db
      .prepare(
        `delete from action_log where user_id = ? and id not in (
           select id from action_log where user_id = ? order by created_at desc limit ?
         )`,
      )
      .bind(userId, userId, KEEP_PER_USER)
      .run();
  } catch (error) {
    console.error("Falha ao gravar o histórico de ações:", error);
  }
}

export type UndoResult = "ok" | "not_found" | "already_undone";

/** Desfaz uma ação do usuário (as operações inversas rodam em lotes). */
export async function undoAction(userId: string, id: string): Promise<UndoResult> {
  const db = getDb();
  const row = await db
    .prepare("select undo, undone_at from action_log where id = ? and user_id = ?")
    .bind(id, userId)
    .first<{ undo: string; undone_at: string | null }>();
  if (!row) return "not_found";
  if (row.undone_at) return "already_undone";

  // Reserva a ação antes de rodar: dois cliques seguidos não desfazem duas vezes.
  const claimed = await db
    .prepare(
      `update action_log set undone_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       where id = ? and user_id = ? and undone_at is null`,
    )
    .bind(id, userId)
    .run();
  if (claimed.meta.changes === 0) return "already_undone";

  try {
    const ops = JSON.parse(row.undo) as UndoOp[];
    const statements = ops.flatMap((op) => statementsFor(userId, op));
    for (const part of chunks(statements, CHUNK)) await db.batch(part);
    return "ok";
  } catch (error) {
    await db
      .prepare("update action_log set undone_at = null where id = ? and user_id = ?")
      .bind(id, userId)
      .run();
    throw error;
  }
}
