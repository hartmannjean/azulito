/**
 * Mês em que uma transação conta nas somas (AAAA-MM). Fragmento SQL para
 * queries que tenham `transactions t join accounts a on a.id = t.account_id`.
 *
 * 1. `t.reference_month`: correção manual do usuário.
 * 2. Compra no cartão com ciclo conhecido: mês do VENCIMENTO da fatura em que
 *    ela cai — é nesse mês que o dinheiro sai da conta. A fatura cobre
 *    [fechamento anterior, fechamento); compra no dia do fechamento ou depois
 *    vai para a fatura seguinte (+1 mês) e, se o vencimento é um dia que vem
 *    antes do fechamento no calendário, a fatura vence no mês depois (+1).
 * 3. Demais casos (conta corrente, cartão sem ciclo): mês da data.
 *
 * Só usa colunas e literais nossos, nunca input do cliente.
 */
export const EFFECTIVE_MONTH = `coalesce(t.reference_month,
  case when a.kind = 'credit_card' and a.closing_day is not null and a.due_day is not null
    then strftime('%Y-%m', substr(t.transaction_date, 1, 7) || '-01',
      '+' || ((cast(substr(t.transaction_date, 9, 2) as integer) >= a.closing_day) + (a.due_day <= a.closing_day)) || ' months')
    else substr(t.transaction_date, 1, 7)
  end)`;

/** O OFX do cartão não traz o vencimento; estima fechamento + 7 dias (o usuário pode editar). */
export function defaultDueDay(closingDay: number): number {
  return ((closingDay + 6) % 28) + 1;
}
