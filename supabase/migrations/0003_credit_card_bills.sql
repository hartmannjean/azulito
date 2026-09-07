-- Faturas de cartão de crédito (Bill entity da Pluggy) + colunas em
-- `transactions` pra ligar cada transação à conta/fatura de origem.
--
-- Necessário pra dois ajustes no resumo mensal: (1) excluir movimentações de
-- investimento (a pessoa só está movendo o próprio dinheiro, não é
-- receita/despesa real) e (2) contar a fatura do cartão como UMA despesa no
-- mês do vencimento (quando o dinheiro sai de verdade), em vez de cada
-- compra do cartão contar solta no mês em que foi feita — o fechamento da
-- fatura muda de data ao longo do tempo (ex: já mudou do dia 7 pro dia 4), e
-- usar `dueDate`/`totalAmount` da própria Pluggy evita cravar esse dia no
-- código.

alter table public.transactions
  add column pluggy_account_id text,
  add column pluggy_bill_id text;

-- Usado pra excluir da soma de receitas/despesas as transações de cartão já
-- representadas por uma linha em credit_card_bills.
create index transactions_pluggy_bill_id_idx
  on public.transactions (pluggy_bill_id)
  where pluggy_bill_id is not null;

create table public.credit_card_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bank_connection_id uuid not null references public.bank_connections (id) on delete cascade,
  pluggy_bill_id text not null unique,
  pluggy_account_id text not null,
  due_date date not null,
  total_amount numeric(14, 2) not null,
  currency_code text not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index credit_card_bills_user_id_idx on public.credit_card_bills (user_id);
create index credit_card_bills_user_id_due_date_idx on public.credit_card_bills (user_id, due_date);

create trigger credit_card_bills_set_updated_at
  before update on public.credit_card_bills
  for each row
  execute function public.set_updated_at();

alter table public.credit_card_bills enable row level security;

create policy "credit_card_bills_select_own"
  on public.credit_card_bills for select
  to authenticated
  using (user_id = auth.uid());

create policy "credit_card_bills_insert_own"
  on public.credit_card_bills for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "credit_card_bills_update_own"
  on public.credit_card_bills for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "credit_card_bills_delete_own"
  on public.credit_card_bills for delete
  to authenticated
  using (user_id = auth.uid());
