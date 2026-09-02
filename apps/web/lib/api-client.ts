import "server-only";
import type { Transaction, BankConnection } from "@azulito/shared";

/**
 * Client HTTP para apps/api. Chamado SÓ do servidor da apps/web (Server
 * Components / Server Actions) — `import "server-only"` garante isso no
 * build. O access token do usuário nunca é exposto ao browser por aqui.
 */
function apiUrl(path: string): string {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    throw new Error("API_BASE_URL não configurado.");
  }
  return `${baseUrl}${path}`;
}

async function apiFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`apps/api respondeu ${response.status} em ${path}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchTransactions(accessToken: string): Promise<Transaction[]> {
  const data = await apiFetch<{ transactions: Transaction[] }>("/transactions", accessToken);
  return data.transactions;
}

export async function fetchBankConnections(accessToken: string): Promise<BankConnection[]> {
  const data = await apiFetch<{ connections: BankConnection[] }>(
    "/bank-connections",
    accessToken,
  );
  return data.connections;
}

export async function requestPluggyConnectToken(accessToken: string): Promise<string> {
  const data = await apiFetch<{ accessToken: string }>("/pluggy/connect-token", accessToken, {
    method: "POST",
  });
  return data.accessToken;
}
