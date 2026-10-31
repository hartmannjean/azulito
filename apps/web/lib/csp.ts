/**
 * Content-Security-Policy montada por request (nonce único, gerado no
 * middleware) — abordagem recomendada pelo Next.js para App Router, permite
 * `script-src`/`style-src` restritos sem `'unsafe-inline'`.
 *
 * O browser NUNCA fala diretamente com apps/api neste app — toda chamada de
 * dados passa por Server Components/Server Actions (rodam no servidor da
 * própria apps/web, fora do escopo da CSP). Por isso `connect-src` fica
 * restrito a 'self'.
 *
 * `style-src-elem` (não `style-src` genérico) mantém as tags `<style>`/`<link>`
 * exigindo o nonce, enquanto `style-src-attr 'unsafe-inline'` permite os
 * atributos `style="..."` que o React renderiza (barras de gráfico, etc.) —
 * quando os dois estão presentes, `style-src` deixa de valer como fallback
 * para qualquer um deles.
 */
export function buildCsp(nonce: string): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src-elem 'self' 'nonce-${nonce}'`,
    `style-src-attr 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `frame-src 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];

  return directives.join("; ");
}
