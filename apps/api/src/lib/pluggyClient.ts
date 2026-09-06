/**
 * TODO(pluggy): wrapper mínimo para a API da Pluggy (Open Finance).
 *
 * Este arquivo é um PLACEHOLDER — o projeto ainda não tem credenciais reais
 * da Pluggy. A forma exata de cada endpoint (paths, payloads) deve ser
 * confirmada contra a documentação oficial atual (https://docs.pluggy.ai)
 * antes de usar em produção; o que está aqui é a estrutura esperada, não
 * uma integração testada.
 *
 * Só existe dentro de apps/api de propósito: é o único lugar do monorepo com
 * acesso a PLUGGY_CLIENT_SECRET. apps/web nunca importa nada daqui.
 */

const PLUGGY_API_BASE_URL = "https://api.pluggy.ai";

function getCredentials() {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET não configurados.");
  }
  return { clientId, clientSecret };
}

// TODO(pluggy): trocar clientId/clientSecret por um API Key de curta duração
// (fluxo oficial: POST /auth). Cachear o token em memória do processo até
// próximo da expiração em vez de gerar um novo a cada chamada.
async function getApiKey(): Promise<string> {
  const { clientId, clientSecret } = getCredentials();

  const response = await fetch(`${PLUGGY_API_BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!response.ok) {
    throw new Error("Falha ao autenticar com a Pluggy.");
  }

  const data = (await response.json()) as { apiKey: string };
  return data.apiKey;
}

/**
 * Gera um Connect Token de uso único para o widget de conexão da Pluggy no
 * client. `clientUserId` é o `user.id` do Supabase — a Pluggy devolve esse
 * mesmo valor em `clientUserId` no payload do webhook `item/created`, o que
 * deixa a gente associar o Item criado ao usuário sem precisar de mais nada.
 */
export async function createConnectToken(clientUserId: string): Promise<string> {
  const apiKey = await getApiKey();

  const response = await fetch(`${PLUGGY_API_BASE_URL}/connect_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({ clientUserId }),
  });

  if (!response.ok) {
    throw new Error("Falha ao gerar o connect token da Pluggy.");
  }

  const data = (await response.json()) as { accessToken: string };
  return data.accessToken;
}

/**
 * Busca um Item pelo id — usado no webhook `item/created` pra pegar o nome
 * da instituição (`connector.name`) na hora de criar a `bank_connection`.
 */
export async function getItem(itemId: string): Promise<{ connector: { name: string } }> {
  const apiKey = await getApiKey();

  const response = await fetch(`${PLUGGY_API_BASE_URL}/items/${itemId}`, {
    headers: { "X-API-KEY": apiKey },
  });

  if (!response.ok) {
    throw new Error("Falha ao buscar o Item na Pluggy.");
  }

  return response.json() as Promise<{ connector: { name: string } }>;
}

/**
 * Lista as contas (conta corrente, poupança, cartão...) de um Item — é o
 * `accountId` de cada uma que `listTransactions` espera, não o `itemId`.
 * Usado por `syncConnectionTransactions` antes de buscar transações.
 */
export async function getAccounts(itemId: string): Promise<{ id: string }[]> {
  const apiKey = await getApiKey();

  const response = await fetch(`${PLUGGY_API_BASE_URL}/accounts?itemId=${itemId}`, {
    headers: { "X-API-KEY": apiKey },
  });

  if (!response.ok) {
    throw new Error("Falha ao buscar as contas do Item na Pluggy.");
  }

  const data = (await response.json()) as { results: { id: string }[] };
  return data.results;
}

/**
 * Busca as transações de uma conta (accountId) retornada pelo Item
 * conectado. Usado tanto pelo webhook (ao receber `item/updated`) quanto
 * pela rota de polling de apoio.
 *
 * `GET /transactions` (v1) foi descontinuado pela Pluggy — devolve 410
 * ENDPOINT_DEPRECATED. O substituto é `GET /v2/transactions`, mesmo formato
 * de resposta (`{ results: [...] }`).
 */
export async function listTransactions(accountId: string, options?: { from?: string }) {
  const apiKey = await getApiKey();

  const params = new URLSearchParams({ accountId });
  if (options?.from) {
    params.set("from", options.from);
  }

  const response = await fetch(`${PLUGGY_API_BASE_URL}/v2/transactions?${params.toString()}`, {
    headers: { "X-API-KEY": apiKey },
  });

  if (!response.ok) {
    throw new Error("Falha ao buscar transações na Pluggy.");
  }

  return response.json();
}

/**
 * A Pluggy não assina o corpo do webhook (não existe HMAC nem header de
 * assinatura — confirmado contra a documentação oficial). O mecanismo real é
 * um `headers` customizado que você define na criação da assinatura do
 * webhook (POST /webhooks, campo `headers`, "API Only" — não dá pra
 * configurar pelo dashboard) e que a Pluggy ecoa em toda notificação. Aqui só
 * comparamos esse valor com PLUGGY_WEBHOOK_SECRET.
 *
 * NUNCA processar um payload de webhook sem essa checagem — é a única forma
 * de saber que a requisição veio mesmo da Pluggy, já que a rota é pública
 * (não passa pelo `requireAuth`).
 */
export async function verifyWebhookAuth(headerValue: string | null): Promise<boolean> {
  if (!headerValue) return false;

  const secret = process.env.PLUGGY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("PLUGGY_WEBHOOK_SECRET não configurado.");
  }

  const crypto = await import("node:crypto");
  const provided = Buffer.from(headerValue);
  const expected = Buffer.from(secret);

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
}
