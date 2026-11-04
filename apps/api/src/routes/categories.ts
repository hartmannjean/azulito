import { Router } from "express";
import { createCategorySchema, isReservedCategoryName } from "@azulito/shared";
import { getDb } from "../lib/db.js";

export const categoriesRouter = Router();

const MAX_CATEGORIES_PER_USER = 50;

/** GET /categories — categorias criadas pelo usuário (as fixas vêm de CATEGORIES). */
categoriesRouter.get("/", async (req, res) => {
  try {
    const { results } = await getDb()
      .prepare("select id, name from user_categories where user_id = ? order by name")
      .bind(req.userId!)
      .all<{ id: string; name: string }>();
    res.json({ categories: results });
  } catch (error) {
    console.error("Falha ao buscar categorias:", error);
    res.status(500).json({ error: "Falha ao buscar categorias." });
  }
});

/** POST /categories — cria uma categoria própria. */
categoriesRouter.post("/", async (req, res) => {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success || isReservedCategoryName(parsed.data.name)) {
    return res.status(400).json({ error: "Nome de categoria inválido." });
  }
  const { name } = parsed.data;
  const userId = req.userId!;
  const db = getDb();

  try {
    const count = await db
      .prepare("select count(*) as n from user_categories where user_id = ?")
      .bind(userId)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= MAX_CATEGORIES_PER_USER) {
      return res.status(400).json({ error: "Limite de categorias atingido." });
    }

    const created = await db
      .prepare(
        `insert into user_categories (user_id, name) values (?, ?)
         on conflict (user_id, name) do nothing
         returning id, name`,
      )
      .bind(userId, name)
      .first<{ id: string; name: string }>();
    if (!created) return res.status(409).json({ error: "Essa categoria já existe." });

    res.status(201).json(created);
  } catch (error) {
    console.error("Falha ao criar categoria:", error);
    res.status(500).json({ error: "Falha ao criar categoria." });
  }
});

/**
 * DELETE /categories/:id — remove uma categoria própria. As transações dela
 * voltam a ficar sem categoria, e o orçamento e as regras dela são apagados
 * (todos guardam o nome, não o id).
 */
categoriesRouter.delete("/:id", async (req, res) => {
  const userId = req.userId!;
  const db = getDb();

  try {
    const row = await db
      .prepare("select name from user_categories where id = ? and user_id = ?")
      .bind(req.params.id, userId)
      .first<{ name: string }>();
    if (!row) return res.status(404).json({ error: "Categoria não encontrada." });

    await db.batch([
      db
        .prepare(
          "update transactions set category = null, category_source = null where user_id = ? and category = ?",
        )
        .bind(userId, row.name),
      db.prepare("delete from budgets where user_id = ? and category = ?").bind(userId, row.name),
      db.prepare("delete from merchant_rules where user_id = ? and category = ?").bind(userId, row.name),
      db.prepare("delete from user_categories where id = ? and user_id = ?").bind(req.params.id, userId),
    ]);

    res.json({ ok: true });
  } catch (error) {
    console.error("Falha ao remover categoria:", error);
    res.status(500).json({ error: "Falha ao remover categoria." });
  }
});
