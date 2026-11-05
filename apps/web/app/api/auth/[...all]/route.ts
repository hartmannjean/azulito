import { apiRequest } from "@/lib/api-client";
import { pickAuthCookies } from "@/lib/session";

/**
 * Proxy dos endpoints de login para a apps/api (que roda o Better Auth). Existe
 * para o cookie de sessão pertencer ao domínio do web e para a api poder ficar
 * sem domínio público.
 *
 * Mínimo privilégio: só passam os caminhos E métodos abaixo (todo o resto do
 * Better Auth, como a troca de e-mail, fica fechado até ser
 * habilitado de propósito). Só os cabeçalhos necessários seguem para a api, e
 * o IP real do cliente vai num header próprio que SOBRESCREVE qualquer valor
 * enviado pelo cliente.
 */
const ALLOWED: Record<string, RegExp> = {
  GET: /^\/(get-session|list-sessions|passkey\/(generate-authenticate-options|generate-register-options|list-user-passkeys))$/,
  POST: /^\/(email-otp\/send-verification-otp|sign-in\/email-otp|sign-out|delete-user|revoke-session|revoke-other-sessions|passkey\/(verify-authentication|verify-registration|delete-passkey|update-passkey))$/,
};

const MAX_BODY_BYTES = 16 * 1024;

async function handle(request: Request, context: { params: Promise<{ all: string[] }> }) {
  const { all } = await context.params;
  const path = `/${all.join("/")}`;
  const allowed = ALLOWED[request.method];
  if (!allowed || !allowed.test(path)) {
    return new Response(null, { status: 404 });
  }

  const headers = new Headers();
  for (const name of ["content-type", "origin", "user-agent", "x-captcha-response"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const cookie = pickAuthCookies(request.headers.get("cookie"));
  if (cookie) headers.set("cookie", cookie);
  const clientIp = request.headers.get("cf-connecting-ip");
  if (clientIp) headers.set("x-azulito-client-ip", clientIp);

  let body: ArrayBuffer | undefined;
  if (request.method === "POST") {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  }

  const search = new URL(request.url).search;
  const upstream = await apiRequest(`/api/auth${path}${search}`, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
    cache: "no-store",
  });

  const out = new Headers({ "cache-control": "no-store" });
  const contentType = upstream.headers.get("content-type");
  if (contentType) out.set("content-type", contentType);
  for (const setCookie of upstream.headers.getSetCookie()) out.append("set-cookie", setCookie);

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { handle as GET, handle as POST };
