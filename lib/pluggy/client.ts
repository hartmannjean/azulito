import "server-only";

/**
 * TODO(pluggy): wrapper mínimo para a API da Pluggy (Open Finance).
 *
 * Este arquivo é um PLACEHOLDER — o projeto ainda não tem credenciais reais
 * da Pluggy. A forma exata de cada endpoint (paths, payloads) deve ser
 * confirmada contra a documentação oficial atual (https://docs.pluggy.ai)
 * antes de usar em produção; o que está aqui é a estrutura esperada,
 * não uma integração testada.
 *
 * Regra inegociável: TUDO neste arquivo roda só no servidor (por isso
 * `import "server-only"` — o build quebra se algo aqui vazar para o bundle
 * do client). PLUGGY_CLIENT_SECRET nunca pode ser acessível pelo browser.
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
 * TODO(pluggy): gera um Connect Token de uso único para o widget de conexão
 * da Pluggy no client (`/api/pluggy/connect-token` chama isto). O
 * `clientUserId` deve ser o `user.id` do Supabase, para a Pluggy conseguir
 * associar o Item criado a este usuário quando o webhook chegar.
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
 * TODO(pluggy): busca as transações de uma conta (accountId) retornada pelo
 * Item conectado. Usado tanto pelo webhook (ao receber `item/updated`)
 * quanto pela rota de polling de apoio.
 */
export async function listTransactions(accountId: string, options?: { from?: string }) {
  const apiKey = await getApiKey();

  const params = new URLSearchParams({ accountId });
  if (options?.from) {
    params.set("from", options.from);
  }

  const response = await fetch(`${PLUGGY_API_BASE_URL}/transactions?${params.toString()}`, {
    headers: { "X-API-KEY": apiKey },
  });

  if (!response.ok) {
    throw new Error("Falha ao buscar transações na Pluggy.");
  }

  return response.json();
}

/**
 * TODO(pluggy): confirmar o mecanismo exato de assinatura de webhook na
 * documentação oficial (header usado, algoritmo). Estrutura assumida aqui:
 * HMAC-SHA256 do corpo cru da requisição usando PLUGGY_WEBHOOK_SECRET,
 * enviado em um header (`X-Pluggy-Signature` ou similar).
 *
 * NUNCA processar um payload de webhook sem validar a assinatura primeiro —
 * é a única forma de saber que a requisição veio mesmo da Pluggy, já que a
 * rota do webhook é pública (não passa pela checagem de sessão do
 * middleware).
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader) return false;

  const secret = process.env.PLUGGY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("PLUGGY_WEBHOOK_SECRET não configurado.");
  }

  const crypto = await import("node:crypto");
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const provided = Buffer.from(signatureHeader);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
}
