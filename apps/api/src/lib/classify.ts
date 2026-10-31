import type { OfxAccountKind } from "./ofx.js";

const CARD_BILL_PAYMENT = /pagamento\s+(de\s+)?fatura|pgto\.?\s+(de\s+)?fatura|fatura\s+(do\s+)?cart/i;
const CARD_PAYMENT_RECEIVED = /pagamento\s+(recebido|efetuado|de\s+fatura)|pgto/i;
const INVESTMENT = /\b(rdb|cdb|lci|lca|aplica[cç][aã]o|resgate)\b/i;

/**
 * Marca o que NÃO é receita/despesa real, para não inflar as somas:
 *
 * - Pagamento de fatura: aparece nos DOIS extratos (débito na conta corrente
 *   e crédito "pagamento recebido" no cartão). As compras do cartão já contam
 *   individualmente, então os dois lados do pagamento ficam de fora.
 * - Aplicação/resgate: o dinheiro só muda de lugar.
 *
 * Heurística por descrição — OFX não traz categoria. Falso positivo some das
 * somas, mas a transação continua na lista.
 */
export function isExcludedFromTotals(
  kind: OfxAccountKind,
  description: string,
  amount: number,
): boolean {
  if (INVESTMENT.test(description)) return true;
  if (kind === "checking") return CARD_BILL_PAYMENT.test(description);
  return amount > 0 && CARD_PAYMENT_RECEIVED.test(description);
}

