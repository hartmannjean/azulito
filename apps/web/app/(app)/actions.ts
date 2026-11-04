"use server";

import { revalidatePath } from "next/cache";
import {
  uploadOfx,
  updateTransactionCategory,
  categorizePendingTransactions,
  saveBudget,
  deleteBudget,
  createUserCategory,
  deleteUserCategory,
  setTransactionsReferenceMonth,
  updateCardCycle,
  saveSavingsSnapshot,
  deleteSavingsSnapshot,
  requestSavingsInsight,
} from "@/lib/api-client";
import { categoryNameSchema, isCategory, isReservedCategoryName } from "@azulito/shared";
import { getAccess } from "@/lib/access";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/** Formato válido de categoria (fixa ou própria); a apps/api confere se a própria existe. */
function isCategoryValue(value: string): boolean {
  return isCategory(value) || categoryNameSchema.safeParse(value).success;
}

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

/** Altera a categoria de uma transação (categoria fixa também vira regra para o estabelecimento). */
export async function setCategory(id: string, category: string): Promise<{ ok: boolean }> {
  const access = await getAccess();
  if (!access || !isCategoryValue(category) || id.length === 0 || id.length > 64) return { ok: false };
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
  if (!isCategoryValue(category) || category === "Income" || !Number.isFinite(limit) || limit <= 0) {
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
  if (!access || !isCategoryValue(category)) return;
  try {
    await deleteBudget(access.jwt, category);
    revalidatePath("/", "layout");
  } catch (error) {
    console.error("Falha ao remover orçamento:", error);
  }
}

export type CategoryState = { error?: string };

/** Cria uma categoria própria. */
export async function createCategoryAction(_prev: CategoryState, formData: FormData): Promise<CategoryState> {
  const dict = getDictionary(await getLocale());
  const access = await getAccess();
  if (!access) return { error: dict.auth.errors.notAuthenticated };

  const parsed = categoryNameSchema.safeParse(String(formData.get("name") ?? ""));
  if (!parsed.success || isReservedCategoryName(parsed.data)) {
    return { error: dict.categoriesPage.invalid };
  }

  try {
    await createUserCategory(access.jwt, parsed.data);
    revalidatePath("/", "layout");
    return {};
  } catch (error) {
    console.error("Falha ao criar categoria:", error);
    return { error: dict.categoriesPage.failed };
  }
}

/** Remove uma categoria própria (as transações dela ficam sem categoria). */
export async function removeCategoryAction(id: string): Promise<void> {
  const access = await getAccess();
  if (!access || !/^[0-9a-f]{32}$/.test(id)) return;
  try {
    await deleteUserCategory(access.jwt, id);
    revalidatePath("/", "layout");
  } catch (error) {
    console.error("Falha ao remover categoria:", error);
  }
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Define (ou, com `null`, volta ao automático) o mês em que uma transação conta nas somas. */
export async function setReferenceMonth(id: string, month: string | null): Promise<{ ok: boolean }> {
  const access = await getAccess();
  if (!access || id.length === 0 || id.length > 64) return { ok: false };
  if (month !== null && !MONTH_PATTERN.test(month)) return { ok: false };
  try {
    await setTransactionsReferenceMonth(access.jwt, [id], month);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    console.error("Falha ao definir mês de referência:", error);
    return { ok: false };
  }
}

export type CardCycleState = { error?: string; saved?: boolean };

/** Ajusta o dia de fechamento e o de vencimento da fatura de um cartão. */
export async function saveCardCycleAction(_prev: CardCycleState, formData: FormData): Promise<CardCycleState> {
  const dict = getDictionary(await getLocale());
  const access = await getAccess();
  if (!access) return { error: dict.auth.errors.notAuthenticated };

  const accountId = String(formData.get("account_id") ?? "");
  const closing = Number(formData.get("closing_day"));
  const due = Number(formData.get("due_day"));
  const validDay = (n: number) => Number.isInteger(n) && n >= 1 && n <= 31;
  if (!/^[0-9a-f]{32}$/.test(accountId) || !validDay(closing) || !validDay(due)) {
    return { error: dict.accountsPage.cycleInvalid };
  }

  try {
    await updateCardCycle(access.jwt, accountId, closing, due);
    revalidatePath("/", "layout");
    return { saved: true };
  } catch (error) {
    console.error("Falha ao salvar o ciclo do cartão:", error);
    return { error: dict.accountsPage.cycleFailed };
  }
}

export type SavingsState = { error?: string; saved?: boolean };

/** "1.234,56", "1234,56" e "1234.56" viram número; qualquer outra coisa vira NaN. */
function parseMoney(raw: string): number {
  const text = raw.trim().replace(/\s/g, "");
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

/** Informa o saldo das caixinhas no fim de um mês. */
export async function saveSavingsAction(_prev: SavingsState, formData: FormData): Promise<SavingsState> {
  const dict = getDictionary(await getLocale());
  const access = await getAccess();
  if (!access) return { error: dict.auth.errors.notAuthenticated };

  const month = String(formData.get("month") ?? "");
  const balance = parseMoney(String(formData.get("balance") ?? ""));
  if (!MONTH_PATTERN.test(month) || !Number.isFinite(balance) || balance < 0 || balance > 1_000_000_000) {
    return { error: dict.savingsPage.invalid };
  }

  try {
    await saveSavingsSnapshot(access.jwt, month, balance);
    revalidatePath("/", "layout");
    return { saved: true };
  } catch (error) {
    console.error("Falha ao salvar o saldo das caixinhas:", error);
    return { error: dict.savingsPage.failed };
  }
}

export async function removeSavingsAction(month: string): Promise<void> {
  const access = await getAccess();
  if (!access || !MONTH_PATTERN.test(month)) return;
  try {
    await deleteSavingsSnapshot(access.jwt, month);
    revalidatePath("/", "layout");
  } catch (error) {
    console.error("Falha ao remover o saldo das caixinhas:", error);
  }
}

/** Gera a análise da IA (onde cortar gastos); fica salva e a página recarrega com ela. */
export async function generateInsightAction(): Promise<{ ok: boolean }> {
  const access = await getAccess();
  if (!access) return { ok: false };
  try {
    await requestSavingsInsight(access.jwt);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    console.error("Falha ao gerar a análise:", error);
    return { ok: false };
  }
}
