import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ACCESS_JWT_HEADER } from "@azulito/shared";
import type {
  Transaction,
  Account,
  ImportResult,
  TransactionsSummary,
  CategoriesSummary,
  TransactionsTrend,
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
