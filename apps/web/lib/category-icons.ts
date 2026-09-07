/**
 * Ícone (emoji) por palavra-chave de categoria. Cobre tanto os nomes em
 * português quanto a taxonomia padrão da Pluggy (que vem em inglês, ex.
 * "Loans and financing", "Shopping") — só cosmético, nunca usado pra lógica
 * de negócio, então um "miss" (categoria não mapeada) é inofensivo e cai no
 * fallback.
 */
const CATEGORY_ICONS: Array<[RegExp, string]> = [
  [/mercado|supermercado|feira|hortifruti|grocer/i, "🛒"],
  [/aliment|restaurante|lanch|ifood|delivery|bar\b|food|drink|dining/i, "🍔"],
  [/transporte|uber|99|combust|estacionamento|pedágio|passagem|transport|fuel|parking/i, "🚗"],
  [/moradia|aluguel|condom[íi]nio|casa|energia|luz|água|internet|housing|home|utilit/i, "🏠"],
  [/sa[úu]de|farm[áa]cia|hospital|plano de sa[úu]de|m[ée]dico|health|pharmacy|medical/i, "💊"],
  [/lazer|cinema|entretenimento|jogo|show|entertainment|leisure|game/i, "🎬"],
  [/educa[çc][ãa]o|curso|escola|faculdade|livro|education|school|tuition/i, "📚"],
  [/assinatura|streaming|netflix|spotify|subscription/i, "📺"],
  [/sal[áa]rio|receita|renda|pagamento recebido|income|salary|payroll/i, "💰"],
  [/compra|vestu[áa]rio|roupa|loja|shopping|clothing|retail/i, "🛍️"],
  [/viagem|hotel|passagem a[ée]rea|travel|flight/i, "✈️"],
  [/investimento|aplica[çc][ãa]o|resgate|investment/i, "📈"],
  [/fatura|cart[ãa]o de cr[ée]dito|credit card|bill\b/i, "💳"],
  [/empr[ée]stimo|financiamento|loan|financing|credit/i, "🏦"],
  [/imposto|taxa|tarifa banc[áa]ria|tax|fee\b/i, "🧾"],
  [/transfer[êe]ncia|pix|ted|doc\b|transfer/i, "🔁"],
  [/servi[çc]o|service/i, "🔧"],
];

export function getCategoryIcon(category: string | null | undefined): string | null {
  if (!category) return null;
  const match = CATEGORY_ICONS.find(([pattern]) => pattern.test(category));
  return match ? match[1] : "🏷️";
}
