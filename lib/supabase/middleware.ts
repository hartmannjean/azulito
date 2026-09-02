import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.some((path) => pathname === path) ||
    pathname.startsWith("/api/pluggy/webhook") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

/**
 * Refresca a sessão do Supabase Auth a cada request e bloqueia acesso a
 * páginas/rotas protegidas quando não há usuário autenticado.
 *
 * Este é o ÚNICO lugar onde a checagem de sessão para navegação/páginas deve
 * viver. Route handlers de API que precisam do usuário autenticado devem ler
 * `supabase.auth.getUser()` a partir de `lib/supabase/server.ts` dentro do
 * próprio handler (o middleware já garante que a sessão chega atualizada),
 * mas a decisão de "autenticado ou não" para navegação é centralizada aqui
 * para evitar checagens duplicadas e inconsistentes espalhadas pelo app.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANTE: getUser() valida o token com o servidor do Supabase (ao
  // contrário de getSession(), que só lê o cookie local). Nunca trocar por
  // getSession() aqui — seria confiar em um cookie que pode ter sido
  // manipulado sem validação do servidor de auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");

  if (!user && !isPublicPath(pathname)) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
