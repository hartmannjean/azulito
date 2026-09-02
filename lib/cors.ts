import { NextResponse, type NextRequest } from "next/server";

/**
 * CORS explícito, sem wildcard: só a origem da própria aplicação
 * (NEXT_PUBLIC_SITE_URL) pode ler a resposta destas rotas via
 * fetch/XHR cross-origin. Isso é defesa em profundidade contra um site de
 * terceiros tentando ler dados do usuário usando os cookies de sessão dele
 * (o app é same-origin, então suas próprias chamadas nunca dependem destes
 * headers — eles só afetam quem tenta chamar de FORA do domínio da app).
 */
function getAllowedOrigin(): string | null {
  return process.env.NEXT_PUBLIC_SITE_URL ?? null;
}

function buildCorsHeaders(request: NextRequest): Record<string, string> {
  const allowedOrigin = getAllowedOrigin();
  const requestOrigin = request.headers.get("origin");

  if (allowedOrigin && requestOrigin === allowedOrigin) {
    return {
      "Access-Control-Allow-Origin": allowedOrigin,
      Vary: "Origin",
    };
  }

  // Origem ausente (same-origin) ou não reconhecida: nenhum header de CORS é
  // adicionado, então o navegador bloqueia a leitura cross-origin por padrão.
  return {};
}

export function withCors(request: NextRequest, response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(buildCorsHeaders(request))) {
    response.headers.set(key, value);
  }
  return response;
}

export function handleCorsPreflight(request: NextRequest): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...buildCorsHeaders(request),
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
