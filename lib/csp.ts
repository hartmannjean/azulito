/**
 * Content-Security-Policy montada por request (usa um nonce por requisição,
 * gerado no middleware) em vez de ficar hardcoded no next.config.js — é a
 * abordagem recomendada pelo próprio Next.js para App Router, porque permite
 * `script-src`/`style-src` restritos sem precisar de `'unsafe-inline'`.
 *
 * TODO(pluggy): `https://api.pluggy.ai` e `https://connect.pluggy.ai` abaixo
 * são um placeholder — confirmar os domínios exatos do Pluggy Connect
 * Widget (script + iframe) na documentação oficial antes de ativar a
 * integração de verdade. Sem isso confirmado, o widget simplesmente não vai
 * carregar (a CSP vai bloquear), o que é o comportamento seguro por padrão.
 */
export function buildCsp(nonce: string, supabaseUrl: string | undefined): string {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self' ${supabaseOrigin} https://api.pluggy.ai`.trim(),
    `frame-src https://connect.pluggy.ai`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];

  return directives.join("; ");
}
