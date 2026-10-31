-- Troca a integração Open Finance (Pluggy) por importação de arquivos OFX.
-- Nenhum dado de produção existia nas tabelas antigas (a Pluggy nunca chegou
-- a sincronizar neste banco), então elas são recriadas em vez de migradas.
-- Sem RLS no D1: toda query filtra por `user_id` vindo do JWT do Access.

drop table transactions;
drop table bank_connections;

-- Uma conta = uma conta corrente ou um cartão identificado pelo OFX
-- (BANKID + ACCTID). Reimportar o mesmo arquivo reaproveita a linha.
create table accounts (
  id text primary key default (lower(hex(randomblob(16)))),
  user_id text not null,
  kind text not null check (kind in ('checking', 'credit_card')),
  bank_id text not null default '',
  account_id text not null,
  institution_name text not null,
  currency_code text not null default 'BRL',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (user_id, kind, bank_id, account_id)
);

create index accounts_user_id_idx on accounts (user_id);

create table imports (
  id text primary key default (lower(hex(randomblob(16)))),
  user_id text not null,
  account_id text not null references accounts (id) on delete cascade,
  file_name text,
  imported integer not null,
  duplicates integer not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index imports_account_id_idx on imports (account_id, created_at desc);

-- `fitid` é o identificador da transação dentro do banco; (account_id, fitid)
-- é a chave de idempotência — reimportar um extrato que se sobrepõe a outro
-- nunca duplica linhas. `excluded` marca o que não é receita/despesa real
-- (pagamento de fatura, aplicação/resgate): fica na lista, fora das somas.
create table transactions (
  id text primary key default (lower(hex(randomblob(16)))),
  user_id text not null,
  account_id text not null references accounts (id) on delete cascade,
  fitid text not null,
  description text not null,
  amount real not null,
  currency_code text not null default 'BRL',
  transaction_date text not null,
  category text,
  excluded integer not null default 0 check (excluded in (0, 1)),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (account_id, fitid)
);

create index transactions_user_id_date_idx on transactions (user_id, transaction_date desc);
create index transactions_account_id_idx on transactions (account_id);
