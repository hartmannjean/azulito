import { Router } from "express";
import { upsertSettingsSchema, type UserSettings } from "@azulito/shared";
import { getDb } from "../lib/db.js";

export const settingsRouter = Router();

type Row = {
  salary_amount: number | null;
  salary_day: number | null;
  card_closing_day: number | null;
  card_due_day: number | null;
  onboarded_at: string | null;
};

function toSettings(row: Row | null): UserSettings {
  return {
    salary_amount: row?.salary_amount ?? null,
    salary_day: row?.salary_day ?? null,
    card_closing_day: row?.card_closing_day ?? null,
    card_due_day: row?.card_due_day ?? null,
    onboarded: Boolean(row?.onboarded_at),
  };
}

async function loadSettings(userId: string): Promise<UserSettings> {
  const row = await getDb()
    .prepare(
      "select salary_amount, salary_day, card_closing_day, card_due_day, onboarded_at from user_settings where user_id = ?",
    )
    .bind(userId)
    .first<Row>();
  return toSettings(row);
}

/** GET /settings — preferências do usuário (salário e ciclo do cartão). Montada com `requireAuth`. */
settingsRouter.get("/", async (req, res) => {
  try {
    res.json({ settings: await loadSettings(req.userId!) });
  } catch (error) {
    console.error("Falha ao buscar as preferências:", error);
    res.status(500).json({ error: "Falha ao buscar as preferências." });
  }
});

/**
 * PUT /settings — salva as preferências e marca as perguntas iniciais como
 * respondidas. Os dias do cartão valem como padrão para cartões importados daqui
 * em diante e preenchem cartões já importados que ainda estejam sem ciclo; não
 * sobrescrevem um ciclo que já existe (mexer nele muda em que mês as compras
 * contam, então isso fica em Contas e importação, com desfazer).
 */
settingsRouter.put("/", async (req, res) => {
  const parsed = upsertSettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos.", issues: parsed.error.flatten() });
  const userId = req.userId!;
  const { salary_amount, salary_day, card_closing_day, card_due_day } = parsed.data;
  const amount = salary_amount === null || salary_amount === 0 ? null : Math.round(salary_amount * 100) / 100;

  try {
    const db = getDb();
    await db.batch([
      db
        .prepare(
          `insert into user_settings (user_id, salary_amount, salary_day, card_closing_day, card_due_day, onboarded_at)
           values (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
           on conflict (user_id) do update set
             salary_amount = excluded.salary_amount,
             salary_day = excluded.salary_day,
             card_closing_day = excluded.card_closing_day,
             card_due_day = excluded.card_due_day,
             onboarded_at = coalesce(user_settings.onboarded_at, excluded.onboarded_at),
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        )
        .bind(userId, amount, amount === null ? null : salary_day, card_closing_day, card_due_day),
      db
        .prepare(
          `update accounts set closing_day = ?, due_day = ?
           where user_id = ? and kind = 'credit_card' and closing_day is null and due_day is null and ? is not null`,
        )
        .bind(card_closing_day, card_due_day, userId, card_closing_day),
    ]);
    res.json({ settings: await loadSettings(userId) });
  } catch (error) {
    console.error("Falha ao salvar as preferências:", error);
    res.status(500).json({ error: "Falha ao salvar as preferências." });
  }
});

/** POST /settings/skip — pular as perguntas iniciais (não pergunta de novo no próximo acesso). */
settingsRouter.post("/skip", async (req, res) => {
  const userId = req.userId!;
  try {
    await getDb()
      .prepare(
        `insert into user_settings (user_id, onboarded_at) values (?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         on conflict (user_id) do update set onboarded_at = coalesce(user_settings.onboarded_at, excluded.onboarded_at)`,
      )
      .bind(userId)
      .run();
    res.json({ settings: await loadSettings(userId) });
  } catch (error) {
    console.error("Falha ao pular as perguntas iniciais:", error);
    res.status(500).json({ error: "Falha ao pular as perguntas iniciais." });
  }
});
