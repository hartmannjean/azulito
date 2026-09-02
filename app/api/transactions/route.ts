import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listTransactionsQuerySchema } from "@/lib/validations/transactions";
import { apiRateLimiter, checkRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request";
import { handleCorsPreflight, withCors } from "@/lib/cors";

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

/**
 * GET /api/transactions — lista as transações do usuário autenticado.
 *
 * Autenticação: já garantida pelo middleware central (`middleware.ts`) antes
 * deste handler rodar; aqui só precisamos ler o usuário da sessão para
 * repassar ao Supabase (que aplica RLS de qualquer forma, mesmo que este
 * código tivesse um bug e esquecesse de filtrar por usuário).
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(apiRateLimiter, `transactions:${ip}`);
  if (!rateLimit.success) {
    return withCors(
      request,
      NextResponse.json(
        { error: "Muitas requisições. Tente novamente em instantes." },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = listTransactionsQuerySchema.safeParse({
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    category: searchParams.get("category") ?? undefined,
  });

  if (!parsed.success) {
    return withCors(
      request,
      NextResponse.json(
        { error: "Parâmetros inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      ),
    );
  }

  const { limit, cursor, category } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Defesa em profundidade: o middleware já deveria ter barrado isto.
    return withCors(request, NextResponse.json({ error: "Não autenticado." }, { status: 401 }));
  }

  let query = supabase
    .from("transactions")
    // RLS já restringe a linhas de `user.id`; o filtro abaixo é redundante
    // por design (defesa em profundidade) e deixa a query auto-explicativa.
    .select("id, description, amount, currency_code, transaction_date, category")
    .eq("user_id", user.id)
    .order("transaction_date", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("transaction_date", cursor);
  }
  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    return withCors(
      request,
      NextResponse.json({ error: "Falha ao buscar transações." }, { status: 500 }),
    );
  }

  return withCors(request, NextResponse.json({ transactions: data }));
}
