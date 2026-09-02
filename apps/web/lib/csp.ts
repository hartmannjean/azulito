/**
 * Content-Security-Policy montada por request (nonce único, gerado no
 * middleware) — abordagem recomendada pelo Next.js para App Router, permite
 * `script-src`/`style-src` restritos sem `'unsafe-inline'`.
 *
 * O browser NUNCA fala diretamente com apps/api ou com a Pluggy neste app —
 * toda chamada de dados passa por Server Components/Server Actions (rodam no
 * servidor da própria apps/web, fora do escopo da CSP). Por isso `connect-src`
 * fica restrito a 'self' + Supabase (usado pela metade "browser" do client
 * SSR, hoje inerte, mas parte do padrão oficial).
 *
 * TODO(pluggy): quando o Pluggy Connect Widget for carregado de verdade
 * (script + iframe no browser), confirmar os domínios exatos na doc oficial
 * e adicioná-los aqui a `script-src`/`frame-src`. Sem isso, o widget
 * simplesmente não carrega — comportamento seguro por padrão.
 */
export function buildCsp(nonce: string, supabaseUrl: string | undefined): string {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self' ${supabaseOrigin}`.trim(),
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];

  return directives.join("; ");
}
