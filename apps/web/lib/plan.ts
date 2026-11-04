import type { SavingsPlan } from "@azulito/shared";

/** O conteúdo salvo é JSON (plano com seções); análises antigas eram texto puro. */
export function parseSavingsPlan(content: string): SavingsPlan {
  try {
    const parsed = JSON.parse(content) as Partial<SavingsPlan>;
    if (parsed && typeof parsed.summary === "string" && Array.isArray(parsed.sections)) {
      return {
        summary: parsed.summary,
        sections: parsed.sections
          .filter((section) => section && typeof section.text === "string" && typeof section.category === "string")
          .map((section) => ({
            category: section.category,
            average: Number(section.average) || 0,
            saving: Number(section.saving) || 0,
            text: section.text,
          })),
      };
    }
  } catch {
    // texto puro de uma versão anterior
  }
  return { summary: content, sections: [] };
}
