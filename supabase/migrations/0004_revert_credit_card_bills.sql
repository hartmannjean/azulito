-- Reverte 0003_credit_card_bills.sql.
--
-- A ideia (contar a fatura como despesa no mês do vencimento via um objeto
-- Bill da Pluggy) partiu de uma suposição errada sobre a causa da despesa
-- inflada. Os dados reais do usuário mostraram outra coisa: o pagamento da
-- fatura já aparece DUAS vezes — uma vez na conta corrente (categoria
-- "Transfers", descrição "Pagamento de fatura") e outra na própria conta do
-- cartão (categoria "Credit card payment", descrição "Pagamento recebido"),
-- sempre com o mesmo valor e a mesma data. O ajuste certo é simplesmente
-- excluir a categoria "Credit card payment" da soma (ver
-- apps/api/src/routes/transactions.ts) — não precisa de fatura sincronizada
-- nem de tabela nova. A tabela nunca chegou a ser usada (nenhuma linha
-- gravada) e as colunas ficaram sempre nulas, então não há dado a preservar.

drop table if exists public.credit_card_bills;

alter table public.transactions
  drop column if exists pluggy_account_id,
  drop column if exists pluggy_bill_id;
