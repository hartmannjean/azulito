import { isCategory } from "@azulito/shared";
import { getDb } from "./db.js";

/** Categoria criada por ESTE usuário (comparação sem diferenciar maiúsculas). */
export async function findUserCategory(userId: string, name: string): Promise<string | null> {
  const row = await getDb()
    .prepare("select name from user_categories where user_id = ? and name = ?")
    .bind(userId, name)
    .first<{ name: string }>();
  return row?.name ?? null;
}

/**
 * Resolve o nome recebido para o valor canônico a gravar: categoria fixa
 * (`CATEGORIES`) ou categoria própria do usuário. `null` = inválida.
 */
export async function resolveCategory(
  userId: string,
  name: string,
): Promise<{ name: string; custom: boolean } | null> {
  if (isCategory(name)) return { name, custom: false };
  const custom = await findUserCategory(userId, name);
  return custom ? { name: custom, custom: true } : null;
}
