import { apiRequest } from "@/lib/api-client";
import { getSession } from "@/lib/session";

/**
 * Baixa a exportação dos dados do usuário. A apps/api valida a sessão e só
 * lê com o user_id dela; aqui só repassamos o arquivo como download.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });

  const upstream = await apiRequest("/account/export", { headers: { cookie: session.cookie }, cache: "no-store" });
  if (!upstream.ok) {
    return Response.json({ error: "export_failed" }, { status: upstream.status === 429 ? 429 : 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="azulito-meus-dados.json"',
      "cache-control": "no-store",
    },
  });
}
