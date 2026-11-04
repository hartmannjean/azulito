import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ACCESS_JWT_HEADER } from "@azulito/shared";
import type {
  Transaction,
  Account,
  ImportResult,
  TransactionsPage,
  CategorizeResult,
  BudgetsProgress,
  RecurringSummary,
  TransactionsSummary,
  CategoriesSummary,
  TransactionsTrend,
  UserCategory,
  SavingsOverview,
  HistoryResponse,
  BudgetSuggestions,
  AuditResult,
  ImportLogEntry,
  ImportDetails,
  ForecastResponse,
} from "@azulito/shared";

/**
 * Client HTTP para apps/api. Chamado SÓ do servidor da apps/web (Server
 * Components / Server Actions) — `import "server-only"` garante isso no
 * build. O JWT do Access nunca é exposto ao browser por aqui.
 */
/**
 * Em produção a chamada vai por service binding (`API`), sem passar pela
 * internet pública. Sem o binding (ex: `next dev`), cai em API_BASE_URL.
 */
async function apiRequest(path: string, init: RequestInit): Promise<Response> {
  try {
    const { env } = getCloudflareContext();
    const api = (env as { API?: { fetch: typeof fetch } }).API;
    if (api) {
      return await api.fetch(`https://api.internal${path}`, init);
    }
  } catch {
    // Fora do runtime da Cloudflare: usa API_BASE_URL.
  }

  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    throw new Error("API_BASE_URL não configurado.");
  }
  return fetch(`${baseUrl}${path}`, init);
}

