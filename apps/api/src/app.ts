import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";

import { requireAuth } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.js";
import { transactionsRouter } from "./routes/transactions.js";
import { accountsRouter } from "./routes/accounts.js";
import { importsRouter } from "./routes/imports.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Necessário atrás da borda da Cloudflare: sem isso, `req.ip` e
  // `x-forwarded-for` não são confiáveis para rate limiting.
  app.set("trust proxy", 1);

  app.use(
    helmet({
      // CSP é responsabilidade de quem renderiza HTML — aqui é apps/web
      // (ver apps/web/middleware.ts). Esta API só devolve JSON.
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    cors({
      origin: process.env.WEB_APP_URL,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      // Sem `credentials: true` de propósito: autenticação aqui é por Bearer
      // token no header Authorization, nunca por cookie. Não há cookie de
      // sessão pra vazar cross-origin, e CSRF clássico (que depende do
      // navegador anexar cookies automaticamente numa requisição forjada)
      // não se aplica a este modelo de auth.
    }),
  );

  app.use(express.json({ limit: "100kb" }));

  app.use(rateLimitMiddleware);

  // Daqui pra baixo, tudo passa pelo middleware CENTRAL de auth. Nenhuma
  // rota reimplementa checagem de sessão por conta própria.
  app.use("/transactions", requireAuth, transactionsRouter);
  app.use("/accounts", requireAuth, accountsRouter);
  app.use("/imports", requireAuth, importsRouter);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Handler de erro central — Express 5 encaminha rejeições de handlers
  // async pra cá automaticamente. Nunca deixar o handler default do Express
  // responder: em produção ele pode incluir stack trace no corpo da
  // resposta, o que vaza detalhes internos para quem está do outro lado.
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Erro interno." });
  };
  app.use(errorHandler);

  return app;
}
