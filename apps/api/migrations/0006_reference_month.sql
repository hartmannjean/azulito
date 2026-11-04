-- Mês de referência: a qual mês uma transação "pertence" nas somas.
-- Por padrão é o mês da data (conta corrente) ou o mês de VENCIMENTO da fatura
-- (cartão); `transactions.reference_month` (AAAA-MM) é a correção manual do
-- usuário, por exemplo "este salário paga as contas do mês seguinte".
-- `closing_day`/`due_day` ficam no cartão: o fechamento vem do DTEND do OFX da
-- fatura (preenchido na importação) e o vencimento é estimado — o OFX do
-- cartão não informa o vencimento — e pode ser editado.
alter table accounts add column closing_day integer check (closing_day between 1 and 31);
alter table accounts add column due_day integer check (due_day between 1 and 31);
alter table transactions add column reference_month text
  check (reference_month is null or reference_month glob '[0-9][0-9][0-9][0-9]-[01][0-9]');

create index transactions_reference_month_idx on transactions (user_id, reference_month);
