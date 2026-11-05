import { getDb } from "./db.js";
import { merchantKey } from "./merchant.js";
import { categorizeMerchants, type MerchantSample } from "./ai.js";
import { reserveAi } from "./limits.js";

class AiBudgetExceeded extends Error {}

const BATCH_SIZE = 50;
const MAX_AI_MERCHANTS = 40;

async function runBatches(statements: D1PreparedStatement[]): Promise<void> {
  const db = getDb();
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    await db.batch(statements.slice(i, i + BATCH_SIZE));
  }
}

/**
 * Categoriza as transações SEM categoria do usuário, em três passos:
 *
 * 1. garante `merchant_key` (transações antigas ainda não têm);
 * 2. aplica as regras do usuário (correções manuais anteriores);
 * 3. pergunta à IA pelos estabelecimentos que sobraram (até
 *    MAX_AI_MERCHANTS por chamada, para respeitar o plano gratuito).
 *
 * A IA é "melhor esforço": se falhar, as regras já aplicadas valem e o
 * restante continua sem categoria para uma próxima tentativa. Devolve
 * quantas foram categorizadas e quantas ainda faltam.
 */
export async function categorizePending(
  userId: string,
): Promise<{ categorized: number; remaining: number; changedIds: string[] }> {
  const db = getDb();

  const pending = await db
    .prepare("select id, description, amount, merchant_key from transactions where user_id = ? and category is null limit 2000")
    .bind(userId)
    .all<{ id: string; description: string; amount: number; merchant_key: string | null }>();

  if (pending.results.length === 0) return { categorized: 0, remaining: 0, changedIds: [] };

  const keyById = new Map<string, string>();
  const missingKey: D1PreparedStatement[] = [];
  for (const row of pending.results) {
    const key = row.merchant_key ?? merchantKey(row.description);
    keyById.set(row.id, key);
    if (!row.merchant_key) {
      missingKey.push(
        db.prepare("update transactions set merchant_key = ? where id = ? and user_id = ?").bind(key, row.id, userId),
      );
    }
  }
  await runBatches(missingKey);

  // 2. Regras do usuário.
  const rules = await db
    .prepare("select merchant_key, category from merchant_rules where user_id = ?")
    .bind(userId)
    .all<{ merchant_key: string; category: string }>();
  const ruleByKey = new Map(rules.results.map((rule) => [rule.merchant_key, rule.category]));

  const applyRules: D1PreparedStatement[] = [];
  for (const [key, category] of ruleByKey) {
    applyRules.push(
      db
        .prepare(
          "update transactions set category = ?, category_source = 'rule' where user_id = ? and merchant_key = ? and category is null",
        )
        .bind(category, userId, key),
    );
  }
  await runBatches(applyRules);

  // 3. IA para os estabelecimentos que ainda não têm regra.
  const samples = new Map<string, MerchantSample>();
  for (const row of pending.results) {
    const key = keyById.get(row.id)!;
    if (!ruleByKey.has(key) && !samples.has(key)) {
      samples.set(key, { key, description: row.description, amount: row.amount });
    }
  }

  try {
    const picked = [...samples.values()].slice(0, MAX_AI_MERCHANTS);
    // Sem cota de IA (do usuário ou do disjuntor global), segue só com as regras:
    // o que sobrar fica sem categoria até a cota voltar.
    if (picked.length > 0 && !(await reserveAi(userId, "categorize")).ok) {
      throw new AiBudgetExceeded();
    }
    const categories = await categorizeMerchants(picked);
    const updates: D1PreparedStatement[] = [];
    for (const [key, category] of categories) {
      updates.push(
        db
          .prepare(
            "update transactions set category = ?, category_source = 'ai' where user_id = ? and merchant_key = ? and category is null",
          )
          .bind(category, userId, key),
      );
    }
    await runBatches(updates);
  } catch (error) {
    if (error instanceof AiBudgetExceeded) console.warn("Cota de IA esgotada: categorização seguiu sem IA.");
    else console.error("Falha na categorização por IA (seguindo sem ela):", error);
  }

  // Quem estava sem categoria e agora tem: é o que o desfazer precisa limpar.
  const stillNull = await db
    .prepare("select id from transactions where user_id = ? and category is null")
    .bind(userId)
    .all<{ id: string }>();
  const nullIds = new Set(stillNull.results.map((row) => row.id));
  const changedIds = pending.results.map((row) => row.id).filter((id) => !nullIds.has(id));

  return { categorized: changedIds.length, remaining: nullIds.size, changedIds };
}