async function apiFetch<T>(path: string, accessJwt: string, init?: RequestInit): Promise<T> {
  const response = await apiRequest(path, {
    ...init,
    headers: {
      ...init?.headers,
      [ACCESS_JWT_HEADER]: accessJwt,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`apps/api respondeu ${response.status} em ${path}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchTransactions(accessJwt: string, month: string): Promise<Transaction[]> {
  const data = await apiFetch<{ transactions: Transaction[] }>(
    `/transactions?month=${month}&limit=200`,
    accessJwt,
  );
  return data.transactions;
}

export async function fetchTransactionsSummary(
  accessJwt: string,
  month: string,
): Promise<TransactionsSummary> {
  return apiFetch<TransactionsSummary>(`/transactions/summary?month=${month}`, accessJwt);
}

export async function fetchTransactionsCategories(
  accessJwt: string,
  month: string,
): Promise<CategoriesSummary> {
  return apiFetch<CategoriesSummary>(`/transactions/categories?month=${month}`, accessJwt);
}

export async function fetchTransactionsTrend(
  accessJwt: string,
  months = 6,
): Promise<TransactionsTrend> {
  return apiFetch<TransactionsTrend>(`/transactions/trend?months=${months}`, accessJwt);
}

export async function fetchAccounts(accessJwt: string): Promise<Account[]> {
  const data = await apiFetch<{ accounts: Account[] }>("/accounts", accessJwt);
  return data.accounts;
}

export async function uploadOfx(
  accessJwt: string,
  file: ArrayBuffer,
  fileName: string,
): Promise<ImportResult> {
  return apiFetch<ImportResult>("/imports", accessJwt, {
    method: "POST",
    body: file,
    headers: {
      "content-type": "application/octet-stream",
      "x-file-name": encodeURIComponent(fileName),
    },
  });
}

export async function fetchTransactionsPage(
  accessJwt: string,
  params: Record<string, string | number | undefined>,
): Promise<TransactionsPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return apiFetch<TransactionsPage>(`/transactions?${query.toString()}`, accessJwt);
}

const JSON_HEADERS = { "content-type": "application/json" };

export async function updateTransactionCategory(
  accessJwt: string,
  id: string,
  category: string,
): Promise<void> {
  await apiFetch(`/transactions/${encodeURIComponent(id)}`, accessJwt, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ category }),
  });
}

export async function categorizePendingTransactions(accessJwt: string): Promise<CategorizeResult> {
  return apiFetch<CategorizeResult>("/transactions/categorize", accessJwt, { method: "POST" });
}

export async function fetchBudgetsProgress(accessJwt: string, month: string): Promise<BudgetsProgress> {
  return apiFetch<BudgetsProgress>(`/budgets/progress?month=${month}`, accessJwt);
}

export async function saveBudget(accessJwt: string, category: string, monthlyLimit: number): Promise<void> {
  await apiFetch("/budgets", accessJwt, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ category, monthly_limit: monthlyLimit }),
  });
}

export async function deleteBudget(accessJwt: string, category: string): Promise<void> {
  await apiFetch(`/budgets/${encodeURIComponent(category)}`, accessJwt, { method: "DELETE" });
}

export async function fetchUserCategories(accessJwt: string): Promise<UserCategory[]> {
  const data = await apiFetch<{ categories: UserCategory[] }>("/categories", accessJwt);
  return data.categories;
}

export async function createUserCategory(accessJwt: string, name: string): Promise<void> {
  await apiFetch("/categories", accessJwt, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name }),
  });
}

export async function deleteUserCategory(accessJwt: string, id: string): Promise<void> {
  await apiFetch(`/categories/${encodeURIComponent(id)}`, accessJwt, { method: "DELETE" });
}

export async function fetchRecurring(accessJwt: string): Promise<RecurringSummary> {
  return apiFetch<RecurringSummary>("/recurring", accessJwt);
}

export async function setTransactionsReferenceMonth(
  accessJwt: string,
  ids: string[],
  month: string | null,
): Promise<void> {
  await apiFetch("/transactions/reference-month", accessJwt, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ ids, month }),
  });
}

export async function updateCardCycle(
  accessJwt: string,
  accountId: string,
  closingDay: number,
  dueDay: number,
): Promise<void> {
  await apiFetch(`/accounts/${encodeURIComponent(accountId)}`, accessJwt, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ closing_day: closingDay, due_day: dueDay }),
  });
}

export async function fetchSavings(accessJwt: string): Promise<SavingsOverview> {
  return apiFetch<SavingsOverview>("/savings", accessJwt);
}

export async function saveSavingsSnapshot(accessJwt: string, month: string, balance: number): Promise<void> {
  await apiFetch("/savings", accessJwt, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ month, balance }),
  });
}

export async function deleteSavingsSnapshot(accessJwt: string, month: string): Promise<void> {
  await apiFetch(`/savings/${encodeURIComponent(month)}`, accessJwt, { method: "DELETE" });
}

export async function requestSavingsInsight(accessJwt: string): Promise<{ content: string; created_at: string }> {
  return apiFetch("/savings/insight", accessJwt, { method: "POST" });
}

export async function fetchHistory(accessJwt: string, limit = 30): Promise<HistoryResponse> {
  return apiFetch<HistoryResponse>(`/history?limit=${limit}`, accessJwt);
}

export async function undoHistoryAction(accessJwt: string, id: string): Promise<void> {
  await apiFetch(`/history/${encodeURIComponent(id)}/undo`, accessJwt, { method: "POST" });
}

export async function renameUserCategory(accessJwt: string, id: string, name: string): Promise<void> {
  await apiFetch(`/categories/${encodeURIComponent(id)}`, accessJwt, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name }),
  });
}

export async function fetchBudgetSuggestions(accessJwt: string): Promise<BudgetSuggestions> {
  return apiFetch<BudgetSuggestions>("/budgets/suggestions", accessJwt);
}

export async function requestBudgetSuggestions(accessJwt: string): Promise<BudgetSuggestions> {
  return apiFetch<BudgetSuggestions>("/budgets/suggestions", accessJwt, { method: "POST" });
}

export async function dismissBudgetSuggestion(accessJwt: string, category: string): Promise<void> {
  await apiFetch(`/budgets/suggestions/${encodeURIComponent(category)}`, accessJwt, { method: "DELETE" });
}

export async function requestRecurringInsight(accessJwt: string): Promise<{ content: string; created_at: string }> {
  return apiFetch("/recurring/insight", accessJwt, { method: "POST" });
}

export async function fetchAudit(accessJwt: string): Promise<AuditResult | null> {
  const data = await apiFetch<{ audit: AuditResult | null }>("/audit", accessJwt);
  return data.audit;
}

export async function requestAudit(accessJwt: string, month: string): Promise<AuditResult> {
  const data = await apiFetch<{ audit: AuditResult }>("/audit", accessJwt, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ month }),
  });
  return data.audit;
}

export async function fetchImports(accessJwt: string): Promise<ImportLogEntry[]> {
  const data = await apiFetch<{ imports: ImportLogEntry[] }>("/imports", accessJwt);
  return data.imports;
}

export async function fetchImportDetails(accessJwt: string, id: string): Promise<ImportDetails> {
  return apiFetch<ImportDetails>(`/imports/${encodeURIComponent(id)}`, accessJwt);
}

export async function fetchForecast(accessJwt: string): Promise<ForecastResponse> {
  return apiFetch<ForecastResponse>("/forecast", accessJwt);
}

export async function createScheduledItem(
  accessJwt: string,
  item: { kind: "expense" | "income"; description: string; amount: number; due_date: string; category: string | null },
): Promise<void> {
  await apiFetch("/scheduled", accessJwt, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(item) });
}

export async function setScheduledPaid(accessJwt: string, id: string, paid: boolean): Promise<void> {
  await apiFetch(`/scheduled/${encodeURIComponent(id)}`, accessJwt, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ paid }),
  });
}

export async function deleteScheduledItem(accessJwt: string, id: string): Promise<void> {
  await apiFetch(`/scheduled/${encodeURIComponent(id)}`, accessJwt, { method: "DELETE" });
}
