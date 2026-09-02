import { Router } from "express";
import { createConnectToken } from "../../lib/pluggyClient.js";

export const pluggyConnectTokenRouter = Router();

/**
 * POST /pluggy/connect-token — gera o token de uso único que o Pluggy
 * Connect Widget (rodando no browser, dentro de apps/web) precisa para abrir
 * o fluxo de conexão do Nubank. Montada com `requireAuth` em src/app.ts: só
 * um usuário logado pode pedir um token, sempre atrelado ao `req.userId` dele.
 */
pluggyConnectTokenRouter.post("/", async (req, res) => {
  try {
    const accessToken = await createConnectToken(req.userId!);
    res.json({ accessToken });
  } catch {
    res.status(502).json({ error: "Falha ao iniciar conexão com a Pluggy." });
  }
});
