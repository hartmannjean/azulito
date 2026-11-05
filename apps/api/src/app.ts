import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";

import { getAuth } from "./lib/auth.js";

import { requireAuth } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.js";
import { transactionsRouter } from "./routes/transactions.js";
import { accountsRouter } from "./routes/accounts.js";
import { importsRouter } from "./routes/imports.js";
import { budgetsRouter } from "./routes/budgets.js";
import { recurringRouter } from "./routes/recurring.js";
import { categoriesRouter } from "./routes/categories.js";
import { savingsRouter } from "./routes/savings.js";
import { historyRouter } from "./routes/history.js";
import { auditRouter } from "./routes/audit.js";
import { forecastRouter, scheduledRouter } from "./routes/forecast.js";
import { cardRouter } from "./routes/card.js";
import { accountRouter } from "./routes/account.js";
import { settingsRouter } from "./routes/settings.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Sem `trust proxy` de propósito: nada aqui usa `req.ip`/`x-forwarded-for`
  // (falsificáveis). O IP vem só de headers confiáveis, ver lib/request.ts.

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
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      // Sem `credentials: true` de propósito: autenticação aqui é por Bearer
      // token no header Authorization, nunca por cookie. Não há cookie de
      // sessão pra vazar cross-origin, e CSRF clássico (que depende do
      // navegador anexar cookies automaticamente numa requisição forjada)
      // não se aplica a este modelo de auth.
    }),
  );

  app.use(rateLimitMiddleware);

  // Endpoints de login (Better Auth). Precisam vir ANTES de express.json: o
  // handler lê o corpo da requisição por conta própria. O web faz proxy de
  // /api/auth/* para cá, então o cookie de sessão pertence ao domínio do web.
  let authHandler: ReturnType<typeof toNodeHandler> | undefined;
  app.all("/api/auth/*splat", (req, res, next) => {
    try {
      authHandler ??= toNodeHandler(getAuth());
    } catch (error) {
      return next(error);
    }
    return authHandler(req, res);
  });

  app.use(express.json({ limit: "100kb" }));

  // Daqui pra baixo, tudo passa pelo middleware CENTRAL de auth. Nenhuma
  // rota reimplementa checagem de sessão por conta própria.
  // Identidade da sessão atual, para o web exibir o e-mail (a verificação
  // da sessão continua só aqui, nunca duplicada no web).
  app.get("/me", requireAuth, (req, res) => res.json({ id: req.userId, email: req.userEmail, name: req.userName }));

  app.use("/transactions", requireAuth, transactionsRouter);
  app.use("/accounts", requireAuth, accountsRouter);
  app.use("/imports", requireAuth, importsRouter);
  app.use("/budgets", requireAuth, budgetsRouter);
  app.use("/recurring", requireAuth, recurringRouter);
  app.use("/categories", requireAuth, categoriesRouter);
  app.use("/savings", requireAuth, savingsRouter);
  app.use("/history", requireAuth, historyRouter);
  app.use("/audit", requireAuth, auditRouter);
  app.use("/forecast", requireAuth, forecastRouter);
  app.use("/scheduled", requireAuth, scheduledRouter);
  app.use("/card", requireAuth, cardRouter);
  app.use("/account", requireAuth, accountRouter);
  app.use("/settings", requireAuth, settingsRouter);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Handler de erro central — Express 5 encaminha rejeições de handlers
  // async pra cá automaticamente. Nunca deixar o handler default do Express
  // responder: em produção ele pode incluir stack trace no corpo da
  // resposta, o que vaza detalhes internos para quem está do outro lado.
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    // Falhas de leitura do corpo (JSON inválido, arquivo acima do limite) já
    // trazem o 4xx correto; o resto é erro interno, sem detalhe no corpo.
    const status = typeof err?.status === "number" && err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 413) return res.status(413).json({ error: "Arquivo grande demais." });
    if (status < 500) return res.status(status).json({ error: "Requisição inválida." });
    console.error(err);
    res.status(500).json({ error: "Erro interno." });
  };
  app.use(errorHandler);

  return app;
}
