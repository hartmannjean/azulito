import { Router } from "express";
import { auditRequestSchema, type AuditResult } from "@azulito/shared";
import { generateAudit } from "../lib/audit.js";
import { cooldownActive, getInsight, saveInsight } from "../lib/insight-store.js";
import { AI_LIMIT_MESSAGE, reserveAi } from "../lib/limits.js";

export const auditRouter = Router();

function parseStored(content: string | undefined): AuditResult | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as AuditResult;
  } catch {
    return null;
  }
}

/** GET /audit — última revisão do mês feita pela IA. */
auditRouter.get("/", async (req, res) => {
  try {
    const stored = await getInsight(req.userId!, "audit");
    res.json({ audit: parseStored(stored?.content) });
  } catch (error) {
    console.error("Falha ao buscar a revisão:", error);
    res.status(500).json({ error: "Falha ao buscar a revisão." });
  }
});

/**
 * POST /audit — a IA revisa os números de um mês: verificações objetivas (em
 * código) + parecer e itens suspeitos (IA). Só exibe; não altera nenhum dado.
 */
auditRouter.post("/", async (req, res) => {
  const parsed = auditRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Mês inválido." });
  const userId = req.userId!;

  try {
    const previous = await getInsight(userId, "audit");
    if (cooldownActive(previous)) {
      return res.status(429).json({ error: "Aguarde alguns segundos para gerar outra revisão." });
    }
    const ai = await reserveAi(userId, "insight", 1);
    if (!ai.ok) return res.status(429).json({ error: AI_LIMIT_MESSAGE[ai.reason] });
    const audit = await generateAudit(userId, parsed.data.month);
    await saveInsight(userId, "audit", JSON.stringify(audit), "ai_audit", previous);
    res.json({ audit });
  } catch (error) {
    console.error("Falha ao revisar o mês:", error);
    res.status(500).json({ error: "Falha ao revisar o mês." });
  }
});
