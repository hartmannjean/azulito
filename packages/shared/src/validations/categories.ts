import { z } from "zod";
import { CATEGORIES } from "../categories.js";

/**
 * Nome de categoria criada pelo usuário. Allowlist de caracteres: letras
 * (com acento), números, espaço e pontuação simples. Sem `_`, então não colide
 * com valores reservados como "__none__" (filtro "sem categoria").
 */
export const categoryNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} .,'&()/-]*$/u, "Nome de categoria inválido.");

/** Corpo de POST /categories. */
export const createCategorySchema = z.object({ name: categoryNameSchema });

/** Nome igual (sem diferenciar maiúsculas) a uma categoria fixa ou reservada. */
export function isReservedCategoryName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return lower === "outros" || CATEGORIES.some((category) => category.toLowerCase() === lower);
}
