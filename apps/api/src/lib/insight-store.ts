import { getDb } from "./db.js";
import { logAction, type ActionKind } from "./history.js";

// Cada geração gasta neurônios do plano gratuito do Workers AI.
const COOLDOWN_MS = 30_000;

export type StoredInsight = { content: string; created_at: string };

export async function getInsight(userId: string, kind: string): Promise<StoredInsight | null> {
  return getDb()
    .prepare("select content, created_at from ai_insights where user_id = ? and kind = ?")
    .bind(userId, kind)
    .first<StoredInsight>();
}

export function cooldownActive(previous: StoredInsight | null): boolean {
  return previous !== null && Date.now() - Date.parse(previous.created_at) < COOLDOWN_MS;
}

/** Grava a análise e registra a ação com o que havia antes, para desfazer. */
export async function saveInsight(
  userId: string,
  kind: string,
  content: string,
  action: ActionKind,
  previous: StoredInsight | null,
): Promise<StoredInsight> {
  await getDb()
    .prepare(
      `insert into ai_insights (user_id, kind, content) values (?, ?, ?)
       on conflict (user_id, kind) do update set
         content = excluded.content,
         created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(userId, kind, content)
    .run();
  await logAction(userId, action, {}, [
    { op: "insight", kind, content: previous?.content ?? null, created_at: previous?.created_at ?? null },
  ]);
  return { content, created_at: new Date().toISOString() };
}

/** Atualiza o conteúdo guardado sem mexer na data nem no histórico (ex.: dispensar uma sugestão). */
export async function rewriteInsight(userId: string, kind: string, content: string): Promise<void> {
  await getDb()
    .prepare("update ai_insights set content = ? where user_id = ? and kind = ?")
    .bind(content, userId, kind)
    .run();
}
