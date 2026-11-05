import { Router } from "express";
import { exportUserData } from "../lib/account.js";
import { consume, limitOf } from "../lib/limits.js";

export const accountRouter = Router();

/**
 * GET /account/export — baixa todos os dados do usuário em JSON (portabilidade).
 * Pesado (lê todas as transações), então tem limite diário por usuário.
 * Montada com `requireAuth` em src/app.ts: o user_id vem sempre da sessão.
 */
accountRouter.get("/export", async (req, res) => {
  const userId = req.userId!;
  try {
    if (!(await consume(userId, "export", 1, limitOf("EXPORTS_PER_DAY")))) {
      return res.status(429).json({ error: "Limite diário de exportações atingido. Ele reinicia às 21h (horário de Brasília)." });
    }
    const data = await exportUserData(userId, req.userEmail ?? "");
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("content-disposition", 'attachment; filename="azulito-meus-dados.json"');
    res.setHeader("cache-control", "no-store");
    res.send(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Falha ao exportar os dados:", error);
    res.status(500).json({ error: "Falha ao exportar os dados." });
  }
});
