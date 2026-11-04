import { merchantKey } from "./merchant.js";
import { round2, sanitizeText } from "./ai-facts.js";

export type CategoryTx = { date: string; amount: number; description: string };

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const CUT_FRACTION = 0.2;
const TICKET_FRACTION = 0.85;
const WEEKS_PER_MONTH = 4.3;

/**
 * Perfil de gasto de UMA categoria a partir das compras reais dos últimos
 * meses: onde (estabelecimentos), quando (dia da semana e parte do mês) e
 * quanto (ticket). As metas são calculadas aqui, em código; a IA só as
 * transforma em micro-objetivos escritos — os números do texto saem daqui.
 */
export function buildCategoryProfile(txs: CategoryTx[], monthsCount: number) {
  const purchases = txs.map((t) => ({ ...t, value: -t.amount })).filter((t) => t.value > 0);
  const total = purchases.reduce((sum, t) => sum + t.value, 0);
  const count = purchases.length;
  const months = Math.max(1, monthsCount);
  const monthlyTotal = total / months;
  const monthlyCount = count / months;
  const avgTicket = count > 0 ? total / count : 0;

  const weekday = WEEKDAYS.map((name) => ({ dia: name, compras: 0, total: 0 }));
  const parts = [
    { parte: "dias 1 a 10", total: 0 },
    { parte: "dias 11 a 20", total: 0 },
    { parte: "dias 21 a 31", total: 0 },
  ];
  const merchants = new Map<string, { nome: string; compras: number; total: number }>();

  for (const t of purchases) {
    const wd = new Date(`${t.date}T12:00:00Z`).getUTCDay();
    weekday[wd]!.compras += 1;
    weekday[wd]!.total += t.value;
    const day = Number(t.date.slice(8, 10));
    parts[day <= 10 ? 0 : day <= 20 ? 1 : 2]!.total += t.value;

    const key = merchantKey(t.description);
    const entry = merchants.get(key) ?? { nome: sanitizeText(t.description, 36), compras: 0, total: 0 };
    entry.compras += 1;
    entry.total += t.value;
    merchants.set(key, entry);
  }

  const topWeekdays = [...weekday].sort((a, b) => b.total - a.total).filter((d) => d.compras > 0).slice(0, 2);
  const topMerchants = [...merchants.values()].sort((a, b) => b.total - a.total).slice(0, 4);
  const heaviest = [...parts].sort((a, b) => b.total - a.total)[0]!;
  const biggest = [...purchases]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((t) => ({ data: t.date, valor: round2(t.value), local: sanitizeText(t.description, 36) }));
  const smallPurchases = purchases.filter((t) => t.value <= avgTicket * 0.6).length;

  const cutTarget = monthlyTotal * CUT_FRACTION;
  const purchasesCap = monthlyCount >= 3 ? Math.max(1, Math.round(monthlyCount * (1 - CUT_FRACTION))) : null;

  return {
    media_mensal: round2(monthlyTotal),
    compras_por_mes: Math.round(monthlyCount * 10) / 10,
    ticket_medio: round2(avgTicket),
    compras_pequenas_por_mes: Math.round((smallPurchases / months) * 10) / 10,
    principais_locais: topMerchants.map((m) => ({
      local: m.nome,
      compras_por_mes: Math.round((m.compras / months) * 10) / 10,
      gasto_por_mes: round2(m.total / months),
    })),
    dias_da_semana_que_mais_gastam: topWeekdays.map((d) => ({
      dia: d.dia,
      compras_por_mes: Math.round((d.compras / months) * 10) / 10,
      gasto_por_mes: round2(d.total / months),
    })),
    parte_do_mes_que_mais_gasta: {
      parte: heaviest.parte,
      gasto_por_mes: round2(heaviest.total / months),
    },
    maiores_compras: biggest,
    metas: {
      economia_mensal: round2(cutTarget),
      economia_semanal: round2(cutTarget / WEEKS_PER_MONTH),
      limite_semanal: round2((monthlyTotal - cutTarget) / WEEKS_PER_MONTH),
      limite_de_compras_por_mes: purchasesCap,
      valor_maximo_por_compra: round2(avgTicket * TICKET_FRACTION),
    },
  };
}

export type CategoryProfile = ReturnType<typeof buildCategoryProfile>;
