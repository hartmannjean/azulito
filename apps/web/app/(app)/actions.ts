"use server";

import { revalidatePath } from "next/cache";
import {
  uploadOfx,
  updateTransactionCategory,
  categorizePendingTransactions,
  saveBudget,
  deleteBudget,
} from "@/lib/api-client";
import { isCategory } from "@azulito/shared";
import { getAccess } from "@/lib/access";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export type ImportState = { message?: string; error?: string };

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Recebe o OFX enviado pelo `ImportOfxButton` (Client Component). Roda no
 * servidor da apps/web: lê o JWT do Cloudflare Access do request (verificado
 * em `getAccess`) e repassa os bytes do arquivo à apps/api — que é quem
 * valida o conteúdo de verdade. As checagens daqui (tipo/tamanho) só evitam
 * mandar lixo óbvio pela rede.
 */
export async function importOfx(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const dict = getDictionary(await getLocale());

  const access = await getAccess();
  if (!access) {
    return { error: dict.auth.errors.notAuthenticated };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: dict.dashboard.importErrors.missingFile };
  }
  if (!/\.(ofx|qfx)$/i.test(file.name)) {
    return { error: dict.dashboard.importErrors.invalidType };
  }
  if (file.size > MAX_BYTES) {
    return { error: dict.dashboard.importErrors.tooLarge };
  }

  try {
    const result = await uploadOfx(access.jwt, await file.arrayBuffer(), file.name);
    revalidatePath("/", "layout");
    return { message: dict.dashboard.importResult(result.imported, result.duplicates) };
  } catch (error) {
    console.error("Falha ao importar OFX:", error);
    return { error: dict.dashboard.importErrors.failed };
  }
}

/** Altera a categoria de uma transação (vira regra para o mesmo estabelecimento). */
export async function setCategory(id: string, category: string): Promise<{ ok: boolean }> {
  const access = await getAccess();
  if (!access || !isCategory(category) || id.length === 0 || id.length > 64) return { ok: false };
  try {
    await updateTransactionCategory(access.jwt, id, category);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    console.error("Falha ao alterar categoria:", error);
    return { ok: false };
  }
}

export type CategorizeState = { message?: string; error?: string };

/** Categoriza (regras + IA) as transações ainda sem categoria. */
export async function runCategorize(): Promise<CategorizeState> {
  const dict = getDictionary(await getLocale());
  const access = await getAccess();
  if (!access) return { error: dict.auth.errors.notAuthenticated };

  try {
    const result = await categorizePendingTransactions(access.jwt);
    revalidatePath("/", "layout");
    return { message: dict.accountsPage.aiResult(result.categorized, result.remaining) };
  } catch (error) {
    console.error("Falha ao categorizar:", error);
    return { error: dict.accountsPage.aiFailed };
  }
}

export type BudgetState = { error?: string; saved?: boolean };

/** Cria/atualiza o limite mensal de uma categoria. */
export async function saveBudgetAction(_prev: BudgetState, formData: FormData): Promise<BudgetState> {
  const dict = getDictionary(await getLocale());
  const access = await getAccess();
  if (!access) return { error: dict.auth.errors.notAuthenticated };

  const category = String(formData.get("category") ?? "");
  const limit = Number(String(formData.get("limit") ?? "").replace(",", "."));
  if (!isCategory(category) || category === "Income" || !Number.isFinite(limit) || limit <= 0) {
    return { error: dict.budgetsPage.invalid };
  }

  try {
    await saveBudget(access.jwt, category, limit);
    revalidatePath("/", "layout");
    return { saved: true };
  } catch (error) {
    console.error("Falha ao salvar orçamento:", error);
    return { error: dict.budgetsPage.failed };
  }
}

export async function removeBudgetAction(category: string): Promise<void> {
  const access = await getAccess();
  if (!access || !isCategory(category)) return;
  try {
    await deleteBudget(access.jwt, category);
    revalidatePath("/", "layout");
  } catch (error) {
    console.error("Falha ao remover orçamento:", error);
  }
}
