import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
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
  CardComparison,
  UserSettings,
  UpsertSettingsInput,
} from "@azulito/shared";

/**
 * Client HTTP para apps/api. Chamado SÓ do servidor da apps/web (Server
 * Components / Server Actions) — `import "server-only"` garante isso no
 * build. O cookie de sessão só é repassado pelo servidor, nunca exposto ao browser.
 */
/**
 * Em produção a chamada vai por service binding (`API`), sem passar pela
 * internet pública. Sem o binding (ex: `next dev`), cai em API_BASE_URL.
 */
export async function apiRequest(path: string, init: RequestInit): Promise<Response> {
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

/** Resposta de erro da api; `status` permite tratar limites de uso (429/413) de forma amigável. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, path: string) {
    super(`apps/api respondeu ${status} em ${path}`);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, sessionCookie: string, init?: RequestInit): Promise<T> {
  const response = await apiRequest(path, {
    ...init,
    headers: {
      ...init?.headers,
      cookie: sessionCookie,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(response.status, path);
  }

  return response.json() as Promise<T>;
}

export async function fetchTransactions(sessionCookie: string, month: string): Promise<Transaction[]> {
  const data = await apiFetch<{ transactions: Transaction[] }>(
    `/transactions?month=${month}&limit=200`,
    sessionCookie,
  );
  return data.transactions;
}

export async function fetchTransactionsSummary(
  sessionCookie: string,
  month: string,
): Promise<TransactionsSummary> {
  return apiFetch<TransactionsSummary>(`/transactions/summary?month=${month}`, sessionCookie);
}

export async function fetchTransactionsCategories(
  sessionCookie: string,
  month: string,
): Promise<CategoriesSummary> {
  return apiFetch<CategoriesSummary>(`/transactions/categories?month=${month}`, sessionCookie);
}

export async function fetchTransactionsTrend(
  sessionCookie: string,
  months = 6,
): Promise<TransactionsTrend> {
  return apiFetch<TransactionsTrend>(`/transactions/trend?months=${months}`, sessionCookie);
}

export async function fetchAccounts(sessionCookie: string): Promise<Account[]> {
  const data = await apiFetch<{ accounts: Account[] }>("/accounts", sessionCookie);
  return data.accounts;
}

export async function uploadOfx(
  sessionCookie: string,
  file: ArrayBuffer,
  fileName: string,
): Promise<ImportResult> {
  return apiFetch<ImportResult>("/imports", sessionCookie, {
    method: "POST",
    body: file,
    headers: {
      "content-type": "application/octet-stream",
      "x-file-name": encodeURIComponent(fileName),
    },
  });
}

export async function fetchTransactionsPage(
  sessionCookie: string,
  params: Record<string, string | number | undefined>,
): Promise<TransactionsPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return apiFetch<TransactionsPage>(`/transactions?${query.toString()}`, sessionCookie);
}

const JSON_HEADERS = { "content-type": "application/json" };

export async function updateTransactionCategory(
  sessionCookie: string,
  id: string,
  category: string,
): Promise<void> {
  await apiFetch(`/transactions/${encodeURIComponent(id)}`, sessionCookie, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ category }),
  });
}

export async function categorizePendingTransactions(sessionCookie: string): Promise<CategorizeResult> {
  return apiFetch<CategorizeResult>("/transactions/categorize", sessionCookie, { method: "POST" });
}

export async function fetchBudgetsProgress(sessionCookie: string, month: string): Promise<BudgetsProgress> {
  return apiFetch<BudgetsProgress>(`/budgets/progress?month=${month}`, sessionCookie);
}

export async function saveBudget(sessionCookie: string, category: string, monthlyLimit: number): Promise<void> {
  await apiFetch("/budgets", sessionCookie, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ category, monthly_limit: monthlyLimit }),
  });
}

export async function deleteBudget(sessionCookie: string, category: string): Promise<void> {
  await apiFetch(`/budgets/${encodeURIComponent(category)}`, sessionCookie, { method: "DELETE" });
}

export async function fetchUserCategories(sessionCookie: string): Promise<UserCategory[]> {
  const data = await apiFetch<{ categories: UserCategory[] }>("/categories", sessionCookie);
  return data.categories;
}

export async function createUserCategory(sessionCookie: string, name: string): Promise<void> {
  await apiFetch("/categories", sessionCookie, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name }),
  });
}

export async function deleteUserCategory(sessionCookie: string, id: string): Promise<void> {
  await apiFetch(`/categories/${encodeURIComponent(id)}`, sessionCookie, { method: "DELETE" });
}

export async function fetchRecurring(sessionCookie: string): Promise<RecurringSummary> {
  return apiFetch<RecurringSummary>("/recurring", sessionCookie);
}

export async function setTransactionsReferenceMonth(
  sessionCookie: string,
  ids: string[],
  month: string | null,
): Promise<void> {
  await apiFetch("/transactions/reference-month", sessionCookie, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ ids, month }),
  });
}

export async function updateCardCycle(
  sessionCookie: string,
  accountId: string,
  closingDay: number,
  dueDay: number,
): Promise<void> {
  await apiFetch(`/accounts/${encodeURIComponent(accountId)}`, sessionCookie, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ closing_day: closingDay, due_day: dueDay }),
  });
}

export async function fetchSavings(sessionCookie: string): Promise<SavingsOverview> {
  return apiFetch<SavingsOverview>("/savings", sessionCookie);
}

export async function saveSavingsSnapshot(sessionCookie: string, month: string, balance: number): Promise<void> {
  await apiFetch("/savings", sessionCookie, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ month, balance }),
  });
}

export async function deleteSavingsSnapshot(sessionCookie: string, month: string): Promise<void> {
  await apiFetch(`/savings/${encodeURIComponent(month)}`, sessionCookie, { method: "DELETE" });
}

export async function requestSavingsInsight(sessionCookie: string): Promise<{ content: string; created_at: string }> {
  return apiFetch("/savings/insight", sessionCookie, { method: "POST" });
}

export async function fetchHistory(sessionCookie: string, limit = 30): Promise<HistoryResponse> {
  return apiFetch<HistoryResponse>(`/history?limit=${limit}`, sessionCookie);
}

export async function undoHistoryAction(sessionCookie: string, id: string): Promise<void> {
  await apiFetch(`/history/${encodeURIComponent(id)}/undo`, sessionCookie, { method: "POST" });
}

export async function renameUserCategory(sessionCookie: string, id: string, name: string): Promise<void> {
  await apiFetch(`/categories/${encodeURIComponent(id)}`, sessionCookie, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name }),
  });
}

export async function fetchBudgetSuggestions(sessionCookie: string): Promise<BudgetSuggestions> {
  return apiFetch<BudgetSuggestions>("/budgets/suggestions", sessionCookie);
}

export async function requestBudgetSuggestions(sessionCookie: string): Promise<BudgetSuggestions> {
  return apiFetch<BudgetSuggestions>("/budgets/suggestions", sessionCookie, { method: "POST" });
}

export async function dismissBudgetSuggestion(sessionCookie: string, category: string): Promise<void> {
  await apiFetch(`/budgets/suggestions/${encodeURIComponent(category)}`, sessionCookie, { method: "DELETE" });
}

export async function requestRecurringInsight(sessionCookie: string): Promise<{ content: string; created_at: string }> {
  return apiFetch("/recurring/insight", sessionCookie, { method: "POST" });
}

export async function fetchAudit(sessionCookie: string): Promise<AuditResult | null> {
  const data = await apiFetch<{ audit: AuditResult | null }>("/audit", sessionCookie);
  return data.audit;
}

export async function requestAudit(sessionCookie: string, month: string): Promise<AuditResult> {
  const data = await apiFetch<{ audit: AuditResult }>("/audit", sessionCookie, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ month }),
  });
  return data.audit;
}

export async function fetchImports(sessionCookie: string): Promise<ImportLogEntry[]> {
  const data = await apiFetch<{ imports: ImportLogEntry[] }>("/imports", sessionCookie);
  return data.imports;
}

export async function fetchImportDetails(sessionCookie: string, id: string): Promise<ImportDetails> {
  return apiFetch<ImportDetails>(`/imports/${encodeURIComponent(id)}`, sessionCookie);
}

export async function fetchForecast(sessionCookie: string): Promise<ForecastResponse> {
  return apiFetch<ForecastResponse>("/forecast", sessionCookie);
}

export async function createScheduledItem(
  sessionCookie: string,
  item: { kind: "expense" | "income"; description: string; amount: number; due_date: string; category: string | null },
): Promise<void> {
  await apiFetch("/scheduled", sessionCookie, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(item) });
}

export async function setScheduledPaid(sessionCookie: string, id: string, paid: boolean): Promise<void> {
  await apiFetch(`/scheduled/${encodeURIComponent(id)}`, sessionCookie, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ paid }),
  });
}

export async function deleteScheduledItem(sessionCookie: string, id: string): Promise<void> {
  await apiFetch(`/scheduled/${encodeURIComponent(id)}`, sessionCookie, { method: "DELETE" });
}

export async function fetchCardComparison(sessionCookie: string): Promise<CardComparison> {
  return apiFetch<CardComparison>("/card/comparison", sessionCookie);
}

export async function fetchSettings(sessionCookie: string): Promise<UserSettings> {
  const data = await apiFetch<{ settings: UserSettings }>("/settings", sessionCookie);
  return data.settings;
}

export async function saveSettings(sessionCookie: string, input: UpsertSettingsInput): Promise<UserSettings> {
  const data = await apiFetch<{ settings: UserSettings }>("/settings", sessionCookie, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
  return data.settings;
}

export async function skipSettings(sessionCookie: string): Promise<UserSettings> {
  const data = await apiFetch<{ settings: UserSettings }>("/settings/skip", sessionCookie, { method: "POST" });
  return data.settings;
}
