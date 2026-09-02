/** @type {import('next').NextConfig} */
const nextConfig = {
  // O Next 16 gera AGENTS.md/CLAUDE.md automaticamente em `next dev`. Este
  // projeto já tem seu próprio CLAUDE.md (gitignored, gerenciado à parte) —
  // desligado para não conflitar nem poluir o repo público.
  agentRules: false,
  // A CSP é montada por request no middleware (precisa de um nonce único por
  // request) — ver middleware.ts e lib/csp.ts. Os headers abaixo não
  // dependem de nonce, então ficam aqui, aplicados a toda resposta.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
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
