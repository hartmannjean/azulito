-- Contas a pagar e a receber lançadas à mão (boletos que ainda não foram
-- pagos, entradas previstas). O OFX só traz o que já aconteceu, então o que
-- ainda vai acontecer precisa ser cadastrado. Quando o pagamento aparece numa
-- importação, a previsão reconhece (mesmo valor, perto do vencimento) e para
-- de contar o item como pendente; `paid` é a marcação manual.
create table scheduled_items (
  id text primary key default (lower(hex(randomblob(16)))),
  user_id text not null,
  kind text not null check (kind in ('expense', 'income')),
  description text not null check (length(description) between 1 and 80),
  amount real not null check (amount > 0),
  due_date text not null check (due_date glob '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'),
  category text,
  paid integer not null default 0 check (paid in (0, 1)),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index scheduled_items_user_due_idx on scheduled_items (user_id, due_date);
