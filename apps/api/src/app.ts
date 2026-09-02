import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import cors from "cors";
import { requireAuth } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.js";
import { transactionsRouter } from "./routes/transactions.js";
import { bankConnectionsRouter } from "./routes/bankConnections.js";
import { pluggyConnectTokenRouter } from "./routes/pluggy/connectToken.js";
import { pluggyWebhookRouter } from "./routes/pluggy/webhook.js";
import { pluggySyncRouter } from "./routes/pluggy/sync.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Necessário atrás do proxy da Vercel: sem isso, `req.ip` e
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

  app.use(
    express.json({
      limit: "100kb",
      // Guarda o corpo cru para o webhook da Pluggy poder validar a
      // assinatura HMAC (precisa dos bytes exatos, não do objeto já parseado).
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(rateLimitMiddleware);

  // Público por natureza — autenticado por assinatura/CRON_SECRET dentro da
  // própria rota, não por sessão de usuário. Ver comentários nos handlers.
  app.use("/pluggy/webhook", pluggyWebhookRouter);
  app.use("/pluggy/sync", pluggySyncRouter);

  // Daqui pra baixo, tudo passa pelo middleware CENTRAL de auth. Nenhuma
  // rota reimplementa checagem de sessão por conta própria.
  app.use("/pluggy/connect-token", requireAuth, pluggyConnectTokenRouter);
  app.use("/transactions", requireAuth, transactionsRouter);
  app.use("/bank-connections", requireAuth, bankConnectionsRouter);

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
