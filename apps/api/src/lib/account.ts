import { getDb, getOfxBucket } from "./db.js";

const R2_DELETE_CHUNK = 1000;
const EXPORT_PAGE = 5000;

/**
 * Exclusão de conta (LGPD): apaga TUDO que é do usuário, antes de o Better Auth
 * remover o usuário em si (sessões, passkeys e contas saem por cascata).
 *
 * 1. R2 primeiro: assim não sobram arquivos órfãos. As chaves vêm de
 *    `imports.r2_key` (vale também para quem teve o user_id trocado na virada
 *    do Access, cujos arquivos continuam sob o prefixo antigo) e da listagem do
 *    prefixo `<user_id>/`. Só as chaves do próprio usuário entram: `imports` é
 *    filtrado por user_id e o prefixo é o do id vindo da sessão.
 * 2. D1 depois, num único batch (tudo ou nada).
 *
 * Se qualquer passo falhar, a exclusão da conta é abortada e pode ser
 * repetida: apagar de novo é seguro (idempotente).
 */
export async function purgeUserData(userId: string): Promise<void> {
  const db = getDb();
  const bucket = getOfxBucket();

  const keys = new Set<string>();
  const stored = await db
    .prepare("select distinct r2_key from imports where user_id = ? and r2_key is not null")
    .bind(userId)
    .all<{ r2_key: string }>();
  for (const row of stored.results) keys.add(row.r2_key);

  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: `${userId}/`, cursor });
    for (const object of page.objects) keys.add(object.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const all = [...keys];
  for (let i = 0; i < all.length; i += R2_DELETE_CHUNK) {
    await bucket.delete(all.slice(i, i + R2_DELETE_CHUNK));
  }

  // Um statement por tabela, escritos por extenso (e não montados num laço)
  // para o verificador estático de isolamento conseguir conferir o user_id.
  await db.batch([
    db.prepare("delete from action_log where user_id = ?").bind(userId),
    db.prepare("delete from ai_insights where user_id = ?").bind(userId),
    db.prepare("delete from scheduled_items where user_id = ?").bind(userId),
    db.prepare("delete from savings_snapshots where user_id = ?").bind(userId),
    db.prepare("delete from budgets where user_id = ?").bind(userId),
    db.prepare("delete from merchant_rules where user_id = ?").bind(userId),
    db.prepare("delete from user_categories where user_id = ?").bind(userId),
    db.prepare("delete from transactions where user_id = ?").bind(userId),
    db.prepare("delete from imports where user_id = ?").bind(userId),
    db.prepare("delete from accounts where user_id = ?").bind(userId),
    db.prepare("delete from usage_counters where user_id = ?").bind(userId),
  ]);
}

type Row = Record<string, unknown>;

export type UserExport = {
  exported_at: string;
  user: { id: string; email: string };
  accounts: Row[];
  imports: Row[];
  transactions: Row[];
  merchant_rules: Row[];
  budgets: Row[];
  user_categories: Row[];
  savings_snapshots: Row[];
  scheduled_items: Row[];
  ai_insights: Row[];
  action_log: Row[];
};

/**
 * Exportação dos dados do usuário (portabilidade, LGPD). Só lê com o user_id da
 * sessão. Não inclui o conteúdo bruto do histórico de desfazer (`undo`, interno
 * do app) nem as sessões e passkeys (credenciais, não dados do usuário).
 */
export async function exportUserData(userId: string, email: string): Promise<UserExport> {
  const db = getDb();
  // Cada query fica escrita por extenso (e não montada a partir de uma variável)
  // para o verificador estático de isolamento conseguir conferir o user_id.
  const rows = async (statement: D1PreparedStatement): Promise<Row[]> => (await statement.all<Row>()).results;

  const transactions: Row[] = [];
  let lastId = "";
  for (;;) {
    const { results } = await db
      .prepare("select * from transactions where user_id = ? and id > ? order by id limit ?")
      .bind(userId, lastId, EXPORT_PAGE)
      .all<Row>();
    transactions.push(...results);
    if (results.length < EXPORT_PAGE) break;
    lastId = String(results[results.length - 1]!.id);
  }

  return {
    exported_at: new Date().toISOString(),
    user: { id: userId, email },
    accounts: await rows(db.prepare("select * from accounts where user_id = ? order by id").bind(userId)),
    imports: await rows(db.prepare("select * from imports where user_id = ? order by id").bind(userId)),
    transactions,
    merchant_rules: await rows(db.prepare("select * from merchant_rules where user_id = ? order by 1, 2").bind(userId)),
    budgets: await rows(db.prepare("select * from budgets where user_id = ? order by category").bind(userId)),
    user_categories: await rows(db.prepare("select * from user_categories where user_id = ? order by name").bind(userId)),
    savings_snapshots: await rows(db.prepare("select * from savings_snapshots where user_id = ? order by month").bind(userId)),
    scheduled_items: await rows(db.prepare("select * from scheduled_items where user_id = ? order by id").bind(userId)),
    ai_insights: await rows(db.prepare("select * from ai_insights where user_id = ? order by kind").bind(userId)),
    action_log: await rows(
      db.prepare("select id, kind, meta, created_at, undone_at from action_log where user_id = ? order by id").bind(userId),
    ),
  };
}
