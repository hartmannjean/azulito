/**
 * Content-Security-Policy montada por request (nonce único, gerado no
 * middleware) — abordagem recomendada pelo Next.js para App Router, permite
 * `script-src`/`style-src` restritos sem `'unsafe-inline'`.
 *
 * O browser NUNCA fala diretamente com apps/api neste app — toda chamada de
 * dados passa por Server Components/Server Actions (rodam no servidor da
 * própria apps/web, fora do escopo da CSP). Por isso `connect-src` fica
 * restrito a 'self' + Supabase (usado pela metade "browser" do client SSR,
 * hoje inerte, mas parte do padrão oficial).
 *
 * O Pluggy Connect Widget (react-pluggy-connect) é a única coisa que o
 * browser carrega de um domínio de terceiro: ele roda inteiramente dentro de
 * um iframe em https://connect.pluggy.ai (biblioteca `zoid`, sem `<script>`
 * externo nem `unsafe-inline`) — por isso só precisa entrar em `frame-src`,
 * não em `script-src`.
 *
 * O `zoid` (biblioteca por trás do widget) posiciona o iframe escrevendo
 * direto no atributo `style="..."` de elementos no NOSSO documento (fora do
 * iframe cross-origin) — precisa de `style-src-attr 'unsafe-inline'`. Usamos
 * `style-src-elem` (não `style-src` genérico) para as tags `<style>`/`<link>`
 * continuarem exigindo o nonce: quando `style-src-elem` E `style-src-attr`
 * estão os dois presentes, `style-src` deixa de valer como fallback para
 * qualquer um dos dois — misturar `style-src` com `style-src-attr` depende
 * de regra de fallback que nem todo navegador aplica do jeito esperado.
 */
export function buildCsp(nonce: string, supabaseUrl: string | undefined): string {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const pluggyConnectOrigin = "https://connect.pluggy.ai";

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src-elem 'self' 'nonce-${nonce}'`,
    `style-src-attr 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self' ${supabaseOrigin}`.trim(),
    `frame-src ${pluggyConnectOrigin}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];

  return directives.join("; ");
}
