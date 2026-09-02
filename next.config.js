/** @type {import('next').NextConfig} */
const nextConfig = {
  // A Content-Security-Policy é montada por request no middleware (precisa
  // de um nonce único por request) — ver middleware.ts e lib/csp.ts. Os
  // headers abaixo não dependem de nonce, então ficam aqui, aplicados a
  // toda resposta de forma estática.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Cinturão extra contra clickjacking; a CSP (frame-ancestors
          // 'none') já cobre isso em navegadores modernos, mas manter
          // ambos é a recomendação padrão para navegadores mais antigos.
          { key: "X-Frame-Options", value: "DENY" },
          // Impede que o navegador tente "adivinhar" o content-type de uma
          // resposta (MIME sniffing), que pode ser vetor de XSS.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Nunca vaza a URL completa (com paths/queries) como referrer em
          // navegação cross-origin.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Força HTTPS por 2 anos, incluindo subdomínios, e permite listar
          // no preload list dos navegadores.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // App pessoal: nenhuma dessas APIs de browser é usada. Negar tudo
          // por padrão reduz a superfície de ataque de qualquer script que
          // eventualmente rode na página.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
